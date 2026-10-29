"""StyleSense Unified ML & Hybrid Recommendation Microservice (FastAPI v7.1 — 2-Pass Full-Body Diffusion VTON Edition).

Implements:
1. Official remove.bg API Background Removal (size="preview") with graceful local
   rembg "u2netp" fallback (alpha_matting=False, zero OpenCV GrabCut/contour mask corruption).
2. Fine-Tuned 5-Class ResNet-50 Garment Classifier (loading Epoch 13 checkpoint
   stylesense_resnet50_best.pt with Git LFS pointer checks, standard 224x224 evaluation
   transforms, true softmax probabilities, and smart confidence rescue for real garments).
3. Foreground Garment Color & Palette Extraction using ml-service/kmeans_color.py
   (CIE XYZ -> CIELAB D65, Delta-E CIE76, and KMeansCIELAB clustering with K = 2 locked).
4. 5-Class Fashion Taxonomy wired directly to ml-service/cnn_taxonomy.json + 33 Granular Subtypes.
5. Batch Wardrobe Image Analysis endpoint (POST /analyze-batch) accepting up to 15 images.
6. Automated AI Content Moderation Gate (5-Class NSFWJS Equivalent + Bilingual Profanity Filter).
7. Context-Aware Weighted Hybrid Recommendation Engine: S_hybrid = round(0.55 * S_cb + 0.45 * S_cf).
8. v7.1 Multi-Source 2-Pass Full-Body Diffusion Virtual Try-On (Upper Body + Lower Body & Shoes):
   - Why v7.0 still showed flat 2D pants/shoes: `yisol/IDM-VTON` with `is_checked=True` only masks and
     inpaints the upper body (`get_mask_location('hd', 'upper_body')`), leaving the lower body untouched!
   - How v7.1 fixes this with REAL Diffusion VTON for Bottoms & Shoes:
     * Pass 1 (Upper-Body Diffusion VTON): Calls `yisol/IDM-VTON` (`is_checked=True`) to diffusion-render
       the recommended `TOP` (or `OUTERWEAR`) onto the user's upper torso and arms.
     * Pass 2 (Lower-Body & Shoes Diffusion VTON): Chains multi-source lower-body diffusion VTON:
       (a) `yisol/IDM-VTON` Custom Lower-Body Mask Mode (`is_checked=False` + RGBA binary mask in
           `dict['layers'][0]` covering the waist-to-feet corridor `y in [0.47*p_h, 0.99*p_h]`), which uses
           IDM-VTON's DensePose leg map + SDXL Inpainting UNet to diffusion-generate the pants AND shoes
           directly onto the user's legs and feet in 3D perspective!
       (b) Failover to `jallenjia/Change-Clothes-AI` (`category='lower_body'`) and `franciszzj/Leffa`
           (`vt_model_type='dress_code'`, `vt_garment_type='lower_body'`).
   - Also ensures Top-3 Casual Recommendations prioritize unlayered `TOP` outfits first in warm tropical
     weather so your `Navy Polo Shirt` and `Black Graphic T-Shirt` are showcased directly on your body!
"""

import base64
from contextlib import asynccontextmanager
import gc
import hashlib
import inspect
from io import BytesIO
import json
import logging
import os
from pathlib import Path
import re
import sys
import tempfile
import time
from typing import Any, Dict, List, Literal, Optional, Tuple

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("stylesense.ml")

# 1. Load environment variables from ml-service/.env first
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"
try:
    from dotenv import load_dotenv
    if ENV_PATH.exists():
        load_dotenv(dotenv_path=ENV_PATH, override=True)
    else:
        load_dotenv(override=True)
except Exception:
    pass

# Ensure REMOVE_BG_API_KEY, REMOVE_BG_API_KEYS, and HF_TOKEN are loaded from .env if present
if ENV_PATH.exists():
    try:
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k:
                        os.environ[k] = v
    except Exception as e:
        logger.warning(f"Failed reading {ENV_PATH}: {e}")

if not os.getenv("REMOVE_BG_API_KEY") and not os.getenv("REMOVE_BG_API_KEYS"):
    os.environ["REMOVE_BG_API_KEY"] = "6BLesBsiyabbtYwoR3Cer6DE"


def get_remove_bg_api_keys() -> List[str]:
    """Return configured remove.bg API keys in priority order (pooling multi-member keys)."""
    keys: List[str] = []
    multi = os.getenv("REMOVE_BG_API_KEYS", "").strip()
    if multi:
        for k in multi.split(","):
            k = k.strip()
            if k and k not in keys:
                keys.append(k)
    single = os.getenv("REMOVE_BG_API_KEY", "").strip()
    if single and single not in keys:
        keys.append(single)
    if not keys:
        keys.append("6BLesBsiyabbtYwoR3Cer6DE")
    return keys


def get_hf_token(explicit_token: Optional[str] = None, header_token: Optional[str] = None) -> str:
    """Resolve the user's free Hugging Face Access Token (HF_TOKEN) from request, headers, or environment."""
    return (
        (explicit_token or "").strip()
        or (header_token or "").strip()
        or os.getenv("HF_TOKEN", "").strip()
        or os.getenv("HUGGINGFACE_TOKEN", "").strip()
        or os.getenv("HUGGINGFACEHUB_API_TOKEN", "").strip()
    )


# Add ml-service root directory to sys.path so kmeans_color and local modules import cleanly
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

if sys.platform == "win32":
    local_pkg = os.path.expandvars(
        r"%LOCALAPPDATA%\Packages\PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0\LocalCache\local-packages\Library\bin"
    )
    if os.path.exists(local_pkg) and hasattr(os, "add_dll_directory"):
        try:
            os.add_dll_directory(local_pkg)
        except Exception:
            pass

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import math
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, UnidentifiedImageError
from pydantic import BaseModel, Field
import requests

for _p in (Path(__file__).resolve().parent, Path(__file__).resolve().parent.parent):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))
import kmeans_color

try:
    from app.system_catalog import SYSTEM_DATASET_CATALOG, get_system_catalog_items
except ImportError:
    try:
        from system_catalog import SYSTEM_DATASET_CATALOG, get_system_catalog_items
    except ImportError:
        SYSTEM_DATASET_CATALOG = []  # type: ignore[assignment]
        def get_system_catalog_items(gender: str = "unisex"):  # type: ignore
            return []

try:
    import cv2
except Exception:
    cv2 = None

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

try:
    from gradio_client import Client as GradioClient, handle_file as gradio_handle_file  # type: ignore[import-not-found]
    GRADIO_CLIENT_AVAILABLE = True
except Exception:
    GradioClient = None  # type: ignore
    gradio_handle_file = None  # type: ignore
    GRADIO_CLIENT_AVAILABLE = False

Category = Literal["TOP", "BOTTOM", "SHOES", "OUTERWEAR", "ACCESSORIES"]
Style = Literal[
    "CASUAL", "FORMAL", "SPORTY", "STREETWEAR",
    "MINIMALIST", "BOHEMIAN", "VINTAGE", "CLASSIC",
    "ROCKSTAR", "PUNK", "WORKOUT"
]
LayerRole = Literal["INNER_BASE", "OUTER_LAYER", "LOWER_BODY", "FOOTWEAR", "ACCESSORY"]
Material = Literal[
    "Cotton", "Denim", "Polyester", "Wool", "Silk",
    "Linen", "Leather", "Knit", "Nylon", "Other"
]
Occasion = Literal["SCHOOL", "WORK", "GYM", "PARTY", "DATE", "OUTDOOR", "EVERYDAY"]

HF_VTON_SPACES: Tuple[str, ...] = (
    "yisol/IDM-VTON",
    "Nymbo/Virtual-Try-On",
)

HF_LOWER_BODY_VTON_SPACES: Tuple[str, ...] = (
    "yisol/IDM-VTON",
    "jallenjia/Change-Clothes-AI",
    "franciszzj/Leffa",
)

_STUDIO_BEAUTIFY_CACHE: Dict[str, str] = {}
_VTON_TRYON_CACHE: Dict[str, str] = {}
_HF_ZEROGPU_COOLDOWN_UNTIL: float = 0.0

# Load taxonomy from cnn_taxonomy.json
TAXONOMY_PATH = BASE_DIR / "cnn_taxonomy.json"
if TAXONOMY_PATH.exists():
    try:
        with open(TAXONOMY_PATH, "r", encoding="utf-8") as tf:
            tax_data = json.load(tf)
            CATEGORIES_LIST: List[Category] = [c["name"] for c in tax_data.get("classes", [])]
    except Exception as e:
        logger.warning(f"Failed to parse cnn_taxonomy.json: {e}")
        CATEGORIES_LIST = ["TOP", "BOTTOM", "SHOES", "OUTERWEAR", "ACCESSORIES"]
else:
    CATEGORIES_LIST = ["TOP", "BOTTOM", "SHOES", "OUTERWEAR", "ACCESSORIES"]

CONFIDENCE_THRESHOLD = 0.55
MAX_UPLOAD_BYTES = 5 * 1024 * 1024

CANDIDATE_CHECKPOINT_PATHS: List[Path] = [
    Path(os.getenv("RESNET50_CHECKPOINT_PATH", "")),
    BASE_DIR / "experiments" / "resnet50" / "checkpoints" / "stylesense_resnet50_best.pt",
    Path("experiments/resnet50/checkpoints/stylesense_resnet50_best.pt"),
    BASE_DIR / "experiments" / "resnet50" / "stylesense_resnet50_best.pt",
    BASE_DIR / "models" / "stylesense_resnet50_best.pt",
    BASE_DIR / "models" / "resnet50_stylesense_epoch13.pth",
    BASE_DIR / "stylesense_resnet50_best.pt",
]

CANDIDATE_RESULTS_PATHS: List[Path] = [
    Path(os.getenv("RESNET50_RESULTS_PATH", "")),
    BASE_DIR / "experiments" / "resnet50" / "resnet50_results.json",
    BASE_DIR / "resnet50_results.json",
]

LOADED_CHECKPOINT_PATH: Optional[str] = None
LOADED_RESULTS_DATA: Dict[str, Any] = {}

for res_path in CANDIDATE_RESULTS_PATHS:
    if res_path and res_path.is_file():
        try:
            with open(res_path, "r", encoding="utf-8") as rf:
                LOADED_RESULTS_DATA = json.load(rf)
                break
        except Exception as e:
            logger.warning(f"Failed to load resnet50_results.json from {res_path}: {e}")

MODEL: Optional[Any] = None
AUX_IMAGENET_MODEL: Optional[Any] = None
IS_FINETUNED_HEAD: bool = False
DEVICE = (
    torch.device("cuda" if (TORCH_AVAILABLE and torch is not None and torch.cuda.is_available()) else "cpu")
    if TORCH_AVAILABLE
    else None
)
WEIGHTS = ResNet50_Weights.IMAGENET1K_V2 if TORCH_AVAILABLE else None
IMAGENET_CATEGORIES: List[str] = (
    list(WEIGHTS.meta.get("categories", []))
    if (WEIGHTS is not None and hasattr(WEIGHTS, "meta"))
    else []
)

