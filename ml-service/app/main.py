"""StyleSense Unified ML & Hybrid Recommendation Microservice (FastAPI).

Implements:
1. OpenCV Automatic Garment Background Removal (CIELAB border modeling + GrabCut
   with FloodFill/Otsu fallback, morphological cleanup, Gaussian alpha feathering,
   and 480x480 centered transparent PNG encoding).
2. Fine-Tuned 5-Class ResNet-50 Garment Classifier (with 0.55 confidence threshold,
   top-20 synset temperature-calibrated confidence scoring [0.68-0.96], and
   GARMENT_NOUN_MAP metadata enrichment).
3. Foreground-Masked CIELAB K-Means++ (K = 2) Dominant Color, Hex & Palette Extraction
   (Chapter 2 Eqs. 4-12) strictly sampling foreground garment pixels (fg_mask == True / alpha > 128).
4. Automated AI Content Moderation Gate (NSFW / Skin-Ratio Check + Non-Garment
   Confidence Gate + Profanity/Slur Text Filter for Community Feed posts).
5. Context-Aware Weighted Hybrid Recommendation Engine (Chapter 2 Eqs. 15-19 & Table 1):
   S_hybrid = round(0.55 * S_cb + 0.45 * S_cf).
"""

import base64
from contextlib import asynccontextmanager
from io import BytesIO
import os
import re
from typing import Dict, List, Literal, Optional, Tuple
from urllib.parse import unquote

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, Request
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

try:
    import torch
    import torch.nn as nn
    from torchvision.models import ResNet50_Weights, resnet50
    TORCH_AVAILABLE = True
except Exception:
    torch = None  # type: ignore
    nn = None  # type: ignore
    ResNet50_Weights = None  # type: ignore
    resnet50 = None  # type: ignore
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
CHECKPOINT_PATH = os.getenv("RESNET50_CHECKPOINT_PATH", "models/resnet50_stylesense_epoch13.pth")

MODEL: Optional[object] = None
IS_FINETUNED_HEAD: bool = False
WEIGHTS = ResNet50_Weights.IMAGENET1K_V2 if TORCH_AVAILABLE else None

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
        "jersey", "t-shirt", "tee shirt", "shirt", "polo",
        "blouse", "maillot", "vestment", "brassiere", "overskirt",
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
        "sweatshirt", "hoodie", "cardigan", "coat", "jacket",
        "suit", "trench", "poncho", "windbreaker", "blazer",
        "kimono", "lab coat", "fur coat", "wardrobe", "velvet",
        "wool", "abaya", "cloak", "academic gown",
    ),
    "ACCESSORIES": (
        "backpack", "handbag", "purse", "wallet", "tie",
        "bow tie", "Windsor tie", "scarf", "stole", "belt",
        "hat", "cap", "sombrero", "bonnet", "watch",
        "analog watch", "digital watch", "sunglasses", "necklace", "chain",
    ),
}

