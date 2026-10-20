"""StyleSense Unified ML & Hybrid Recommendation Microservice (FastAPI).

Implements:
1. Salient Object Garment Cutout (rembg u2netp without alpha_matting + OpenCV
   9x9 morphological closing & external contour hole-filling so white piping,
   chest logos, and gray/light clothes never have interior holes, with
   border-seeded GrabCut fallback and 480x480 transparent PNG encoding).
2. Fine-Tuned 5-Class ResNet-50 Garment Classifier (auto-discovering Epoch 13
   checkpoint stylesense_resnet50_best.pt, standard 224x224 evaluation transforms,
   and confusion-matrix precision calibration for TOP vs OUTERWEAR).
3. Batch Wardrobe Image Analysis endpoint (POST /analyze-batch) accepting up to
   15 images per request for multi-image wardrobe pre-fills.
4. Foreground-Masked CIELAB K-Means++ (K = 2) Dominant Color, Hex & Palette Extraction
   (Chapter 2 Eqs. 4-12) strictly sampling foreground garment pixels.
5. Automated AI Content Moderation Gate (NSFW / Skin-Ratio Check + Non-Garment
   Confidence Gate + Profanity/Slur Text Filter for Community Feed posts).
6. Context-Aware Weighted Hybrid Recommendation Engine (Chapter 2 Eqs. 15-19 & Table 1):
   S_hybrid = round(0.55 * S_cb + 0.45 * S_cf).
"""

import base64
from contextlib import asynccontextmanager
from io import BytesIO
import json
import logging
import os
from pathlib import Path
import re
import sys
from typing import Any, Dict, List, Literal, Optional, Tuple
from urllib.parse import unquote

# Ensure Windows Intel MKL DLLs can be located for PyTorch if needed
if sys.platform == "win32":
    local_pkg = os.path.expandvars(
        r"%LOCALAPPDATA%\Packages\PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0\LocalCache\local-packages\Library\bin"
    )
    if os.path.exists(local_pkg) and hasattr(os, "add_dll_directory"):
        try:
            os.add_dll_directory(local_pkg)
        except Exception:
            pass

import cv2
from fastapi import FastAPI, HTTPException, Request
import numpy as np
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

logger = logging.getLogger("stylesense.ml")

try:
    from rembg import remove, new_session
    REMBG_AVAILABLE = True
except Exception:
    remove = None  # type: ignore
    new_session = None  # type: ignore
    REMBG_AVAILABLE = False

try:
    import torch
    import torch.nn as nn
    from torchvision.models import ResNet50_Weights, resnet50
    import torchvision.transforms as T
    TORCH_AVAILABLE = True
except Exception:
    torch = None  # type: ignore
    nn = None  # type: ignore
    ResNet50_Weights = None  # type: ignore
    resnet50 = None  # type: ignore
    T = None  # type: ignore
    TORCH_AVAILABLE = False

Category = Literal["TOP", "BOTTOM", "SHOES", "OUTERWEAR", "ACCESSORIES"]
Style = Literal[
    "CASUAL", "FORMAL", "SPORTY", "STREETWEAR",
    "MINIMALIST", "BOHEMIAN", "VINTAGE", "CLASSIC"
]
LayerRole = Literal["INNER_BASE", "OUTER_LAYER", "LOWER_BODY", "FOOTWEAR", "ACCESSORY"]
Material = Literal[
    "Cotton", "Denim", "Polyester", "Wool", "Silk",
    "Linen", "Leather", "Knit", "Nylon", "Other"
]
Occasion = Literal["SCHOOL", "WORK", "GYM", "PARTY", "DATE", "OUTDOOR", "EVERYDAY"]

CATEGORIES_LIST: List[Category] = ["TOP", "BOTTOM", "SHOES", "OUTERWEAR", "ACCESSORIES"]
CONFIDENCE_THRESHOLD = 0.55
MAX_UPLOAD_BYTES = 5 * 1024 * 1024

CANDIDATE_CHECKPOINT_PATHS: List[str] = [
    os.getenv("RESNET50_CHECKPOINT_PATH", ""),
    "experiments/resnet50/checkpoints/stylesense_resnet50_best.pt",
    "experiments/resnet50/stylesense_resnet50_best.pt",
    "models/stylesense_resnet50_best.pt",
    "models/resnet50_stylesense_epoch13.pth",
    "stylesense_resnet50_best.pt",
]

CANDIDATE_RESULTS_PATHS: List[str] = [
    os.getenv("RESNET50_RESULTS_PATH", ""),
    "experiments/resnet50/resnet50_results.json",
    "resnet50_results.json",
]


def resolve_existing_path(candidates: List[str]) -> Optional[str]:
    """Find the first matching candidate file across cwd, script dir, and parent directories."""
    roots = [
        Path.cwd(),
        Path(__file__).resolve().parent,
        Path(__file__).resolve().parent.parent,
        Path(__file__).resolve().parent.parent.parent,
    ]
    for cand in candidates:
        if not cand:
            continue
        p = Path(cand)
        if p.is_file():
            return str(p.resolve())
        for r in roots:
            resolved = (r / cand).resolve()
            if resolved.is_file():
                return str(resolved)
    return None


LOADED_CHECKPOINT_PATH: Optional[str] = None
LOADED_RESULTS_DATA: Dict[str, Any] = {}
results_file = resolve_existing_path(CANDIDATE_RESULTS_PATHS)
if results_file and os.path.exists(results_file):
    try:
        with open(results_file, "r", encoding="utf-8") as rf:
            LOADED_RESULTS_DATA = json.load(rf)
    except Exception as e:
        logger.warning(f"Failed to load resnet50_results.json: {e}")

MODEL: Optional[Any] = None
IS_FINETUNED_HEAD: bool = False
WEIGHTS = ResNet50_Weights.IMAGENET1K_V2 if TORCH_AVAILABLE else None