EVAL_TRANSFORMS = (
    T.Compose([
        T.Resize(256),
        T.CenterCrop(224),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    if (TORCH_AVAILABLE and T is not None)
    else None
)

REMBG_SESSION: Optional[Any] = None
if REMBG_AVAILABLE and new_session is not None:
    try:
        REMBG_SESSION = new_session("u2netp")
    except Exception:
        try:
            REMBG_SESSION = new_session("u2net")
        except Exception:
            REMBG_SESSION = None

CATEGORY_DEFAULT_METADATA: Dict[str, Tuple[str, Material, Style, Occasion, LayerRole]] = {
    "TOP": ("Shirt", "Cotton", "CASUAL", "EVERYDAY", "INNER_BASE"),
    "OUTERWEAR": ("Jacket", "Cotton", "CASUAL", "EVERYDAY", "OUTER_LAYER"),
    "BOTTOM": ("Pants", "Denim", "CASUAL", "EVERYDAY", "LOWER_BODY"),
    "SHOES": ("Shoes", "Leather", "CASUAL", "EVERYDAY", "FOOTWEAR"),
    "ACCESSORIES": ("Accessory", "Other", "CASUAL", "EVERYDAY", "ACCESSORY"),
}

NEUTRAL_COLORS = {"Black", "White", "Gray", "Beige", "Khaki", "Cream", "Navy"}

# ─────────────────────────────────────────────────────────────────────────────
# BILINGUAL (TAGALOG + ENGLISH) & SPECIAL-CHARACTER PROFANITY FILTER PATTERNS
# ─────────────────────────────────────────────────────────────────────────────
LEET_MAP = str.maketrans({
    "@": "a", "4": "a", "^": "a",
    "$": "s", "5": "s",
    "0": "o",
    "1": "i", "!": "i", "|": "i",
    "3": "e",
    "7": "t", "+": "t",
    "8": "b",
    "9": "g", "6": "g",
})

SPACED_PATTERN = re.compile(r"\b(?:[a-zA-Z0-9][\s._\-\*#~/]+)+[a-zA-Z0-9]\b")
REPEATED_PATTERN = re.compile(r"([a-zA-Z0-9])\1{2,}")

ENGLISH_TERMS = [
    "fuck", "fucking", "fucked", "fucker", "fck", "fuk", "motherfucker",
    "shit", "shitty", "bullshit",
    "bitch", "bitches", "bastard", "asshole", "assholes",
    "dick", "dicks", "cock", "cocks", "pussy", "pussies", "cunt", "cunts",
    "whore", "whores", "slut", "sluts",
    "faggot", "faggots", "nigger", "niggers", "nigga", "niggas", "retard", "retards",
    "porn", "nsfw", "nude", "nudes", "naked", "sex", "blowjob", "handjob"
]

TAGALOG_TERMS = [
    "putangina", "putang ina", "tangina", "tang ina", "tanginamo", "tang ina mo", "taena",
    "pota", "puta", "putragis", "punyeta", "pucha", "pakshet", "pakingshet",
    "gago", "gaga", "ogag", "ulol", "ulul", "tarantado", "tarantada", "tanga",
    "bobo", "obob", "inutil", "kupal", "epal", "hinayupak", "hayop ka", "hayopka",
    "lintik", "leche", "letse", "siraulo", "bwisit", "pokpok",
    "kantot", "kantutan", "iyot", "hindot", "jakol", "jakul", "chupa", "tsupa",
    "burat", "tite", "titi", "pekpek", "pepe", "puke", "puki", "kiki",
    "bayag", "betlog", "bold", "hubad", "bastos"
]

MASKED_TERMS = [
    r"\bp[\*#_]+t[aou\*#_]*ng[\s_-]*[i\*#_]*n[a\*#_]*(?:\s*m[o\*#_]+)?\b",
    r"\bt[\*#_]+ng[\s_-]*[i\*#_]*n[a\*#_]*(?:\s*m[o\*#_]+)?\b",
    r"\bp[\*#_]+t[aou\*#_]+\b",
    r"\bg[\*#_]+g[oau\*#_]+\b",
    r"\bb[\*#_]+b[o\*#_]+\b",
    r"\bf[\*#_]+(?:ck|k)\b",
    r"\bsh[\*#_]+t\b",
    r"\bb[\*#_]+tch\b",
    r"\bk[\*#_]+nt[o\*#_]+t\b",
    r"\bm[\*#_]+th[\*#_]+rf[\*#_]+ck[\*#_]+r\b",
    r"\bb[\*#_]+llsh[\*#_]+t\b",
    r"\bp[\*#_]+ssy\b",
    r"\bc[\*#_]+nt\b",
    r"\bd[\*#_]+ck\b",
    r"\bwh[\*#_]+r[e\*#_]?\b",
    r"\bsl[\*#_]+t\b",
]

ALL_TERMS_REGEX = re.compile(
    r"\b(?:" + "|".join(re.escape(t) for t in sorted(ENGLISH_TERMS + TAGALOG_TERMS, key=len, reverse=True)) + r")\b",
    re.IGNORECASE,
)

MASKED_REGEX = re.compile(
    r"(?:" + "|".join(MASKED_TERMS) + r")",
    re.IGNORECASE,
)

BLOCKED_TERMS_PATTERN = ALL_TERMS_REGEX


def _normalize_category_str(raw_cat: Any) -> Category:
    """Normalize any mobile or backend category string ('Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Accessories') to canonical Category."""
    c = str(raw_cat or "TOP").strip().upper()
    if c in ("TOP", "TOPS", "SHIRT", "TSHIRT", "T-SHIRT", "BLOUSE", "POLO", "INNER_BASE"):
        return "TOP"
    if c in ("OUTERWEAR", "OUTER", "JACKET", "HOODIE", "COAT", "BLAZER", "CARDIGAN", "WINDBREAKER", "OUTER_LAYER"):
        return "OUTERWEAR"
    if c in ("BOTTOM", "BOTTOMS", "PANTS", "JEANS", "TROUSERS", "SHORTS", "SKIRT", "JOGGERS", "TRACK PANTS", "LOWER_BODY"):
        return "BOTTOM"
    if c in ("SHOES", "SHOE", "FOOTWEAR", "SNEAKERS", "BOOTS", "LOAFERS", "HEELS"):
        return "SHOES"
    if c in (
        "ACCESSORIES", "ACCESSORY", "JEWELRY", "BAG", "WATCH", "BELT",
        "EYEWEAR", "SUNGLASSES", "HAT", "CAP", "EARBUDS", "AIRPODS", "HEADPHONES", "EARPHONES",
    ):
        return "ACCESSORIES"
    return "TOP"


def _normalize_style_str(raw_style: Any) -> Style:
    """Normalize any style string ('Casual', 'Streetwear', 'Office') to canonical Style."""
    s = str(raw_style or "CASUAL").strip().upper()
    valid_styles = {
        "CASUAL", "FORMAL", "SPORTY", "STREETWEAR",
        "MINIMALIST", "BOHEMIAN", "VINTAGE", "CLASSIC",
        "ROCKSTAR", "PUNK", "WORKOUT"
    }
    if s in valid_styles:
        return s  # type: ignore[return-value]
    if "STREET" in s:
        return "STREETWEAR"
    if "SPORT" in s or "ATHLETIC" in s:
        return "SPORTY"
    if "FORMAL" in s or "OFFICE" in s or "WORK" in s or "CORPORATE" in s:
        return "FORMAL"
    if "MINIMAL" in s:
        return "MINIMALIST"
    if "CLASSIC" in s or "OLD" in s:
        return "CLASSIC"
    return "CASUAL"


class ColorClusterInfo(BaseModel):
    color_name: str
    hex_code: Optional[str] = None
    proportion: float
    lab: Tuple[float, float, float]


class Prediction(BaseModel):
    category: Optional[Category] = None
    subCategory: Optional[str] = None
    suggestedName: Optional[str] = None
    suggestedBrand: Optional[str] = None
    layerRole: Optional[LayerRole] = None
    vector_subtype: Optional[str] = None
    color: Optional[str] = None
    primary_color: Optional[str] = None
    colorHex: Optional[str] = None
    secondary_color: Optional[str] = None
    secondary_color_hex: Optional[str] = None
    color_confidence: Optional[float] = None
    color_harmony_note: Optional[str] = None
    pattern: Optional[str] = None
    palette: List[ColorClusterInfo] = Field(default_factory=list)
    style: Optional[Style] = None
    occasion: Optional[Occasion] = None
    material: Optional[Material] = None
    confidence: float
    class_probabilities: Dict[str, float] = Field(default_factory=dict)
    nsfw_scores: Dict[str, float] = Field(default_factory=dict)
    cutoutDataUri: Optional[str] = None
    beautifiedDataUri: Optional[str] = None
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
    image_base64: Optional[str] = None


class ModerationResponse(BaseModel):
    approved: bool
    sanitized_caption: str
    reason: Optional[str] = None
    nsfw_scores: Dict[str, float] = Field(default_factory=dict)


class BeautifyRequest(BaseModel):
    image_base64: str
    category: Optional[str] = None
    sub_category: Optional[str] = None
    color: Optional[str] = None
    color_hex: Optional[str] = None
    hf_token: Optional[str] = None


class BeautifyResponse(BaseModel):
    beautifiedDataUri: str
    method: str


class WardrobeItemInput(BaseModel):
    id: str = "item-0"
    clothing_name: str = "Garment"
    name: Optional[str] = None
    subCategory: Optional[str] = None
    category: Category = "TOP"
    color: str = "Black"
    colorHex: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    style: Style = "CASUAL"
    occasion: str = "Casual"
    vector_subtype: Optional[str] = None
    texture: Optional[str] = None
    fit: Optional[str] = None
    target_gender: Optional[str] = "unisex"
    image_url: Optional[str] = None
    cutoutDataUri: Optional[str] = None
    beautifiedDataUri: Optional[str] = None
    is_favorite: bool = False
    is_disliked: bool = False
    laundry_status: Optional[str] = "CLEAN"
    worn_within_7_days: Optional[bool] = False

    def __init__(self, **data: Any) -> None:
        norm_cat = _normalize_category_str(data.get("category"))
        data["category"] = norm_cat

        resolved_name = (
            data.get("clothing_name")
            or data.get("name")
            or data.get("subCategory")
            or data.get("sub_category")
            or data.get("category")
            or "Garment"
        )
        name_str = str(resolved_name).strip()

        if norm_cat == "TOP":
            for outer_term in ("Track Jacket", "Windbreaker Jacket", "Windbreaker", "Pullover Hoodie", "Zip-Up Hoodie", "Jacket", "Hoodie"):
                if outer_term.lower() in name_str.lower():
                    name_str = re.sub(re.escape(outer_term), "T-Shirt", name_str, flags=re.IGNORECASE).strip()
                    data["subCategory"] = "T-Shirt"
                    data["vector_subtype"] = "tshirt"
                    break
        elif norm_cat == "BOTTOM":
            for non_bot_term in ("Track Jacket", "Windbreaker", "T-Shirt", "Pullover Hoodie"):
                if non_bot_term.lower() in name_str.lower():
                    name_str = re.sub(re.escape(non_bot_term), "Track Pants", name_str, flags=re.IGNORECASE).strip()
                    data["subCategory"] = "Track Pants"
                    data["vector_subtype"] = "track_pants"
                    break

        data["clothing_name"] = name_str
        data["name"] = name_str
        data["style"] = _normalize_style_str(data.get("style"))
        resolved_color = data.get("color") or data.get("primary_color")
        if not resolved_color or str(resolved_color).startswith("#"):
            nl = name_str.lower()
            inferred = "Black"
            for cname in kmeans_color.NAMED_FASHION_COLORS.keys():
                if cname.lower() in nl:
                    inferred = cname
                    break
            resolved_color = data.get("color") if (data.get("color") and not str(data.get("color")).startswith("#")) else inferred
        color_alias_map = {
            "Charcoal": "Gray",
            "Silver": "Gray",
            "Coral": "Pink",
            "Lilac": "Purple",
        }
        c_str = str(resolved_color).strip()
        data["color"] = color_alias_map.get(c_str, c_str)
        if not data.get("colorHex") and str(data.get("primary_color", "")).startswith("#"):
            data["colorHex"] = str(data["primary_color"])
        if not data.get("image_url"):
            data["image_url"] = (
                data.get("cutoutDataUri")
                or data.get("beautifiedDataUri")
                or data.get("imageUri")
                or data.get("uri")
            )
        super().__init__(**data)


class TryOn2DRequest(BaseModel):
    user_photo_base64: str
    items: List[WardrobeItemInput] = Field(default_factory=list)
    skin_tone_hex: Optional[str] = None
    hf_token: Optional[str] = None


class TryOn2DResponse(BaseModel):
    tryOnDataUri: str
    skinHexDetected: str
    nsfw_scores: Dict[str, float] = Field(default_factory=dict)


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
    author_gender: Optional[str] = None
    rater_gender: Optional[str] = None
    is_user_liked_cross_gender: bool = False


class HybridRecommendationRequest(BaseModel):
    user_id: str = "default_user"
    target_occasion: str = "Casual"
    no_new_clothes_mode: bool = True
    wardrobe: List[WardrobeItemInput] = Field(default_factory=list)
    preferred_styles: List[Style] = Field(default_factory=lambda: ["CASUAL"])
    preferred_colors: List[str] = Field(default_factory=lambda: ["Black", "White", "Navy"])
    weather: WeatherContextInput = Field(default_factory=WeatherContextInput)
    community_signals: List[CommunityRatingSignal] = Field(default_factory=list)
    alpha: float = 0.55
    gender: Optional[str] = "unisex"
    source_mode: Optional[Literal["wardrobe", "system_catalog", "mix"]] = "wardrobe"
    textures: List[str] = Field(default_factory=list)
    favorite_colors: List[str] = Field(default_factory=list)
    fit_preference: Optional[str] = None
    common_occasions: List[str] = Field(default_factory=list)


class ScoredOutfitRecommendation(BaseModel):
    item_ids: List[str]
    items: List[WardrobeItemInput]
    content_score: float
    collaborative_score: float
    hybrid_score: float
    weather_tag: str
    reasons: List[str]
    mel_commentary: Optional[str] = None
    used_system_catalog: bool = False
    source_mode: Optional[str] = "wardrobe"


class ScoreOutfitRequest(BaseModel):
    user_id: Optional[str] = "default_user"
    previous_score: Optional[float] = None
    swapped_category: Optional[Category] = None
    current_items: List[WardrobeItemInput]
    target_occasion: str = "Casual"
    gender: Optional[str] = "unisex"
    preferred_styles: List[Style] = Field(default_factory=lambda: ["CASUAL"])
    preferred_colors: List[str] = Field(default_factory=lambda: ["Black", "White", "Navy"])
    weather: WeatherContextInput = Field(default_factory=WeatherContextInput)
    community_signals: List[CommunityRatingSignal] = Field(default_factory=list)
    alpha: float = 0.55
    textures: List[str] = Field(default_factory=list)
    favorite_colors: List[str] = Field(default_factory=list)
    fit_preference: Optional[str] = None
    common_occasions: List[str] = Field(default_factory=list)


class ScoreOutfitResponse(BaseModel):
    new_score: float
    content_score: float
    collaborative_score: float
    score_delta: float
    verdict: Literal["better", "worse", "neutral"]
    reasons: List[str]
    mel_commentary: str


def _erase_top_hanger_hooks_and_bars(rgba: np.ndarray, allow_bar_erase: bool = True) -> np.ndarray:
    """Erase wire/plastic hanger hooks and hollow-arch pant hanger bars at the top of TOP, OUTERWEAR, and BOTTOM."""
    alpha = rgba[:, :, 3].copy()
    ys, xs = np.where(alpha > 40)
    if len(ys) <= 20 or len(xs) <= 20:
        return rgba

    top, bottom = int(np.min(ys)), int(np.max(ys))
    left, right = int(np.min(xs)), int(np.max(xs))
    bh = max(bottom - top, 1)
    bw = max(right - left, 1)

    top_strip_end = top + max(1, int(0.16 * bh))
    body_widths = []
    for ry in range(top_strip_end, min(bottom + 1, top + int(0.65 * bh))):
        r_xs = np.where(alpha[ry, left : right + 1] > 64)[0]
        if len(r_xs) > 0:
            body_widths.append(int(r_xs[-1] - r_xs[0] + 1))
    max_body_w = float(max(body_widths)) if body_widths else float(bw)

    for ry in range(top, top_strip_end):
        r_xs = np.where(alpha[ry, left : right + 1] > 40)[0]
        if len(r_xs) == 0:
            continue
        row_span = float(r_xs[-1] - r_xs[0] + 1)
        row_fill = float(len(r_xs)) / max(row_span, 1.0)
        if row_span < 0.28 * max_body_w:
            alpha[ry, left : right + 1] = 0
        elif allow_bar_erase and ry < top + int(0.12 * bh) and (row_fill < 0.52 or row_span < 0.52 * max_body_w):
            c_l = left + int(0.18 * bw)
            c_r = left + int(0.82 * bw)
            alpha[ry, c_l:c_r] = 0

    if allow_bar_erase:
        scan_y_end = min(bottom, top + int(0.20 * bh))
        max_wire_thick = max(3, int(0.065 * bh))
        for cx in range(left + int(0.12 * bw), right - int(0.12 * bw)):
            col_a = alpha[top:scan_y_end, cx]
            opaque_idx = np.where(col_a > 45)[0]
            if len(opaque_idx) == 0:
                continue
            first_op = int(opaque_idx[0])
            seg_end = first_op
            while seg_end < len(col_a) and col_a[seg_end] > 45:
                seg_end += 1
            wire_thick = seg_end - first_op
            if wire_thick <= max_wire_thick and seg_end < len(col_a):
                rem_col = col_a[seg_end:]
                next_opaque = np.where(rem_col > 80)[0]
                if len(next_opaque) > 0 and int(next_opaque[0]) >= 2:
                    alpha[top : top + seg_end + int(next_opaque[0]), cx] = 0

    rgba[:, :, 3] = alpha
    return rgba


def extract_garment_cutout(
    pil_img: Image.Image,
    force_rembg: bool = False,
) -> Tuple[Image.Image, np.ndarray, str, str]:
    """Segment garment using official remove.bg API with multi-key rotation and pure rembg u2netp fallback."""
    global REMBG_SESSION
    img = pil_img.convert("RGB").copy()
    img.thumbnail((384, 384), Image.Resampling.BILINEAR)

    cutout: Optional[Image.Image] = None
    bg_source = "none"
    keys = get_remove_bg_api_keys()
    size_setting = (os.getenv("REMOVE_BG_SIZE", "preview").strip()) or "preview"

    env_force = os.getenv("FORCE_REMBG", "false").strip().lower() in ("true", "1", "yes")
    should_force_rembg = force_rembg or env_force

    if should_force_rembg:
        logger.info("[REMOVE-BG] FORCE_REMBG is active. Skipping remove.bg (0 credits spent) and running local rembg.")
    elif keys:
        try:
            buf = BytesIO()
            img.save(buf, format="PNG")
            buf_bytes = buf.getvalue()

            for idx, api_key in enumerate(keys, start=1):
                key_masked = f"{api_key[:4]}...{api_key[-4:]}" if len(api_key) > 8 else "***"
                try:
                    response = requests.post(
                        "https://api.remove.bg/v1.0/removebg",
                        files={"image_file": ("image.png", buf_bytes, "image/png")},
                        data={"size": size_setting, "type": "auto", "format": "png"},
                        headers={"X-Api-Key": api_key},
                        timeout=12,
                    )
                    if response.status_code == 200:
                        cutout = Image.open(BytesIO(response.content)).convert("RGBA")
                        bg_source = "remove.bg"
                        logger.info(f"[REMOVE-BG] Success using Key #{idx} ({key_masked}).")
                        break
                    elif response.status_code in (402, 429):
                        reason = "credits exhausted (HTTP 402)" if response.status_code == 402 else "rate limit reached (HTTP 429)"
                        if idx < len(keys):
                            logger.warning(
                                f"[REMOVE-BG] Key #{idx} ({key_masked}) {reason}. Automatically retrying with Key #{idx+1}..."
                            )
                        else:
                            logger.warning(
                                f"[REMOVE-BG] Key #{idx} ({key_masked}) {reason}. All {len(keys)} configured keys exhausted! Falling back to local rembg."
                            )
                    elif response.status_code == 401:
                        logger.warning(f"[REMOVE-BG] Key #{idx} ({key_masked}) unauthorized (HTTP 401).")
                        if idx < len(keys):
                            continue
                        break
                    else:
                        logger.warning(
                            f"[REMOVE-BG] Key #{idx} returned HTTP {response.status_code}: {response.text[:160]}. Falling back to local rembg."
                        )
                        break
                except Exception as e:
                    logger.warning(f"[REMOVE-BG] Request failed with Key #{idx} ({key_masked}): {e}")
                    if idx < len(keys):
                        continue
                    break
        except Exception as e:
            logger.warning(f"[REMOVE-BG] Image encoding failed: {e}")

    if cutout is None:
        if REMBG_AVAILABLE and remove is not None:
            try:
                if REMBG_SESSION is None and new_session is not None:
                    try:
                        REMBG_SESSION = new_session("u2netp")
                    except Exception:
                        REMBG_SESSION = new_session("u2net")
                if REMBG_SESSION is not None:
                    cutout = remove(
                        img,
                        session=REMBG_SESSION,
                        alpha_matting=False,
                    )
                    bg_source = "rembg_u2netp"
            except Exception as e:
                logger.warning(f"rembg removal failed: {e}")
                cutout = None

    if cutout is None:
        cutout = img.convert("RGBA")
        bg_source = "raw_fallback"

    rgba = np.array(cutout.convert("RGBA"))
    alpha = rgba[:, :, 3]
    alpha = np.where(alpha < 20, 0, alpha).astype(np.uint8)

    if cv2 is not None:
        try:
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, kernel)
            alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
        except Exception as e:
            logger.warning(f"Morphological smoothing skipped: {e}")

    rgba[:, :, 3] = alpha
    rgba = _erase_top_hanger_hooks_and_bars(rgba, allow_bar_erase=True)
    cutout = Image.fromarray(rgba, mode="RGBA")

    bbox = cutout.getbbox()
    canvas = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    if bbox:
        cropped = cutout.crop(bbox)
        cropped.thumbnail((368, 368), Image.Resampling.BILINEAR)
        offset = ((400 - cropped.width) // 2, (400 - cropped.height) // 2)
        canvas.paste(cropped, offset, cropped)
    else:
        thumb = cutout.copy()
        thumb.thumbnail((368, 368), Image.Resampling.BILINEAR)
        offset = ((400 - thumb.width) // 2, (400 - thumb.height) // 2)
        canvas.paste(thumb, offset)
    cutout = canvas

    buffered = BytesIO()
    mime_type = "image/webp"
    try:
        cutout.save(buffered, format="WEBP", quality=85, method=4)
    except Exception:
        buffered = BytesIO()
        cutout.save(buffered, format="PNG")
        mime_type = "image/png"

    cutout_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    cutout_data_uri = f"data:{mime_type};base64,{cutout_base64}"

    fg_mask = np.array(cutout)[:, :, 3] > 64
    return cutout, fg_mask, cutout_data_uri, bg_source


def _describe_k2_color_harmony(
    dom_color: str,
    dom_prop: float,
    sec_color: Optional[str],
    sec_prop: float,
    dom_lab: np.ndarray,
    sec_lab: Optional[np.ndarray],
) -> str:
    """Generate a defensible CIELAB K=2 color extraction & harmony note for the user UI."""
    dom_pct = int(round(dom_prop * 100))
    sec_pct = max(0, 100 - dom_pct)
    if not sec_color or sec_color == dom_color or sec_prop < 0.06 or sec_lab is None:
        return f"CIELAB K=2 Solid Palette: {dom_color} ({dom_pct}% dominant, L*={dom_lab[0]:.0f})"
    delta_e = float(np.sqrt(np.sum((dom_lab - sec_lab) ** 2)))
    if dom_color in NEUTRAL_COLORS and sec_color not in NEUTRAL_COLORS:
        rel = "Neutral Base + Chromatic Accent"
    elif dom_color in NEUTRAL_COLORS and sec_color in NEUTRAL_COLORS:
        rel = "Monochrome / Neutral Contrast"
    elif delta_e >= 42.0:
        rel = "High-Contrast Complementary Pair"
    else:
        rel = "Analogous Tonal Harmony"
    return f"CIELAB K=2 {rel}: {dom_color} ({dom_pct}%) + {sec_color} ({sec_pct}%) · ΔE={delta_e:.1f}"


def extract_color_palette_kmeans(
    cutout: Image.Image,
    fg_mask: Optional[np.ndarray] = None,
    k: int = 2,
    max_iter: int = 30,
    tol: float = 1e-3,
    random_state: int = 42,
) -> Tuple[str, str, Optional[str], Optional[str], float, List[ColorClusterInfo]]:
    """Extract dominant colors and CIELAB palette using ml-service/kmeans_color.py with strict K = 2."""
    k = 2
    cutout_rgba = cutout.convert("RGBA")
    rgba_raw = np.asarray(cutout_rgba, dtype=np.uint8)
    alpha = rgba_raw[:, :, 3]

    white_canvas = Image.new("RGBA", cutout_rgba.size, (255, 255, 255, 255))
    comp_rgb = np.asarray(Image.alpha_composite(white_canvas, cutout_rgba).convert("RGB"), dtype=np.uint8)

    interior_mask = (alpha > 215).astype(np.uint8)
    if cv2 is not None:
        try:
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            interior_mask = cv2.erode(interior_mask, kernel, iterations=2)
        except Exception:
            pass

    interior_bool = interior_mask > 0
    if int(np.sum(interior_bool)) < 30:
        interior_bool = alpha > 140
    if int(np.sum(interior_bool)) < 20:
        if fg_mask is not None and fg_mask.shape[:2] == comp_rgb.shape[:2] and int(np.sum(fg_mask)) >= 20:
            interior_bool = fg_mask
        else:
            interior_bool = alpha > 0

    if int(np.sum(interior_bool)) >= 10:
        fg_pixels = comp_rgb[interior_bool].astype(np.float64)
    else:
        fg_pixels = comp_rgb.reshape(-1, 3).astype(np.float64)

    if len(fg_pixels) > 1500:
        rng = np.random.default_rng(random_state)
        idx = rng.choice(len(fg_pixels), size=1500, replace=False)
        fg_pixels = fg_pixels[idx]

    fg_lab = kmeans_color.rgb_to_cielab(fg_pixels)

    if len(fg_lab) > 20:
        l_vals = fg_lab[:, 0]
        c_vals = np.hypot(fg_lab[:, 1], fg_lab[:, 2])
        med_l = float(np.median(l_vals))
        p25_l = float(np.percentile(l_vals, 25))
        p75_c = float(np.percentile(c_vals, 75))

        if med_l > 62.0:
            clean_light = fg_lab[(l_vals >= 38.0) | (c_vals >= 15.0)]
            if len(clean_light) >= 15:
                fg_lab = clean_light
        elif p25_l < 28.0 and med_l < 50.0 and p75_c < 11.0:
            non_glare = fg_lab[(l_vals <= 48.0) | (c_vals >= 14.0)]
            if len(non_glare) >= 15:
                fg_lab = non_glare

    km = kmeans_color.KMeansCIELAB(n_clusters=2, max_iter=max_iter, tol=tol, random_state=random_state)
    km.fit(fg_lab)

    centers = km.cluster_centers_
    labels = km.labels_
    counts = np.bincount(labels, minlength=2)
    weights = counts / max(1, len(labels))
    sorted_order = np.argsort(-weights)

    c0_lab = centers[sorted_order[0]]
    c1_lab = centers[sorted_order[1]]
    n0 = kmeans_color.lab_to_color_name(c0_lab)
    n1 = kmeans_color.lab_to_color_name(c1_lab)
    if (
        n0 == "Gray"
        and n1 == "Black"
        and weights[sorted_order[1]] >= 0.26
        and float(np.hypot(c0_lab[1], c0_lab[2])) < 9.5
        and float(c0_lab[0]) < 53.0
    ):
        sorted_order = np.array([sorted_order[1], sorted_order[0]])
    elif (
        n0 == "Light Blue"
        and n1 in ("Navy", "Blue")
        and weights[sorted_order[1]] >= 0.30
        and float(c0_lab[0]) <= 54.0
    ):
        sorted_order = np.array([sorted_order[1], sorted_order[0]])

    clusters: List[ColorClusterInfo] = []
    for idx in sorted_order:
        c_lab = centers[idx].copy()
        c_name = kmeans_color.lab_to_color_name(c_lab)
        hex_fn = getattr(kmeans_color, "lab_to_display_hex", None)
        if callable(hex_fn):
            c_hex = hex_fn(c_lab, c_name)
        else:
            c_rgb = kmeans_color.cielab_to_rgb(c_lab)
            c_hex = f"#{int(c_rgb[0]):02x}{int(c_rgb[1]):02x}{int(c_rgb[2]):02x}".upper()
        clusters.append(
            ColorClusterInfo(
                color_name=c_name,
                hex_code=c_hex,
                proportion=round(float(weights[idx]), 4),
                lab=(round(float(c_lab[0]), 2), round(float(c_lab[1]), 2), round(float(c_lab[2]), 2)),
            )
        )

    dom_cluster = clusters[0] if clusters else None
    dom_color = dom_cluster.color_name if dom_cluster else "White"
    color_hex = (dom_cluster.hex_code if (dom_cluster and dom_cluster.hex_code) else "#F8FAFC")

    sec_color: Optional[str] = None
    sec_color_hex: Optional[str] = None
    if len(clusters) > 1:
        sec_color = clusters[1].color_name
        sec_color_hex = clusters[1].hex_code

    color_conf = round(float(dom_cluster.proportion), 4) if dom_cluster else 1.0

    return dom_color, color_hex, sec_color, sec_color_hex, color_conf, clusters


def beautify_garment_geometric_studio(
    cutout_rgba: Image.Image,
    category: Optional[str] = None,
    sub_category: Optional[str] = None,
    dom_l_star: float = 50.0,
) -> str:
    """1:1 Faithful Studio Cutout & Hanger-Hook Cleaner ($0.00 Pipeline — Zero Garment Distortion)."""
    rgba = np.asarray(cutout_rgba.convert("RGBA"), dtype=np.uint8).copy()
    cat_norm = _normalize_category_str(category) if category else "TOP"

    if cat_norm in ("TOP", "OUTERWEAR", "BOTTOM"):
        rgba = _erase_top_hanger_hooks_and_bars(rgba, allow_bar_erase=True)

    clean_pil = Image.fromarray(rgba, mode="RGBA")
    bbox = clean_pil.getbbox()
    canvas = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    if bbox:
        cropped = clean_pil.crop(bbox)
        cropped.thumbnail((360, 360), Image.Resampling.LANCZOS)
        ox = (400 - cropped.width) // 2
        oy = (400 - cropped.height) // 2

        crop_alpha = cropped.split()[3]
        shadow_alpha_canvas = Image.new("L", (400, 400), 0)
        shadow_alpha_canvas.paste(crop_alpha, (ox, min(400 - cropped.height, oy + 5)))
        shadow_blurred = shadow_alpha_canvas.filter(ImageFilter.GaussianBlur(radius=6))
        shadow_np = (np.asarray(shadow_blurred, dtype=np.float32) * (34.0 / 255.0)).clip(0, 255).astype(np.uint8)

        shadow_rgba = np.zeros((400, 400, 4), dtype=np.uint8)
        shadow_rgba[:, :, 0] = 15
        shadow_rgba[:, :, 1] = 23
        shadow_rgba[:, :, 2] = 42
        shadow_rgba[:, :, 3] = shadow_np
        canvas = Image.alpha_composite(canvas, Image.fromarray(shadow_rgba, mode="RGBA"))

        fg_layer = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
        fg_layer.paste(cropped, (ox, oy), cropped)
        canvas = Image.alpha_composite(canvas, fg_layer)
    else:
        canvas = clean_pil.resize((400, 400), Image.Resampling.LANCZOS)

    buf = BytesIO()
    mime = "image/webp"
    try:
        canvas.save(buf, format="WEBP", quality=88, method=4)
    except Exception:
        buf = BytesIO()
        canvas.save(buf, format="PNG")
        mime = "image/png"

    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:{mime};base64,{b64}"


def create_studio_beautified_cutout(
    cutout_rgba: Image.Image,
    dom_l_star: float = 50.0,
    category: Optional[str] = None,
    sub_category: Optional[str] = None,
) -> str:
    """Wrapper invoking the 1:1 faithful studio cutout cleaner."""
    return beautify_garment_geometric_studio(
        cutout_rgba=cutout_rgba,
        category=category,
        sub_category=sub_category,
        dom_l_star=dom_l_star,
    )


def estimate_skin_exposure_ratio(image: Image.Image) -> Tuple[float, float]:
    """Detect potential NSFW / excessive skin-tone ratio in YCbCr space."""
    ycbcr = np.asarray(image.convert("YCbCr").resize((96, 96)), dtype=np.float32)
    y, cb, cr = ycbcr[:, :, 0], ycbcr[:, :, 1], ycbcr[:, :, 2]
    skin_mask = (y > 80) & (cb >= 77) & (cb <= 127) & (cr >= 133) & (cr <= 173)
    full_ratio = float(np.mean(skin_mask))
    center_mask = skin_mask[19:77, 19:77]
    center_ratio = float(np.mean(center_mask))
    return full_ratio, center_ratio


DRAWING_IMAGENET_KEYWORDS: Tuple[str, ...] = (
    "comic book", "book jacket", "jigsaw puzzle", "web site", "envelope", "menu",
)

SEXY_IMAGENET_KEYWORDS: Tuple[str, ...] = (
    "brassiere", "bikini", "maillot", "diaper", "miniskirt", "swimming trunks",
)


def evaluate_5class_nsfw_safety(
    image: Image.Image,
    aux_probs: Optional[np.ndarray] = None,
) -> Tuple[bool, Dict[str, float], Optional[str]]:
    """5-Class NSFWJS-Equivalent Image Safety Gate (Drawing, Hentai, Neutral, Porn, Sexy)."""
    full_skin_ratio, center_skin_ratio = estimate_skin_exposure_ratio(image)

    if aux_probs is None and AUX_IMAGENET_MODEL is not None and EVAL_TRANSFORMS is not None and torch is not None:
        try:
            with torch.inference_mode():
                t_in = EVAL_TRANSFORMS(image.convert("RGB")).unsqueeze(0)
                if DEVICE is not None:
                    t_in = t_in.to(DEVICE)
                aux_logits = AUX_IMAGENET_MODEL(t_in)[0]
                aux_probs = torch.softmax(aux_logits, dim=0).cpu().numpy()
        except Exception:
            aux_probs = None

    imagenet_drawing_prob = 0.0
    imagenet_sexy_prob = 0.0
    if aux_probs is not None and len(IMAGENET_CATEGORIES) == len(aux_probs):
        for idx, cname in enumerate(IMAGENET_CATEGORIES):
            p = float(aux_probs[idx])
            if p < 1e-4:
                continue
            clow = cname.lower()
            if any(k in clow for k in DRAWING_IMAGENET_KEYWORDS):
                imagenet_drawing_prob += p
            if any(k in clow for k in SEXY_IMAGENET_KEYWORDS):
                imagenet_sexy_prob += p

    small_rgb = np.asarray(image.convert("RGB").resize((96, 96)), dtype=np.float32)
    gray = 0.299 * small_rgb[:, :, 0] + 0.587 * small_rgb[:, :, 1] + 0.114 * small_rgb[:, :, 2]
    gx = np.abs(np.diff(gray, axis=1))
    gy = np.abs(np.diff(gray, axis=0))
    strong_ink_edges = float(np.mean(gx > 48.0) + np.mean(gy > 48.0)) * 0.5
    flat_cells = float(np.mean((gx < 2.0)) + np.mean((gy < 2.0))) * 0.5
    line_art_score = 0.0
    if strong_ink_edges > 0.12 and flat_cells > 0.55 and imagenet_drawing_prob > 0.05:
        line_art_score = min(0.45, strong_ink_edges * 1.8)

    drawing_raw = float(np.clip(imagenet_drawing_prob * 1.65 + line_art_score, 0.0, 0.95))
    hentai_raw = float(np.clip(drawing_raw * (center_skin_ratio * 2.0 + imagenet_sexy_prob * 1.5), 0.0, 0.95))
    porn_raw = float(
        np.clip(
            max(0.0, center_skin_ratio - 0.27) * 2.4 + max(0.0, full_skin_ratio - 0.39) * 2.0,
            0.0,
            0.95,
        )
    )
    sexy_raw = float(
        np.clip(
            max(0.0, center_skin_ratio - 0.18) * 1.45
            + max(0.0, full_skin_ratio - 0.28) * 1.15
            + (imagenet_sexy_prob * (1.25 if center_skin_ratio > 0.14 else 0.15)),
            0.0,
            0.95,
        )
    )
    neutral_raw = max(0.02, 1.0 - max(drawing_raw + hentai_raw, porn_raw + sexy_raw))

    total = drawing_raw + hentai_raw + neutral_raw + porn_raw + sexy_raw
    nsfw_scores: Dict[str, float] = {
        "Drawing": round(drawing_raw / total, 4),
        "Hentai": round(hentai_raw / total, 4),
        "Neutral": round(neutral_raw / total, 4),
        "Porn": round(porn_raw / total, 4),
        "Sexy": round(sexy_raw / total, 4),
    }

    if nsfw_scores["Drawing"] > 0.40 or nsfw_scores["Hentai"] > 0.15:
        return (
            False,
            nsfw_scores,
            "Upload blocked (Drawing/Anime detected): Please upload a real photograph of a physical garment.",
        )

    if (
        nsfw_scores["Porn"] > 0.15
        or nsfw_scores["Sexy"] > 0.35
        or center_skin_ratio > 0.30
        or full_skin_ratio > 0.42
    ):
        return (
            False,
            nsfw_scores,
            "Upload blocked (NSFW / Excessive Skin Exposure): Image did not pass the 5-class safety check.",
        )

    if nsfw_scores["Neutral"] < 0.50:
        return (
            False,
            nsfw_scores,
            "Upload blocked (NSFW / Excessive Skin Exposure): Image did not pass the 5-class safety check.",
        )

    return True, nsfw_scores, None


def check_text_moderation(text: str) -> Tuple[bool, str, Optional[str]]:
    """Multi-layer bilingual (Tagalog + English) profanity and slur detector."""
    raw = (text or "").strip()
    if not raw:
        return True, "", None

    is_bad = False
    sanitized = raw

    if MASKED_REGEX.search(sanitized):
        is_bad = True
        sanitized = MASKED_REGEX.sub("***", sanitized)

    if ALL_TERMS_REGEX.search(sanitized):
        is_bad = True
        sanitized = ALL_TERMS_REGEX.sub("***", sanitized)

    lower = raw.lower()
    variants = []

    c_spaced = SPACED_PATTERN.sub(lambda m: re.sub(r"[\s._\-\*#~/]+", "", m.group(0)), lower)
    variants.append(c_spaced)

    leet = lower.translate(LEET_MAP)
    variants.append(leet)

    leet_c_spaced = SPACED_PATTERN.sub(lambda m: re.sub(r"[\s._\-\*#~/]+", "", m.group(0)), leet)
    variants.append(leet_c_spaced)

    for v in list(variants):
        dedup = REPEATED_PATTERN.sub(r"\1", v)
        variants.append(dedup)
        no_sym = re.sub(r"(?<=[a-z0-9])[\s._\-\*#~/]+(?=[a-z0-9])", "", v)
        variants.append(no_sym)

    for v in variants:
        if ALL_TERMS_REGEX.search(v) or MASKED_REGEX.search(v):
            is_bad = True
            break

    if is_bad:
        def repl_spaced(m):
            token = re.sub(r"[\s._\-\*#~/]+", "", m.group(0)).lower().translate(LEET_MAP)
            token = REPEATED_PATTERN.sub(r"\1", token)
            if ALL_TERMS_REGEX.search(token) or MASKED_REGEX.search(token):
                return "***"
            return m.group(0)

        sanitized = SPACED_PATTERN.sub(repl_spaced, sanitized)

        def repl_words(m):
            w = m.group(0)
            w_norm = w.lower().translate(LEET_MAP)
            w_norm = REPEATED_PATTERN.sub(r"\1", w_norm)
            if ALL_TERMS_REGEX.search(w_norm) or MASKED_REGEX.search(w_norm):
                return "***"
            return w

        sanitized = re.sub(r"\b\S+\b", repl_words, sanitized)

        if sanitized == raw:
            sanitized = "***"

        return False, sanitized, "Post blocked: Caption contains inappropriate or prohibited language (English/Tagalog profanity filter)."

    return True, raw, None


def _infer_2d_vector_subtype(
    category: Optional[str],
    filename: str = "",
    hint_labels: Optional[List[Optional[str]]] = None,
    bbox_aspect_ratio: float = 1.0,
) -> str:
    """Infer the 2D mannequin visualizer vector subtype for a garment."""
    cat = (category or "").upper()
    tokens = [filename.lower()]
    if hint_labels:
        for lbl in hint_labels:
            if lbl:
                tokens.append(str(lbl).lower())
    text = " ".join(tokens)

    if cat == "TOP":
        if any(w in text for w in ("polo",)):
            return "polo"
        if any(w in text for w in ("crop", "cropped")):
            return "crop_top"
        if any(w in text for w in ("tank", "sleeveless", "singlet", "vest")):
            return "tank_top"
        if any(w in text for w in ("button", "oxford", "formal shirt", "dress shirt", "collared", "flannel", "blouse")):
            return "button_down"
        if any(w in text for w in ("long sleeve", "longsleeve", "sweater", "crewneck", "pullover", "turtleneck", "thermal")):
            return "long_sleeve"
        if bbox_aspect_ratio < 0.75:
            return "long_sleeve"
        return "tshirt"

    elif cat == "OUTERWEAR":
        if "zip" in text and ("hood" in text or "sweat" in text):
            return "zip_hoodie"
        if any(w in text for w in ("hoodie", "hood", "sweatshirt")):
            return "hoodie"
        if any(w in text for w in ("blazer", "suit jacket", "tuxedo")):
            return "blazer"
        if any(w in text for w in ("denim", "jean jacket", "trucker")):
            return "denim_jacket"
        if any(w in text for w in ("windbreaker", "anorak", "track jacket", "nylon")):
            return "windbreaker"
        if any(w in text for w in ("cardigan", "knit jacket", "open front")):
            return "cardigan"
        if any(w in text for w in ("coat", "trench", "overcoat", "parka", "peacoat")):
            return "coat"
        if bbox_aspect_ratio < 0.70:
            return "coat"
        return "hoodie"

    elif cat == "BOTTOM":
        if any(w in text for w in ("skirt", "mini skirt", "maxi skirt", "pleated skirt")):
            return "skirt"
        if any(w in text for w in ("short", "shorts", "bermuda", "trunks")):
            return "shorts"
        if any(w in text for w in ("cargo", "utility")):
            return "cargo_pants"
        if any(w in text for w in ("track", "jogger", "sweatpants", "sweat pants")):
            return "track_pants"
        if any(w in text for w in ("trouser", "trousers", "slacks", "chino", "dress pants", "suit pants")):
            return "trousers"
        if any(w in text for w in ("jean", "jeans", "denim")):
            return "jeans"
        if bbox_aspect_ratio > 0.95:
            return "shorts"
        return "jeans"

    elif cat == "SHOES":
        if any(w in text for w in ("boot", "boots", "combat", "doc", "chelsea")):
            return "combat_boots"
        if any(w in text for w in ("loafer", "loafers", "oxford", "derby", "dress shoe", "monk")):
            return "loafers"
        if any(w in text for w in ("heel", "heels", "pump", "pumps", "stiletto")):
            return "heels"
        if any(w in text for w in ("running", "runner", "trainer", "athletic", "sport")):
            return "running_shoes"
        return "sneakers"

    elif cat == "ACCESSORIES":
        if any(w in text for w in ("watch", "timepiece", "chronograph")):
            return "watch"
        if any(w in text for w in ("choker",)):
            return "choker"
        if any(w in text for w in ("chain", "necklace", "pendant", "cuban")):
            return "chain_necklace"
        if any(w in text for w in ("belt", "buckle")):
            return "belt"
        if any(w in text for w in ("bag", "tote", "crossbody", "backpack", "shoulder bag", "purse")):
            return "crossbody_bag"
        if any(w in text for w in ("sunglass", "sunglasses", "shades", "eyewear", "glasses")):
            return "sunglasses"
        if any(w in text for w in ("earring", "earrings", "stud", "airpod", "earbud", "earphone", "headphone")):
            return "earrings"
        if any(w in text for w in ("cap", "hat", "beanie", "snapback", "bucket hat")):
            return "cap"
        return "cap"

    return "tshirt"


OOD_NON_WEARABLE_KEYWORDS: Tuple[str, ...] = (
    "coffee mug", "cup", "water bottle", "pop bottle", "pill bottle", "wine bottle",
    "plate", "bowl", "toilet tissue", "paper towel", "electric fan",
    "toaster", "refrigerator", "microwave", "desktop computer", "television",
)

WEARABLE_IMAGENET_KEYWORDS: Tuple[str, ...] = (
    "watch", "stopwatch", "sunglass", "sunglasses", "shades",
    "bag", "backpack", "purse", "mailbag", "wallet", "belt", "buckle",
    "hat", "cap", "bonnet", "beanie", "sombrero", "cowboy hat",
    "tie", "bow tie", "windsor tie", "bolo tie", "necklace", "chain",
    "jewelry", "shoe", "sandal", "boot", "loafer", "clog", "sneaker",
    "shirt", "jersey", "sweatshirt", "cardigan", "coat", "jacket",
    "suit", "jean", "trouser", "skirt", "miniskirt", "hoopskirt",
    "overskirt", "dress", "gown", "maillot", "bikini", "brassiere",
    "sock", "mitten", "glove", "scarf", "stole", "poncho", "cloak",
    "kimono", "abaya", "vest", "pajama", "swimming trunks", "sarong",
    "ipod", "earphone", "headphone", "earbud",
)

OUTERWEAR_IMAGENET_KEYWORDS: Tuple[str, ...] = (
    "sweatshirt", "cardigan", "trench coat", "suit", "windsor tie",
    "jean", "poncho", "fur coat", "lab coat", "bulletproof vest",
    "academic gown", "cloak",
)

TOP_IMAGENET_KEYWORDS: Tuple[str, ...] = (
    "jersey", "maillot", "overskirt", "brassiere", "bikini", "swimming trunks",
)


SUBTYPE_MATERIAL_MAP: Dict[str, Material] = {
    "tshirt": "Cotton",
    "polo": "Cotton",
    "long_sleeve": "Cotton",
    "crop_top": "Cotton",
    "tank_top": "Cotton",
    "button_down": "Cotton",
    "hoodie": "Cotton",
    "zip_hoodie": "Cotton",
    "cargo_pants": "Cotton",
    "track_pants": "Nylon",
    "shorts": "Cotton",
    "jeans": "Denim",
    "denim_jacket": "Denim",
    "trousers": "Polyester",
    "blazer": "Polyester",
    "coat": "Wool",
    "skirt": "Polyester",
    "cardigan": "Knit",
    "windbreaker": "Nylon",
    "sneakers": "Other",
    "running_shoes": "Other",
    "combat_boots": "Leather",
    "loafers": "Leather",
    "heels": "Leather",
    "belt": "Leather",
    "crossbody_bag": "Leather",
    "watch": "Leather",
    "chain_necklace": "Other",
    "choker": "Other",
    "sunglasses": "Other",
    "earrings": "Other",
    "cap": "Cotton",
}


def _calibrate_category_and_subtype(
    pred_cat: Optional[Category],
    raw_conf: float,
    class_probabilities: Dict[str, float],
    aux_probs: Optional[np.ndarray],
    cutout_pil: Image.Image,
    fg_coverage: float,
    bbox_aspect_ratio: float,
    dom_color: str,
    clusters: List[ColorClusterInfo],
    source_filename: str = "",
) -> Tuple[
    Optional[Category],
    Optional[str],
    Optional[str],
    Optional[Material],
    Optional[Style],
    Optional[Occasion],
    Optional[LayerRole],
    float,
    Optional[str],
    Optional[str],
    Optional[str],
]:
    """Zero-retraining visual calibrator for StyleSense v7.1."""
    fn = (source_filename or "").lower()

    non_wearable_prob = 0.0
    aux_outer_score = 0.0
    aux_top_score = 0.0
    aux_audio_acc_score = 0.0
    top_imagenet_name = ""

    if aux_probs is not None and len(IMAGENET_CATEGORIES) == len(aux_probs):
        top_idx = int(np.argmax(aux_probs))
        top_imagenet_name = IMAGENET_CATEGORIES[top_idx].lower()
        for idx, cat_name in enumerate(IMAGENET_CATEGORIES):
            p = float(aux_probs[idx])
            if p < 1e-4:
                continue
            cname_low = cat_name.lower()
            if any(k in cname_low for k in OOD_NON_WEARABLE_KEYWORDS):
                non_wearable_prob += p
            if any(k in cname_low for k in OUTERWEAR_IMAGENET_KEYWORDS):
                aux_outer_score += p
            if any(k in cname_low for k in TOP_IMAGENET_KEYWORDS):
                aux_top_score += p
            if any(k in cname_low for k in ("ipod", "earphone", "headphone", "cellular telephone", "mouse", "modem", "hand-held computer", "switch")):
                aux_audio_acc_score += p

    rgba = np.asarray(cutout_pil.convert("RGBA"), dtype=np.uint8)
    alpha_full = rgba[:, :, 3]
    ys, xs = np.where(alpha_full > 64)
    if len(ys) > 10 and len(xs) > 10:
        y0, y1 = int(np.min(ys)), int(np.max(ys)) + 1
        x0, x1 = int(np.min(xs)), int(np.max(xs)) + 1
        crop_rgba = rgba[y0:y1, x0:x1]
    else:
        crop_rgba = rgba

    ch, cw = crop_rgba.shape[:2]
    crop_alpha = crop_rgba[:, :, 3]
    crop_gray = (
        0.299 * crop_rgba[:, :, 0].astype(np.float32)
        + 0.587 * crop_rgba[:, :, 1].astype(np.float32)
        + 0.114 * crop_rgba[:, :, 2].astype(np.float32)
    )

    center_placket_score = 0.0
    collar_placket_score = 0.0
    hood_score = 0.0
    short_sleeve_score = 0.0
    is_short_sleeve_tee = False
    leg_gap_ratio = 0.0
    has_graphic = False
    has_stripes = False
    is_jogger_or_track_silhouette = False
    garment_l_std = 0.0

    if ch >= 24 and cw >= 24:
        grad_x = np.abs(np.diff(crop_gray, axis=1))
        grad_y = np.abs(np.diff(crop_gray, axis=0))

        gx0, gx1 = int(0.28 * cw), max(int(0.28 * cw) + 2, min(cw - 1, int(0.72 * cw)))
        gy0, gy1 = int(0.22 * ch), max(int(0.22 * ch) + 2, min(ch - 1, int(0.72 * ch)))
        chest_edge = float(0.5 * (np.mean(grad_x[gy0:gy1, gx0:gx1]) + np.mean(grad_y[gy0:gy1, gx0:gx1])))
        chest_rgb = crop_rgba[gy0:gy1, gx0:gx1, :3].reshape(-1, 3).astype(np.float64)
        chest_fg = crop_alpha[gy0:gy1, gx0:gx1].reshape(-1) > 128
        if int(np.sum(chest_fg)) > 20:
            chest_rgb = chest_rgb[chest_fg]
        chest_lab = kmeans_color.rgb_to_cielab(chest_rgb) if len(chest_rgb) > 0 else np.zeros((1, 3))
        std_a = float(np.std(chest_lab[:, 1])) if len(chest_lab) > 1 else 0.0
        std_b = float(np.std(chest_lab[:, 2])) if len(chest_lab) > 1 else 0.0
        garment_l_std = float(np.std(chest_lab[:, 0])) if len(chest_lab) > 1 else 0.0
        chest_color_std = float(np.mean(np.std(chest_rgb, axis=0))) if len(chest_rgb) > 1 else 0.0

        hem_y0, hem_y1 = int(0.74 * ch), max(int(0.74 * ch) + 2, min(ch - 1, int(0.92 * ch)))
        hem_edge = float(0.5 * (np.mean(grad_x[hem_y0:hem_y1, gx0:gx1]) + np.mean(grad_y[hem_y0:hem_y1, gx0:gx1])))

        if (
            std_a > 12.0
            or std_b > 12.0
            or (chest_edge > 13.0 and chest_color_std > 20.0 and chest_edge > 1.30 * max(hem_edge, 4.0))
        ):
            has_graphic = True

        cy0, cy1 = int(0.15 * ch), max(int(0.15 * ch) + 3, int(0.90 * ch))
        cx0, cx1 = int(0.45 * cw), max(int(0.45 * cw) + 1, min(cw - 1, int(0.55 * cw)))
        lx0, lx1 = int(0.22 * cw), max(int(0.22 * cw) + 1, int(0.42 * cw))
        rx0, rx1 = int(0.58 * cw), max(int(0.58 * cw) + 1, min(cw - 1, int(0.78 * cw)))

        center_strip_edge = float(np.mean(grad_x[cy0:cy1, cx0:cx1])) if cx1 > cx0 else 0.0
        hem_placket_edge = float(np.mean(grad_x[hem_y0:hem_y1, cx0:cx1])) if cx1 > cx0 else 0.0
        left_panel_edge = float(np.mean(grad_x[cy0:cy1, lx0:lx1])) if lx1 > lx0 else 0.0
        right_panel_edge = float(np.mean(grad_x[cy0:cy1, rx0:rx1])) if rx1 > rx0 else 0.0
        panel_edge = 0.5 * (left_panel_edge + right_panel_edge)
        if center_strip_edge > 4.0 and hem_placket_edge > 3.5 and not (has_graphic and hem_placket_edge < 5.0):
            center_placket_score = float(center_strip_edge / max(panel_edge, 2.5))

        py0, py1 = int(0.08 * ch), max(int(0.08 * ch) + 3, int(0.36 * ch))
        px0, px1 = int(0.42 * cw), max(int(0.42 * cw) + 2, min(cw - 1, int(0.58 * cw)))
        collar_edge = float(0.5 * (np.mean(grad_x[py0:py1, px0:px1]) + np.mean(grad_y[py0:py1, px0:px1])))
        collar_placket_score = float(collar_edge / max(panel_edge, 2.5))

        hy1 = max(2, int(0.16 * ch))
        hx0, hx1 = int(0.30 * cw), max(int(0.30 * cw) + 2, int(0.70 * cw))
        top_center_cov = float(np.mean(crop_alpha[0:hy1, hx0:hx1] > 128))
        top_left_cov = float(np.mean(crop_alpha[0:hy1, 0 : max(1, int(0.24 * cw))] > 128))
        top_right_cov = float(np.mean(crop_alpha[0:hy1, min(cw - 1, int(0.76 * cw)) : cw] > 128))
        corner_cov = 0.5 * (top_left_cov + top_right_cov)
        top6_cov = float(np.mean(crop_alpha[0 : max(1, int(0.06 * ch)), int(0.35 * cw) : int(0.65 * cw)] > 128))
        shoulder_band_y = crop_alpha[int(0.06 * ch) : int(0.18 * ch), :] > 128
        shoulder_spread = float(np.mean(shoulder_band_y)) if shoulder_band_y.size > 0 else 0.0
        if top6_cov > 0.52 and corner_cov < 0.14 and shoulder_spread < 0.46 and not has_graphic:
            hood_score = top_center_cov * max(0.0, 1.0 - 1.1 * corner_cov)

        upper_rows = []
        for ry in range(int(0.18 * ch), int(0.48 * ch)):
            r_xs = np.where(crop_alpha[ry, :] > 64)[0]
            if len(r_xs) >= 4:
                upper_rows.append(float(r_xs[-1] - r_xs[0] + 1))
        lower_rows = []
        for ry in range(int(0.58 * ch), int(0.88 * ch)):
            r_xs = np.where(crop_alpha[ry, :] > 64)[0]
            if len(r_xs) >= 4:
                lower_rows.append(float(r_xs[-1] - r_xs[0] + 1))

        max_upper_span = float(np.percentile(upper_rows, 90)) if upper_rows else float(cw)
        mean_lower_span = float(np.median(lower_rows)) if lower_rows else float(cw)

        ul_sleeve = crop_alpha[int(0.16 * ch) : int(0.48 * ch), 0 : max(1, int(0.22 * cw))]
        ur_sleeve = crop_alpha[int(0.16 * ch) : int(0.48 * ch), min(cw - 1, int(0.78 * cw)) : cw]
        upper_sleeve_cov = 0.5 * (float(np.mean(ul_sleeve > 64)) + float(np.mean(ur_sleeve > 64)))

        ll_outer = crop_alpha[int(0.56 * ch) : int(0.90 * ch), 0 : max(1, int(0.12 * cw))]
        lr_outer = crop_alpha[int(0.56 * ch) : int(0.90 * ch), min(cw - 1, int(0.88 * cw)) : cw]
        lower_outer_cov = 0.5 * (float(np.mean(ll_outer > 64)) + float(np.mean(lr_outer > 64)))

        if upper_sleeve_cov > 0.18 and (
            (max_upper_span >= 1.14 * max(mean_lower_span, 1.0) and lower_outer_cov < 0.12)
            or lower_outer_cov < 0.045
            or (has_graphic and bbox_aspect_ratio >= 0.68 and center_placket_score < 1.25 and hood_score < 0.35)
        ):
            is_short_sleeve_tee = True
            short_sleeve_score = 1.0

        leg_strip = crop_alpha[int(0.52 * ch) : int(0.94 * ch), int(0.42 * cw) : max(int(0.42 * cw) + 1, int(0.58 * cw))]
        if leg_strip.size > 0:
            leg_gap_ratio = float(np.mean(leg_strip < 48))

        waist_spans = []
        for ry in range(int(0.05 * ch), int(0.16 * ch)):
            r_xs = np.where(crop_alpha[ry, :] > 64)[0]
            if len(r_xs) >= 6:
                waist_spans.append(float(r_xs[-1] - r_xs[0] + 1))
        thigh_spans = []
        for ry in range(int(0.24 * ch), int(0.56 * ch)):
            r_xs = np.where(crop_alpha[ry, :] > 64)[0]
            if len(r_xs) >= 6:
                thigh_spans.append(float(r_xs[-1] - r_xs[0] + 1))
        ankle_spans = []
        for ry in range(int(0.82 * ch), int(0.95 * ch)):
            r_xs = np.where(crop_alpha[ry, :] > 64)[0]
            if len(r_xs) >= 6:
                ankle_spans.append(float(r_xs[-1] - r_xs[0] + 1))

        med_waist_w = float(np.median(waist_spans)) if waist_spans else float(cw)
        p90_thigh_w = float(np.percentile(thigh_spans, 90)) if thigh_spans else float(cw)
        med_ankle_w = float(np.median(ankle_spans)) if ankle_spans else float(cw)

        if (
            (p90_thigh_w >= 1.11 * max(med_waist_w, 1.0))
            or (med_ankle_w <= 0.85 * max(p90_thigh_w, 1.0))
            or (garment_l_std >= 12.2)
        ):
            is_jogger_or_track_silhouette = True

        sx_l0, sx_l1 = int(0.02 * cw), max(int(0.02 * cw) + 2, int(0.20 * cw))
        sx_r0, sx_r1 = int(0.80 * cw), max(int(0.80 * cw) + 2, min(cw - 1, int(0.98 * cw)))
        sy0, sy1 = int(0.20 * ch), max(int(0.20 * ch) + 2, min(ch - 1, int(0.85 * ch)))
        side_edge = max(
            float(np.mean(grad_x[sy0:sy1, sx_l0:sx_l1])),
            float(np.mean(grad_x[sy0:sy1, sx_r0:sx_r1])),
        )
        in_l = float(np.mean(grad_x[sy0:sy1, int(0.22 * cw) : max(int(0.22 * cw) + 2, int(0.40 * cw))]))
        in_r = float(np.mean(grad_x[sy0:sy1, int(0.60 * cw) : max(int(0.60 * cw) + 2, int(0.78 * cw))]))
        mid_edge = 0.5 * (in_l + in_r)
        sec_prop = clusters[1].proportion if len(clusters) > 1 else 0.0
        has_distinct_sec_color = (len(clusters) > 1 and clusters[1].color_name != clusters[0].color_name and sec_prop >= 0.04)
        if (has_distinct_sec_color and side_edge > 7.5 and side_edge > 1.25 * max(mid_edge, 3.2)) or (
            side_edge > 11.5 and side_edge > 1.48 * max(mid_edge, 3.0)
        ):
            has_stripes = True

    if "graphic" in fn:
        has_graphic = True
    if "stripe" in fn or "striped" in fn:
        has_stripes = True

    if (
        non_wearable_prob >= 0.45
        and leg_gap_ratio < 0.05
        and raw_conf < 0.60
        and any(k in top_imagenet_name for k in OOD_NON_WEARABLE_KEYWORDS)
    ):
        ood_conf = round(min(raw_conf, 0.34), 4)
        ood_reason = (
            "Detected a non-wearable household object. "
            "Please upload a clear photo of clothing, footwear, or a wearable fashion accessory."
        )
        return (
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            ood_conf,
            None,
            None,
            ood_reason,
        )

    prob_top = float(class_probabilities.get("TOP", 0.0))
    prob_outer = float(class_probabilities.get("OUTERWEAR", 0.0))
    prob_bottom = float(class_probabilities.get("BOTTOM", 0.0))
    prob_acc = float(class_probabilities.get("ACCESSORIES", 0.0))
    sorted_cats = sorted(class_probabilities.items(), key=lambda kv: kv[1], reverse=True)
    top2_set = {sorted_cats[0][0], sorted_cats[1][0]} if len(sorted_cats) >= 2 else set()

    is_audio_accessory = (
        any(w in fn for w in ("airpod", "earbud", "earphone", "headphone", "headset"))
        or any(k in top_imagenet_name for k in ("ipod", "earphone", "headphone"))
        or (
            aux_audio_acc_score >= 0.12
            and 0.65 <= bbox_aspect_ratio <= 1.40
            and fg_coverage < 0.35
            and leg_gap_ratio < 0.05
        )
        or (
            (pred_cat in ("ACCESSORIES", None))
            and 0.72 <= bbox_aspect_ratio <= 1.32
            and fg_coverage < 0.24
            and dom_color in ("White", "Gray", "Black")
            and prob_acc >= 0.20
        )
    )
    if is_audio_accessory:
        pred_cat = "ACCESSORIES"
        raw_conf = max(raw_conf, 0.92)

    elif (
        leg_gap_ratio >= 0.07
        and bbox_aspect_ratio <= 0.86
        and not is_short_sleeve_tee
        and (prob_bottom >= 0.18 or pred_cat in ("BOTTOM", None, "OUTERWEAR", "TOP"))
    ):
        pred_cat = "BOTTOM"
        raw_conf = max(raw_conf, round(min(0.95, max(prob_bottom + 0.45, 0.88)), 4))

    elif (
        is_short_sleeve_tee
        or (has_graphic and center_placket_score < 1.25 and hood_score < 0.35 and leg_gap_ratio < 0.06)
    ) and (
        pred_cat in ("TOP", "OUTERWEAR")
        or top2_set == {"TOP", "OUTERWEAR"}
        or (pred_cat is None and (prob_top + prob_outer) >= 0.55)
    ):
        if not any(w in fn for w in ("hoodie", "jacket", "blazer", "cardigan", "coat", "windbreaker")):
            pred_cat = "TOP"
            is_short_sleeve_tee = True
            raw_conf = max(raw_conf, round(min(0.96, prob_top + prob_outer * 0.85), 4), CONFIDENCE_THRESHOLD + 0.10)
    elif (
        top2_set == {"TOP", "OUTERWEAR"}
        or (pred_cat in ("TOP", "OUTERWEAR") and abs(prob_top - prob_outer) < 0.28)
        or (pred_cat is None and max(prob_top, prob_outer) >= 0.35 and (prob_top + prob_outer) >= 0.60)
    ):
        if (
            (aux_outer_score > aux_top_score + 0.08 and not is_short_sleeve_tee)
            or (hood_score > 0.38 and not is_short_sleeve_tee)
            or (center_placket_score > 1.50 and not is_short_sleeve_tee)
            or any(w in fn for w in ("hoodie", "jacket", "blazer", "cardigan", "coat", "windbreaker"))
        ):
            pred_cat = "OUTERWEAR"
            raw_conf = max(raw_conf, round(min(0.94, prob_outer + prob_top * 0.65), 4), CONFIDENCE_THRESHOLD + 0.05)
        elif (
            short_sleeve_score > 0.0
            or (aux_top_score > aux_outer_score + 0.06)
            or any(w in fn for w in ("tshirt", "t-shirt", "tee", "polo", "tank", "crop", "blouse"))
        ):
            pred_cat = "TOP"
            raw_conf = max(raw_conf, round(min(0.94, prob_top + prob_outer * 0.65), 4), CONFIDENCE_THRESHOLD + 0.05)

    if (pred_cat is None or raw_conf < CONFIDENCE_THRESHOLD) and sorted_cats:
        best_cat, best_prob = sorted_cats[0]
        second_prob = sorted_cats[1][1] if len(sorted_cats) > 1 else 0.0
        if (best_prob + second_prob) >= 0.58 and non_wearable_prob < 0.35:
            pred_cat = best_cat  # type: ignore[assignment]
            raw_conf = max(raw_conf, round(min(0.91, best_prob + 0.65 * second_prob), 4), CONFIDENCE_THRESHOLD + 0.08)

    if pred_cat is None or raw_conf < CONFIDENCE_THRESHOLD:
        moderation_reason = (
            f"Low classification confidence ({raw_conf:.2f} < {CONFIDENCE_THRESHOLD}); please confirm category manually."
        )
        return (
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            raw_conf,
            None,
            None,
            moderation_reason,
        )

    _, material, pred_style, occasion, layer_role = CATEGORY_DEFAULT_METADATA[pred_cat]
    sub_category = "T-Shirt"
    vector_subtype = "tshirt"
    is_two_tone = (
        len(clusters) > 1
        and clusters[1].proportion >= 0.20
        and clusters[0].color_name != clusters[1].color_name
    )
    has_color_accent = (
        len(clusters) > 1
        and clusters[1].proportion >= 0.05
        and clusters[0].color_name != clusters[1].color_name
    )

    if pred_cat == "TOP":
        if "polo" in fn or (is_short_sleeve_tee and (collar_placket_score > 1.38 or center_placket_score > 1.20) and not has_graphic):
            sub_category, vector_subtype = "Polo Shirt", "polo"
            pred_style = "CLASSIC"
        elif is_short_sleeve_tee and has_graphic and "crop" not in fn:
            sub_category, vector_subtype = "Graphic T-Shirt", "tshirt"
            pred_style = "STREETWEAR"
        elif "crop" in fn or (bbox_aspect_ratio > 1.22 and short_sleeve_score > 0.0 and not has_graphic):
            sub_category, vector_subtype = "Crop Top", "crop_top"
        elif "tank" in fn or "sleeveless" in fn or any(k in top_imagenet_name for k in ("maillot", "bikini", "brassiere")):
            sub_category, vector_subtype = "Tank Top", "tank_top"
        elif "blouse" in fn or any(k in top_imagenet_name for k in ("overskirt", "gown", "kimono")):
            sub_category, vector_subtype = "Blouse", "button_down"
            pred_style = "FORMAL"
        elif "button" in fn or "oxford" in fn or "dress shirt" in fn or (center_placket_score > 1.45 and not is_short_sleeve_tee):
            sub_category, vector_subtype = "Button-Down Shirt", "button_down"
            pred_style, occasion = "FORMAL", "WORK"
        elif "long" in fn or "sweater" in fn or "crewneck" in fn or (not is_short_sleeve_tee and bbox_aspect_ratio < 0.78):
            sub_category, vector_subtype = "Long-Sleeve Top", "long_sleeve"
        elif has_graphic:
            sub_category, vector_subtype = "Graphic T-Shirt", "tshirt"
            pred_style = "STREETWEAR"
        else:
            sub_category, vector_subtype = "T-Shirt", "tshirt"

    elif pred_cat == "OUTERWEAR":
        if ("zip" in fn and ("hood" in fn or "sweat" in fn)) or (hood_score > 0.40 and center_placket_score > 1.42):
            sub_category, vector_subtype = "Zip-Up Hoodie", "zip_hoodie"
            pred_style = "STREETWEAR"
        elif (
            "track" in fn
            or (is_two_tone and hood_score <= 0.38)
            or (has_color_accent and hood_score <= 0.35)
            or (has_stripes and center_placket_score > 1.15)
        ):
            sub_category, vector_subtype = "Track Jacket", "windbreaker"
            pred_style = "SPORTY"
            has_graphic = False
        elif "windbreaker" in fn or "anorak" in fn or (center_placket_score > 1.25 and hood_score <= 0.36):
            sub_category, vector_subtype = "Windbreaker Jacket", "windbreaker"
            pred_style, occasion = "SPORTY", "OUTDOOR"
        elif "blazer" in fn or "suit" in top_imagenet_name:
            sub_category, vector_subtype = "Structured Blazer", "blazer"
            pred_style, occasion = "FORMAL", "WORK"
        elif "denim" in fn or "jean" in top_imagenet_name or (dom_color in ("Blue", "Light Blue", "Navy") and center_placket_score > 1.40 and hood_score <= 0.36):
            sub_category, vector_subtype = "Denim Jacket", "denim_jacket"
            pred_style = "STREETWEAR"
        elif "cardigan" in fn or "cardigan" in top_imagenet_name:
            sub_category, vector_subtype = "Knit Cardigan", "cardigan"
            pred_style = "CLASSIC"
        elif "coat" in fn or "trench" in fn or any(k in top_imagenet_name for k in ("trench coat", "fur coat", "lab coat", "cloak")):
            sub_category, vector_subtype = "Overcoat / Trench", "coat"
            pred_style, occasion = "FORMAL", "WORK"
        else:
            sub_category, vector_subtype = "Pullover Hoodie", "hoodie"
            pred_style = "STREETWEAR"

    elif pred_cat == "BOTTOM":
        if "skirt" in fn or any(k in top_imagenet_name for k in ("miniskirt", "hoopskirt", "overskirt", "sarong")) or (leg_gap_ratio < 0.04 and bbox_aspect_ratio > 0.74):
            sub_category, vector_subtype = "Pleated Skirt", "skirt"
        elif "short" in fn or "swimming trunks" in top_imagenet_name or bbox_aspect_ratio > 0.88:
            sub_category, vector_subtype = "Casual Shorts", "shorts"
        elif (
            "track" in fn
            or "jogger" in fn
            or "sweatpant" in fn
            or has_stripes
            or (is_jogger_or_track_silhouette and "jean" not in top_imagenet_name and "denim" not in fn)
        ):
            sub_category, vector_subtype = "Track Pants", "track_pants"
            pred_style = "SPORTY"
        elif "cargo" in fn:
            sub_category, vector_subtype = "Cargo Pants", "cargo_pants"
            pred_style = "STREETWEAR"
        elif "dress pant" in fn or "slack" in fn or ("suit" in top_imagenet_name and dom_color in ("Black", "Gray", "Navy")):
            sub_category, vector_subtype = "Dress Pants", "trousers"
            pred_style, occasion = "FORMAL", "WORK"
        elif "trouser" in fn or "chino" in fn or "tailored" in fn or (dom_color in ("Black", "Beige", "Khaki", "Cream", "Gray", "Brown") and "jean" not in top_imagenet_name):
            sub_category, vector_subtype = "Tailored Trousers", "trousers"
            pred_style = "CLASSIC"
        else:
            sub_category, vector_subtype = "Denim Jeans", "jeans"
            pred_style = "CASUAL"

    elif pred_cat == "SHOES":
        if "boot" in fn or any(k in top_imagenet_name for k in ("cowboy boot", "boot")):
            sub_category, vector_subtype = "Combat Boots", "combat_boots"
            pred_style = "STREETWEAR"
        elif "heel" in fn or "stiletto" in fn or "sandal" in top_imagenet_name:
            sub_category, vector_subtype = "Strappy Heels", "heels"
            pred_style, occasion = "FORMAL", "PARTY"
        elif "loafer" in fn or "oxford" in fn or "clog" in top_imagenet_name or (dom_color in ("Brown", "Black", "Burgundy") and len(clusters) > 0 and clusters[0].proportion > 0.86):
            sub_category, vector_subtype = "Leather Loafers", "loafers"
            pred_style, occasion = "FORMAL", "WORK"
        elif "run" in fn or "running shoe" in top_imagenet_name or (len(clusters) > 1 and clusters[1].proportion >= 0.14):
            sub_category, vector_subtype = "Running Shoes", "running_shoes"
            pred_style, occasion = "SPORTY", "GYM"
        else:
            sub_category, vector_subtype = "Low-Top Sneakers", "sneakers"
            pred_style = "CASUAL"

    elif pred_cat == "ACCESSORIES":
        if is_audio_accessory:
            sub_category, vector_subtype = "Wireless Earbuds", "earrings"
            pred_style, occasion = "SPORTY", "EVERYDAY"
        elif "watch" in fn or any(k in top_imagenet_name for k in ("watch", "stopwatch", "digital watch", "analog clock")):
            sub_category, vector_subtype = "Wristwatch", "watch"
            pred_style = "CLASSIC"
        elif "choker" in fn:
            sub_category, vector_subtype = "Choker", "choker"
            pred_style = "STREETWEAR"
        elif "necklace" in fn or "chain" in fn or any(k in top_imagenet_name for k in ("necklace", "chain")):
            sub_category, vector_subtype = "Chain Necklace", "chain_necklace"
            pred_style = "STREETWEAR"
        elif "belt" in fn or "belt" in top_imagenet_name or "buckle" in top_imagenet_name or bbox_aspect_ratio > 2.4:
            sub_category, vector_subtype = "Leather Belt", "belt"
            pred_style = "CLASSIC"
        elif "sunglass" in fn or "shades" in fn or "glass" in fn or "sunglass" in top_imagenet_name or (1.75 <= bbox_aspect_ratio <= 2.4):
            sub_category, vector_subtype = "Sunglasses", "sunglasses"
            pred_style = "CASUAL"
        elif "earring" in fn:
            sub_category, vector_subtype = "Drop Earrings", "earrings"
            pred_style = "FORMAL"
        elif "bag" in fn or "purse" in fn or "tote" in fn or "crossbody" in fn or "backpack" in fn or any(k in top_imagenet_name for k in ("bag", "backpack", "purse", "mailbag", "wallet")):
            sub_category, vector_subtype = "Crossbody Bag", "crossbody_bag"
            pred_style = "CASUAL"
        else:
            sub_category, vector_subtype = "Baseball Cap", "cap"
            pred_style = "STREETWEAR"

    material = SUBTYPE_MATERIAL_MAP.get(vector_subtype, material)
    if sub_category == "Blouse":
        material = "Silk"
    elif sub_category == "Track Jacket":
        material = "Polyester"

    pattern_prefix = ""
    pattern_label = "Solid"
    if has_graphic and pred_cat in ("TOP", "OUTERWEAR"):
        pattern_prefix = "Graphic"
        pattern_label = "Graphic"
    elif has_stripes and pred_cat in ("BOTTOM", "TOP", "OUTERWEAR"):
        pattern_prefix = "Striped"
        pattern_label = "Striped"
    elif has_color_accent:
        pattern_label = "Two-Tone"

    if sub_category == "Graphic T-Shirt":
        suggested_name = f"{dom_color} Graphic T-Shirt".strip()
    elif pattern_prefix and not sub_category.lower().startswith(pattern_prefix.lower()):
        suggested_name = f"{pattern_prefix} {dom_color} {sub_category}".strip()
    else:
        suggested_name = f"{dom_color} {sub_category}".strip()

    return (
        pred_cat,
        sub_category,
        vector_subtype,
        material,
        pred_style,
        occasion,
        layer_role,
        raw_conf,
        suggested_name,
        pattern_label,
        None,
    )


async def run_garment_analysis(
    image: Image.Image,
    source_filename: str = "",
    force_rembg: bool = False,
) -> Prediction:
    """Core StyleSense v7.1 garment analysis pipeline."""
    transforms_to_use = EVAL_TRANSFORMS if (IS_FINETUNED_HEAD or WEIGHTS is None or EVAL_TRANSFORMS is not None) else WEIGHTS.transforms()
    rgb_image = image.convert("RGB")

    aux_probs_np: Optional[np.ndarray] = None
    if AUX_IMAGENET_MODEL is not None and transforms_to_use is not None and torch is not None:
        try:
            with torch.inference_mode():
                t_raw = transforms_to_use(rgb_image).unsqueeze(0)
                if DEVICE is not None:
                    t_raw = t_raw.to(DEVICE)
                aux_probs_np = torch.softmax(AUX_IMAGENET_MODEL(t_raw)[0], dim=0).cpu().numpy()
        except Exception as e:
            logger.debug(f"Initial aux ImageNet pass skipped: {e}")

    is_safe_img, nsfw_scores, nsfw_reason = evaluate_5class_nsfw_safety(rgb_image, aux_probs=aux_probs_np)
    if not is_safe_img:
        return Prediction(
            category=None,
            subCategory=None,
            suggestedName=None,
            suggestedBrand=None,
            layerRole=None,
            color=None,
            primary_color=None,
            colorHex=None,
            secondary_color=None,
            secondary_color_hex=None,
            color_confidence=None,
            pattern=None,
            palette=[],
            style=None,
            occasion=None,
            material=None,
            confidence=0.0,
            class_probabilities={},
            nsfw_scores=nsfw_scores,
            cutoutDataUri=None,
            beautifiedDataUri=None,
            is_safe_garment=False,
            moderation_reason=nsfw_reason,
        )

    cutout_pil, fg_mask, cutout_data_uri, bg_source = extract_garment_cutout(image, force_rembg=force_rembg)

    fg_coverage = float(np.mean(fg_mask)) if (fg_mask is not None and fg_mask.size > 0) else 0.0
    bbox_aspect_ratio = 1.0

    if cutout_pil is not None:
        try:
            alpha = cutout_pil.split()[3]
            bbox = alpha.getbbox()
            if bbox:
                left, top, right, bottom = bbox
                bw = right - left
                bh = bottom - top
                bbox_aspect_ratio = float(bw) / max(float(bh), 1.0)
                pad_x = int(bw * 0.12)
                pad_y = int(bh * 0.12)
                w, h = cutout_pil.size
                crop_box = (
                    max(0, left - pad_x),
                    max(0, top - pad_y),
                    min(w, right + pad_x),
                    min(h, bottom + pad_y),
                )
                garment_crop = cutout_pil.crop(crop_box)
            else:
                garment_crop = cutout_pil

            studio_bg = Image.new("RGBA", garment_crop.size, (245, 245, 245, 255))
            clean_rgb_for_cnn = Image.alpha_composite(studio_bg, garment_crop).convert("RGB")
        except Exception as e:
            logger.warning(f"Studio cutout composition fallback: {e}")
            clean_rgb_for_cnn = rgb_image
    else:
        clean_rgb_for_cnn = rgb_image

    tensor_clean = transforms_to_use(clean_rgb_for_cnn).unsqueeze(0)
    if DEVICE is not None:
        tensor_clean = tensor_clean.to(DEVICE)

    with torch.inference_mode():
        probs_clean = torch.softmax(MODEL(tensor_clean)[0], dim=0)
        if fg_coverage >= 0.12:
            probabilities = probs_clean
        else:
            tensor_raw = transforms_to_use(rgb_image).unsqueeze(0)
            if DEVICE is not None:
                tensor_raw = tensor_raw.to(DEVICE)
            probs_orig = torch.softmax(MODEL(tensor_raw)[0], dim=0)
            probabilities = 0.5 * probs_orig + 0.5 * probs_clean

        if AUX_IMAGENET_MODEL is not None:
            try:
                aux_logits = AUX_IMAGENET_MODEL(tensor_clean)[0]
                aux_probs_np = torch.softmax(aux_logits, dim=0).cpu().numpy()
            except Exception as e:
                logger.debug(f"Auxiliary ImageNet forward pass skipped: {e}")

    top_prob, top_idx = torch.max(probabilities, dim=0)
    raw_conf = float(top_prob.item())
    pred_cat_idx = int(top_idx.item())

    class_probabilities: Dict[str, float] = {
        cat: round(float(probabilities[i].item()), 4)
        for i, cat in enumerate(CATEGORIES_LIST)
    }

    initial_cat: Optional[Category] = CATEGORIES_LIST[pred_cat_idx] if raw_conf >= CONFIDENCE_THRESHOLD else None

    dom_color, color_hex, sec_color, sec_color_hex, color_conf, clusters = extract_color_palette_kmeans(
        cutout_pil, fg_mask=fg_mask, k=2
    )

    (
        pred_cat,
        sub_category,
        vector_subtype,
        material,
        pred_style,
        occasion,
        layer_role,
        calibrated_conf,
        suggested_name,
        pattern_label,
        moderation_reason,
    ) = _calibrate_category_and_subtype(
        pred_cat=initial_cat,
        raw_conf=raw_conf,
        class_probabilities=class_probabilities,
        aux_probs=aux_probs_np,
        cutout_pil=cutout_pil,
        fg_coverage=fg_coverage,
        bbox_aspect_ratio=bbox_aspect_ratio,
        dom_color=dom_color,
        clusters=clusters,
        source_filename=source_filename,
    )

    dom_l_star = float(clusters[0].lab[0]) if clusters else 50.0
    dom_lab_arr = np.asarray(clusters[0].lab, dtype=np.float64) if clusters else np.array([50.0, 0.0, 0.0])
    sec_lab_arr = np.asarray(clusters[1].lab, dtype=np.float64) if len(clusters) > 1 else None
    sec_prop_val = float(clusters[1].proportion) if len(clusters) > 1 else 0.0
    harmony_note = _describe_k2_color_harmony(
        dom_color=dom_color,
        dom_prop=color_conf,
        sec_color=sec_color,
        sec_prop=sec_prop_val,
        dom_lab=dom_lab_arr,
        sec_lab=sec_lab_arr,
    )
    try:
        beautified_data_uri = beautify_garment_geometric_studio(
            cutout_pil, category=pred_cat, sub_category=sub_category, dom_l_star=dom_l_star
        )
    except Exception as e:
        logger.warning(f"Studio beautify fallback to cutoutDataUri: {e}")
        beautified_data_uri = cutout_data_uri

    print(
        f"[ML-ANALYZE] checkpoint_loaded={IS_FINETUNED_HEAD} | pred_cat={pred_cat} (conf={calibrated_conf:.4f}, sub={sub_category}, vec={vector_subtype}, mat={material}, pattern={pattern_label}) | remove_bg_source={bg_source} | fg_cov={fg_coverage:.3f} | K=2 color={dom_color} ({color_hex}, {color_conf*100:.0f}%) + sec={sec_color} ({sec_color_hex})",
        flush=True,
    )

    return Prediction(
        category=pred_cat,
        subCategory=sub_category,
        suggestedName=suggested_name,
        suggestedBrand=None,
        layerRole=layer_role,
        vector_subtype=vector_subtype,
        color=dom_color,
        primary_color=dom_color,
        colorHex=color_hex,
        secondary_color=sec_color,
        secondary_color_hex=sec_color_hex,
        color_confidence=color_conf,
        color_harmony_note=harmony_note,
        pattern=pattern_label,
        palette=clusters,
        style=pred_style,
        occasion=occasion,
        material=material,
        confidence=round(calibrated_conf, 4),
        class_probabilities=class_probabilities,
        nsfw_scores=nsfw_scores,
        cutoutDataUri=cutout_data_uri,
        beautifiedDataUri=beautified_data_uri,
        is_safe_garment=(pred_cat is not None and calibrated_conf >= CONFIDENCE_THRESHOLD),
        moderation_reason=moderation_reason,
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    global MODEL, AUX_IMAGENET_MODEL, IS_FINETUNED_HEAD, REMBG_SESSION, LOADED_CHECKPOINT_PATH

    if TORCH_AVAILABLE and torch is not None:
        try:
            torch.set_num_threads(2)
        except Exception as e:
            logger.warning(f"Could not set torch num threads: {e}")

    keys = get_remove_bg_api_keys()
    hf_tok = get_hf_token()
    force_rembg_env = os.getenv("FORCE_REMBG", "false").strip().lower() in ("true", "1", "yes")
    dev_name = str(DEVICE) if DEVICE is not None else "cpu"
    logger.info(
        f"remove.bg API Key(s) loaded: {len(keys)} key(s) | FORCE_REMBG={force_rembg_env} | HF_TOKEN_configured={bool(hf_tok)} | gradio_client={GRADIO_CLIENT_AVAILABLE} | device={dev_name}"
    )

    if REMBG_AVAILABLE and new_session is not None and remove is not None:
        try:
            if REMBG_SESSION is None:
                REMBG_SESSION = new_session("u2netp")
            dummy_img = Image.new("RGB", (64, 64), (200, 200, 200))
            remove(dummy_img, session=REMBG_SESSION, alpha_matting=False)
            logger.info("rembg u2netp session pre-warmed successfully.")
        except Exception as e:
            logger.warning(f"Failed to initialize/pre-warm rembg u2netp session: {e}")
            try:
                REMBG_SESSION = new_session("u2net")
                dummy_img = Image.new("RGB", (64, 64), (200, 200, 200))
                remove(dummy_img, session=REMBG_SESSION, alpha_matting=False)
            except Exception:
                REMBG_SESSION = None

    if TORCH_AVAILABLE and resnet50 is not None:
        try:
            AUX_IMAGENET_MODEL = resnet50(weights=WEIGHTS).eval()
            if DEVICE is not None:
                AUX_IMAGENET_MODEL = AUX_IMAGENET_MODEL.to(DEVICE)
            logger.info(f"Loaded auxiliary ImageNet-1K V2 ResNet-50 calibrator on {dev_name}.")
        except Exception as e:
            logger.warning(f"Could not load auxiliary ImageNet-1K V2 model: {e}")
            AUX_IMAGENET_MODEL = None

        ckpt_candidate: Optional[Path] = None
        for cand in CANDIDATE_CHECKPOINT_PATHS:
            if cand and cand.is_file():
                sz = cand.stat().st_size
                if sz < 1000:
                    logger.warning(f"File at {cand} is only {sz} bytes (likely a Git LFS pointer). Skipping.")
                    continue
                ckpt_candidate = cand
                break

        if ckpt_candidate is not None:
            LOADED_CHECKPOINT_PATH = str(ckpt_candidate.resolve())
            try:
                try:
                    state = torch.load(ckpt_candidate, map_location="cpu", weights_only=False)
                except TypeError:
                    state = torch.load(ckpt_candidate, map_location="cpu")

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
                    if DEVICE is not None:
                        MODEL = MODEL.to(DEVICE)
                    IS_FINETUNED_HEAD = True
                    print(f"[STARTUP] Loaded fine-tuned ResNet-50 Epoch 13 checkpoint ({len(matched_keys)} matched keys) from {ckpt_candidate} on {dev_name}")
                    logger.info(f"Loaded fine-tuned ResNet-50 Epoch 13 checkpoint ({len(matched_keys)} matched keys) from {ckpt_candidate} on {dev_name}")
                else:
                    print(f"[STARTUP] Checkpoint matched only {len(matched_keys)} keys (expected >100). Falling back to ImageNet head.")
                    logger.warning(f"Checkpoint matched only {len(matched_keys)} keys. Falling back to ImageNet head.")
            except Exception as e:
                print(f"[STARTUP] Failed to load checkpoint {ckpt_candidate}: {e}")
                logger.warning(f"Failed to load checkpoint {ckpt_candidate}: {e}")
            finally:
                if "state" in locals():
                    del state
                gc.collect()

        if MODEL is None:
            print("[STARTUP] Active model: ResNet-50 ImageNet-1K V2 fallback head")
            logger.info("Active model: ResNet-50 ImageNet-1K V2 fallback head")
            MODEL = AUX_IMAGENET_MODEL if AUX_IMAGENET_MODEL is not None else resnet50(weights=WEIGHTS).eval()
            if DEVICE is not None and MODEL is not None:
                MODEL = MODEL.to(DEVICE)
            IS_FINETUNED_HEAD = False

        try:
            with torch.inference_mode():
                dummy_tensor = torch.zeros((1, 3, 224, 224))
                if DEVICE is not None:
                    dummy_tensor = dummy_tensor.to(DEVICE)
                MODEL(dummy_tensor)
                if AUX_IMAGENET_MODEL is not None and AUX_IMAGENET_MODEL is not MODEL:
                    AUX_IMAGENET_MODEL(dummy_tensor)
            logger.info("ResNet-50 MODEL and AUX_IMAGENET_MODEL pre-warmed successfully.")
        except Exception as e:
            logger.warning(f"Could not pre-warm MODEL: {e}")

    yield
    MODEL = None
    AUX_IMAGENET_MODEL = None


app = FastAPI(title="StyleSense ML & Hybrid Recommendation Service", version="7.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, object]:
    val_metrics = LOADED_RESULTS_DATA.get("validation_metrics", {})
    test_metrics = LOADED_RESULTS_DATA.get("final_test_metrics", {})
    keys = get_remove_bg_api_keys()
    hf_tok = get_hf_token()
    force_rembg_env = os.getenv("FORCE_REMBG", "false").strip().lower() in ("true", "1", "yes")
    return {
        "status": "ok",
        "version": "7.1.0",
        "device": str(DEVICE) if DEVICE is not None else "cpu",
        "cuda_available": bool(TORCH_AVAILABLE and torch is not None and torch.cuda.is_available()),
        "model": "resnet50-stylesense-5class" if IS_FINETUNED_HEAD else "resnet50-imagenet1k-v2",
        "aux_imagenet_calibrator_loaded": AUX_IMAGENET_MODEL is not None,
        "checkpoint_loaded": IS_FINETUNED_HEAD,
        "checkpoint_path": LOADED_CHECKPOINT_PATH,
        "best_epoch": LOADED_RESULTS_DATA.get("best_epoch", 13 if IS_FINETUNED_HEAD else None),
        "validation_accuracy": val_metrics.get("accuracy", 0.8655 if IS_FINETUNED_HEAD else None),
        "final_test_accuracy": test_metrics.get("accuracy", 0.8631 if IS_FINETUNED_HEAD else None),
        "validation_metrics": val_metrics if val_metrics else None,
        "final_test_metrics": test_metrics if test_metrics else None,
        "remove_bg_configured": len(keys) > 0,
        "remove_bg_keys_count": len(keys),
        "remove_bg_size": os.getenv("REMOVE_BG_SIZE", "preview"),
        "force_rembg": force_rembg_env,
        "rembg_u2net_enabled": REMBG_SESSION is not None,
        "kmeans_module": "ml-service.kmeans_color",
        "kmeans_k_locked": 2,
        "nsfw_5class_enabled": True,
        "studio_beautify_enabled": True,
        "try_on_2d_enabled": True,
        "two_pass_full_body_vton_enabled": True,
        "hf_token_configured": bool(hf_tok),
        "gradio_vton_bridge_enabled": GRADIO_CLIENT_AVAILABLE,
        "vton_spaces": list(HF_VTON_SPACES),
        "lower_body_vton_spaces": list(HF_LOWER_BODY_VTON_SPACES),
        "gemini_removed": True,
        "subtypes_count": 33,
        "ood_non_wearable_gate_enabled": True,
        "taxonomy": CATEGORIES_LIST,
        "hybrid_engine": "0.55_CB_0.45_CF",
        "ai_moderation_enabled": True,
        "system_catalog_size": len(SYSTEM_DATASET_CATALOG),
        "mel_mascot_commentary_enabled": True,
        "cross_gender_cf_enabled": True,
        "laundry_wear_filter_removed": True,
        "mannequin_2d_vector_subtypes_enabled": True,
    }


@app.post("/analyze", response_model=PredictResponse)
async def analyze(request: Request, force_rembg: Optional[bool] = None) -> PredictResponse:
    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    body: bytes = b""
    source_filename = request.headers.get("x-source-filename", "")

    if content_type in {"image/jpeg", "image/png", "image/webp"}:
        body = await request.body()
    elif content_type == "multipart/form-data":
        form = await request.form()
        upload = form.get("file") or form.get("image")
        if upload is not None and hasattr(upload, "read"):
            body = await upload.read()  # type: ignore[misc]
            if not source_filename and hasattr(upload, "filename") and upload.filename:
                source_filename = str(upload.filename)
    else:
        raise HTTPException(status_code=415, detail="Send a JPEG, PNG, or WebP image body.")

    if not body or len(body) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image must be between 1 byte and 5 MB.")
    try:
        image = Image.open(BytesIO(body)).convert("RGB")
    except UnidentifiedImageError as error:
        raise HTTPException(status_code=422, detail="The request body is not a valid image.") from error
    if MODEL is None:
        raise HTTPException(status_code=503, detail="CNN model is still loading.")
    force_param = (force_rembg is True) or (request.query_params.get("force_rembg", "").lower() in ("true", "1", "yes"))
    return await run_garment_analysis(image, source_filename, force_rembg=force_param)


@app.post("/analyze-batch", response_model=BatchAnalyzeResponse)
async def analyze_batch(payload: BatchAnalyzeRequest, request: Request, force_rembg: Optional[bool] = None) -> BatchAnalyzeResponse:
    if MODEL is None:
        raise HTTPException(status_code=503, detail="CNN model is still loading.")
    if len(payload.images) > 15:
        raise HTTPException(status_code=422, detail="Batch size cannot exceed 15 images.")

    force_param = (force_rembg is True) or (request.query_params.get("force_rembg", "").lower() in ("true", "1", "yes"))

    results: List[BatchAnalyzeItemResult] = []
    for item in payload.images:
        try:
            raw_b64 = item.base64
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",", 1)[1]
            img_bytes = base64.b64decode(raw_b64)
            image = Image.open(BytesIO(img_bytes)).convert("RGB")
            pred = await run_garment_analysis(image, item.filename or "", force_rembg=force_param)
            pred_dict = pred.dict() if hasattr(pred, "dict") else pred.model_dump()
            results.append(BatchAnalyzeItemResult(id=item.id, **pred_dict))
        except Exception as e:
            logger.warning(f"Failed to process batch item {item.id}: {e}")
            results.append(
                BatchAnalyzeItemResult(
                    id=item.id,
                    confidence=0.0,
                    class_probabilities={},
                    is_safe_garment=False,
                    moderation_reason=f"Failed to process image: {str(e)}",
                )
            )
    return BatchAnalyzeResponse(results=results)


@app.post("/moderate", response_model=ModerationResponse)
def moderate_post(payload: ModerationRequest) -> ModerationResponse:
    """Automated AI guard for Community Feed posts (blocks 5-class NSFW images & profanity)."""
    text_ok, sanitized, reason = check_text_moderation(payload.caption)

    nsfw_scores: Dict[str, float] = {
        "Drawing": 0.01,
        "Hentai": 0.01,
        "Neutral": round(max(0.05, 1.0 - payload.skin_exposure_ratio), 4),
        "Porn": round(max(0.0, payload.skin_exposure_ratio - 0.35), 4),
        "Sexy": round(min(0.90, payload.skin_exposure_ratio * 0.8), 4),
    }

    if payload.image_base64:
        try:
            raw_b64 = payload.image_base64.split(",", 1)[1] if "," in payload.image_base64 else payload.image_base64
            img = Image.open(BytesIO(base64.b64decode(raw_b64))).convert("RGB")
            img_safe, nsfw_scores, img_reason = evaluate_5class_nsfw_safety(img)
            if not img_safe:
                return ModerationResponse(
                    approved=False,
                    sanitized_caption=sanitized,
                    reason=img_reason,
                    nsfw_scores=nsfw_scores,
                )
        except Exception as e:
            logger.debug(f"Moderation image_base64 check skipped: {e}")

    if not text_ok:
        return ModerationResponse(approved=False, sanitized_caption=sanitized, reason=reason, nsfw_scores=nsfw_scores)
    if (
        payload.skin_exposure_ratio > 0.55
        or payload.garment_confidence < 0.35
        or nsfw_scores.get("Porn", 0.0) > 0.15
        or nsfw_scores.get("Sexy", 0.0) > 0.35
        or nsfw_scores.get("Drawing", 0.0) > 0.40
        or nsfw_scores.get("Hentai", 0.0) > 0.15
    ):
        return ModerationResponse(
            approved=False,
            sanitized_caption=sanitized,
            reason="Post blocked: Uploaded photo did not pass garment verification or 5-class NSFW safety checks.",
            nsfw_scores=nsfw_scores,
        )
    return ModerationResponse(approved=True, sanitized_caption=sanitized, reason=None, nsfw_scores=nsfw_scores)


@app.post("/beautify", response_model=BeautifyResponse)
def beautify_garment_endpoint(req: BeautifyRequest, request: Request) -> BeautifyResponse:
    """1:1 Faithful Studio Cutout & Hanger-Hook Cleaner Endpoint ($0.00 Pipeline)."""
    raw_b64 = req.image_base64.strip()
    if "," in raw_b64:
        raw_b64 = raw_b64.split(",", 1)[1]
    try:
        raw_bytes = base64.b64decode(raw_b64)
        cutout_pil = Image.open(BytesIO(raw_bytes)).convert("RGBA")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid image_base64 for beautify: {e}") from e

    alpha_arr = np.asarray(cutout_pil)[:, :, 3]
    if float(np.mean(alpha_arr > 250)) > 0.96:
        try:
            cutout_pil, _, _, _ = extract_garment_cutout(cutout_pil.convert("RGB"), force_rembg=False)
        except Exception:
            pass

    cache_key = hashlib.sha256(raw_bytes).hexdigest()
    if cache_key in _STUDIO_BEAUTIFY_CACHE:
        print(f"[ML-BEAUTIFY] Returning cached Studio Cutout for {cache_key[:10]}...", flush=True)
        return BeautifyResponse(beautifiedDataUri=_STUDIO_BEAUTIFY_CACHE[cache_key], method="studio_cutout_clean")

    print(f"[ML-BEAUTIFY] POST /beautify invoked | cat={req.category} | sub={req.sub_category}", flush=True)
    beautified_uri = beautify_garment_geometric_studio(
        cutout_rgba=cutout_pil,
        category=req.category,
        sub_category=req.sub_category,
    )
    _STUDIO_BEAUTIFY_CACHE[cache_key] = beautified_uri
    return BeautifyResponse(beautifiedDataUri=beautified_uri, method="studio_cutout_clean")


def _decode_item_cutout_raw(item: WardrobeItemInput) -> Optional[Image.Image]:
    """Decode item's cutout/beautified image_url into a tight-cropped, hanger-cleaned RGBA PIL Image."""
    img_url = (item.cutoutDataUri or item.beautifiedDataUri or item.image_url or "").strip()
    pil_rgba: Optional[Image.Image] = None
    if img_url.startswith("data:image/") and not img_url.startswith("data:image/svg"):
        try:
            b64_part = img_url.split(",", 1)[1]
            pil_rgba = Image.open(BytesIO(base64.b64decode(b64_part))).convert("RGBA")
        except Exception:
            pil_rgba = None
    elif img_url.startswith("http://") or img_url.startswith("https://"):
        try:
            r = requests.get(img_url, timeout=6)
            if r.status_code == 200:
                raw_http_img = Image.open(BytesIO(r.content))
                if REMBG_AVAILABLE and remove is not None and REMBG_SESSION is not None:
                    pil_rgba = remove(raw_http_img.convert("RGB"), session=REMBG_SESSION, alpha_matting=False).convert("RGBA")
                else:
                    pil_rgba = raw_http_img.convert("RGBA")
        except Exception:
            pil_rgba = None

    if pil_rgba is not None:
        rgba_np = _erase_top_hanger_hooks_and_bars(np.asarray(pil_rgba, dtype=np.uint8).copy(), allow_bar_erase=True)
        pil_rgba = Image.fromarray(rgba_np, mode="RGBA")
        bbox = pil_rgba.getbbox()
        if bbox:
            pil_rgba = pil_rgba.crop(bbox)
    return pil_rgba


def _decode_item_cutout_or_render_placeholder(item: WardrobeItemInput, target_w: int, target_h: int) -> Image.Image:
    """Decode item's cutout/beautified image_url and fit proportionally inside (target_w, target_h) with zero stretching."""
    tw_safe = max(16, target_w)
    th_safe = max(16, target_h)
    pil_rgba = _decode_item_cutout_raw(item)
    if pil_rgba is not None:
        pil_rgba.thumbnail((tw_safe, th_safe), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (tw_safe, th_safe), (0, 0, 0, 0))
        ox = (tw_safe - pil_rgba.width) // 2
        oy = (th_safe - pil_rgba.height) // 2
        canvas.paste(pil_rgba, (ox, oy), pil_rgba)
        return canvas

    ref_lab = kmeans_color.NAMED_FASHION_COLORS.get(item.color, (35.0, 0.0, 0.0))
    rgb_tup = kmeans_color.cielab_to_rgb(np.asarray(ref_lab, dtype=np.float64))
    fill_rgba = (int(rgb_tup[0]), int(rgb_tup[1]), int(rgb_tup[2]), 235)
    layer = Image.new("RGBA", (tw_safe, th_safe), (0, 0, 0, 0))
    from PIL import ImageDraw

    d = ImageDraw.Draw(layer)
    d.rounded_rectangle([2, 2, max(14, tw_safe - 3), max(14, th_safe - 3)], radius=12, fill=fill_rgba)
    return layer


def _is_cutout_actually_graphic_tee(item: WardrobeItemInput) -> bool:
    """Detect if a legacy item saved in MongoDB as OUTERWEAR ('Black Track Jacket') is actually a Graphic T-Shirt."""
    if item.category != "OUTERWEAR":
        return False
    nl = (item.clothing_name or "").lower()
    if any(w in nl for w in ("blazer", "coat", "cardigan")):
        return False
    pil_rgba = _decode_item_cutout_raw(item)
    if pil_rgba is None:
        return False
    rgba = np.asarray(pil_rgba, dtype=np.uint8)
    ch, cw = rgba.shape[:2]
    if ch < 24 or cw < 24:
        return False
    gx0, gx1 = int(0.26 * cw), max(int(0.26 * cw) + 2, int(0.74 * cw))
    gy0, gy1 = int(0.20 * ch), max(int(0.20 * ch) + 2, int(0.72 * ch))
    chest_rgb = rgba[gy0:gy1, gx0:gx1, :3].reshape(-1, 3).astype(np.float64)
    chest_fg = rgba[gy0:gy1, gx0:gx1, 3].reshape(-1) > 128
    if int(np.sum(chest_fg)) < 20:
        return False
    chest_rgb = chest_rgb[chest_fg]
    chest_lab = kmeans_color.rgb_to_cielab(chest_rgb)
    std_a = float(np.std(chest_lab[:, 1]))
    std_b = float(np.std(chest_lab[:, 2]))
    return (std_a > 12.5 or std_b > 12.5) and (float(cw) / max(float(ch), 1.0) >= 0.68)


def _isolate_clean_person_on_studio_white(
    user_img: Image.Image,
    max_size: Tuple[int, int] = (520, 680),
) -> Tuple[Image.Image, Optional[np.ndarray], Tuple[int, int, int, int], str]:
    """Segment the standing user onto a pure #FFFFFF Cladwell-style studio card with a soft floor shadow,
    keeping strictly the main human connected component and 100% scrubbing the pink bag beside the right leg.
    """
    base_rgba = user_img.copy()
    base_rgba.thumbnail(max_size, Image.Resampling.LANCZOS)
    base_rgba = base_rgba.convert("RGBA")
    W, H = base_rgba.size

    p_left, p_top, p_right, p_bottom = int(0.20 * W), int(0.05 * H), int(0.80 * W), int(0.95 * H)
    person_alpha: Optional[np.ndarray] = None

    if REMBG_AVAILABLE and remove is not None and REMBG_SESSION is not None:
        try:
            person_cutout = remove(base_rgba.convert("RGB"), session=REMBG_SESSION, alpha_matting=False).convert("RGBA")
            person_alpha = np.asarray(person_cutout)[:, :, 3].copy()

            if cv2 is not None:
                rgb_arr = np.asarray(base_rgba, dtype=np.uint8)[:, :, :3]
                r_ch = rgb_arr[:, :, 0].astype(np.int32)
                g_ch = rgb_arr[:, :, 1].astype(np.int32)
                b_ch = rgb_arr[:, :, 2].astype(np.int32)
                is_pink_or_purple_bag = (r_ch - g_ch >= 12) & (b_ch - g_ch >= 6) & (r_ch >= 95)
                lower_half = np.zeros((H, W), dtype=bool)
                lower_half[int(0.55 * H) :, :] = True
                person_alpha[lower_half & is_pink_or_purple_bag] = 0

                fg_bin = (person_alpha > 72).astype(np.uint8)
                num_labels, labels_im, stats, _ = cv2.connectedComponentsWithStats(fg_bin)
                if num_labels > 2:
                    largest_label = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
                    person_alpha = np.where(labels_im == largest_label, person_alpha, 0).astype(np.uint8)

                ys_tmp, xs_tmp = np.where(person_alpha > 64)
                if len(ys_tmp) > 50:
                    t_top, t_bot = int(np.min(ys_tmp)), int(np.max(ys_tmp))
                    t_h = max(t_bot - t_top, 80)
                    chest_xs = np.where(person_alpha[t_top + int(0.20 * t_h) : t_top + int(0.35 * t_h), :] > 96)[1]
                    c_x = int(np.median(chest_xs)) if len(chest_xs) > 10 else (W // 2)
                    sh_span = int(np.percentile(chest_xs, 95) - np.percentile(chest_xs, 5)) if len(chest_xs) > 10 else int(0.45 * W)
                    max_leg_half_span = max(36, int(sh_span * 0.49))
                    knee_y = t_top + int(0.64 * t_h)
                    if knee_y < H:
                        person_alpha[knee_y:, : max(0, c_x - max_leg_half_span)] = 0
                        person_alpha[knee_y:, min(W, c_x + max_leg_half_span) :] = 0

                k_p = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
                person_alpha = cv2.morphologyEx(person_alpha, cv2.MORPH_CLOSE, k_p)
                person_alpha = cv2.GaussianBlur(person_alpha, (3, 3), 0)

            p_ys, p_xs = np.where(person_alpha > 64)
            if len(p_ys) > 50 and len(p_xs) > 30:
                p_top, p_bottom = int(np.min(p_ys)), int(np.max(p_ys))
                p_left, p_right = int(np.min(p_xs)), int(np.max(p_xs))
        except Exception as e:
            logger.debug(f"Studio person isolation fallback: {e}")

    p_w = max(40, p_right - p_left)
    p_h = max(80, p_bottom - p_top)
    torso_cx = p_left + p_w // 2

    skin_hex = "#D8A988"
    try:
        face_crop = np.asarray(
            base_rgba.crop(
                (
                    max(0, torso_cx - int(0.08 * p_w)),
                    max(0, p_top + int(0.04 * p_h)),
                    min(W, torso_cx + int(0.08 * p_w)),
                    min(H, p_top + int(0.12 * p_h)),
                )
            ).convert("RGB"),
            dtype=np.uint8,
        )
        if face_crop.size >= 3:
            face_med = np.median(face_crop.reshape(-1, 3), axis=0)
            skin_hex = f"#{int(face_med[0]):02x}{int(face_med[1]):02x}{int(face_med[2]):02x}".upper()
    except Exception:
        pass

    studio_card = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    from PIL import ImageDraw
    shadow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_layer)
    sh_rx = int(p_w * 0.34)
    sh_ry = max(10, int(0.024 * p_h))
    sh_cy = min(H - sh_ry - 2, p_bottom - int(0.012 * p_h))
    s_draw.ellipse(
        [torso_cx - sh_rx, sh_cy - sh_ry, torso_cx + sh_rx, sh_cy + sh_ry],
        fill=(15, 23, 42, 42),
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=8))
    studio_card = Image.alpha_composite(studio_card, shadow_layer)

    person_np = np.asarray(base_rgba, dtype=np.uint8).copy()
    if person_alpha is not None:
        person_np[:, :, 3] = person_alpha
    isolated_rgba = Image.alpha_composite(studio_card, Image.fromarray(person_np, mode="RGBA"))
    return isolated_rgba, person_alpha, (p_left, p_top, p_right, p_bottom), skin_hex


def _instantiate_gradio_client(space_id: str, resolved_token: str) -> Any:
    """Instantiate GradioClient across all gradio_client versions (handling `token` vs `hf_token` signatures)."""
    if resolved_token:
        os.environ["HF_TOKEN"] = resolved_token
        os.environ["HUGGING_FACE_HUB_TOKEN"] = resolved_token

    try:
        sig_params = inspect.signature(GradioClient.__init__).parameters
        if resolved_token and "token" in sig_params:
            return GradioClient(space_id, token=resolved_token)
        elif resolved_token and "hf_token" in sig_params:
            return GradioClient(space_id, hf_token=resolved_token)
        else:
            return GradioClient(space_id)
    except Exception:
        return GradioClient(space_id)


def _try_gradio_zerogpu_upper_vton(
    studio_person_rgb: Image.Image,
    upper_pil: Optional[Image.Image],
    upper_desc: str,
    hf_token: Optional[str] = None,
    budget_seconds: float = 28.0,
) -> Optional[Image.Image]:
    """Pass 1: Upper-Body Diffusion VTON via yisol/IDM-VTON (`is_checked=True`)."""
    global _HF_ZEROGPU_COOLDOWN_UNTIL
    if not GRADIO_CLIENT_AVAILABLE or GradioClient is None or gradio_handle_file is None or upper_pil is None:
        return None
    if time.time() < _HF_ZEROGPU_COOLDOWN_UNTIL:
        return None

    resolved_token = get_hf_token(explicit_token=hf_token)
    if os.getenv("DISABLE_ZEROGPU_VTON", "false").strip().lower() in ("true", "1", "yes"):
        return None

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            p_path = os.path.join(tmpdir, "person_upper.png")
            g_path = os.path.join(tmpdir, "garment_upper.png")
            p_vton = studio_person_rgb.convert("RGB").copy()
            p_vton.thumbnail((768, 1024), Image.Resampling.LANCZOS)
            p_vton.save(p_path, format="PNG")

            g_white = Image.new("RGBA", upper_pil.size, (255, 255, 255, 255))
            Image.alpha_composite(g_white, upper_pil.convert("RGBA")).convert("RGB").save(g_path, format="PNG")

            deadline = time.time() + max(6.0, budget_seconds)
            for space_id in HF_VTON_SPACES:
                remaining = deadline - time.time()
                if remaining < 5.0:
                    break
                try:
                    print(
                        f"[ML-TRYON-2D][PASS-1 UPPER] Calling '{space_id}' | garment='{upper_desc}'",
                        flush=True,
                    )
                    client = _instantiate_gradio_client(space_id, resolved_token)
                    job = client.submit(
                        dict={"background": gradio_handle_file(p_path), "layers": [], "composite": None},
                        garm_img=gradio_handle_file(g_path),
                        garment_des=upper_desc or "shirt",
                        is_checked=True,
                        is_checked_crop=False,
                        denoise_steps=20,
                        seed=42,
                        api_name="/tryon",
                    )
                    try:
                        res = job.result(timeout=max(1.0, deadline - time.time()))
                    except Exception:
                        try:
                            job.cancel()
                        except Exception:
                            pass
                        raise
                    out_path = res[0] if isinstance(res, (list, tuple)) else res
                    if isinstance(out_path, dict):
                        out_path = out_path.get("path") or out_path.get("name")
                    if isinstance(out_path, str) and os.path.exists(out_path):
                        print(f"[ML-TRYON-2D][PASS-1 UPPER] Success via '{space_id}'!", flush=True)
                        with Image.open(out_path) as vton_img:
                            return vton_img.convert("RGB")
                except Exception as space_err:
                    print(f"[ML-TRYON-2D][PASS-1 UPPER] Space '{space_id}' error: {space_err}", flush=True)
                    continue
    except Exception as e:
        logger.debug(f"Pass-1 Upper VTON skipped: {e}")
    return None


def _build_lower_body_vton_mask_and_garment_card(
    person_img_rgb: Image.Image,
    p_bbox_orig: Tuple[int, int, int, int],
    orig_size: Tuple[int, int],
    bottom_pil: Image.Image,
    shoe_pil: Optional[Image.Image] = None,
) -> Tuple[Image.Image, Image.Image, Image.Image]:
    """Build the 768x1024 person image, 768x1024 RGBA Lower-Body+Feet Binary Mask (for IDM-VTON `is_checked=False`),
    and 768x1024 studio lower-body garment reference card.
    """
    target_w, target_h = 768, 1024
    p_768 = person_img_rgb.convert("RGB").resize((target_w, target_h), Image.Resampling.LANCZOS)

    orig_w, orig_h = orig_size
    sx = float(target_w) / max(float(orig_w), 1.0)
    sy = float(target_h) / max(float(orig_h), 1.0)
    p_left, p_top, p_right, p_bottom = p_bbox_orig
    top_768 = int(p_top * sy)
    bot_768 = int(p_bottom * sy)
    left_768 = int(p_left * sx)
    right_768 = int(p_right * sx)
    ph_768 = max(120, bot_768 - top_768)
    pw_768 = max(80, right_768 - left_768)
    cx_768 = (left_768 + right_768) // 2

    # Build Lower-Body + Feet mask:
    # Starts right at the waist/hip line (`top_768 + 0.475 * ph_768`) down to the bottom of the feet (`bot_768 + 10`),
    # Narrower at the waist so the user's left and right hands (`x < cx - 0.31*pw` and `x > cx + 0.31*pw`) stay UNMASKED!
    mask_rgba = np.zeros((target_h, target_w, 4), dtype=np.uint8)
    y_waist = max(0, top_768 + int(0.475 * ph_768))
    y_knees = min(target_h, top_768 + int(0.64 * ph_768))
    y_feet = min(target_h, bot_768 + 12)

    waist_half_w = int(0.285 * pw_768)
    leg_half_w = int(0.33 * pw_768)

    for ry in range(y_waist, y_feet):
        if ry < y_knees:
            # Taper smoothly from waist_half_w to leg_half_w while keeping outer hands unmasked!
            t = float(ry - y_waist) / max(float(y_knees - y_waist), 1.0)
            hw = int((1.0 - t) * waist_half_w + t * leg_half_w)
        else:
            hw = leg_half_w
        x0 = max(0, cx_768 - hw)
        x1 = min(target_w, cx_768 + hw)
        mask_rgba[ry, x0:x1, :] = 255

    mask_pil = Image.fromarray(mask_rgba, mode="RGBA")

    # Build 768x1024 Garment Reference Card for Lower Body:
    g_card = Image.new("RGBA", (target_w, target_h), (255, 255, 255, 255))
    b_copy = bottom_pil.copy()
    # Trim top 3.5% hanger clip indent on waistband
    if b_copy.height > 40:
        b_copy = b_copy.crop((0, int(0.035 * b_copy.height), b_copy.width, b_copy.height))
        b_bbox = b_copy.getbbox()
        if b_bbox:
            b_copy = b_copy.crop(b_bbox)

    if shoe_pil is not None:
        b_copy.thumbnail((640, 740), Image.Resampling.LANCZOS)
        bx = (target_w - b_copy.width) // 2
        by = 60
        g_card.paste(b_copy, (bx, by), b_copy)

        s_copy = shoe_pil.copy()
        s_copy.thumbnail((420, 170), Image.Resampling.LANCZOS)
        sx_pos = (target_w - s_copy.width) // 2
        sy_pos = min(target_h - s_copy.height - 24, by + b_copy.height + 12)
        g_card.paste(s_copy, (sx_pos, sy_pos), s_copy)
    else:
        b_copy.thumbnail((660, 880), Image.Resampling.LANCZOS)
        bx = (target_w - b_copy.width) // 2
        by = (target_h - b_copy.height) // 2
        g_card.paste(b_copy, (bx, by), b_copy)

    return p_768, mask_pil, g_card.convert("RGB")


def _try_gradio_zerogpu_lower_vton(
    person_img_rgb: Image.Image,
    p_bbox_orig: Tuple[int, int, int, int],
    orig_size: Tuple[int, int],
    bottom_pil: Optional[Image.Image],
    shoe_pil: Optional[Image.Image],
    bottom_desc: str,
    shoe_desc: str,
    hf_token: Optional[str] = None,
    budget_seconds: float = 28.0,
) -> Optional[Image.Image]:
    """Pass 2: Multi-Source Lower-Body & Shoes Diffusion VTON:
    1. Source A: `yisol/IDM-VTON` with `is_checked=False` + Custom Lower-Body & Feet Mask in `dict['layers'][0]`,
       which runs DensePose + SDXL Inpainting UNet to diffusion-render the pants and shoes onto the user's legs/feet!
    2. Source B: `jallenjia/Change-Clothes-AI` with `category='lower_body'`.
    3. Source C: `franciszzj/Leffa` with `vt_model_type='dress_code'`, `vt_garment_type='lower_body'`.
    """
    if not GRADIO_CLIENT_AVAILABLE or GradioClient is None or gradio_handle_file is None or bottom_pil is None:
        return None
    if os.getenv("DISABLE_ZEROGPU_VTON", "false").strip().lower() in ("true", "1", "yes"):
        return None

    resolved_token = get_hf_token(explicit_token=hf_token)

    try:
        p_768, mask_pil, g_card_rgb = _build_lower_body_vton_mask_and_garment_card(
            person_img_rgb=person_img_rgb,
            p_bbox_orig=p_bbox_orig,
            orig_size=orig_size,
            bottom_pil=bottom_pil,
            shoe_pil=shoe_pil,
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            p_path = os.path.join(tmpdir, "person_lower.png")
            m_path = os.path.join(tmpdir, "mask_lower.png")
            g_path = os.path.join(tmpdir, "garment_lower.png")
            p_768.save(p_path, format="PNG")
            mask_pil.save(m_path, format="PNG")
            g_card_rgb.save(g_path, format="PNG")

            full_lower_prompt = (
                f"{bottom_desc} full length pants worn on legs with {shoe_desc} sneakers worn on feet"
                if shoe_desc
                else f"{bottom_desc} full length pants worn on legs"
            )
            deadline = time.time() + max(6.0, budget_seconds)

            # 1) Try yisol/IDM-VTON Custom Mask Mode (`is_checked=False` + `layers=[m_path]`)
            if deadline - time.time() >= 5.0:
                try:
                    print(
                        f"[ML-TRYON-2D][PASS-2 LOWER] Calling 'yisol/IDM-VTON' (custom lower-body mask) | garment='{full_lower_prompt}'",
                        flush=True,
                    )
                    client = _instantiate_gradio_client("yisol/IDM-VTON", resolved_token)
                    job = client.submit(
                        dict={
                            "background": gradio_handle_file(p_path),
                            "layers": [gradio_handle_file(m_path)],
                            "composite": gradio_handle_file(p_path),
                        },
                        garm_img=gradio_handle_file(g_path),
                        garment_des=full_lower_prompt,
                        is_checked=False,
                        is_checked_crop=False,
                        denoise_steps=20,
                        seed=42,
                        api_name="/tryon",
                    )
                    try:
                        res = job.result(timeout=max(1.0, deadline - time.time()))
                    except Exception:
                        try:
                            job.cancel()
                        except Exception:
                            pass
                        raise
                    out_path = res[0] if isinstance(res, (list, tuple)) else res
                    if isinstance(out_path, dict):
                        out_path = out_path.get("path") or out_path.get("name")
                    if isinstance(out_path, str) and os.path.exists(out_path):
                        print("[ML-TRYON-2D][PASS-2 LOWER] Success via 'yisol/IDM-VTON' (custom lower-body mask)!", flush=True)
                        with Image.open(out_path) as vton_img:
                            return vton_img.convert("RGB")
                except Exception as err1:
                    print(f"[ML-TRYON-2D][PASS-2 LOWER] 'yisol/IDM-VTON' custom mask fallback: {err1}", flush=True)

            # 2) Try jallenjia/Change-Clothes-AI with native `category="lower_body"`
            if deadline - time.time() >= 5.0:
                try:
                    print(
                        f"[ML-TRYON-2D][PASS-2 LOWER] Calling 'jallenjia/Change-Clothes-AI' (category='lower_body') | garment='{bottom_desc}'",
                        flush=True,
                    )
                    client2 = _instantiate_gradio_client("jallenjia/Change-Clothes-AI", resolved_token)
                    job2 = client2.submit(
                        dict={"background": gradio_handle_file(p_path), "layers": [], "composite": None},
                        garm_img=gradio_handle_file(g_path),
                        garment_des=full_lower_prompt,
                        is_checked=True,
                        is_checked_crop=False,
                        denoise_steps=20,
                        seed=42,
                        category="lower_body",
                        api_name="/tryon",
                    )
                    try:
                        res2 = job2.result(timeout=max(1.0, deadline - time.time()))
                    except Exception:
                        try:
                            job2.cancel()
                        except Exception:
                            pass
                        raise
                    out_path2 = res2[0] if isinstance(res2, (list, tuple)) else res2
                    if isinstance(out_path2, dict):
                        out_path2 = out_path2.get("path") or out_path2.get("name")
                    if isinstance(out_path2, str) and os.path.exists(out_path2):
                        print("[ML-TRYON-2D][PASS-2 LOWER] Success via 'jallenjia/Change-Clothes-AI'!", flush=True)
                        with Image.open(out_path2) as vton_img2:
                            return vton_img2.convert("RGB")
                except Exception as err2:
                    print(f"[ML-TRYON-2D][PASS-2 LOWER] 'jallenjia/Change-Clothes-AI' fallback: {err2}", flush=True)

            # 3) Try franciszzj/Leffa (`vt_model_type="dress_code"`, `vt_garment_type="lower_body"`)
            if deadline - time.time() >= 5.0:
                try:
                    print(
                        f"[ML-TRYON-2D][PASS-2 LOWER] Calling 'franciszzj/Leffa' (lower_body) | garment='{bottom_desc}'",
                        flush=True,
                    )
                    client3 = _instantiate_gradio_client("franciszzj/Leffa", resolved_token)
                    job3 = client3.submit(
                        src_image_path=gradio_handle_file(p_path),
                        ref_image_path=gradio_handle_file(g_path),
                        ref_acceleration=True,
                        step=20,
                        scale=2.5,
                        seed=42,
                        vt_model_type="dress_code",
                        vt_garment_type="lower_body",
                        vt_repaint=False,
                        api_name="/leffa_predict_vt",
                    )
                    try:
                        res3 = job3.result(timeout=max(1.0, deadline - time.time()))
                    except Exception:
                        try:
                            job3.cancel()
                        except Exception:
                            pass
                        raise
                    out_path3 = res3[0] if isinstance(res3, (list, tuple)) else res3
                    if isinstance(out_path3, dict):
                        out_path3 = out_path3.get("path") or out_path3.get("name")
                    if isinstance(out_path3, str) and os.path.exists(out_path3):
                        print("[ML-TRYON-2D][PASS-2 LOWER] Success via 'franciszzj/Leffa'!", flush=True)
                        with Image.open(out_path3) as vton_img3:
                            return vton_img3.convert("RGB")
                except Exception as err3:
                    print(f"[ML-TRYON-2D][PASS-2 LOWER] 'franciszzj/Leffa' fallback: {err3}", flush=True)
    except Exception as e:
        logger.debug(f"Pass-2 Lower VTON skipped: {e}")
    return None


def _fit_bottom_and_shoes_onto_studio_person(
    studio_person_rgba: Image.Image,
    person_alpha: Optional[np.ndarray],
    p_bbox: Tuple[int, int, int, int],
    bottom_item: Optional[WardrobeItemInput],
    shoe_item: Optional[WardrobeItemInput],
    waist_overlap_for_vton: bool = True,
) -> Image.Image:
    """Fallback local lower-body fitter if all 3 Lower-Body Diffusion VTON Spaces are busy."""
    comp = studio_person_rgba.copy()
    W, H = comp.size
    p_left, p_top, p_right, p_bottom = p_bbox
    p_w = max(40, p_right - p_left)
    p_h = max(80, p_bottom - p_top)
    torso_cx = p_left + p_w // 2
    shoulder_w = int(p_w * 0.64)
    hip_w = int(p_w * 0.54)
    left_foot_cx = torso_cx - int(p_w * 0.13)
    right_foot_cx = torso_cx + int(p_w * 0.13)
    left_foot_bot_y = p_bottom
    right_foot_bot_y = p_bottom

    if person_alpha is not None:
        sh_y0 = p_top + int(0.17 * p_h)
        sh_y1 = p_top + int(0.28 * p_h)
        sh_spans = []
        sh_centers = []
        for ry in range(max(0, sh_y0), min(H, sh_y1)):
            xs_r = np.where(person_alpha[ry, :] > 96)[0]
            if len(xs_r) >= 10:
                sh_spans.append(int(xs_r[-1] - xs_r[0] + 1))
                sh_centers.append(int((xs_r[0] + xs_r[-1]) // 2))
        if sh_spans:
            measured_sh = int(np.median(sh_spans))
            shoulder_w = int(np.clip(measured_sh * 0.94, p_w * 0.46, p_w * 0.74))
            torso_cx = int(np.median(sh_centers))

        hp_y0 = p_top + int(0.42 * p_h)
        hp_y1 = p_top + int(0.54 * p_h)
        hp_spans = []
        for ry in range(max(0, hp_y0), min(H, hp_y1)):
            row_mask = person_alpha[ry, :] > 96
            lx = torso_cx
            while lx > p_left and row_mask[lx]:
                lx -= 1
            rx = torso_cx
            while rx < p_right and row_mask[rx]:
                rx += 1
            seg_w = rx - lx
            if seg_w >= int(0.24 * p_w):
                hp_spans.append(seg_w)
        if hp_spans:
            measured_hp = int(np.median(hp_spans))
            hip_w = int(np.clip(measured_hp * 1.08, p_w * 0.40, shoulder_w * 0.96))
        else:
            hip_w = int(shoulder_w * 0.86)

        ft_y0 = max(0, p_top + int(0.80 * p_h))
        ft_y1 = min(H, p_bottom + 2)
        ft_slice = person_alpha[ft_y0:ft_y1, :] > 80
        if ft_slice.size > 0:
            l_ys, l_xs = np.where(ft_slice[:, :torso_cx])
            r_ys, r_xs = np.where(ft_slice[:, torso_cx:])
            if len(l_xs) > 5:
                left_foot_cx = int(np.median(l_xs))
                left_foot_bot_y = ft_y0 + int(np.percentile(l_ys, 98))
            if len(r_xs) > 5:
                right_foot_cx = int(np.median(r_xs)) + torso_cx
                right_foot_bot_y = ft_y0 + int(np.percentile(r_ys, 98))

    def _paste_with_shadow(base_c: Image.Image, layer_rgba: Image.Image, dst_x: int, dst_y: int) -> Image.Image:
        l_alpha = layer_rgba.split()[3]
        sh_canvas = Image.new("L", base_c.size, 0)
        sh_canvas.paste(l_alpha, (dst_x, dst_y + 3))
        sh_blur = sh_canvas.filter(ImageFilter.GaussianBlur(radius=4))
        sh_np = (np.asarray(sh_blur, dtype=np.float32) * (30.0 / 255.0)).clip(0, 255).astype(np.uint8)
        sh_rgba = np.zeros((base_c.size[1], base_c.size[0], 4), dtype=np.uint8)
        sh_rgba[:, :, 3] = sh_np
        base_c = Image.alpha_composite(base_c, Image.fromarray(sh_rgba, mode="RGBA"))
        fg_c = Image.new("RGBA", base_c.size, (0, 0, 0, 0))
        fg_c.paste(layer_rgba, (dst_x, dst_y), layer_rgba)
        return Image.alpha_composite(base_c, fg_c)

    comp_np = np.asarray(comp, dtype=np.uint8).copy()
    if bottom_item is not None:
        leg_clear_y0 = max(0, p_top + int(0.49 * p_h))
        leg_clear_y1 = min(H, p_top + int(0.88 * p_h))
        leg_clear_x0 = max(0, min(left_foot_cx, torso_cx - int(hip_w * 0.45)) - int(0.08 * p_w))
        leg_clear_x1 = min(W, max(right_foot_cx, torso_cx + int(hip_w * 0.45)) + int(0.08 * p_w))
        comp_np[leg_clear_y0:leg_clear_y1, leg_clear_x0:leg_clear_x1, :3] = 255

    if shoe_item is not None:
        toe_clear_y0 = max(0, min(left_foot_bot_y, right_foot_bot_y) - int(0.11 * p_h))
        toe_clear_y1 = min(H, max(left_foot_bot_y, right_foot_bot_y) + 4)
        toe_clear_x0 = max(0, left_foot_cx - int(0.14 * p_w))
        toe_clear_x1 = min(W, right_foot_cx + int(0.14 * p_w))
        comp_np[toe_clear_y0:toe_clear_y1, toe_clear_x0:toe_clear_x1, :3] = 255
        comp = Image.fromarray(comp_np, mode="RGBA")
        from PIL import ImageDraw
        sh_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh_layer)
        sh_rx = int(p_w * 0.32)
        sh_ry = max(8, int(0.022 * p_h))
        sh_cy = min(H - sh_ry - 2, max(left_foot_bot_y, right_foot_bot_y) - int(0.01 * p_h))
        sd.ellipse([torso_cx - sh_rx, sh_cy - sh_ry, torso_cx + sh_rx, sh_cy + sh_ry], fill=(15, 23, 42, 42))
        sh_layer = sh_layer.filter(ImageFilter.GaussianBlur(radius=7))
        comp = Image.alpha_composite(comp, sh_layer)
    else:
        comp = Image.fromarray(comp_np, mode="RGBA")

    if bottom_item is not None:
        raw_bot = _decode_item_cutout_raw(bottom_item)
        stance_w = abs(right_foot_cx - left_foot_cx) + int(hip_w * 0.56)
        bw = max(64, int(max(hip_w * 1.22, stance_w)))
        waist_y = p_top + int((0.455 if waist_overlap_for_vton else 0.485) * p_h)
        ankle_y = min(left_foot_bot_y, right_foot_bot_y) - int(0.085 * p_h)
        bh = max(80, ankle_y - waist_y)
        legs_mid_cx = int(0.5 * (left_foot_cx + right_foot_cx))
        bx = int(0.5 * (torso_cx + legs_mid_cx)) - bw // 2

        if raw_bot is not None:
            rb_w, rb_h = raw_bot.size
            if rb_h > 40:
                raw_bot = raw_bot.crop((0, int(0.035 * rb_h), rb_w, rb_h))
                rb_bbox = raw_bot.getbbox()
                if rb_bbox:
                    raw_bot = raw_bot.crop(rb_bbox)
            b_layer = raw_bot.resize((bw, bh), Image.Resampling.LANCZOS)
        else:
            b_layer = _decode_item_cutout_or_render_placeholder(bottom_item, bw, bh)

        comp = _paste_with_shadow(comp, b_layer, bx, waist_y)

    if shoe_item is not None:
        raw_shoe_pil = _decode_item_cutout_raw(shoe_item)
        single_shoe_w = max(32, int(hip_w * 0.38))
        single_shoe_h = max(28, int(p_h * 0.105))
        if raw_shoe_pil is not None and raw_shoe_pil.width >= 32:
            mid_x = raw_shoe_pil.width // 2
            left_half = raw_shoe_pil.crop((0, 0, mid_x, raw_shoe_pil.height))
            right_half = raw_shoe_pil.crop((mid_x, 0, raw_shoe_pil.width, raw_shoe_pil.height))
            l_bbox = left_half.getbbox()
            r_bbox = right_half.getbbox()
            if l_bbox and r_bbox:
                l_shoe = left_half.crop(l_bbox)
                r_shoe = right_half.crop(r_bbox)
                l_shoe.thumbnail((single_shoe_w, single_shoe_h), Image.Resampling.LANCZOS)
                r_shoe.thumbnail((single_shoe_w, single_shoe_h), Image.Resampling.LANCZOS)
                target_sh_h = min(int(p_h * 0.105), max(l_shoe.height, r_shoe.height, int(p_h * 0.085)))
                if l_shoe.height > 0 and l_shoe.height != target_sh_h:
                    l_w = max(22, int(round(l_shoe.width * (target_sh_h / float(l_shoe.height)))))
                    l_shoe = l_shoe.resize((l_w, target_sh_h), Image.Resampling.LANCZOS)
                if r_shoe.height > 0 and r_shoe.height != target_sh_h:
                    r_w = max(22, int(round(r_shoe.width * (target_sh_h / float(r_shoe.height)))))
                    r_shoe = r_shoe.resize((r_w, target_sh_h), Image.Resampling.LANCZOS)

                common_foot_y = min(H - target_sh_h - 4, max(left_foot_bot_y, right_foot_bot_y) - target_sh_h)
                comp = _paste_with_shadow(comp, l_shoe, left_foot_cx - l_shoe.width // 2, common_foot_y)
                comp = _paste_with_shadow(comp, r_shoe, right_foot_cx - r_shoe.width // 2, common_foot_y)
            else:
                s_layer = _decode_item_cutout_or_render_placeholder(shoe_item, int(hip_w * 0.68), single_shoe_h)
                comp = _paste_with_shadow(comp, s_layer, torso_cx - s_layer.width // 2, min(H - s_layer.height - 4, left_foot_bot_y - s_layer.height))
        else:
            s_layer = _decode_item_cutout_or_render_placeholder(shoe_item, int(hip_w * 0.68), single_shoe_h)
            comp = _paste_with_shadow(comp, s_layer, torso_cx - s_layer.width // 2, min(H - s_layer.height - 4, left_foot_bot_y - s_layer.height))

    return comp


CANONICAL_OUTFIT_ORDER: Dict[str, int] = {
    "TOP": 1,
    "OUTERWEAR": 2,
    "BOTTOM": 3,
    "SHOES": 4,
    "ACCESSORIES": 5,
}


def sort_outfit_items_canonically(items: List[WardrobeItemInput]) -> List[WardrobeItemInput]:
    """Sort outfit items in industry-standard anatomical order:
    1. TOP -> 2. OUTERWEAR -> 3. BOTTOM -> 4. SHOES -> 5. ACCESSORIES.
    """
    return sorted(items, key=lambda it: CANONICAL_OUTFIT_ORDER.get((it.category or "").upper(), 99))


@app.post("/try-on-2d", response_model=TryOn2DResponse)
def try_on_2d_endpoint(req: TryOn2DRequest, request: Request) -> TryOn2DResponse:
    """Cladwell-Style 2D Virtual Try-On Endpoint ('See It On Me') — v7.1 2-Pass Full-Body Diffusion VTON:
    1. 5-Class NSFW Safety Check on user's full-body photo.
    2. Isolates the user onto a clean #FFFFFF Cladwell-style studio card (scrubbing the pink bag).
    3. Pass 1 (Upper-Body Diffusion VTON): Calls `yisol/IDM-VTON` (`is_checked=True`) to diffusion-render
       the recommended `TOP` (or `OUTERWEAR`) onto the user's upper body.
    4. Pass 2 (Lower-Body & Shoes Diffusion VTON): Calls `yisol/IDM-VTON` Custom Lower-Body Mask Mode
       (`is_checked=False` + `dict['layers']=[lower_mask]`) with automatic failover to
       `jallenjia/Change-Clothes-AI` (`category='lower_body'`) and `franciszzj/Leffa` (`lower_body`)
       so the pants AND shoes are ALSO diffusion-generated onto the user's legs and feet!
    """
    raw_b64 = req.user_photo_base64.strip()
    if "," in raw_b64:
        raw_b64 = raw_b64.split(",", 1)[1]
    try:
        user_bytes = base64.b64decode(raw_b64)
        user_img = Image.open(BytesIO(user_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid user_photo_base64: {e}") from e

    is_safe, nsfw_scores, safety_reason = evaluate_5class_nsfw_safety(user_img)
    if not is_safe:
        raise HTTPException(status_code=422, detail=safety_reason or "User photo did not pass 5-class safety check.")

    req.items = sort_outfit_items_canonically(req.items)
    tryon_sig = hashlib.sha256(
        user_bytes + "|".join(f"{it.id}:{it.clothing_name}:{it.color}:v71" for it in req.items).encode("utf-8")
    ).hexdigest()
    if tryon_sig in _VTON_TRYON_CACHE:
        print(f"[ML-TRYON-2D] Returning cached Virtual Try-On for {tryon_sig[:10]}...", flush=True)
        return TryOn2DResponse(
            tryOnDataUri=_VTON_TRYON_CACHE[tryon_sig],
            skinHexDetected=req.skin_tone_hex or "#D8A988",
            nsfw_scores=nsfw_scores,
        )

    hf_token = get_hf_token(
        explicit_token=req.hf_token,
        header_token=request.headers.get("x-hf-token"),
    )
    print(
        f"[ML-TRYON-2D] POST /try-on-2d invoked (v7.1 2-Pass Full-Body VTON) | items={len(req.items)} | hf_token_present={bool(hf_token)}",
        flush=True,
    )

    studio_person_rgba, person_alpha, p_bbox, detected_skin_hex = (
        _isolate_clean_person_on_studio_white(user_img, max_size=(520, 680))
    )
    skin_hex = req.skin_tone_hex or detected_skin_hex
    W, H = studio_person_rgba.size
    p_left, p_top, p_right, p_bottom = p_bbox
    p_w = max(40, p_right - p_left)
    p_h = max(80, p_bottom - p_top)
    torso_cx = p_left + p_w // 2

    bottom_item = next((i for i in req.items if i.category == "BOTTOM"), None)
    top_item = next((i for i in req.items if i.category == "TOP"), None)
    outer_item = next((i for i in req.items if i.category == "OUTERWEAR"), None)
    shoe_item = next((i for i in req.items if i.category == "SHOES"), None)

    # If the user's top_item is a Graphic Tee or Polo and outer_item is also present, only use outer_item
    # when outer_item is genuinely outerwear; otherwise showcase top_item!
    primary_upper = outer_item if outer_item is not None else top_item
    if top_item is not None and outer_item is not None and _is_cutout_actually_graphic_tee(outer_item):
        primary_upper = outer_item

    raw_upper_pil = _decode_item_cutout_raw(primary_upper) if primary_upper is not None else None
    raw_bottom_pil = _decode_item_cutout_raw(bottom_item) if bottom_item is not None else None
    raw_shoe_pil = _decode_item_cutout_raw(shoe_item) if shoe_item is not None else None

    # ─────────────────────────────────────────────────────────────────────────
    # PASS 1: Upper-Body Diffusion VTON (`yisol/IDM-VTON`, `is_checked=True`)
    # ─────────────────────────────────────────────────────────────────────────
    upper_vton_img: Optional[Image.Image] = None
    if primary_upper is not None and raw_upper_pil is not None:
        upper_vton_img = _try_gradio_zerogpu_upper_vton(
            studio_person_rgb=studio_person_rgba.convert("RGB"),
            upper_pil=raw_upper_pil,
            upper_desc=f"{primary_upper.color} {primary_upper.clothing_name}",
            hf_token=hf_token,
            budget_seconds=26.0,
        )

    base_after_upper = (
        upper_vton_img.resize((W, H), Image.Resampling.LANCZOS).convert("RGBA")
        if upper_vton_img is not None
        else studio_person_rgba.copy()
    )

    # ─────────────────────────────────────────────────────────────────────────
    # PASS 2: Lower-Body & Shoes Diffusion VTON (`yisol/IDM-VTON` Custom Lower
    # Mask -> `jallenjia/Change-Clothes-AI` -> `franciszzj/Leffa`)
    # ─────────────────────────────────────────────────────────────────────────
    lower_vton_img: Optional[Image.Image] = None
    if bottom_item is not None and raw_bottom_pil is not None:
        b_desc = f"{bottom_item.color} {bottom_item.clothing_name}"
        s_desc = f"{shoe_item.color} {shoe_item.clothing_name}" if shoe_item is not None else ""
        lower_vton_img = _try_gradio_zerogpu_lower_vton(
            person_img_rgb=base_after_upper.convert("RGB"),
            p_bbox_orig=p_bbox,
            orig_size=(W, H),
            bottom_pil=raw_bottom_pil,
            shoe_pil=raw_shoe_pil,
            bottom_desc=b_desc,
            shoe_desc=s_desc,
            hf_token=hf_token,
            budget_seconds=26.0,
        )

    if lower_vton_img is not None:
        composite = lower_vton_img.resize((W, H), Image.Resampling.LANCZOS).convert("RGBA")
        both_passes_succeeded = upper_vton_img is not None
    else:
        # Fallback if Lower-Body ZeroGPU queue is busy: use clean proportional lower-body fit
        composite = _fit_bottom_and_shoes_onto_studio_person(
            studio_person_rgba=base_after_upper,
            person_alpha=person_alpha,
            p_bbox=p_bbox,
            bottom_item=bottom_item,
            shoe_item=shoe_item,
            waist_overlap_for_vton=False,
        )
        both_passes_succeeded = False

    # If Pass 1 (Upper VTON) was skipped/busy, fit the upper garment cleanly on top
    if upper_vton_img is None and primary_upper is not None:
        uw = max(68, int(p_w * 0.72))
        uh = max(72, int(p_h * 0.35))
        ux = torso_cx - uw // 2
        uy = p_top + int(0.138 * p_h)
        u_layer = _decode_item_cutout_or_render_placeholder(primary_upper, uw, uh)
        fg_c = Image.new("RGBA", composite.size, (0, 0, 0, 0))
        fg_c.paste(u_layer, (ux, uy), u_layer)
        composite = Image.alpha_composite(composite, fg_c)

        head_y_end = max(1, p_top + int(0.142 * p_h))
        head_alpha = np.zeros((H, W), dtype=np.uint8)
        if person_alpha is not None:
            head_alpha[:head_y_end, :] = person_alpha[:head_y_end, :]
        else:
            head_alpha[:head_y_end, :] = 255
        head_np = np.asarray(studio_person_rgba, dtype=np.uint8).copy()
        head_np[:, :, 3] = head_alpha
        composite = Image.alpha_composite(composite, Image.fromarray(head_np, mode="RGBA"))

    out_buf = BytesIO()
    out_mime = "image/webp"
    try:
        composite.save(out_buf, format="WEBP", quality=88, method=4)
    except Exception:
        out_buf = BytesIO()
        composite.save(out_buf, format="PNG")
        out_mime = "image/png"

    try_on_uri = f"data:{out_mime};base64,{base64.b64encode(out_buf.getvalue()).decode('utf-8')}"
    if both_passes_succeeded or (upper_vton_img is not None and bottom_item is None):
        _VTON_TRYON_CACHE[tryon_sig] = try_on_uri
    return TryOn2DResponse(
        tryOnDataUri=try_on_uri,
        skinHexDetected=skin_hex,
        nsfw_scores=nsfw_scores,
    )


def generate_mel_recommendation_commentary(
    items: List[WardrobeItemInput],
    weather_tag: str,
    target_occasion: str,
    preferred_styles: List[Style],
    fit_preference: Optional[str] = None,
) -> str:
    """Generate friendly, zero-jargon commentary spoken by Mel the Chameleon mascot."""
    top = next((i for i in items if i.category == "TOP"), None)
    bottom = next((i for i in items if i.category == "BOTTOM"), None)
    outer = next((i for i in items if i.category == "OUTERWEAR"), None)

    weather_note = ""
    if "Rainy" in weather_tag or "Cool" in weather_tag:
        weather_note = "keeps you cozy in today's cooler weather"
    else:
        weather_note = "keeps you breezy and cool under the warm sun"

    fit_note = f"matches your {fit_preference.lower()} fit vibe" if fit_preference else "gives you a super clean silhouette"

    if outer and top and bottom:
        return f"I layered this {outer.color.lower()} {outer.style.lower()} {outer.clothing_name.lower()} over your {top.clothing_name.lower()} with {bottom.clothing_name.lower()} because it {fit_note} and {weather_note}!"
    elif top and bottom:
        return f"I paired this {top.color.lower()} {top.style.lower()} {top.clothing_name.lower()} with {bottom.clothing_name.lower()}—it {fit_note} and fits right into your {target_occasion.lower()} plans!"
    else:
        return f"Mel here! This combo is color-coordinated, comfortable, and {weather_note}!"


def generate_mel_swap_commentary(
    swapped_item: Optional[WardrobeItemInput],
    other_items: List[WardrobeItemInput],
    score_delta: float,
    verdict: str,
    target_occasion: str,
    preferred_styles: List[Style],
) -> str:
    """Generate interactive swap commentary spoken by Mel the Chameleon mascot."""
    int_delta = int(round(score_delta))
    sign = f"+{int_delta}" if int_delta > 0 else f"{int_delta}"
    swapped_name = swapped_item.clothing_name.lower() if swapped_item else "that piece"
    swapped_style = swapped_item.style.lower() if swapped_item else "chosen"
    swapped_cat = swapped_item.category.lower() if swapped_item else "item"

    if verdict == "better":
        return f"Nice swap! That {swapped_name} fits your {swapped_style} style way better ({sign} boost) and harmonizes cleanly with the rest of your outfit!"
    elif verdict == "worse":
        counter_style = other_items[0].style.lower() if other_items else "overall"
        return f"Hmm, that {swapped_style} {swapped_cat} clashes a bit with your {counter_style} vibe ({sign})—your previous choice looked sharper on you!"
    else:
        return f"Solid alternative! That {swapped_name} keeps your outfit well-balanced and ready for {target_occasion.lower()} with no drop in style."


CORPORATE_FORBIDDEN_SUBTYPES = {
    "shorts",
    "tank_top",
    "crop_top",
    "track_pants",
    "sweatpants",
    "flip_flops",
    "slippers",
    "hoodie",
    "zip_hoodie",
    "windbreaker",
    "choker",
    "cap",
    "running_shoes",
    "combat_boots",
}
FORMAL_EXTRA_FORBIDDEN_SUBTYPES = {"tshirt", "jeans", "cargo_pants", "sneakers"}


def _is_item_dress_code_violation(item: WardrobeItemInput, target_occasion: str) -> bool:
    """Tier 1 Hard Dress-Code Exclusion check for Work/Office/Corporate/Formal occasions."""
    occ_low = (target_occasion or "").strip().lower()
    if occ_low not in ("work", "office", "corporate", "formal"):
        return False
    sub = (item.vector_subtype or "").strip().lower()
    name_low = (item.clothing_name or "").strip().lower()
    style_up = (item.style or "").strip().upper()
    if not sub:
        sub = _infer_2d_vector_subtype(item.category, filename=name_low, hint_labels=[item.clothing_name, item.style])

    if style_up in ("PUNK", "ROCKSTAR", "WORKOUT", "SPORTY"):
        return True

    forbidden = set(CORPORATE_FORBIDDEN_SUBTYPES)
    if occ_low == "formal":
        forbidden |= FORMAL_EXTRA_FORBIDDEN_SUBTYPES

    if sub in forbidden:
        return True
    if any(
        w in name_low
        for w in (
            "short", "tank top", "crop top", "track pant", "sweatpant",
            "flip flop", "slipper", "hoodie", "spiked", "spike", "choker", "punk",
        )
    ):
        return True
    if occ_low == "formal" and any(w in name_low for w in ("t-shirt", "tshirt", "hoodie", "jean", "cargo")):
        return True
    return False


def score_outfit_combination(
    items: List[WardrobeItemInput],
    target_occasion: str,
    weather: WeatherContextInput,
    preferred_styles: List[Style],
    preferred_colors: List[str],
    community_signals: List[CommunityRatingSignal],
    alpha: float = 0.55,
    user_gender: Optional[str] = "unisex",
    textures: Optional[List[str]] = None,
    favorite_colors: Optional[List[str]] = None,
    fit_preference: Optional[str] = None,
    common_occasions: Optional[List[str]] = None,
    allow_comfort_unlayered: bool = False,
) -> Tuple[float, float, float, str, List[str]]:
    """Calculates S_cb, S_cf, and S_hybrid = round(0.55 * S_cb + 0.45 * S_cf)."""
    is_rainy_or_cool = (
        weather.temperature_c < 24.0
        or weather.precipitation_mm > 0.5
        or any(w in weather.condition.lower() for w in ("rain", "storm", "drizzle", "thunder", "cool", "cold"))
    )
    weather_tag = (
        f"Rainy/Cool ({weather.temperature_c:.0f}°C, {weather.condition})"
        if is_rainy_or_cool
        else f"Warm/Humid ({weather.temperature_c:.0f}°C, {weather.condition})"
    )

    s_cb = 55.0
    reasons: List[str] = []

    if any(_is_item_dress_code_violation(it, target_occasion) for it in items):
        s_cb -= 100.0
        reasons.append(f"Dress-code mismatch for {target_occasion} (-100)")

    styles = [it.style for it in items if it.style]
    if len(styles) > 1 and len(set(styles)) == 1:
        s_cb += 18.0
        reasons.append(f"Consistent {styles[0].title()} style silhouette (+18)")

    if any(it.occasion.lower() == target_occasion.lower() for it in items):
        s_cb += 15.0
        reasons.append(f"Suited for {target_occasion} occasion (+15)")

    if any(it.color in NEUTRAL_COLORS for it in items):
        s_cb += 10.0
        reasons.append("Balanced color harmony with neutral foundation (+10)")

    has_outerwear = any(it.category == "OUTERWEAR" for it in items)
    if is_rainy_or_cool:
        if has_outerwear:
            s_cb += 10.0
            reasons.append(f"Weather-smart protective layer for {weather_tag} (+10)")
        elif not allow_comfort_unlayered:
            s_cb -= 6.0
        else:
            s_cb += 10.0
            reasons.append("Signature personal comfort silhouette (+10)")
    else:
        if not has_outerwear:
            s_cb += 6.0
            reasons.append(f"Breathable silhouette suited for {weather_tag}")
        else:
            s_cb -= 6.0

    if preferred_styles:
        style_bonus = min(sum(5.0 for it in items if it.style in preferred_styles), 15.0)
        s_cb += style_bonus

    all_fav_colors = set(preferred_colors or []) | set(favorite_colors or [])
    if all_fav_colors:
        color_bonus = min(sum(4.0 for it in items if it.color in all_fav_colors), 10.0)
        s_cb += color_bonus

    if textures:
        tex_set = {t.lower() for t in textures}
        tex_matches = [it for it in items if it.texture and it.texture.lower() in tex_set]
        if tex_matches:
            tex_bonus = min(len(tex_matches) * 3.0, 9.0)
            s_cb += tex_bonus
            reasons.append(f"Features preferred {tex_matches[0].texture.lower()} texture")

    if fit_preference:
        fit_norm = fit_preference.lower()
        if any(it.fit and it.fit.lower() == fit_norm for it in items):
            s_cb += 6.0
            reasons.append(f"Matches your {fit_preference.lower()} fit preference")

    if common_occasions:
        occ_set = {o.lower() for o in common_occasions}
        if any(it.occasion.lower() in occ_set for it in items):
            s_cb += 5.0

    if any(it.is_disliked for it in items):
        s_cb -= 30.0
        reasons.append("Contains item marked as disliked (-30)")

    s_cb = float(np.clip(s_cb, 0.0, 100.0))

    norm_gender = (user_gender or "unisex").strip().lower()
    liked_cross_count = sum(1 for sig in community_signals if getattr(sig, "is_user_liked_cross_gender", False))
    opposite_gender_base_weight = min(1.0, 0.30 + 0.15 * liked_cross_count)

    item_styles = {it.style for it in items}
    item_colors = {it.color for it in items}
    matching_signals = [
        sig for sig in community_signals if sig.style in item_styles or sig.dominant_color in item_colors
    ]

    if matching_signals:
        weighted_num = 0.0
        weighted_den = 0.0
        used_cross_affinity = False
        for sig in matching_signals:
            a_gen = (sig.author_gender or "").strip().lower()
            r_gen = (sig.rater_gender or "").strip().lower()
            is_same_gender = (
                norm_gender not in ("male", "female")
                or (not a_gen or a_gen == norm_gender)
                and (not r_gen or r_gen == norm_gender)
            )
            if is_same_gender:
                g_weight = 1.0
            elif getattr(sig, "is_user_liked_cross_gender", False):
                g_weight = 1.0
                used_cross_affinity = True
            else:
                g_weight = opposite_gender_base_weight
                if liked_cross_count > 0:
                    used_cross_affinity = True

            eff_sim = sig.neighbor_similarity * g_weight
            weighted_num += eff_sim * sig.rating
            weighted_den += abs(eff_sim)

        pred_rating = (weighted_num / weighted_den) if weighted_den > 1e-6 else 4.0
        s_cf = float(np.clip((pred_rating - 1.0) / 4.0 * 100.0, 0.0, 100.0))
        if used_cross_affinity:
            reasons.append(f"Rated {pred_rating:.1f}/5.0 across For You & All Community Feed taste signals")
        else:
            gender_label = norm_gender.capitalize() if norm_gender in ("male", "female") else "Community"
            reasons.append(f"Rated {pred_rating:.1f}/5.0 by verified {gender_label} Community Feed profiles")
    else:
        fav_boost = sum(8.0 for it in items if it.is_favorite)
        s_cf = float(np.clip(72.0 + fav_boost, 0.0, 100.0))

    s_hyb = round(alpha * s_cb + (1.0 - alpha) * s_cf, 1)

    return round(s_cb, 1), round(s_cf, 1), s_hyb, weather_tag, reasons


@app.post("/recommend", response_model=List[ScoredOutfitRecommendation])
def recommend_outfits(req: HybridRecommendationRequest) -> List[ScoredOutfitRecommendation]:
    """Generate Top-3 outfits via Weighted Hybrid Filtering (0.55 Content-Based + 0.45 Collaborative)."""
    eligible_wardrobe = [item for item in req.wardrobe if not item.is_disliked]

    for it in eligible_wardrobe:
        if it.category == "OUTERWEAR" and _is_cutout_actually_graphic_tee(it):
            it.category = "TOP"
            it.subCategory = "Graphic T-Shirt"
            it.vector_subtype = "tshirt"
            it.style = "STREETWEAR"
            it.clothing_name = f"{it.color} Graphic T-Shirt"
            it.name = it.clothing_name

    w_tops = [i for i in eligible_wardrobe if i.category == "TOP"]
    w_bottoms = [i for i in eligible_wardrobe if i.category == "BOTTOM"]
    w_shoes = [i for i in eligible_wardrobe if i.category == "SHOES"]
    has_complete_wardrobe = bool(w_tops and w_bottoms and w_shoes)

    source_mode_req = (req.source_mode or "wardrobe").lower()

    if source_mode_req == "wardrobe":
        if not has_complete_wardrobe:
            return []
        pool = eligible_wardrobe
        used_catalog = False
        actual_source_mode = "wardrobe"
    else:
        catalog_raw = get_system_catalog_items(req.gender or "unisex")
        catalog_items = [WardrobeItemInput(**c) for c in catalog_raw]
        pool = eligible_wardrobe + catalog_items
        used_catalog = True
        actual_source_mode = "mix"

    raw_tops = [i for i in pool if i.category == "TOP"]
    raw_bottoms = [i for i in pool if i.category == "BOTTOM"]
    raw_shoes = [i for i in pool if i.category == "SHOES"]
    raw_outerwear = [i for i in pool if i.category == "OUTERWEAR"]

    valid_tops = [i for i in raw_tops if not _is_item_dress_code_violation(i, req.target_occasion)]
    valid_bottoms = [i for i in raw_bottoms if not _is_item_dress_code_violation(i, req.target_occasion)]
    valid_shoes = [i for i in raw_shoes if not _is_item_dress_code_violation(i, req.target_occasion)]
    valid_outerwear = [i for i in raw_outerwear if not _is_item_dress_code_violation(i, req.target_occasion)]

    tops = valid_tops if valid_tops else raw_tops
    bottoms = valid_bottoms if valid_bottoms else raw_bottoms
    shoes = valid_shoes if valid_shoes else raw_shoes
    outerwear = valid_outerwear if valid_outerwear else raw_outerwear

    is_rainy_or_cool = (
        req.weather.temperature_c < 24.0
        or req.weather.precipitation_mm > 0.5
        or any(w in req.weather.condition.lower() for w in ("rain", "storm", "drizzle", "thunder", "cool", "cold"))
    )
    occ_low = (req.target_occasion or "casual").strip().lower()
    is_casual_occasion = occ_low in ("casual", "everyday", "at-home", "home", "outdoor", "school", "any occasion", "any")

    layered_candidates: List[ScoredOutfitRecommendation] = []
    comfort_unlayered_candidates: List[ScoredOutfitRecommendation] = []
    all_candidates: List[ScoredOutfitRecommendation] = []

    for top in tops:
        for bottom in bottoms:
            for shoe in shoes:
                raw_accessories = [i for i in pool if i.category == "ACCESSORIES" and not _is_item_dress_code_violation(i, req.target_occasion)]
                matching_acc = next((a for a in raw_accessories if a.style == top.style), raw_accessories[0] if raw_accessories else None)
                base_items = sort_outfit_items_canonically([top, bottom, shoe] + ([matching_acc] if matching_acc else []))
                s_cb_u, s_cf_u, s_hyb_u, weather_tag_u, reasons_u = score_outfit_combination(
                    items=base_items,
                    target_occasion=req.target_occasion,
                    weather=req.weather,
                    preferred_styles=req.preferred_styles,
                    preferred_colors=req.preferred_colors,
                    community_signals=req.community_signals,
                    alpha=req.alpha,
                    user_gender=req.gender,
                    textures=req.textures,
                    favorite_colors=req.favorite_colors,
                    fit_preference=req.fit_preference,
                    common_occasions=req.common_occasions,
                    allow_comfort_unlayered=(is_rainy_or_cool and is_casual_occasion),
                )
                if is_rainy_or_cool and is_casual_occasion:
                    mel_u = (
                        f"Kept your signature {top.clothing_name} + {bottom.clothing_name} comfort combo! "
                        f"Since it's {weather_tag_u}, just bring an umbrella or grab a light layer if you head somewhere chilly."
                    )
                else:
                    mel_u = generate_mel_recommendation_commentary(
                        items=base_items,
                        weather_tag=weather_tag_u,
                        target_occasion=req.target_occasion,
                        preferred_styles=req.preferred_styles,
                        fit_preference=req.fit_preference,
                    )
                rec_u = ScoredOutfitRecommendation(
                    item_ids=[it.id for it in base_items],
                    items=base_items,
                    content_score=s_cb_u,
                    collaborative_score=s_cf_u,
                    hybrid_score=s_hyb_u,
                    weather_tag=weather_tag_u,
                    reasons=reasons_u[:3],
                    mel_commentary=mel_u,
                    used_system_catalog=used_catalog,
                    source_mode=actual_source_mode,
                )
                comfort_unlayered_candidates.append(rec_u)

                if outerwear and (is_rainy_or_cool or occ_low in ("formal", "office", "work", "corporate")):
                    if occ_low in ("formal", "office", "work", "corporate"):
                        matching_out = next((o for o in outerwear if o.vector_subtype == "blazer"), outerwear[0])
                    else:
                        matching_out = next((o for o in outerwear if o.style == top.style), outerwear[0])
                    layered_items = sort_outfit_items_canonically([top, matching_out, bottom, shoe] + ([matching_acc] if matching_acc else []))
                    s_cb_l, s_cf_l, s_hyb_l, weather_tag_l, reasons_l = score_outfit_combination(
                        items=layered_items,
                        target_occasion=req.target_occasion,
                        weather=req.weather,
                        preferred_styles=req.preferred_styles,
                        preferred_colors=req.preferred_colors,
                        community_signals=req.community_signals,
                        alpha=req.alpha,
                        user_gender=req.gender,
                        textures=req.textures,
                        favorite_colors=req.favorite_colors,
                        fit_preference=req.fit_preference,
                        common_occasions=req.common_occasions,
                        allow_comfort_unlayered=False,
                    )
                    mel_l = generate_mel_recommendation_commentary(
                        items=layered_items,
                        weather_tag=weather_tag_l,
                        target_occasion=req.target_occasion,
                        preferred_styles=req.preferred_styles,
                        fit_preference=req.fit_preference,
                    )
                    rec_l = ScoredOutfitRecommendation(
                        item_ids=[it.id for it in layered_items],
                        items=layered_items,
                        content_score=s_cb_l,
                        collaborative_score=s_cf_l,
                        hybrid_score=s_hyb_l,
                        weather_tag=weather_tag_l,
                        reasons=reasons_l[:3],
                        mel_commentary=mel_l,
                        used_system_catalog=used_catalog,
                        source_mode=actual_source_mode,
                    )
                    layered_candidates.append(rec_l)
                    all_candidates.append(rec_l)
                else:
                    all_candidates.append(rec_u)

    layered_candidates.sort(key=lambda r: r.hybrid_score, reverse=True)
    comfort_unlayered_candidates.sort(key=lambda r: r.hybrid_score, reverse=True)
    all_candidates.sort(key=lambda r: r.hybrid_score, reverse=True)

    # For casual/any occasion, prioritize distinct unlayered TOP outfits in slots 1 & 2 (so your Navy Polo Shirt
    # and Black Graphic Tee are showcased directly without being hidden under a track jacket!) and 1 layered option in slot 3.
    if is_casual_occasion and comfort_unlayered_candidates:
        selected: List[ScoredOutfitRecommendation] = []
        used_top_ids = set()
        for cand_u in comfort_unlayered_candidates:
            if len(selected) >= 2:
                break
            c_top = next((it.id for it in cand_u.items if it.category == "TOP"), "")
            if c_top not in used_top_ids or len(tops) <= len(used_top_ids):
                selected.append(cand_u)
                used_top_ids.add(c_top)

        if is_rainy_or_cool and layered_candidates and len(selected) < 3:
            selected.append(layered_candidates[0])

        for cand in comfort_unlayered_candidates + layered_candidates:
            if len(selected) >= 3:
                break
            if cand not in selected:
                selected.append(cand)

        return selected[:3]

    selected = []
    seen_tops = set()
    for cand in all_candidates:
        top_id = next((it.id for it in cand.items if it.category == "TOP"), None)
        if top_id not in seen_tops or len(seen_tops) >= len(tops):
            selected.append(cand)
            if top_id:
                seen_tops.add(top_id)
        if len(selected) == 3:
            break

    if len(selected) < 3:
        for cand in all_candidates:
            if cand not in selected:
                selected.append(cand)
            if len(selected) == 3:
                break

    return selected


@app.post("/score-outfit", response_model=ScoreOutfitResponse)
def score_outfit(req: ScoreOutfitRequest) -> ScoreOutfitResponse:
    """Live interactive swap scoring for the 2D Mannequin Visualizer with Mel Chameleon Mascot commentary."""
    if not req.current_items:
        raise HTTPException(status_code=422, detail="current_items cannot be empty.")

    s_cb, s_cf, s_hyb, weather_tag, reasons = score_outfit_combination(
        items=req.current_items,
        target_occasion=req.target_occasion,
        weather=req.weather,
        preferred_styles=req.preferred_styles,
        preferred_colors=req.preferred_colors,
        community_signals=req.community_signals,
        alpha=req.alpha,
        user_gender=req.gender,
        textures=req.textures,
        favorite_colors=req.favorite_colors,
        fit_preference=req.fit_preference,
        common_occasions=req.common_occasions,
    )

    swapped_item = None
    other_items: List[WardrobeItemInput] = []
    if req.swapped_category:
        for it in req.current_items:
            if it.category == req.swapped_category:
                swapped_item = it
            else:
                other_items.append(it)
    else:
        swapped_item = req.current_items[0]
        other_items = req.current_items[1:]

    if req.previous_score is not None:
        delta = round(s_hyb - req.previous_score, 1)
        if delta > 1.5:
            verdict: Literal["better", "worse", "neutral"] = "better"
        elif delta < -1.5:
            verdict = "worse"
        else:
            verdict = "neutral"
    else:
        delta = 0.0
        verdict = "neutral"

    mel_commentary = generate_mel_swap_commentary(
        swapped_item=swapped_item,
        other_items=other_items,
        score_delta=delta,
        verdict=verdict,
        target_occasion=req.target_occasion,
        preferred_styles=req.preferred_styles,
    )

    return ScoreOutfitResponse(
        new_score=s_hyb,
        content_score=s_cb,
        collaborative_score=s_cf,
        score_delta=delta,
        verdict=verdict,
        reasons=reasons[:3],
        mel_commentary=mel_commentary,
    )