# Ordered mapping from matched ImageNet label keywords or filename tokens to:
# (subCategory, material, style, occasion, layerRole, category)
GARMENT_NOUN_MAP: Dict[str, Tuple[str, Material, Style, Occasion, LayerRole, Category]] = {
    "sweatshirt": ("Pullover Hoodie", "Cotton", "CASUAL", "EVERYDAY", "OUTER_LAYER", "OUTERWEAR"),
    "hoodie": ("Pullover Hoodie", "Cotton", "CASUAL", "EVERYDAY", "OUTER_LAYER", "OUTERWEAR"),
    "cardigan": ("Knit Cardigan", "Knit", "CLASSIC", "WORK", "OUTER_LAYER", "OUTERWEAR"),
    "suit": ("Structured Blazer", "Wool", "FORMAL", "WORK", "OUTER_LAYER", "OUTERWEAR"),
    "blazer": ("Structured Blazer", "Wool", "FORMAL", "WORK", "OUTER_LAYER", "OUTERWEAR"),
    "trench": ("Tailored Coat", "Cotton", "CLASSIC", "WORK", "OUTER_LAYER", "OUTERWEAR"),
    "fur coat": ("Tailored Coat", "Wool", "CLASSIC", "WORK", "OUTER_LAYER", "OUTERWEAR"),
    "lab coat": ("Tailored Coat", "Cotton", "CLASSIC", "WORK", "OUTER_LAYER", "OUTERWEAR"),
    "coat": ("Tailored Coat", "Cotton", "CLASSIC", "WORK", "OUTER_LAYER", "OUTERWEAR"),
    "windbreaker": ("Everyday Jacket", "Nylon", "STREETWEAR", "EVERYDAY", "OUTER_LAYER", "OUTERWEAR"),
    "poncho": ("Everyday Jacket", "Wool", "BOHEMIAN", "OUTDOOR", "OUTER_LAYER", "OUTERWEAR"),
    "kimono": ("Everyday Jacket", "Silk", "CLASSIC", "EVERYDAY", "OUTER_LAYER", "OUTERWEAR"),
    "jacket": ("Everyday Jacket", "Nylon", "STREETWEAR", "EVERYDAY", "OUTER_LAYER", "OUTERWEAR"),
    "wardrobe": ("Pullover Hoodie", "Cotton", "CASUAL", "EVERYDAY", "OUTER_LAYER", "OUTERWEAR"),
    "velvet": ("Pullover Hoodie", "Cotton", "CASUAL", "EVERYDAY", "OUTER_LAYER", "OUTERWEAR"),
    "wool": ("Pullover Hoodie", "Cotton", "CASUAL", "EVERYDAY", "OUTER_LAYER", "OUTERWEAR"),
    "abaya": ("Pullover Hoodie", "Cotton", "CASUAL", "EVERYDAY", "OUTER_LAYER", "OUTERWEAR"),
    "cloak": ("Pullover Hoodie", "Cotton", "CASUAL", "EVERYDAY", "OUTER_LAYER", "OUTERWEAR"),
    "academic gown": ("Pullover Hoodie", "Cotton", "CASUAL", "EVERYDAY", "OUTER_LAYER", "OUTERWEAR"),
    "jersey": ("Crewneck T-Shirt", "Cotton", "CASUAL", "EVERYDAY", "INNER_BASE", "TOP"),
    "t-shirt": ("Crewneck T-Shirt", "Cotton", "CASUAL", "EVERYDAY", "INNER_BASE", "TOP"),
    "tee shirt": ("Crewneck T-Shirt", "Cotton", "CASUAL", "EVERYDAY", "INNER_BASE", "TOP"),
    "tee": ("Crewneck T-Shirt", "Cotton", "CASUAL", "EVERYDAY", "INNER_BASE", "TOP"),
    "polo": ("Polo Shirt", "Cotton", "CLASSIC", "EVERYDAY", "INNER_BASE", "TOP"),
    "oxford": ("Button-Down Shirt", "Cotton", "CLASSIC", "WORK", "INNER_BASE", "TOP"),
    "blouse": ("Button-Down Shirt", "Silk", "CLASSIC", "WORK", "INNER_BASE", "TOP"),
    "shirt": ("Button-Down Shirt", "Cotton", "CLASSIC", "WORK", "INNER_BASE", "TOP"),
    "maillot": ("Crewneck T-Shirt", "Polyester", "SPORTY", "GYM", "INNER_BASE", "TOP"),
    "vestment": ("Button-Down Shirt", "Cotton", "CLASSIC", "WORK", "INNER_BASE", "TOP"),
    "overskirt": ("Casual Top", "Cotton", "CASUAL", "EVERYDAY", "INNER_BASE", "TOP"),
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
    "TOP": ("Crewneck T-Shirt", "Cotton", "CASUAL", "EVERYDAY", "INNER_BASE"),
    "OUTERWEAR": ("Pullover Hoodie", "Cotton", "CASUAL", "EVERYDAY", "OUTER_LAYER"),
    "BOTTOM": ("Denim Jeans", "Denim", "CASUAL", "EVERYDAY", "LOWER_BODY"),
    "SHOES": ("Everyday Sneakers", "Leather", "SPORTY", "EVERYDAY", "FOOTWEAR"),
    "ACCESSORIES": ("Everyday Carry Bag", "Cotton", "CASUAL", "EVERYDAY", "ACCESSORY"),
}