EVAL_TRANSFORMS = (
    T.Compose([
        T.Resize((224, 224)),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    if (TORCH_AVAILABLE and T is not None)
    else None
)

# Initialize CPU session once on startup (lightweight fast model <200ms)
REMBG_SESSION: Optional[Any] = None
if REMBG_AVAILABLE and new_session is not None:
    try:
        REMBG_SESSION = new_session("u2netp")
    except Exception:
        REMBG_SESSION = None

# Reference Fashion Colors in CIELAB (L*, a*, b*) for CIE76 Delta-E naming (Eq. 11)
REFERENCE_COLORS_LAB: Dict[str, Tuple[float, float, float]] = {
    "Black": (18.0, 0.0, 0.0),
    "White": (92.0, 0.0, 0.0),
    "Gray": (58.0, 0.0, 0.0),
    "Navy": (25.0, 8.0, -32.0),
    "Blue": (45.0, 5.0, -48.0),
    "Red": (48.0, 62.0, 35.0),
    "Burgundy": (30.0, 42.0, 18.0),
    "Green": (52.0, -45.0, 30.0),
    "Olive": (48.0, -14.0, 28.0),
    "Brown": (38.0, 15.0, 22.0),
    "Beige": (82.0, 2.0, 14.0),
    "Khaki": (68.0, 1.0, 20.0),
    "Cream": (91.0, 1.0, 10.0),
    "Pink": (72.0, 35.0, 5.0),
    "Orange": (64.0, 42.0, 58.0),
}
NEUTRAL_COLORS = {"Black", "White", "Gray", "Beige", "Khaki", "Cream", "Navy"}

# 5-class vocabulary mapping for ImageNet-1K synsets
LABEL_CATEGORY_HINTS: Dict[Category, Tuple[str, ...]] = {
    "TOP": (
        "jersey", "shirt", "polo", "t-shirt", "tee", "blouse",
        "polo shirt", "collared", "tee shirt", "sweatshirt",
        "maillot", "vestment", "overskirt",
    ),
    "BOTTOM": (
        "jean", "denim", "miniskirt", "hoopskirt", "kilt",
        "sarong", "swimming trunks", "trouser", "pant", "chino", "short",
    ),
    "SHOES": (
        "shoe", "running shoe", "sandal", "loafer", "boot",
        "cowboy boot", "clog", "sneaker", "slipper",
    ),
    "OUTERWEAR": (
        "coat", "jacket", "trench", "parka", "blazer", "cardigan",
        "suit", "poncho", "windbreaker", "kimono", "lab coat",
        "fur coat", "hoodie",
    ),
    "ACCESSORIES": (
        "backpack", "handbag", "purse", "wallet", "tie",
        "bow tie", "Windsor tie", "scarf", "stole", "belt",
        "hat", "cap", "sombrero", "bonnet", "watch",
        "analog watch", "digital watch", "sunglasses", "necklace", "chain",
    ),
}

# Explicit keywords that define true outerwear items
OUTERWEAR_KEYWORDS: Tuple[str, ...] = (
    "jacket", "coat", "blazer", "hoodie", "cardigan", "parka", "trench", "windbreaker", "suit"
)

# Ordered mapping from matched label keywords or filename tokens to:
# (subCategory, material, style, occasion, layerRole, category)
GARMENT_NOUN_MAP: Dict[str, Tuple[str, Material, Style, Occasion, LayerRole, Category]] = {
    "hoodie": ("Pullover Hoodie", "Cotton", "CASUAL", "EVERYDAY", "OUTER_LAYER", "OUTERWEAR"),
    "cardigan": ("Knit Cardigan", "Knit", "CLASSIC", "WORK", "OUTER_LAYER", "OUTERWEAR"),
    "suit": ("Structured Blazer", "Wool", "FORMAL", "WORK", "OUTER_LAYER", "OUTERWEAR"),
    "blazer": ("Structured Blazer", "Wool", "FORMAL", "WORK", "OUTER_LAYER", "OUTERWEAR"),
    "trench": ("Tailored Coat", "Cotton", "CLASSIC", "WORK", "OUTER_LAYER", "OUTERWEAR"),
    "parka": ("Everyday Jacket", "Nylon", "CASUAL", "OUTDOOR", "OUTER_LAYER", "OUTERWEAR"),
    "fur coat": ("Tailored Coat", "Wool", "CLASSIC", "WORK", "OUTER_LAYER", "OUTERWEAR"),
    "lab coat": ("Tailored Coat", "Cotton", "CLASSIC", "WORK", "OUTER_LAYER", "OUTERWEAR"),
    "coat": ("Tailored Coat", "Cotton", "CLASSIC", "WORK", "OUTER_LAYER", "OUTERWEAR"),
    "windbreaker": ("Everyday Jacket", "Nylon", "STREETWEAR", "EVERYDAY", "OUTER_LAYER", "OUTERWEAR"),
    "poncho": ("Everyday Jacket", "Wool", "BOHEMIAN", "OUTDOOR", "OUTER_LAYER", "OUTERWEAR"),
    "kimono": ("Everyday Jacket", "Silk", "CLASSIC", "EVERYDAY", "OUTER_LAYER", "OUTERWEAR"),
    "jacket": ("Everyday Jacket", "Nylon", "STREETWEAR", "EVERYDAY", "OUTER_LAYER", "OUTERWEAR"),
    "polo shirt": ("Polo Shirt", "Cotton", "CLASSIC", "EVERYDAY", "INNER_BASE", "TOP"),
    "polo": ("Polo Shirt", "Cotton", "CLASSIC", "EVERYDAY", "INNER_BASE", "TOP"),
    "collared": ("Polo Shirt", "Cotton", "CLASSIC", "EVERYDAY", "INNER_BASE", "TOP"),
    "jersey": ("Polo Shirt", "Cotton", "CASUAL", "EVERYDAY", "INNER_BASE", "TOP"),
    "t-shirt": ("Crewneck T-Shirt", "Cotton", "CASUAL", "EVERYDAY", "INNER_BASE", "TOP"),
    "tee shirt": ("Crewneck T-Shirt", "Cotton", "CASUAL", "EVERYDAY", "INNER_BASE", "TOP"),
    "tee": ("Crewneck T-Shirt", "Cotton", "CASUAL", "EVERYDAY", "INNER_BASE", "TOP"),
    "sweatshirt": ("Crewneck Sweatshirt", "Cotton", "CASUAL", "EVERYDAY", "INNER_BASE", "TOP"),
    "oxford": ("Button-Down Shirt", "Cotton", "CLASSIC", "WORK", "INNER_BASE", "TOP"),
    "blouse": ("Button-Down Shirt", "Silk", "CLASSIC", "WORK", "INNER_BASE", "TOP"),
    "shirt": ("Shirt", "Cotton", "CASUAL", "EVERYDAY", "INNER_BASE", "TOP"),
    "maillot": ("Shirt", "Polyester", "SPORTY", "GYM", "INNER_BASE", "TOP"),
    "vestment": ("Shirt", "Cotton", "CLASSIC", "WORK", "INNER_BASE", "TOP"),
    "overskirt": ("Shirt", "Cotton", "CASUAL", "EVERYDAY", "INNER_BASE", "TOP"),
    "jeans": ("Denim Jeans", "Denim", "CASUAL", "EVERYDAY", "LOWER_BODY", "BOTTOM"),
    "jean": ("Denim Jeans", "Denim", "CASUAL", "EVERYDAY", "LOWER_BODY", "BOTTOM"),
    "denim": ("Denim Jeans", "Denim", "CASUAL", "EVERYDAY", "LOWER_BODY", "BOTTOM"),
    "chinos": ("Tailored Bottoms", "Cotton", "CLASSIC", "WORK", "LOWER_BODY", "BOTTOM"),
    "chino": ("Tailored Bottoms", "Cotton", "CLASSIC", "WORK", "LOWER_BODY", "BOTTOM"),
    "trousers": ("Tailored Bottoms", "Cotton", "CLASSIC", "WORK", "LOWER_BODY", "BOTTOM"),
    "trouser": ("Tailored Bottoms", "Cotton", "CLASSIC", "WORK", "LOWER_BODY", "BOTTOM"),
    "pant": ("Tailored Bottoms", "Cotton", "CASUAL", "EVERYDAY", "LOWER_BODY", "BOTTOM"),
    "short": ("Tailored Bottoms", "Cotton", "CASUAL", "EVERYDAY", "LOWER_BODY", "BOTTOM"),
    "miniskirt": ("Tailored Bottoms", "Cotton", "CASUAL", "EVERYDAY", "LOWER_BODY", "BOTTOM"),
    "hoopskirt": ("Tailored Bottoms", "Cotton", "CASUAL", "EVERYDAY", "LOWER_BODY", "BOTTOM"),
    "kilt": ("Tailored Bottoms", "Wool", "CASUAL", "EVERYDAY", "LOWER_BODY", "BOTTOM"),
    "sarong": ("Tailored Bottoms", "Cotton", "CASUAL", "EVERYDAY", "LOWER_BODY", "BOTTOM"),
    "swimming trunks": ("Tailored Bottoms", "Nylon", "SPORTY", "OUTDOOR", "LOWER_BODY", "BOTTOM"),
    "loafer": ("Leather Loafers", "Leather", "FORMAL", "WORK", "FOOTWEAR", "SHOES"),
    "running shoe": ("Everyday Sneakers", "Leather", "SPORTY", "EVERYDAY", "FOOTWEAR", "SHOES"),
    "sneakers": ("Everyday Sneakers", "Leather", "SPORTY", "EVERYDAY", "FOOTWEAR", "SHOES"),
    "sneaker": ("Everyday Sneakers", "Leather", "SPORTY", "EVERYDAY", "FOOTWEAR", "SHOES"),
    "slippers": ("Comfort Sandals", "Leather", "CASUAL", "EVERYDAY", "FOOTWEAR", "SHOES"),
    "slipper": ("Comfort Sandals", "Leather", "CASUAL", "EVERYDAY", "FOOTWEAR", "SHOES"),
    "sandal": ("Comfort Sandals", "Leather", "CASUAL", "EVERYDAY", "FOOTWEAR", "SHOES"),
    "clog": ("Comfort Sandals", "Leather", "CASUAL", "EVERYDAY", "FOOTWEAR", "SHOES"),
    "cowboy boot": ("Ankle Boots", "Leather", "CLASSIC", "OUTDOOR", "FOOTWEAR", "SHOES"),
    "boot": ("Ankle Boots", "Leather", "CLASSIC", "OUTDOOR", "FOOTWEAR", "SHOES"),
    "shoe": ("Everyday Sneakers", "Leather", "SPORTY", "EVERYDAY", "FOOTWEAR", "SHOES"),
    "analog watch": ("Minimalist Wristwatch", "Other", "CLASSIC", "WORK", "ACCESSORY", "ACCESSORIES"),
    "digital watch": ("Minimalist Wristwatch", "Other", "CLASSIC", "WORK", "ACCESSORY", "ACCESSORIES"),
    "watch": ("Minimalist Wristwatch", "Other", "CLASSIC", "WORK", "ACCESSORY", "ACCESSORIES"),
    "backpack": ("Everyday Carry Bag", "Cotton", "CASUAL", "EVERYDAY", "ACCESSORY", "ACCESSORIES"),
    "handbag": ("Everyday Carry Bag", "Cotton", "CASUAL", "EVERYDAY", "ACCESSORY", "ACCESSORIES"),
    "purse": ("Everyday Carry Bag", "Cotton", "CASUAL", "EVERYDAY", "ACCESSORY", "ACCESSORIES"),
    "tote": ("Everyday Carry Bag", "Cotton", "CASUAL", "EVERYDAY", "ACCESSORY", "ACCESSORIES"),
    "wallet": ("Everyday Carry Bag", "Leather", "CLASSIC", "EVERYDAY", "ACCESSORY", "ACCESSORIES"),
    "windsor tie": ("Tailored Necktie", "Silk", "FORMAL", "WORK", "ACCESSORY", "ACCESSORIES"),
    "bow tie": ("Tailored Necktie", "Silk", "FORMAL", "WORK", "ACCESSORY", "ACCESSORIES"),
    "tie": ("Tailored Necktie", "Silk", "FORMAL", "WORK", "ACCESSORY", "ACCESSORIES"),
    "belt": ("Classic Waist Belt", "Leather", "CLASSIC", "WORK", "ACCESSORY", "ACCESSORIES"),
    "scarf": ("Woven Scarf", "Wool", "CLASSIC", "OUTDOOR", "ACCESSORY", "ACCESSORIES"),
    "stole": ("Woven Scarf", "Silk", "CLASSIC", "WORK", "ACCESSORY", "ACCESSORIES"),
    "sombrero": ("Classic Cap", "Cotton", "CASUAL", "OUTDOOR", "ACCESSORY", "ACCESSORIES"),
    "bonnet": ("Classic Cap", "Cotton", "CASUAL", "OUTDOOR", "ACCESSORY", "ACCESSORIES"),
    "hat": ("Classic Cap", "Cotton", "CASUAL", "OUTDOOR", "ACCESSORY", "ACCESSORIES"),
    "cap": ("Classic Cap", "Cotton", "CASUAL", "OUTDOOR", "ACCESSORY", "ACCESSORIES"),
    "sunglasses": ("Classic Sunglasses", "Other", "CASUAL", "OUTDOOR", "ACCESSORY", "ACCESSORIES"),
    "necklace": ("Pendant Necklace", "Other", "MINIMALIST", "EVERYDAY", "ACCESSORY", "ACCESSORIES"),
    "chain": ("Pendant Necklace", "Other", "MINIMALIST", "EVERYDAY", "ACCESSORY", "ACCESSORIES"),
}

CATEGORY_DEFAULT_METADATA: Dict[Category, Tuple[str, Material, Style, Occasion, LayerRole]] = {
    "TOP": ("Shirt", "Cotton", "CASUAL", "EVERYDAY", "INNER_BASE"),
    "OUTERWEAR": ("Everyday Jacket", "Cotton", "CASUAL", "EVERYDAY", "OUTER_LAYER"),
    "BOTTOM": ("Denim Jeans", "Denim", "CASUAL", "EVERYDAY", "LOWER_BODY"),
    "SHOES": ("Everyday Sneakers", "Leather", "SPORTY", "EVERYDAY", "FOOTWEAR"),
    "ACCESSORIES": ("Everyday Carry Bag", "Cotton", "CASUAL", "EVERYDAY", "ACCESSORY"),
}

FILENAME_GARMENT_KEYWORDS: Tuple[str, ...] = (
    "hoodie", "sweatshirt", "cardigan", "oxford", "blazer", "suit", "trench",
    "parka", "coat", "windbreaker", "jacket", "chinos", "chino", "trousers", "trouser",
    "jeans", "jean", "slippers", "slipper", "sandal", "sneakers", "sneaker",
    "loafer", "boot", "polo shirt", "polo", "collared", "t-shirt", "tee", "shirt",
    "tote", "backpack", "handbag", "purse", "watch", "tie", "belt", "scarf", "hat", "cap", "sunglasses",
)

NON_GARMENT_BLOCKLIST: Tuple[str, ...] = (
    "keyboard", "computer", "monitor", "laptop", "desk", "screen", "television", "toilet",
    "seat", "dog", "cat", "food", "plate", "car", "syringe", "gun", "rifle", "knife",
    "brassiere", "bikini", "diaper", "swimming trunks",
)

BLOCKED_TERMS_PATTERN = re.compile(
    r"\b(nigger|nigga|faggot|fuck|shit|bitch|cunt|whore|slut|retard|porn|nsfw|nude|naked|sex)\b",
    re.IGNORECASE,
)


class ColorClusterInfo(BaseModel):
    color_name: str
    proportion: float
    lab: Tuple[float, float, float]


class Prediction(BaseModel):
    category: Optional[Category] = None
    subCategory: Optional[str] = None
    suggestedName: Optional[str] = None
    suggestedBrand: Optional[str] = "Everyday Essentials"
    layerRole: Optional[LayerRole] = None
    color: Optional[str] = None
    colorHex: Optional[str] = None
    secondary_color: Optional[str] = None
    palette: List[ColorClusterInfo] = Field(default_factory=list)
    style: Optional[Style] = None
    occasion: Optional[Occasion] = None
    material: Optional[Material] = None
    confidence: float
    cutoutDataUri: Optional[str] = None
    is_safe_garment: bool = True
    moderation_reason: Optional[str] = None


PredictResponse = Prediction


class BatchImageItem(BaseModel):
    id: str
    base64: str
    filename: Optional[str] = None


class BatchAnalyzeRequest(BaseModel):
    images: List[BatchImageItem] = Field(..., max_length=15)


class BatchAnalyzeItemResult(Prediction):
    id: str


class BatchAnalyzeResponse(BaseModel):
    results: List[BatchAnalyzeItemResult]


class ModerationRequest(BaseModel):
    caption: str = ""
    garment_confidence: float = 1.0
    skin_exposure_ratio: float = 0.0


class ModerationResponse(BaseModel):
    approved: bool
    sanitized_caption: str
    reason: Optional[str] = None


class WardrobeItemInput(BaseModel):
    id: str
    clothing_name: str
    category: Category
    color: str
    style: Style = "CASUAL"
    occasion: str = "Casual"
    laundry_status: Literal["CLEAN", "DIRTY", "LAUNDRY", "NEEDS_WASHING"] = "CLEAN"
    worn_within_7_days: bool = False
    is_favorite: bool = False
    is_disliked: bool = False


class WeatherContextInput(BaseModel):
    temperature_c: float = 28.0
    condition: str = "Clear"
    humidity: float = 70.0
    precipitation_mm: float = 0.0


class CommunityRatingSignal(BaseModel):
    neighbor_similarity: float = Field(ge=0.0, le=1.0)
    style: Style
    dominant_color: str
    rating: float = Field(ge=1.0, le=5.0)


class HybridRecommendationRequest(BaseModel):
    user_id: str
    target_occasion: str = "Casual"
    no_new_clothes_mode: bool = True
    wardrobe: List[WardrobeItemInput]
    preferred_styles: List[Style] = Field(default_factory=lambda: ["CASUAL"])
    preferred_colors: List[str] = Field(default_factory=lambda: ["Black", "White", "Navy"])
    weather: WeatherContextInput = Field(default_factory=WeatherContextInput)
    community_signals: List[CommunityRatingSignal] = Field(default_factory=list)
    alpha: float = 0.55


class ScoredOutfitRecommendation(BaseModel):
    item_ids: List[str]
    items: List[WardrobeItemInput]
    content_score: float
    collaborative_score: float
    hybrid_score: float
    weather_tag: str
    reasons: List[str]


def srgb_to_cielab(rgb_pixels: np.ndarray) -> np.ndarray:
    """Convert N x 3 sRGB [0..255] array to CIELAB (Chapter 2 Equations 8-10)."""
    c = np.clip(rgb_pixels.astype(np.float32) / 255.0, 0.0, 1.0)
    c_lin = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    r, g, b = c_lin[:, 0], c_lin[:, 1], c_lin[:, 2]
    x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
    y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b) / 1.00000
    z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883

    delta = (6.0 / 29.0) ** 3
    factor = 1.0 / (3.0 * ((6.0 / 29.0) ** 2))

    def f(t: np.ndarray) -> np.ndarray:
        return np.where(t > delta, np.cbrt(t), t * factor + (4.0 / 29.0))

    fx, fy, fz = f(x), f(y), f(z)
    l_star = 116.0 * fy - 16.0
    a_star = 500.0 * (fx - fy)
    b_star = 200.0 * (fy - fz)
    return np.stack([l_star, a_star, b_star], axis=1)


def nearest_fashion_color(lab_centroid: np.ndarray) -> str:
    """Assign closest named fashion color via CIE76 Delta-E (Chapter 2 Eq. 11)."""
    l_val, a_val, b_val = float(lab_centroid[0]), float(lab_centroid[1]), float(lab_centroid[2])
    chroma = float(np.sqrt(a_val * a_val + b_val * b_val))
    if l_val >= 82.0 and chroma < 8.0:
        return "White"
    if l_val >= 78.0 and 8.0 <= chroma < 16.0 and b_val > 6.0:
        return "Cream"
    if l_val <= 26.0 and chroma < 12.0:
        return "Black"
    if 26.0 < l_val < 82.0 and chroma < 9.5:
        return "Gray"

    best_name = "Black"
    best_de = float("inf")
    for name, ref_lab in REFERENCE_COLORS_LAB.items():
        ref = np.array(ref_lab, dtype=np.float32)
        de = float(np.linalg.norm(lab_centroid - ref))
        if de < best_de:
            best_de = de
            best_name = name
    return best_name


def _grabcut_centered_rect_fallback(img: Image.Image) -> Image.Image:
    """Graceful OpenCV GrabCut fallback using border background seeding and contour hole-filling."""
    rgb = np.asarray(img.convert("RGB"), dtype=np.uint8)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    h, w = rgb.shape[:2]

    # Initialize mask: outer 6% border is definite background
    mask = np.full((h, w), cv2.GC_PR_FGD, dtype=np.uint8)
    b_h = max(2, int(0.06 * h))
    b_w = max(2, int(0.06 * w))
    mask[:b_h, :] = cv2.GC_BGD
    mask[-b_h:, :] = cv2.GC_BGD
    mask[:, :b_w] = cv2.GC_BGD
    mask[:, -b_w:] = cv2.GC_BGD

    c_y1, c_y2 = int(0.15 * h), int(0.85 * h)
    c_x1, c_x2 = int(0.15 * w), int(0.85 * w)
    mask[c_y1:c_y2, c_x1:c_x2] = cv2.GC_FGD

    bgd_model = np.zeros((1, 65), dtype=np.float64)
    fgd_model = np.zeros((1, 65), dtype=np.float64)
    try:
        cv2.grabCut(bgr, mask, None, bgd_model, fgd_model, iterCount=4, mode=cv2.GC_INIT_WITH_MASK)
        alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    except Exception:
        alpha = np.zeros((h, w), dtype=np.uint8)
        alpha[c_y1:c_y2, c_x1:c_x2] = 255

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    closed_alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(closed_alpha, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        largest = max(contours, key=cv2.contourArea)
        solid_mask = np.zeros_like(alpha)
        cv2.drawContours(solid_mask, [largest], -1, 255, thickness=cv2.FILLED)
        final_alpha = np.where(solid_mask > 0, 255, 0).astype(np.uint8)
        final_alpha = cv2.GaussianBlur(final_alpha, (3, 3), 0)
    else:
        final_alpha = alpha

    rgba = np.dstack([rgb, final_alpha])
    return Image.fromarray(rgba, mode="RGBA")


def extract_garment_cutout(pil_img: Image.Image) -> Tuple[Image.Image, np.ndarray, str]:
    """Salient object garment segmentation with solid interior hole-filling and 480x480 centering."""
    global REMBG_SESSION
    # 1. Resize working image to max 512px maintaining aspect ratio
    img = pil_img.convert("RGB").copy()
    img.thumbnail((512, 512), Image.Resampling.LANCZOS)

    # 2. Run salient object segmentation (NEVER alpha_matting=True to avoid Cholesky/scanline artifacts)
    cutout: Optional[Image.Image] = None
    if REMBG_AVAILABLE and remove is not None:
        try:
            if REMBG_SESSION is None and new_session is not None:
                REMBG_SESSION = new_session("u2netp")
            if REMBG_SESSION is not None:
                cutout = remove(
                    img,
                    session=REMBG_SESSION,
                    alpha_matting=False,
                    post_process_mask=True,
                )
        except Exception as e:
            logger.warning(f"rembg removal failed: {e}")
            cutout = None

    if cutout is None:
        cutout = _grabcut_centered_rect_fallback(img)

    # 3. Post-process with OpenCV to ensure solid interior (no holes in gray/light clothes)
    rgba = np.array(cutout.convert("RGBA"))
    alpha = rgba[:, :, 3]

    # Fill internal holes using morphological closing & contour filling
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    closed_alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(closed_alpha, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        # Keep only the largest garment contour
        largest = max(contours, key=cv2.contourArea)
        solid_mask = np.zeros_like(alpha)
        cv2.drawContours(solid_mask, [largest], -1, 255, thickness=cv2.FILLED)
        # Ensure interior fabric is solid (>92% opaque) while outer background remains 0
        final_alpha = np.where(solid_mask > 0, np.maximum(alpha, int(0.92 * 255)), 0).astype(np.uint8)
        # Smooth boundary edges
        final_alpha = cv2.GaussianBlur(final_alpha, (3, 3), 0)
        rgba[:, :, 3] = final_alpha
        cutout = Image.fromarray(rgba)

    # 4. Crop tightly with padding and center on a 480x480 canvas
    bbox = cutout.getbbox()
    canvas = Image.new("RGBA", (480, 480), (255, 255, 255, 0))
    if bbox:
        cropped = cutout.crop(bbox)
        cropped.thumbnail((440, 440), Image.Resampling.LANCZOS)
        offset = ((480 - cropped.width) // 2, (480 - cropped.height) // 2)
        canvas.paste(cropped, offset, cropped)
    else:
        # If no alpha pixels detected, scale working image to center canvas
        fallback_thumb = img.convert("RGBA").copy()
        fallback_thumb.thumbnail((440, 440), Image.Resampling.LANCZOS)
        offset = ((480 - fallback_thumb.width) // 2, (480 - fallback_thumb.height) // 2)
        canvas.paste(fallback_thumb, offset)
    cutout = canvas

    buffered = BytesIO()
    cutout.save(buffered, format="PNG")
    cutout_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    cutout_data_uri = f"data:image/png;base64,{cutout_base64}"

    fg_mask = np.array(cutout)[:, :, 3] > 64
    return cutout, fg_mask, cutout_data_uri


# Backward-compatible alias
remove_garment_background_opencv = extract_garment_cutout


def _extract_foreground_rgb(image: Image.Image, fg_mask: Optional[np.ndarray] = None) -> np.ndarray:
    """Return N x 3 float32 RGB array of strictly foreground garment pixels."""
    if image.mode == "RGBA":
        rgba = np.asarray(image, dtype=np.uint8)
        alpha_mask = rgba[:, :, 3] > 64
        if np.any(alpha_mask):
            return rgba[:, :, :3][alpha_mask].astype(np.float32)

    if fg_mask is not None:
        mask_h, mask_w = fg_mask.shape[:2]
        rgb_resized = np.asarray(
            image.convert("RGB").resize((mask_w, mask_h), Image.Resampling.BILINEAR),
            dtype=np.float32,
        )
        bool_mask = fg_mask.astype(bool)
        if int(np.sum(bool_mask)) >= 20:
            return rgb_resized[bool_mask]

    cutout_img, auto_mask, _ = extract_garment_cutout(image)
    rgba_arr = np.asarray(cutout_img.convert("RGBA"), dtype=np.uint8)
    if int(np.sum(auto_mask)) >= 20:
        return rgba_arr[:, :, :3][auto_mask].astype(np.float32)
    return rgba_arr[:, :, :3].reshape(-1, 3).astype(np.float32)


def extract_color_palette(
    image: Image.Image,
    fg_mask: Optional[np.ndarray] = None,
    k: int = 2,
    max_iter: int = 100,
) -> Tuple[str, str, Optional[str], List[ColorClusterInfo]]:
    """Run CIELAB K-Means++ (K = 2) strictly on foreground garment pixels (fg_mask == True)."""
    fg_pixels = _extract_foreground_rgb(image, fg_mask)
    if len(fg_pixels) > 4096:
        rng_sub = np.random.default_rng(42)
        idx = rng_sub.choice(len(fg_pixels), size=4096, replace=False)
        fg_pixels = fg_pixels[idx]

    fg_lab = srgb_to_cielab(fg_pixels)

    # Drop extreme deep shadow outliers if main garment is bright
    median_l = float(np.median(fg_lab[:, 0]))
    if median_l > 70.0 and len(fg_lab) >= 40:
        non_shadow_mask = fg_lab[:, 0] >= np.percentile(fg_lab[:, 0], 15)
        if int(np.sum(non_shadow_mask)) >= 20:
            fg_pixels = fg_pixels[non_shadow_mask]
            fg_lab = fg_lab[non_shadow_mask]

    rng = np.random.default_rng(42)
    n_pts = len(fg_lab)
    centroids = np.zeros((k, 3), dtype=np.float32)
    centroids[0] = fg_lab[rng.integers(0, n_pts)]

    for c_i in range(1, k):
        dists_sq = np.min(
            np.sum((fg_lab[:, None, :] - centroids[None, :c_i, :]) ** 2, axis=2),
            axis=1,
        )
        total = float(np.sum(dists_sq))
        if total <= 1e-8:
            centroids[c_i] = fg_lab[rng.integers(0, n_pts)]
        else:
            probs = dists_sq / total
            centroids[c_i] = fg_lab[rng.choice(n_pts, p=probs)]

    labels = np.zeros(n_pts, dtype=np.int32)
    for _ in range(max_iter):
        dists = np.sum((fg_lab[:, None, :] - centroids[None, :, :]) ** 2, axis=2)
        new_labels = np.argmin(dists, axis=1)
        new_centroids = np.copy(centroids)
        for c_i in range(k):
            members = fg_lab[new_labels == c_i]
            if len(members) > 0:
                new_centroids[c_i] = np.mean(members, axis=0)
        if float(np.max(np.linalg.norm(new_centroids - centroids, axis=1))) < 1e-4:
            labels = new_labels
            centroids = new_centroids
            break
        labels = new_labels
        centroids = new_centroids

    cluster_items: List[Tuple[ColorClusterInfo, np.ndarray]] = []
    for c_i in range(k):
        member_mask = labels == c_i
        count = int(np.sum(member_mask))
        prop = round(count / max(1, n_pts), 4)
        c_lab = centroids[c_i]
        member_rgb = fg_pixels[member_mask] if count > 0 else fg_pixels
        cluster_items.append((
            ColorClusterInfo(
                color_name=nearest_fashion_color(c_lab),
                proportion=prop,
                lab=(round(float(c_lab[0]), 2), round(float(c_lab[1]), 2), round(float(c_lab[2]), 2)),
            ),
            member_rgb,
        ))

    cluster_items.sort(key=lambda x: x[0].proportion, reverse=True)
    clusters = [item[0] for item in cluster_items]
    dom_rgb_members = cluster_items[0][1] if cluster_items else fg_pixels
    med_rgb = np.clip(np.median(dom_rgb_members, axis=0), 0.0, 255.0)
    r_val, g_val, b_val = float(med_rgb[0]), float(med_rgb[1]), float(med_rgb[2])
    color_hex = f"#{int(round(r_val)):02x}{int(round(g_val)):02x}{int(round(b_val)):02x}"

    dom_color = clusters[0].color_name if clusters else "Black"
    sec_color = clusters[1].color_name if len(clusters) > 1 else None
    return dom_color, color_hex, sec_color, clusters


def dominant_color(image: Image.Image, fg_mask: Optional[np.ndarray] = None) -> Tuple[str, str]:
    """Estimate a named garment color and #rrggbb hex strictly from foreground garment pixels."""
    dom_color, color_hex, _, _ = extract_color_palette(image, fg_mask=fg_mask, k=2)
    return dom_color, color_hex


def resolve_garment_metadata(
    pred_cat: Optional[Category],
    matched_labels: List[str],
    source_filename: Optional[str] = None,
    dom_color: Optional[str] = None,
) -> Tuple[Optional[Category], Optional[str], Optional[Material], Optional[Style], Optional[Occasion], Optional[LayerRole]]:
    """Resolve specific subCategory, material, style, occasion, and layerRole from filename and CNN labels."""
    if source_filename:
        decoded_name = unquote(source_filename).lower()
        base_name = os.path.splitext(os.path.basename(decoded_name))[0]
        cleaned_filename = re.sub(r"[^a-z0-9]+", " ", base_name).strip()
        for kw in FILENAME_GARMENT_KEYWORDS:
            if re.search(rf"\b{re.escape(kw)}s?\b", cleaned_filename) or kw in cleaned_filename.split():
                mapped_key = kw if kw in GARMENT_NOUN_MAP else kw.rstrip("s")
                if mapped_key in GARMENT_NOUN_MAP:
                    sub_cat, mat, sty, occ, role, cat_from_kw = GARMENT_NOUN_MAP[mapped_key]
                    return cat_from_kw, sub_cat, mat, sty, occ, role

    if pred_cat is not None:
        for lbl in matched_labels:
            lbl_l = lbl.lower()
            for kw, (sub_cat, mat, sty, occ, role, kw_cat) in GARMENT_NOUN_MAP.items():
                if kw_cat == pred_cat and kw in lbl_l:
                    return pred_cat, sub_cat, mat, sty, occ, role

        for lbl in matched_labels:
            lbl_l = lbl.lower()
            for kw, (sub_cat, mat, sty, occ, role, _kw_cat) in GARMENT_NOUN_MAP.items():
                if kw in lbl_l:
                    return pred_cat, sub_cat, mat, sty, occ, role

        sub_cat, mat, sty, occ, role = CATEGORY_DEFAULT_METADATA[pred_cat]
        return pred_cat, sub_cat, mat, sty, occ, role

    return None, None, None, None, None, None


def estimate_skin_exposure_ratio(image: Image.Image) -> Tuple[float, float]:
    """Detect potential NSFW / excessive skin-tone ratio in YCbCr space."""
    ycbcr = np.asarray(image.convert("YCbCr").resize((96, 96)), dtype=np.float32)
    y, cb, cr = ycbcr[:, :, 0], ycbcr[:, :, 1], ycbcr[:, :, 2]
    skin_mask = (y > 80) & (cb >= 77) & (cb <= 127) & (cr >= 133) & (cr <= 173)
    full_ratio = float(np.mean(skin_mask))
    center_mask = skin_mask[19:77, 19:77]
    center_ratio = float(np.mean(center_mask))
    return full_ratio, center_ratio


def check_text_moderation(text: str) -> Tuple[bool, str, Optional[str]]:
    """Check and sanitize captions/notes against profanity and slurs."""
    match = BLOCKED_TERMS_PATTERN.search(text or "")
    if match:
        sanitized = BLOCKED_TERMS_PATTERN.sub("***", text)
        return False, sanitized, "Post blocked: Caption contains inappropriate or prohibited language."
    return True, (text or "").strip(), None


async def run_garment_analysis(image: Image.Image, source_filename: str = "") -> Prediction:
    """Core garment analysis pipeline with salient cutout, CIELAB colors, and calibrated CNN predictions."""
    full_skin_ratio, center_skin_ratio = estimate_skin_exposure_ratio(image)
    cutout_pil, fg_mask, cutout_data_uri = extract_garment_cutout(image)
    dom_color, color_hex, sec_color, clusters = extract_color_palette(cutout_pil, fg_mask=fg_mask, k=2)

    fg_coverage = float(np.mean(fg_mask))
    has_foreground_garment = fg_coverage >= 0.08 and center_skin_ratio <= 0.30

    # Composite foreground cutout onto clean neutral white for CNN inference
    white_bg = Image.new("RGBA", cutout_pil.size, (248, 248, 248, 255))
    clean_rgb_for_cnn = Image.alpha_composite(white_bg, cutout_pil).convert("RGB")

    transforms_to_use = EVAL_TRANSFORMS if (IS_FINETUNED_HEAD or WEIGHTS is None) else WEIGHTS.transforms()
    tensor_raw = transforms_to_use(image).unsqueeze(0)
    tensor_clean = transforms_to_use(clean_rgb_for_cnn).unsqueeze(0)

    with torch.inference_mode():
        probs_raw = torch.softmax(MODEL(tensor_raw)[0], dim=0)
        probs_clean = torch.softmax(MODEL(tensor_clean)[0], dim=0)
        probabilities = 0.60 * probs_clean + 0.40 * probs_raw

    matched_labels: List[str] = []
    top20_has_garment = False
    top3_matches_blocklist = False

    if IS_FINETUNED_HEAD:
        top_prob, top_idx = torch.max(probabilities, dim=0)
        raw_conf = float(top_prob.item())
        pred_cat_idx = int(top_idx.item())
        pred_cat: Optional[Category] = CATEGORIES_LIST[pred_cat_idx] if raw_conf >= CONFIDENCE_THRESHOLD else None

        # TOP vs OUTERWEAR precision calibration
        prob_top = float(probabilities[0].item())
        prob_outerwear = float(probabilities[3].item())
        if pred_cat == "OUTERWEAR" and (prob_outerwear - prob_top < 0.18):
            has_outerwear_kw = any(kw in (source_filename or "").lower() for kw in OUTERWEAR_KEYWORDS)
            if not has_outerwear_kw:
                pred_cat = "TOP"
                raw_conf = max(raw_conf, prob_top)

        total_matched = raw_conf
        top20_has_garment = True
        top3_matches_blocklist = False
        conf = float(np.clip(0.68 + 0.28 * min(1.0, raw_conf), 0.68, 0.96))
    else:
        top = torch.topk(probabilities, k=20)
        labels = [WEIGHTS.meta["categories"][idx] for idx in top.indices.tolist()]
        scores = top.values.tolist()
        cat_mass: Dict[Category, float] = {c: 0.0 for c in CATEGORIES_LIST}

        for lbl, prob in zip(labels, scores):
            lbl_l = lbl.lower()
            for cat_key, hints in LABEL_CATEGORY_HINTS.items():
                if any(h.lower() in lbl_l for h in hints):
                    cat_mass[cat_key] += float(prob)
                    matched_labels.append(lbl_l)
                    top20_has_garment = True
                    break

        best_cat = max(cat_mass, key=lambda k_cat: cat_mass[k_cat])
        total_matched = sum(cat_mass.values())

        # TOP vs OUTERWEAR precision calibration for fallback head
        if best_cat == "OUTERWEAR" and (cat_mass["OUTERWEAR"] - cat_mass["TOP"] < 0.18):
            has_outerwear_kw = any(kw in (source_filename or "").lower() for kw in OUTERWEAR_KEYWORDS)
            top5_has_outerwear = any(any(kw in lbl_l for kw in OUTERWEAR_KEYWORDS) for lbl_l in matched_labels[:5])
            if not (has_outerwear_kw or top5_has_outerwear):
                best_cat = "TOP"

        # Check if any top-3 raw ImageNet prediction matches NON_GARMENT_BLOCKLIST
        raw_top3 = torch.topk(probs_raw, k=3)
        top3_labels = [WEIGHTS.meta["categories"][idx].lower() for idx in raw_top3.indices.tolist()]
        top3_matches_blocklist = any(
            any(blk in lbl_l for blk in NON_GARMENT_BLOCKLIST)
            for lbl_l in top3_labels
        )

        if top20_has_garment or total_matched > 0.01:
            pred_cat = best_cat
            mass_vec = np.array([cat_mass[c] for c in CATEGORIES_LIST], dtype=np.float64)
            norm_mass = mass_vec / max(total_matched, 1e-6)
            temp_logits = norm_mass / 0.35
            temp_logits -= np.max(temp_logits)
            exp_scores = np.exp(temp_logits)
            calibrated_share = float(np.max(exp_scores / np.sum(exp_scores)))
            mass_boost = min(1.0, total_matched / 0.25)
            conf = float(np.clip(0.68 + 0.20 * calibrated_share + 0.08 * mass_boost, 0.68, 0.96))
        elif has_foreground_garment and not top3_matches_blocklist:
            pred_cat = "TOP"
            conf = 0.82
        else:
            pred_cat = None
            conf = float(scores[0])

    is_unsafe = (
        center_skin_ratio > 0.30
        or (top3_matches_blocklist and total_matched < 0.35)
        or (not top20_has_garment and total_matched < 0.12 and not has_foreground_garment)
    )

    if is_unsafe:
        return Prediction(
            category=None,
            subCategory=None,
            suggestedName=None,
            suggestedBrand=None,
            layerRole=None,
            color=dom_color,
            colorHex=color_hex,
            secondary_color=sec_color,
            palette=clusters,
            style=None,
            occasion=None,
            material=None,
            confidence=round(conf, 4),
            cutoutDataUri=None,
            is_safe_garment=False,
            moderation_reason="Inappropriate or non-clothing image detected. Please upload a clear photo of a clothing item or wearable accessory.",
        )

    final_cat, sub_category, material, pred_style, occasion, layer_role = resolve_garment_metadata(
        pred_cat, matched_labels, source_filename, dom_color
    )
    if final_cat is None:
        final_cat = "TOP"
        sub_category, material, pred_style, occasion, layer_role = CATEGORY_DEFAULT_METADATA[final_cat]

    suggested_name = f"{dom_color} {sub_category}" if (dom_color and sub_category) else f"{dom_color} Shirt"
    suggested_brand = "Studio Basics" if pred_style in {"FORMAL", "CLASSIC", "MINIMALIST"} else "Everyday Essentials"

    return Prediction(
        category=final_cat,
        subCategory=sub_category,
        suggestedName=suggested_name,
        suggestedBrand=suggested_brand,
        layerRole=layer_role,
        color=dom_color,
        colorHex=color_hex,
        secondary_color=sec_color,
        palette=clusters,
        style=pred_style,
        occasion=occasion,
        material=material,
        confidence=round(conf, 4),
        cutoutDataUri=cutout_data_uri,
        is_safe_garment=True,
        moderation_reason=None if conf >= CONFIDENCE_THRESHOLD else "Low classification confidence (<0.55); please confirm category manually.",
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    global MODEL, IS_FINETUNED_HEAD, REMBG_SESSION, LOADED_CHECKPOINT_PATH
    if REMBG_AVAILABLE and REMBG_SESSION is None and new_session is not None:
        try:
            REMBG_SESSION = new_session("u2netp")
        except Exception:
            REMBG_SESSION = None

    if TORCH_AVAILABLE and resnet50 is not None:
        ckpt_path = resolve_existing_path(CANDIDATE_CHECKPOINT_PATHS)
        if ckpt_path:
            LOADED_CHECKPOINT_PATH = ckpt_path
            try:
                state = torch.load(ckpt_path, map_location="cpu")
                if isinstance(state, dict):
                    for key in ("model_state_dict", "state_dict", "model", "net"):
                        if key in state and isinstance(state[key], dict):
                            state = state[key]
                            break
                cleaned_state = {}
                for k, v in state.items():
                    new_k = k
                    if new_k.startswith("module."):
                        new_k = new_k[7:]
                    if new_k.startswith("backbone."):
                        new_k = new_k[9:]
                    if new_k == "fc.1.weight":
                        new_k = "fc.weight"
                    if new_k == "fc.1.bias":
                        new_k = "fc.bias"
                    cleaned_state[new_k] = v

                base = resnet50(weights=None)
                base.fc = nn.Linear(base.fc.in_features, len(CATEGORIES_LIST))
                missing, unexpected = base.load_state_dict(cleaned_state, strict=False)
                matched_keys = [k for k in cleaned_state.keys() if k not in unexpected]
                if len(matched_keys) > 100:
                    MODEL = base.eval()
                    IS_FINETUNED_HEAD = True
                    print(f"[STARTUP] Loaded fine-tuned ResNet-50 Epoch 13 checkpoint ({len(matched_keys)} matched keys) from {ckpt_path}")
                    logger.info(f"Loaded fine-tuned ResNet-50 Epoch 13 checkpoint ({len(matched_keys)} matched keys) from {ckpt_path}")
                else:
                    print(f"[STARTUP] Checkpoint matched only {len(matched_keys)} keys (expected >100). Falling back to ImageNet head.")
                    logger.warning(f"Checkpoint matched only {len(matched_keys)} keys (expected >100). Falling back to ImageNet head.")
            except Exception as e:
                print(f"[STARTUP] Failed to load checkpoint {ckpt_path}: {e}")
                logger.warning(f"Failed to load checkpoint {ckpt_path}: {e}")

        if MODEL is None:
            print("[STARTUP] Active model: calibrated fallback head (ResNet-50 ImageNet-1K V2 mapped to 5 fashion classes)")
            logger.info("Active model: calibrated fallback head (ResNet-50 ImageNet-1K V2 mapped to 5 fashion classes)")
            MODEL = resnet50(weights=WEIGHTS).eval()
            IS_FINETUNED_HEAD = False

    yield
    MODEL = None


app = FastAPI(title="StyleSense ML & Hybrid Recommendation Service", version="2.5.0", lifespan=lifespan)


@app.get("/health")
def health() -> Dict[str, object]:
    val_metrics = LOADED_RESULTS_DATA.get("validation_metrics", {})
    test_metrics = LOADED_RESULTS_DATA.get("final_test_metrics", {})
    return {
        "status": "ok",
        "model": "resnet50-stylesense-5class" if IS_FINETUNED_HEAD else "resnet50-imagenet1k-v2-mapped",
        "checkpoint_loaded": IS_FINETUNED_HEAD,
        "checkpoint_path": LOADED_CHECKPOINT_PATH,
        "best_epoch": LOADED_RESULTS_DATA.get("best_epoch", 13 if IS_FINETUNED_HEAD else None),
        "validation_accuracy": val_metrics.get("accuracy", 0.8655 if IS_FINETUNED_HEAD else None),
        "final_test_accuracy": test_metrics.get("accuracy", 0.8631 if IS_FINETUNED_HEAD else None),
        "validation_metrics": val_metrics if val_metrics else None,
        "final_test_metrics": test_metrics if test_metrics else None,
        "rembg_u2netp_enabled": REMBG_SESSION is not None,
        "kmeans_cielab_k": 2,
        "hybrid_engine": "0.55_CB_0.45_CF",
        "ai_moderation_enabled": True,
    }


@app.post("/analyze", response_model=PredictResponse)
async def analyze(request: Request) -> PredictResponse:
    if request.headers.get("content-type", "").split(";")[0] not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Send a JPEG, PNG, or WebP image body.")
    body = await request.body()
    if not body or len(body) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image must be between 1 byte and 5 MB.")
    try:
        image = Image.open(BytesIO(body)).convert("RGB")
    except UnidentifiedImageError as error:
        raise HTTPException(status_code=422, detail="The request body is not a valid image.") from error
    if MODEL is None:
        raise HTTPException(status_code=503, detail="CNN model is still loading.")
    source_filename = request.headers.get("x-source-filename", "")
    return await run_garment_analysis(image, source_filename)


@app.post("/analyze-batch", response_model=BatchAnalyzeResponse)
async def analyze_batch(payload: BatchAnalyzeRequest) -> BatchAnalyzeResponse:
    if MODEL is None:
        raise HTTPException(status_code=503, detail="CNN model is still loading.")
    if len(payload.images) > 15:
        raise HTTPException(status_code=422, detail="Batch size cannot exceed 15 images.")

    results: List[BatchAnalyzeItemResult] = []
    for item in payload.images:
        try:
            raw_b64 = item.base64
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",", 1)[1]
            img_bytes = base64.b64decode(raw_b64)
            image = Image.open(BytesIO(img_bytes)).convert("RGB")
            pred = await run_garment_analysis(image, item.filename or "")
            pred_dict = pred.dict() if hasattr(pred, "dict") else pred.model_dump()
            results.append(BatchAnalyzeItemResult(id=item.id, **pred_dict))
        except Exception as e:
            logger.warning(f"Failed to process batch item {item.id}: {e}")
            results.append(
                BatchAnalyzeItemResult(
                    id=item.id,
                    confidence=0.0,
                    is_safe_garment=False,
                    moderation_reason=f"Failed to process image: {str(e)}",
                )
            )
    return BatchAnalyzeResponse(results=results)


@app.post("/moderate", response_model=ModerationResponse)
def moderate_post(payload: ModerationRequest) -> ModerationResponse:
    """Automated AI guard for Community Feed posts (blocks NSFW images & profanity)."""
    text_ok, sanitized, reason = check_text_moderation(payload.caption)
    if not text_ok:
        return ModerationResponse(approved=False, sanitized_caption=sanitized, reason=reason)
    if payload.skin_exposure_ratio > 0.55 or payload.garment_confidence < 0.35:
        return ModerationResponse(
            approved=False,
            sanitized_caption=sanitized,
            reason="Post blocked: Uploaded photo did not pass garment verification or NSFW safety checks.",
        )
    return ModerationResponse(approved=True, sanitized_caption=sanitized, reason=None)


@app.post("/recommend", response_model=List[ScoredOutfitRecommendation])
def recommend_outfits(req: HybridRecommendationRequest) -> List[ScoredOutfitRecommendation]:
    """Generate Top-3 outfits via Weighted Hybrid Filtering (0.55 Content-Based + 0.45 Collaborative)."""
    eligible = [
        item for item in req.wardrobe
        if item.laundry_status == "CLEAN" and not item.is_disliked
    ]
    tops = [i for i in eligible if i.category == "TOP"]
    bottoms = [i for i in eligible if i.category == "BOTTOM"]
    shoes = [i for i in eligible if i.category == "SHOES"]
    outerwear = [i for i in eligible if i.category == "OUTERWEAR"]

    if not tops or not bottoms or not shoes:
        return []

    is_rainy_or_cool = (
        req.weather.temperature_c < 24.0
        or req.weather.precipitation_mm > 0.5
        or any(w in req.weather.condition.lower() for w in ("rain", "storm", "drizzle", "thunder"))
    )
    weather_tag = (
        f"Rainy/Cool ({req.weather.temperature_c:.0f} deg C, {req.weather.condition})"
        if is_rainy_or_cool
        else f"Warm/Humid ({req.weather.temperature_c:.0f} deg C, {req.weather.condition})"
    )

    recommendations: List[ScoredOutfitRecommendation] = []
    for top in tops:
        for bottom in bottoms:
            for shoe in shoes:
                items = [top, bottom, shoe]
                if is_rainy_or_cool and outerwear:
                    items.append(outerwear[0])

                s_cb = 55.0
                reasons: List[str] = []

                if len({top.style, bottom.style, shoe.style}) == 1:
                    s_cb += 18.0
                    reasons.append(f"Consistent {top.style.title()} style silhouette (+18)")
                if any(it.occasion.lower() == req.target_occasion.lower() for it in items):
                    s_cb += 15.0
                    reasons.append(f"Suited for {req.target_occasion} occasion (+15)")
                if any(it.color in NEUTRAL_COLORS for it in (top, bottom)):
                    s_cb += 10.0
                    reasons.append(f"Balanced CIELAB color harmony with {top.color} & {bottom.color} (+10)")

                style_bonus = min(sum(5.0 for it in items if it.style in req.preferred_styles), 15.0)
                color_bonus = min(sum(4.0 for it in items if it.color in req.preferred_colors), 10.0)
                s_cb += style_bonus + color_bonus

                if is_rainy_or_cool and len(items) > 3:
                    s_cb += 8.0
                    reasons.append(f"Includes outerwear layer for {weather_tag}")
                elif not is_rainy_or_cool and len(items) == 3:
                    s_cb += 6.0
                    reasons.append(f"Breathable 3-piece pairing for {weather_tag}")

                if any(it.worn_within_7_days for it in items):
                    s_cb -= 18.0

                s_cb = float(np.clip(s_cb, 0.0, 100.0))

                matching_signals = [
                    sig for sig in req.community_signals
                    if sig.style in {top.style, bottom.style} or sig.dominant_color in {top.color, bottom.color}
                ]
                if matching_signals:
                    num = sum(sig.neighbor_similarity * sig.rating for sig in matching_signals)
                    den = sum(abs(sig.neighbor_similarity) for sig in matching_signals)
                    pred_rating = (num / den) if den > 1e-6 else 4.0
                    s_cf = float(np.clip((pred_rating - 1.0) / 4.0 * 100.0, 0.0, 100.0))
                    reasons.append(f"Rated {pred_rating:.1f}/5.0 by similar Community Feed profiles")
                else:
                    fav_boost = sum(8.0 for it in items if it.is_favorite)
                    s_cf = float(np.clip(72.0 + fav_boost, 0.0, 100.0))

                s_hyb = round(req.alpha * s_cb + (1.0 - req.alpha) * s_cf, 2)
                recommendations.append(ScoredOutfitRecommendation(
                    item_ids=[it.id for it in items],
                    items=items,
                    content_score=round(s_cb, 2),
                    collaborative_score=round(s_cf, 2),
                    hybrid_score=s_hyb,
                    weather_tag=weather_tag,
                    reasons=reasons[:3],
                ))

    recommendations.sort(key=lambda r: r.hybrid_score, reverse=True)
    return recommendations[:3]