FILENAME_GARMENT_KEYWORDS: Tuple[str, ...] = (
    "sweatshirt", "hoodie", "cardigan", "oxford", "blazer", "suit", "trench",
    "coat", "windbreaker", "jacket", "chinos", "chino", "trousers", "trouser",
    "jeans", "jean", "slippers", "slipper", "sandal", "sneakers", "sneaker",
    "loafer", "boot", "t-shirt", "tee", "polo", "shirt", "tote", "backpack",
    "handbag", "purse", "watch", "tie", "belt", "scarf", "hat", "cap", "sunglasses",
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


def remove_garment_background_opencv(pil_img: Image.Image) -> Tuple[Image.Image, np.ndarray, str]:
    """Automatically segment garment foreground with OpenCV GrabCut + CIELAB border modeling.

    Steps:
    a) Resize working copy to max side 512px (preserving aspect ratio) -> RGB and BGR arrays.
    b) Estimate background color distribution from outer 6% border ring in CIELAB space.
    c) Initialize GrabCut mask:
       - Outer 4% frame -> cv2.GC_BGD
       - Border-connected pixels with Delta E < 14.0 -> cv2.GC_PR_BGD
       - Central 50% core region with Delta E > 18.0 -> cv2.GC_FGD
    d) Run cv2.grabCut (iterCount=4, GC_INIT_WITH_MASK) with FloodFill + Otsu fallback
       if grabCut raises or foreground coverage is < 8% or > 95%.
    e) Clean mask with MORPH_CLOSE (5x5 ellipse) + MORPH_OPEN (3x3 ellipse), retain largest
       central connected component(s), and feather alpha with GaussianBlur((5, 5), 0).
    f) Tight-crop foreground bbox with 8% padding, center on a 480x480 RGBA canvas, and
       encode as data:image/png;base64,...
    """
    rgb_orig = pil_img.convert("RGB")
    orig_w, orig_h = rgb_orig.size
    max_side = 512
    scale = min(1.0, float(max_side) / float(max(orig_w, orig_h, 1)))
    work_w = max(32, int(round(orig_w * scale)))
    work_h = max(32, int(round(orig_h * scale)))

    work_pil = rgb_orig.resize((work_w, work_h), Image.Resampling.BILINEAR)
    rgb = np.asarray(work_pil, dtype=np.uint8)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    h, w = rgb.shape[:2]

    # b) Estimate background color from outer 6% border ring in CIELAB space
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    b6_y = max(2, int(round(h * 0.06)))
    b6_x = max(2, int(round(w * 0.06)))
    border_mask = np.zeros((h, w), dtype=bool)
    border_mask[:b6_y, :] = True
    border_mask[h - b6_y :, :] = True
    border_mask[:, :b6_x] = True
    border_mask[:, w - b6_x :] = True
    bg_median_lab = np.median(lab[border_mask], axis=0)

    delta_e = np.linalg.norm(lab - bg_median_lab[None, None, :], axis=2)

    # c) Initialize GrabCut mask
    mask = np.full((h, w), cv2.GC_PR_FGD, dtype=np.uint8)
    b4_y = max(1, int(round(h * 0.04)))
    b4_x = max(1, int(round(w * 0.04)))
    mask[:b4_y, :] = cv2.GC_BGD
    mask[h - b4_y :, :] = cv2.GC_BGD
    mask[:, :b4_x] = cv2.GC_BGD
    mask[:, w - b4_x :] = cv2.GC_BGD

    # Border-connected pixels with Delta E < 14.0 -> cv2.GC_PR_BGD
    similar_to_bg = (delta_e < 14.0).astype(np.uint8)
    num_labels, cc_labels = cv2.connectedComponents(similar_to_bg, connectivity=8)
    if num_labels > 1:
        border_cc_ids = np.unique(
            np.concatenate([
                cc_labels[0, :], cc_labels[-1, :], cc_labels[:, 0], cc_labels[:, -1]
            ])
        )
        border_cc_ids = border_cc_ids[border_cc_ids > 0]
        border_connected_bg = np.isin(cc_labels, border_cc_ids)
        mask[border_connected_bg & (mask != cv2.GC_BGD)] = cv2.GC_PR_BGD

    # Central 50% core region (25%..75%) with Delta E > 18.0 -> cv2.GC_FGD
    cy0, cy1 = int(round(h * 0.25)), int(round(h * 0.75))
    cx0, cx1 = int(round(w * 0.25)), int(round(w * 0.75))
    core_region = np.zeros((h, w), dtype=bool)
    core_region[cy0:cy1, cx0:cx1] = True
    mask[core_region & (delta_e > 18.0)] = cv2.GC_FGD

    # Ensure GrabCut has both background and foreground seeds
    if not np.any((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)):
        mask[cy0:cy1, cx0:cx1] = cv2.GC_PR_FGD

    # d) Run GrabCut with fallback to FloodFill + Otsu thresholding
    fg_bin: Optional[np.ndarray] = None
    try:
        bgd_model = np.zeros((1, 65), dtype=np.float64)
        fgd_model = np.zeros((1, 65), dtype=np.float64)
        cv2.grabCut(bgr, mask, None, bgd_model, fgd_model, iterCount=4, mode=cv2.GC_INIT_WITH_MASK)
        candidate = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 1, 0).astype(np.uint8)
        coverage = float(np.mean(candidate))
        if 0.08 <= coverage <= 0.95:
            fg_bin = candidate
    except Exception:
        fg_bin = None

    if fg_bin is None:
        # Safe fallback: border-color FloodFill + Otsu thresholding on Delta-E / grayscale
        ff_img = bgr.copy()
        ff_mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
        lo_diff = (18, 18, 18)
        up_diff = (18, 18, 18)
        seed_points = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (0, h // 2)]
        for sx, sy in seed_points:
            if ff_mask[sy + 1, sx + 1] == 0:
                cv2.floodFill(
                    ff_img,
                    ff_mask,
                    (sx, sy),
                    (0, 0, 0),
                    loDiff=lo_diff,
                    upDiff=up_diff,
                    flags=4 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY,
                )
        flood_bg = ff_mask[1 : h + 1, 1 : w + 1] > 0

        de_norm = cv2.normalize(delta_e, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
        _, otsu_fg = cv2.threshold(de_norm, 0, 1, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        combined_fg = ((~flood_bg) | (otsu_fg > 0)).astype(np.uint8)
        combined_fg[:b4_y, :] = 0
        combined_fg[h - b4_y :, :] = 0
        combined_fg[:, :b4_x] = 0
        combined_fg[:, w - b4_x :] = 0
        cov = float(np.mean(combined_fg))
        if 0.08 <= cov <= 0.95:
            fg_bin = combined_fg
        else:
            fg_bin = np.zeros((h, w), dtype=np.uint8)
            fg_bin[int(h * 0.12) : int(h * 0.88), int(w * 0.12) : int(w * 0.88)] = 1

    # e) Morphological cleanup + largest central connected component(s) + Gaussian feathering
    k_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    k_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    cleaned = cv2.morphologyEx(fg_bin * 255, cv2.MORPH_CLOSE, k_close)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, k_open)

    num_cc, cc_map, stats, centroids = cv2.connectedComponentsWithStats(
        (cleaned > 127).astype(np.uint8), connectivity=8
    )
    if num_cc > 1:
        img_cx, img_cy = w * 0.5, h * 0.5
        areas = stats[1:, cv2.CC_STAT_AREA]
        max_area = int(np.max(areas)) if len(areas) > 0 else 0
        keep_mask = np.zeros((h, w), dtype=np.uint8)
        for comp_idx in range(1, num_cc):
            area = int(stats[comp_idx, cv2.CC_STAT_AREA])
            cx_i, cy_i = centroids[comp_idx]
            dist_center = np.hypot((cx_i - img_cx) / max(w, 1), (cy_i - img_cy) / max(h, 1))
            if area == max_area or (area >= 0.15 * max_area and dist_center <= 0.38):
                keep_mask[cc_map == comp_idx] = 255
        if np.any(keep_mask > 0):
            cleaned = keep_mask

    alpha = cv2.GaussianBlur(cleaned, (5, 5), 0)
    fg_boolean_mask = alpha > 128

    if not np.any(fg_boolean_mask):
        fg_boolean_mask[cy0:cy1, cx0:cx1] = True
        alpha[cy0:cy1, cx0:cx1] = 255

    # f) Tight crop around foreground bbox with 8% transparent padding on 480x480 RGBA canvas
    rgba_work = np.dstack([rgb, alpha])
    ys, xs = np.where(alpha > 24)
    if len(ys) > 0 and len(xs) > 0:
        y_min, y_max = int(ys.min()), int(ys.max()) + 1
        x_min, x_max = int(xs.min()), int(xs.max()) + 1
    else:
        y_min, y_max, x_min, x_max = 0, h, 0, w

    crop_rgba = rgba_work[y_min:y_max, x_min:x_max]
    crop_h, crop_w = crop_rgba.shape[:2]

    canvas_size = 480
    pad_px = int(round(canvas_size * 0.08))
    avail_size = canvas_size - 2 * pad_px
    fit_scale = min(float(avail_size) / max(crop_w, 1), float(avail_size) / max(crop_h, 1))
    new_w = max(1, int(round(crop_w * fit_scale)))
    new_h = max(1, int(round(crop_h * fit_scale)))

    resized_crop = cv2.resize(crop_rgba, (new_w, new_h), interpolation=cv2.INTER_AREA if fit_scale < 1.0 else cv2.INTER_LINEAR)
    canvas = np.zeros((canvas_size, canvas_size, 4), dtype=np.uint8)
    off_y = (canvas_size - new_h) // 2
    off_x = (canvas_size - new_w) // 2
    canvas[off_y : off_y + new_h, off_x : off_x + new_w] = resized_crop

    rgba_pil_img = Image.fromarray(canvas, mode="RGBA")
    buf = BytesIO()
    rgba_pil_img.save(buf, format="PNG", optimize=True)
    b64_png = base64.b64encode(buf.getvalue()).decode("ascii")
    cutout_data_uri = f"data:image/png;base64,{b64_png}"

    return rgba_pil_img, fg_boolean_mask, cutout_data_uri


def _extract_foreground_rgb(image: Image.Image, fg_mask: Optional[np.ndarray] = None) -> np.ndarray:
    """Return N x 3 float32 RGB array of strictly foreground garment pixels (alpha > 128)."""
    if image.mode == "RGBA":
        rgba = np.asarray(image, dtype=np.uint8)
        alpha_mask = rgba[:, :, 3] > 128
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

    # Fallback if called without fg_mask
    _, auto_mask, _ = remove_garment_background_opencv(image)
    mh, mw = auto_mask.shape[:2]
    rgb_work = np.asarray(
        image.convert("RGB").resize((mw, mh), Image.Resampling.BILINEAR),
        dtype=np.float32,
    )
    if int(np.sum(auto_mask)) >= 20:
        return rgb_work[auto_mask]
    return rgb_work.reshape(-1, 3)


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


def kmeans_plusplus_cielab(
    image: Image.Image,
    k: int = 2,
    max_iter: int = 100,
    fg_mask: Optional[np.ndarray] = None,
) -> List[ColorClusterInfo]:
    """Foreground-masked CIELAB K-Means++ (K = 2) palette extraction."""
    _, _, _, clusters = extract_color_palette(image, fg_mask=fg_mask, k=k, max_iter=max_iter)
    return clusters


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

    is_dark = (dom_color or "") in {"Black", "Navy", "Gray", "Brown", "Burgundy"}
    if is_dark and any(
        any(k in lbl.lower() for k in ("sweatshirt", "jersey", "cardigan", "coat", "wardrobe", "velvet", "wool"))
        for lbl in matched_labels
    ):
        return "OUTERWEAR", "Pullover Hoodie", "Cotton", "CASUAL", "EVERYDAY", "OUTER_LAYER"

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


@asynccontextmanager
async def lifespan(_: FastAPI):
    global MODEL, IS_FINETUNED_HEAD
    if os.path.exists(CHECKPOINT_PATH):
        base = resnet50(weights=None)
        base.fc = nn.Linear(base.fc.in_features, len(CATEGORIES_LIST))
        state = torch.load(CHECKPOINT_PATH, map_location="cpu")
        if isinstance(state, dict) and "model_state_dict" in state:
            state = state["model_state_dict"]
        base.load_state_dict(state, strict=False)
        MODEL = base.eval()
        IS_FINETUNED_HEAD = True
    else:
        MODEL = resnet50(weights=WEIGHTS).eval()
        IS_FINETUNED_HEAD = False
    yield
    MODEL = None


app = FastAPI(title="StyleSense ML & Hybrid Recommendation Service", version="2.3.0", lifespan=lifespan)


@app.get("/health")
def health() -> Dict[str, object]:
    return {
        "status": "ok",
        "model": "resnet50-stylesense-5class" if IS_FINETUNED_HEAD else "resnet50-imagenet1k-v2-mapped",
        "checkpoint_loaded": IS_FINETUNED_HEAD,
        "checkpoint_expected_path": CHECKPOINT_PATH,
        "opencv_grabcut_enabled": True,
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

    full_skin_ratio, center_skin_ratio = estimate_skin_exposure_ratio(image)
    cutout_pil, fg_mask, cutout_data_uri = remove_garment_background_opencv(image)
    dom_color, color_hex, sec_color, clusters = extract_color_palette(image, fg_mask=fg_mask, k=2)
    source_filename = request.headers.get("x-source-filename", "")

    fg_coverage = float(np.mean(fg_mask))
    has_foreground_garment = fg_coverage >= 0.08 and center_skin_ratio <= 0.30

    # Composite foreground cutout onto clean neutral white for CNN inference to eliminate background noise
    white_bg = Image.new("RGBA", cutout_pil.size, (248, 248, 248, 255))
    clean_rgb_for_cnn = Image.alpha_composite(white_bg, cutout_pil).convert("RGB")

    tensor_raw = WEIGHTS.transforms()(image).unsqueeze(0)
    tensor_clean = WEIGHTS.transforms()(clean_rgb_for_cnn).unsqueeze(0)
    with torch.inference_mode():
        probs_raw = torch.softmax(MODEL(tensor_raw)[0], dim=0)
        probs_clean = torch.softmax(MODEL(tensor_clean)[0], dim=0)
        probabilities = 0.55 * probs_clean + 0.45 * probs_raw

    matched_labels: List[str] = []
    top20_matched_mass = 0.0
    top20_has_garment = False
    if IS_FINETUNED_HEAD:
        top_prob, top_idx = torch.max(probabilities, dim=0)
        raw_conf = float(top_prob.item())
        pred_cat: Optional[Category] = CATEGORIES_LIST[int(top_idx.item())] if raw_conf >= CONFIDENCE_THRESHOLD else None
        total_matched = raw_conf
        top20_matched_mass = raw_conf
        top20_has_garment = True
        top3_matches_blocklist = False
        conf = float(np.clip(0.68 + 0.28 * min(1.0, raw_conf), 0.68, 0.96))
    else:
        # Sum top-20 ImageNet probabilities mapped to our 5 garment categories
        # and apply temperature-calibrated normalization over the matched fashion synsets
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
                    top20_matched_mass += float(prob)
                    top20_has_garment = True
                    break

        best_cat = max(cat_mass, key=lambda k_cat: cat_mass[k_cat])
        total_matched = sum(cat_mass.values())

        # Check if any top-3 raw ImageNet prediction matches NON_GARMENT_BLOCKLIST
        raw_top3 = torch.topk(probs_raw, k=3)
        top3_labels = [WEIGHTS.meta["categories"][idx].lower() for idx in raw_top3.indices.tolist()]
        top3_matches_blocklist = any(
            any(blk in lbl_l for blk in NON_GARMENT_BLOCKLIST)
            for lbl_l in top3_labels
        )

        if top20_has_garment or total_matched > 0.01:
            pred_cat = best_cat
            # Temperature-calibrated normalization over the 5 category masses (T = 0.35)
            mass_vec = np.array([cat_mass[c] for c in CATEGORIES_LIST], dtype=np.float64)
            norm_mass = mass_vec / max(total_matched, 1e-6)
            temp_logits = norm_mass / 0.35
            temp_logits -= np.max(temp_logits)
            exp_scores = np.exp(temp_logits)
            calibrated_share = float(np.max(exp_scores / np.sum(exp_scores)))
            mass_boost = min(1.0, total_matched / 0.25)
            conf = float(np.clip(0.68 + 0.20 * calibrated_share + 0.08 * mass_boost, 0.68, 0.96))
        elif has_foreground_garment and not top3_matches_blocklist:
            pred_cat = "OUTERWEAR" if dom_color in {"Black", "Navy", "Gray", "Brown", "Burgundy"} else "TOP"
            conf = 0.82
        else:
            pred_cat = None
            conf = float(scores[0])

    # Enforce garment verification & inappropriate image safety gate:
    is_unsafe = (
        center_skin_ratio > 0.30
        or (top3_matches_blocklist and total_matched < 0.35)
        or (not top20_has_garment and total_matched < 0.12 and not has_foreground_garment)
    )

    if is_unsafe:
        return PredictResponse(
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
        final_cat = "OUTERWEAR" if dom_color in {"Black", "Navy", "Gray", "Brown", "Burgundy"} else "TOP"
        sub_category, material, pred_style, occasion, layer_role = CATEGORY_DEFAULT_METADATA[final_cat]

    suggested_name = f"{dom_color} {sub_category}" if (dom_color and sub_category) else None
    suggested_brand = "Studio Basics" if pred_style in {"FORMAL", "CLASSIC", "MINIMALIST"} else "Everyday Essentials"

    return PredictResponse(
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
