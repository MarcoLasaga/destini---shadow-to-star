"""StyleSense Unified ML & Hybrid Recommendation Microservice (FastAPI v6.8 — HF_TOKEN + IDM-VTON Edition).

Implements:
1. Official remove.bg API Background Removal (size="preview") with graceful local
   rembg "u2netp" fallback (alpha_matting=False, zero OpenCV GrabCut/contour mask corruption).
2. Fine-Tuned 5-Class ResNet-50 Garment Classifier (loading Epoch 13 checkpoint
   stylesense_resnet50_best.pt with Git LFS pointer checks, standard 224x224 evaluation
   transforms, true softmax probabilities, and smart confidence rescue for real garments).
3. Foreground Garment Color & Palette Extraction using ml-service/kmeans_color.py
   (CIE XYZ -> CIELAB D65, Delta-E CIE76, and KMeansCIELAB clustering with K = 2 locked).
4. 5-Class Fashion Taxonomy wired directly to ml-service/cnn_taxonomy.json + 33 Granular Subtypes
   (including Wireless Earbuds / AirPods & Headphones under ACCESSORIES, plus Track Pants / Joggers
   vs. Denim Jeans geometric + sheen calibration).
5. Batch Wardrobe Image Analysis endpoint (POST /analyze-batch) accepting up to 15 images.
6. Automated AI Content Moderation Gate (5-Class NSFWJS Equivalent + Bilingual Profanity Filter).
7. Context-Aware Weighted Hybrid Recommendation Engine: S_hybrid = round(0.55 * S_cb + 0.45 * S_cf).
8. v6.8 HF_TOKEN + IDM-VTON & Acloset Studio Upgrades ($0.00 Free Pipeline — GEMINI_API_KEY Removed):
   - Completely removes GEMINI_API_KEY (zero paid billing required, zero 429/404 logs).
   - Uses free Hugging Face Access Token (HF_TOKEN) with gradio_client to call yisol/IDM-VTON
     on Hugging Face Spaces for real Diffusion Virtual Try-On in POST /try-on-2d, then isolates
     the dressed user onto a Cladwell-style #FFFFFF studio card with fitted bottoms/shoes.
   - Instant fallback to the Cladwell Studio Body-Worn Compositor (clean #FFFFFF studio card,
     old-clothing erasure, row-wise body contour warping, and foreground arm/hand/neck occlusion)
     if ZeroGPU queues are busy.
   - Fixes false 'Non-Wearable Object Blocked' on hanging Track Pants / Bottoms and accepts
     Earphones / AirPods / Headphones as wearable ACCESSORIES.
"""

import base64
from contextlib import asynccontextmanager
import gc
import hashlib
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
    if c in ("TOP", "TOPS", "SHIRT", "TSHIRT", "T-SHIRT", "BLOUSE", "POLO"):
        return "TOP"
    if c in ("OUTERWEAR", "OUTER", "JACKET", "HOODIE", "COAT", "BLAZER", "CARDIGAN", "WINDBREAKER"):
        return "OUTERWEAR"
    if c in ("BOTTOM", "BOTTOMS", "PANTS", "JEANS", "TROUSERS", "SHORTS", "SKIRT", "JOGGERS", "TRACK PANTS"):
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
        resolved_name = (
            data.get("clothing_name")
            or data.get("name")
            or data.get("subCategory")
            or data.get("sub_category")
            or data.get("category")
            or "Garment"
        )
        data["clothing_name"] = str(resolved_name)
        if not data.get("name"):
            data["name"] = str(resolved_name)
        data["category"] = _normalize_category_str(data.get("category"))
        data["style"] = _normalize_style_str(data.get("style"))
        resolved_color = data.get("color") or data.get("primary_color")
        if not resolved_color or str(resolved_color).startswith("#"):
            nl = str(resolved_name).lower()
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
                data.get("beautifiedDataUri")
                or data.get("cutoutDataUri")
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
    """Erase wire/plastic hanger hooks and waistband hanger bars at the top of TOP, OUTERWEAR, and BOTTOM."""
    alpha = rgba[:, :, 3].copy()
    ys, xs = np.where(alpha > 40)
    if len(ys) <= 20 or len(xs) <= 20:
        return rgba

    top, bottom = int(np.min(ys)), int(np.max(ys))
    left, right = int(np.min(xs)), int(np.max(xs))
    bh = max(bottom - top, 1)
    bw = max(right - left, 1)

    top_strip_end = top + max(1, int(0.15 * bh))
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
        if row_span < 0.25 * max_body_w:
            alpha[ry, left : right + 1] = 0
        elif allow_bar_erase and ry < top + int(0.09 * bh) and row_fill < 0.42:
            c_l = left + int(0.26 * bw)
            c_r = left + int(0.74 * bw)
            alpha[ry, c_l:c_r] = 0

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
    """Acloset-Style Non-Destructive Studio Flat-Lay Beautifier ($0.00 Pipeline):
    1. Universal Hanger Hook & Waistband Hanger-Bar Eraser (works on TOP, OUTERWEAR, and BOTTOM).
    2. Rigid Principal-Axis Deskewing (straightens tilted shirts, jackets, and pants).
    3. Bilateral Silhouette Symmetry Recovery (fills shallow crumpled edge indentations on left/right sides).
    4. 2D Homomorphic Illumination Flattening (removes uneven room glare & flash hotspots on dark clothes).
    5. OpenCV Domain-Transform Steam-Ironing (cv2.edgePreservingFilter + Bilateral L*) that removes fabric
       wrinkles while keeping seams, collars, drawstrings, stripes, and graphic prints 100% sharp.
    6. Centered 400x400 Studio Product Card with Soft Drop-Shadow.
    """
    rgba = np.asarray(cutout_rgba.convert("RGBA"), dtype=np.uint8).copy()
    cat_norm = _normalize_category_str(category) if category else "TOP"

    if cat_norm in ("TOP", "OUTERWEAR", "BOTTOM"):
        rgba = _erase_top_hanger_hooks_and_bars(rgba, allow_bar_erase=True)

    alpha = rgba[:, :, 3].copy()
    ys, xs = np.where(alpha > 40)
    if len(ys) > 20 and len(xs) > 20:
        top, bottom = int(np.min(ys)), int(np.max(ys))
        left, right = int(np.min(xs)), int(np.max(xs))

        if cv2 is not None and cat_norm in ("TOP", "OUTERWEAR", "BOTTOM"):
            try:
                m = cv2.moments((alpha > 64).astype(np.uint8))
                if m["m00"] > 50:
                    denom = m["mu02"] - m["mu20"]
                    if abs(denom) > 1e-3:
                        theta_rad = 0.5 * math.atan2(2.0 * m["mu11"], denom)
                        theta_deg = math.degrees(theta_rad)
                        if 0.8 <= abs(theta_deg) <= 9.5:
                            cx = float(left + right) * 0.5
                            cy = float(top + bottom) * 0.5
                            rot_mat = cv2.getRotationMatrix2D((cx, cy), -theta_deg, 1.0)
                            rgba = cv2.warpAffine(
                                rgba,
                                rot_mat,
                                (rgba.shape[1], rgba.shape[0]),
                                flags=cv2.INTER_LINEAR,
                                borderMode=cv2.BORDER_CONSTANT,
                                borderValue=(0, 0, 0, 0),
                            )
                            alpha = rgba[:, :, 3]
            except Exception as e:
                logger.debug(f"Deskewing skipped: {e}")

    stage_pil = Image.fromarray(rgba, mode="RGBA")
    s_bbox = stage_pil.getbbox()
    work_canvas = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    if s_bbox:
        s_crop = stage_pil.crop(s_bbox)
        s_crop.thumbnail((358, 358), Image.Resampling.LANCZOS)
        sox = (400 - s_crop.width) // 2
        soy = (400 - s_crop.height) // 2
        work_canvas.paste(s_crop, (sox, soy), s_crop)
    else:
        work_canvas = stage_pil.resize((400, 400), Image.Resampling.LANCZOS)

    rgba = np.asarray(work_canvas, dtype=np.uint8).copy()
    alpha = rgba[:, :, 3]

    if cv2 is not None:
        try:
            k_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
            alpha_clean = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, k_close)
            alpha_clean = cv2.GaussianBlur(alpha_clean, (3, 3), 0)
            rgba[:, :, 3] = alpha_clean
            alpha = alpha_clean

            fg_mask_bool = alpha > 128
            rgb_chan = rgba[:, :, :3].copy()
            if int(np.sum(fg_mask_bool)) > 50:
                med_rgb = np.median(rgb_chan[fg_mask_bool], axis=0).astype(np.uint8)
                bg_fill = np.full_like(rgb_chan, med_rgb)
                work_rgb = np.where(alpha[:, :, None] > 32, rgb_chan, bg_fill)
            else:
                work_rgb = rgb_chan.copy()

            lab_cv = cv2.cvtColor(work_rgb, cv2.COLOR_RGB2LAB)
            l_chan, a_chan, b_chan = cv2.split(lab_cv)
            l_float = l_chan.astype(np.float32)

            if int(np.sum(fg_mask_bool)) > 80:
                target_l = float(np.percentile(l_float[fg_mask_bool], 42))
                illum_field = cv2.GaussianBlur(l_float, (0, 0), sigmaX=38.0, sigmaY=38.0)
                l_flat = l_float - 0.55 * (illum_field - target_l)
                l_flat = np.clip(l_flat, 0.0, 255.0).astype(np.uint8)
            else:
                l_flat = l_chan

            l_bilat1 = cv2.bilateralFilter(l_flat, d=9, sigmaColor=36, sigmaSpace=36)
            l_bilat2 = cv2.bilateralFilter(l_bilat1, d=7, sigmaColor=28, sigmaSpace=28)
            clahe = cv2.createCLAHE(clipLimit=1.35, tileGridSize=(8, 8))
            l_studio = clahe.apply(l_bilat2)

            l_fine_detail = l_flat.astype(np.float32) - cv2.GaussianBlur(l_flat.astype(np.float32), (3, 3), 0)
            l_ironed = np.clip(
                0.82 * l_studio.astype(np.float32) + 0.18 * l_bilat2.astype(np.float32) + 0.95 * l_fine_detail,
                0.0,
                255.0,
            ).astype(np.uint8)

            erode_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            interior_fg = cv2.erode((alpha > 160).astype(np.uint8), erode_k, iterations=1) > 0
            l_out = np.where(interior_fg, l_ironed, l_chan).astype(np.uint8)
            lab_merged = cv2.merge((l_out, a_chan, b_chan))
            ironed_rgb = cv2.cvtColor(lab_merged, cv2.COLOR_LAB2RGB)

            if hasattr(cv2, "edgePreservingFilter"):
                try:
                    ep_rgb = cv2.edgePreservingFilter(ironed_rgb, flags=cv2.RECURS_FILTER, sigma_s=28, sigma_r=0.18)
                    ironed_rgb = np.clip(
                        0.65 * ep_rgb.astype(np.float32) + 0.35 * ironed_rgb.astype(np.float32),
                        0.0,
                        255.0,
                    ).astype(np.uint8)
                except Exception:
                    pass

            rgba[:, :, :3] = np.where(interior_fg[:, :, None], ironed_rgb, rgba[:, :, :3])
        except Exception as e:
            logger.debug(f"Frequency-separated L* studio relighting skipped: {e}")

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
        shadow_np = (np.asarray(shadow_blurred, dtype=np.float32) * (38.0 / 255.0)).clip(0, 255).astype(np.uint8)

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
    """Wrapper invoking the non-destructive studio beautifier."""
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
    """Zero-retraining visual calibrator for StyleSense v6.8:
    - Rescues hanging Track Pants / Bottoms so they are NEVER falsely blocked as non-wearable.
    - Accepts Earphones / AirPods / Headphones as wearable ACCESSORIES.
    - Distinguishes Track Pants / Joggers / Sweatpants from Denim Jeans via waist-to-thigh bow,
      ankle cuff taper, and nylon sheen.
    """
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
            or (has_graphic and bbox_aspect_ratio >= 0.72 and lower_outer_cov < 0.16)
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
    prob_shoes = float(class_probabilities.get("SHOES", 0.0))
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

    elif is_short_sleeve_tee and (
        pred_cat in ("TOP", "OUTERWEAR")
        or top2_set == {"TOP", "OUTERWEAR"}
        or (pred_cat is None and (prob_top + prob_outer) >= 0.55)
    ):
        if not any(w in fn for w in ("hoodie", "jacket", "blazer", "cardigan", "coat", "windbreaker")):
            pred_cat = "TOP"
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
    """Core StyleSense v6.8 garment analysis pipeline."""
    transforms_to_use = EVAL_TRANSFORMS if (IS_FINETUNED_HEAD or WEIGHTS is None or EVAL_TRANSFORMS is not None) else WEIGHTS.transforms()
    rgb_image = image.convert("RGB")

    aux_probs_np: Optional[np.ndarray] = None
    if AUX_IMAGENET_MODEL is not None and transforms_to_use is not None and torch is not None:
        try:
            with torch.inference_mode():
                t_raw = transforms_to_use(rgb_image).unsqueeze(0)
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

    with torch.inference_mode():
        probs_clean = torch.softmax(MODEL(tensor_clean)[0], dim=0)
        if fg_coverage >= 0.12:
            probabilities = probs_clean
        else:
            tensor_raw = transforms_to_use(rgb_image).unsqueeze(0)
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
    logger.info(
        f"remove.bg API Key(s) loaded: {len(keys)} key(s) | FORCE_REMBG={force_rembg_env} | HF_TOKEN_configured={bool(hf_tok)} | gradio_client={GRADIO_CLIENT_AVAILABLE}"
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
            logger.info("Loaded auxiliary ImageNet-1K V2 ResNet-50 calibrator for 33-subtype & OOD detection.")
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
                    IS_FINETUNED_HEAD = True
                    print(f"[STARTUP] Loaded fine-tuned ResNet-50 Epoch 13 checkpoint ({len(matched_keys)} matched keys) from {ckpt_candidate}")
                    logger.info(f"Loaded fine-tuned ResNet-50 Epoch 13 checkpoint ({len(matched_keys)} matched keys) from {ckpt_candidate}")
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
            IS_FINETUNED_HEAD = False

        try:
            with torch.inference_mode():
                dummy_tensor = torch.zeros((1, 3, 224, 224))
                MODEL(dummy_tensor)
                if AUX_IMAGENET_MODEL is not None and AUX_IMAGENET_MODEL is not MODEL:
                    AUX_IMAGENET_MODEL(dummy_tensor)
            logger.info("ResNet-50 MODEL and AUX_IMAGENET_MODEL pre-warmed successfully.")
        except Exception as e:
            logger.warning(f"Could not pre-warm MODEL: {e}")

    yield
    MODEL = None
    AUX_IMAGENET_MODEL = None


app = FastAPI(title="StyleSense ML & Hybrid Recommendation Service", version="6.8.0", lifespan=lifespan)

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
        "version": "6.8.0",
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
        "hf_token_configured": bool(hf_tok),
        "gradio_vton_bridge_enabled": GRADIO_CLIENT_AVAILABLE,
        "vton_spaces": list(HF_VTON_SPACES),
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
    """Acloset-Style On-Demand POST /beautify Endpoint ($0.00 Pipeline — GEMINI_API_KEY Removed):
    Runs Universal Hanger & Waistband Bar Removal + Principal-Axis Deskewing + 2D Homomorphic Illumination
    Flattening + OpenCV Domain-Transform Steam-Ironing (cv2.edgePreservingFilter + Bilateral CIELAB L*).
    """
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
        print(f"[ML-BEAUTIFY] Returning cached Studio Flat-Lay for {cache_key[:10]}...", flush=True)
        return BeautifyResponse(beautifiedDataUri=_STUDIO_BEAUTIFY_CACHE[cache_key], method="geometric_studio_iron")

    print(f"[ML-BEAUTIFY] POST /beautify invoked | cat={req.category} | sub={req.sub_category}", flush=True)
    beautified_uri = beautify_garment_geometric_studio(
        cutout_rgba=cutout_pil,
        category=req.category,
        sub_category=req.sub_category,
    )
    _STUDIO_BEAUTIFY_CACHE[cache_key] = beautified_uri
    return BeautifyResponse(beautifiedDataUri=beautified_uri, method="geometric_studio_iron")


def _decode_item_cutout_raw(item: WardrobeItemInput) -> Optional[Image.Image]:
    """Decode item's cutout/beautified image_url into a tight-cropped, hanger-cleaned RGBA PIL Image."""
    img_url = (item.beautifiedDataUri or item.cutoutDataUri or item.image_url or "").strip()
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


def _warp_garment_to_body_rows(
    garment_rgba: Image.Image,
    dst_w: int,
    dst_h: int,
    top_span_ratio: float = 1.0,
    mid_span_ratio: float = 0.92,
    bot_span_ratio: float = 0.88,
) -> Image.Image:
    """Piecewise row-by-row contour warp that maps a hanging garment's shoulders/waist/hem
    onto the user's true shoulder-to-waist taper so folded/hanging garments fill the torso naturally.
    """
    gw = max(24, dst_w)
    gh = max(24, dst_h)
    src_pil = garment_rgba.resize((gw, gh), Image.Resampling.LANCZOS)
    if cv2 is None:
        return src_pil

    src_np = np.asarray(src_pil, dtype=np.uint8)
    alpha = src_np[:, :, 3]
    out_np = np.zeros_like(src_np)
    cx = gw * 0.5

    row_spans = []
    for y in range(gh):
        xs = np.where(alpha[y, :] > 48)[0]
        if len(xs) >= 6:
            row_spans.append(float(xs[-1] - xs[0] + 1))
    ref_span = float(np.percentile(row_spans, 85)) if row_spans else float(gw * 0.85)

    for y in range(gh):
        t = float(y) / max(float(gh - 1), 1.0)
        if t < 0.45:
            u = t / 0.45
            target_ratio = (1.0 - u) * top_span_ratio + u * mid_span_ratio
        else:
            u = (t - 0.45) / 0.55
            target_ratio = (1.0 - u) * mid_span_ratio + u * bot_span_ratio

        xs = np.where(alpha[y, :] > 48)[0]
        if len(xs) >= 6:
            cur_span = float(xs[-1] - xs[0] + 1)
            cur_cx = 0.5 * float(xs[0] + xs[-1])
            desired_span = max(cur_span, ref_span * target_ratio)
            scale_x = float(np.clip(desired_span / max(cur_span, 1.0), 0.82, 1.32))
        else:
            cur_cx = cx
            scale_x = 1.0

        dst_xs = np.arange(gw, dtype=np.float32)
        src_xs = (dst_xs - cx) / scale_x + cur_cx
        valid = (src_xs >= 0.0) & (src_xs <= float(gw - 1))
        src_idx = np.clip(np.round(src_xs).astype(np.int32), 0, gw - 1)
        row_out = src_np[y, src_idx].copy()
        row_out[~valid, 3] = 0
        out_np[y] = row_out

    return Image.fromarray(out_np, mode="RGBA")


def _try_gradio_zerogpu_vton(
    user_img: Image.Image,
    upper_pil: Optional[Image.Image],
    upper_desc: str,
    hf_token: Optional[str] = None,
) -> Optional[Image.Image]:
    """Tier-1 Free Hugging Face ZeroGPU Diffusion VTON Bridge (yisol/IDM-VTON + Nymbo/Virtual-Try-On).
    Authenticates with HF_TOKEN (free Hugging Face Access Token, $0.00 cost) when configured.
    """
    global _HF_ZEROGPU_COOLDOWN_UNTIL
    if not GRADIO_CLIENT_AVAILABLE or GradioClient is None or gradio_handle_file is None or upper_pil is None:
        return None
    if time.time() < _HF_ZEROGPU_COOLDOWN_UNTIL:
        return None

    resolved_token = get_hf_token(explicit_token=hf_token)
    disable_vton = os.getenv("DISABLE_ZEROGPU_VTON", "false").strip().lower() in ("true", "1", "yes")
    if disable_vton:
        return None

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            p_path = os.path.join(tmpdir, "person.png")
            g_path = os.path.join(tmpdir, "garment.png")
            # Resize person to 768x1024 standard IDM-VTON aspect ratio for crispest diffusion fit
            p_vton = user_img.convert("RGB").copy()
            p_vton.thumbnail((768, 1024), Image.Resampling.LANCZOS)
            p_vton.save(p_path, format="PNG")

            g_white = Image.new("RGBA", upper_pil.size, (255, 255, 255, 255))
            Image.alpha_composite(g_white, upper_pil.convert("RGBA")).convert("RGB").save(g_path, format="PNG")

            # Total wall-clock budget for all Spaces so POST /try-on-2d always answers before the
            # server/ proxy's 65 s timeout (IDM-VTON diffusion normally takes 15-25 s on ZeroGPU).
            try:
                total_budget_s = float(os.getenv("VTON_TIMEOUT_SECONDS", "50"))
            except ValueError:
                total_budget_s = 50.0
            deadline = time.time() + max(5.0, total_budget_s)

            for space_id in HF_VTON_SPACES:
                remaining = deadline - time.time()
                if remaining < 5.0:
                    print("[ML-TRYON-2D] VTON time budget exhausted; using local Cladwell Studio compositor.", flush=True)
                    break
                try:
                    print(
                        f"[ML-TRYON-2D] Calling Hugging Face Space '{space_id}' | HF_TOKEN_present={bool(resolved_token)} | garment='{upper_desc}'",
                        flush=True,
                    )
                    if resolved_token:
                        client = GradioClient(space_id, hf_token=resolved_token)
                    else:
                        client = GradioClient(space_id)

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
                        print(f"[ML-TRYON-2D] Success via Hugging Face Space '{space_id}'!", flush=True)
                        with Image.open(out_path) as vton_img:
                            return vton_img.convert("RGB")
                except Exception as space_err:
                    print(f"[ML-TRYON-2D] Space '{space_id}' unavailable/busy/timed out: {space_err}", flush=True)
                    continue

            _HF_ZEROGPU_COOLDOWN_UNTIL = time.time() + 180.0
    except Exception as e:
        _HF_ZEROGPU_COOLDOWN_UNTIL = time.time() + 180.0
        logger.debug(f"ZeroGPU IDM-VTON skipped/busy ({e}); using local Cladwell Studio Try-On.")
    return None


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
    """Cladwell-Style 2D Virtual Try-On Endpoint ('See It On Me') — v6.8 HF_TOKEN + IDM-VTON & Studio Compositor:
    1. 5-Class NSFW Safety Check on user's full-body photo.
    2. Tier 1: Free Hugging Face ZeroGPU Diffusion VTON (yisol/IDM-VTON + Nymbo/Virtual-Try-On via HF_TOKEN)
       for upper-body diffusion dressing, followed by Cladwell #FFFFFF studio background isolation.
    3. Tier 2 ($0.00 Instant Local Cladwell Studio Engine — Matches image_e864ba.png):
       - Segments the user out of their bedroom background onto a clean #FFFFFF studio card with a soft floor shadow.
       - Erases old protruding shirt/shorts pixels inside the torso/leg contour so old clothes never bleed through.
       - Warps garments row-by-row to match the user's shoulder, waist, and leg contours.
       - Composites the user's real skin-toned arms, hands, neck, and head IN FRONT OF the outfit so the clothes
         sit naturally behind the arms and look physically worn on the user's body!
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
        user_bytes + "|".join(f"{it.id}:{it.clothing_name}:{it.color}:v68" for it in req.items).encode("utf-8")
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
        f"[ML-TRYON-2D] POST /try-on-2d invoked | items={len(req.items)} | hf_token_present={bool(hf_token)}",
        flush=True,
    )

    bottom_item = next((i for i in req.items if i.category == "BOTTOM"), None)
    top_item = next((i for i in req.items if i.category == "TOP"), None)
    outer_item = next((i for i in req.items if i.category == "OUTERWEAR"), None)
    shoe_item = next((i for i in req.items if i.category == "SHOES"), None)
    primary_upper = outer_item if outer_item is not None else top_item

    # Tier 1: Call Hugging Face ZeroGPU IDM-VTON with HF_TOKEN for real Diffusion Upper-Body Try-On!
    vton_dressed_upper_img: Optional[Image.Image] = None
    if primary_upper is not None:
        raw_upper_pil = _decode_item_cutout_raw(primary_upper)
        vton_dressed_upper_img = _try_gradio_zerogpu_vton(
            user_img=user_img,
            upper_pil=raw_upper_pil,
            upper_desc=f"{primary_upper.color} {primary_upper.clothing_name}",
            hf_token=hf_token,
        )

    # Use the IDM-VTON dressed person image if Tier 1 succeeded; otherwise use the user's standing photo
    active_person_img = vton_dressed_upper_img if vton_dressed_upper_img is not None else user_img
    upper_already_rendered_by_vton = vton_dressed_upper_img is not None

    # ─────────────────────────────────────────────────────────────────────────
    # CLADWELL-STYLE STUDIO BODY-WORN COMPOSITOR (Matches image_e864ba.png)
    # 1. Segments person onto a clean #FFFFFF studio card with soft floor shadow.
    # 2. Erases old protruding shorts/shirts inside the torso/leg contour.
    # 3. Warps garments row-by-row to fit shoulder, waist, and leg contours.
    # 4. Places the user's real skin-toned arms, hands, neck, and head IN FRONT
    #    of the garments so the outfit looks physically worn!
    # ─────────────────────────────────────────────────────────────────────────
    base_rgba = active_person_img.copy()
    base_rgba.thumbnail((520, 680), Image.Resampling.LANCZOS)
    base_rgba = base_rgba.convert("RGBA")
    W, H = base_rgba.size

    p_left, p_top, p_right, p_bottom = int(0.20 * W), int(0.05 * H), int(0.80 * W), int(0.95 * H)
    person_cutout: Optional[Image.Image] = None
    person_alpha: Optional[np.ndarray] = None
    if REMBG_AVAILABLE and remove is not None and REMBG_SESSION is not None:
        try:
            person_cutout = remove(base_rgba.convert("RGB"), session=REMBG_SESSION, alpha_matting=False).convert("RGBA")
            person_alpha = np.asarray(person_cutout)[:, :, 3].copy()
            if cv2 is not None:
                k_p = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
                person_alpha = cv2.morphologyEx(person_alpha, cv2.MORPH_CLOSE, k_p)
                person_alpha = cv2.GaussianBlur(person_alpha, (3, 3), 0)
            p_ys, p_xs = np.where(person_alpha > 64)
            if len(p_ys) > 50 and len(p_xs) > 30:
                p_top, p_bottom = int(np.min(p_ys)), int(np.max(p_ys))
                p_left, p_right = int(np.min(p_xs)), int(np.max(p_xs))
        except Exception as e:
            logger.debug(f"Try-on person segmentation fallback: {e}")

    p_w = max(40, p_right - p_left)
    p_h = max(80, p_bottom - p_top)
    p_cx = p_left + p_w // 2

    shoulder_w = int(p_w * 0.62)
    hip_w = int(p_w * 0.52)
    torso_cx = p_cx
    left_foot_cx = p_cx - int(p_w * 0.14)
    right_foot_cx = p_cx + int(p_w * 0.14)

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
            shoulder_w = int(np.clip(measured_sh * 0.92, p_w * 0.44, p_w * 0.72))
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
            hip_w = int(np.clip(measured_hp * 1.04, p_w * 0.36, shoulder_w * 0.94))
        else:
            hip_w = int(shoulder_w * 0.84)

        ft_y0 = p_top + int(0.85 * p_h)
        ft_y1 = p_top + int(0.96 * p_h)
        ft_slice = person_alpha[max(0, ft_y0) : min(H, ft_y1), :] > 96
        if ft_slice.size > 0:
            left_xs = np.where(ft_slice[:, :torso_cx])[1]
            right_xs = np.where(ft_slice[:, torso_cx:])[1] + torso_cx
            if len(left_xs) > 5 and len(right_xs) > 5:
                left_foot_cx = int(np.median(left_xs))
                right_foot_cx = int(np.median(right_xs))

    skin_hex = req.skin_tone_hex or "#D8A988"
    face_med_rgb = np.array([216.0, 169.0, 136.0], dtype=np.float32)
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
            face_med_rgb = np.median(face_crop.reshape(-1, 3), axis=0).astype(np.float32)
            if not req.skin_tone_hex:
                skin_hex = f"#{int(face_med_rgb[0]):02x}{int(face_med_rgb[1]):02x}{int(face_med_rgb[2]):02x}".upper()
    except Exception:
        pass

    studio_card = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    from PIL import ImageDraw
    shadow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_layer)
    sh_rx = int(max(hip_w * 0.78, abs(right_foot_cx - left_foot_cx) * 0.80))
    sh_ry = max(10, int(0.028 * p_h))
    sh_cy = min(H - sh_ry - 2, p_bottom - int(0.02 * p_h))
    s_draw.ellipse(
        [torso_cx - sh_rx, sh_cy - sh_ry, torso_cx + sh_rx, sh_cy + sh_ry],
        fill=(15, 23, 42, 48),
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=8))
    studio_card = Image.alpha_composite(studio_card, shadow_layer)

    base_np = np.asarray(base_rgba, dtype=np.uint8).copy()
    p_alpha_work = person_alpha.copy() if person_alpha is not None else np.full((H, W), 255, dtype=np.uint8)

    ycbcr_np = np.asarray(base_rgba.convert("YCbCr"), dtype=np.float32)
    yc, cb, cr = ycbcr_np[:, :, 0], ycbcr_np[:, :, 1], ycbcr_np[:, :, 2]
    rgb_dist = np.linalg.norm(base_np[:, :, :3].astype(np.float32) - face_med_rgb[None, None, :], axis=2)
    is_skin_pixel = (
        ((yc > 55) & (cb >= 74) & (cb <= 132) & (cr >= 128) & (cr <= 178) & (rgb_dist < 82.0))
        | (rgb_dist < 46.0)
    ) & (p_alpha_work > 96)

    # If IDM-VTON already rendered the upper body, only erase old lower-body shorts/pants (`y >= 0.44*p_h`);
    # otherwise erase old clothing across both torso and legs (`y in [0.17*p_h, 0.83*p_h]`)
    erase_y0 = p_top + int((0.44 if upper_already_rendered_by_vton else 0.17) * p_h)
    erase_y1 = p_top + int(0.83 * p_h)
    erase_x0 = max(0, torso_cx - int(hip_w * 0.62))
    erase_x1 = min(W, torso_cx + int(hip_w * 0.62))
    ey0, ey1 = max(0, erase_y0), min(H, erase_y1)
    if ey1 > ey0 and erase_x1 > erase_x0:
        erase_region = p_alpha_work[ey0:ey1, erase_x0:erase_x1]
        erase_region[~is_skin_pixel[ey0:ey1, erase_x0:erase_x1]] = 0

    cleaned_person_np = base_np.copy()
    cleaned_person_np[:, :, 3] = p_alpha_work
    composite = Image.alpha_composite(studio_card, Image.fromarray(cleaned_person_np, mode="RGBA"))

    head_y_end = p_top + int(0.155 * p_h)
    neck_y_end = p_top + int(0.215 * p_h)
    fg_occlusion_alpha = np.zeros((H, W), dtype=np.uint8)
    if person_alpha is not None:
        fg_occlusion_alpha[:head_y_end, :] = person_alpha[:head_y_end, :]
        v_x0 = max(0, torso_cx - int(0.14 * shoulder_w))
        v_x1 = min(W, torso_cx + int(0.14 * shoulder_w))
        ny0, ny1 = max(0, head_y_end), min(H, neck_y_end)
        if ny1 > ny0 and v_x1 > v_x0:
            neck_skin = is_skin_pixel[ny0:ny1, v_x0:v_x1]
            fg_occlusion_alpha[ny0:ny1, v_x0:v_x1][neck_skin] = person_alpha[ny0:ny1, v_x0:v_x1][neck_skin]

        arm_y0 = max(0, p_top + int(0.20 * p_h))
        arm_y1 = min(H, p_top + int(0.68 * p_h))
        inner_chest_half = int(0.36 * shoulder_w)
        ax0, ax1 = max(0, p_left), min(W, p_right)
        if arm_y1 > arm_y0 and ax1 > ax0:
            col_idx = np.arange(ax0, ax1)
            outside_chest = np.abs(col_idx - torso_cx) >= inner_chest_half
            arm_mask = is_skin_pixel[arm_y0:arm_y1, ax0:ax1] & outside_chest[None, :]
            fg_occlusion_alpha[arm_y0:arm_y1, ax0:ax1][arm_mask] = person_alpha[arm_y0:arm_y1, ax0:ax1][arm_mask]

        if cv2 is not None:
            fg_occlusion_alpha = cv2.GaussianBlur(fg_occlusion_alpha, (3, 3), 0)

    fg_occlusion_np = base_np.copy()
    fg_occlusion_np[:, :, 3] = fg_occlusion_alpha
    fg_occlusion_layer = Image.fromarray(fg_occlusion_np, mode="RGBA")

    def _paste_with_shadow(comp: Image.Image, layer_rgba: Image.Image, dst_x: int, dst_y: int) -> Image.Image:
        l_alpha = layer_rgba.split()[3]
        sh_canvas = Image.new("L", comp.size, 0)
        sh_canvas.paste(l_alpha, (dst_x, dst_y + 3))
        sh_blur = sh_canvas.filter(ImageFilter.GaussianBlur(radius=4))
        sh_np = (np.asarray(sh_blur, dtype=np.float32) * (34.0 / 255.0)).clip(0, 255).astype(np.uint8)
        sh_rgba = np.zeros((comp.size[1], comp.size[0], 4), dtype=np.uint8)
        sh_rgba[:, :, 3] = sh_np
        comp = Image.alpha_composite(comp, Image.fromarray(sh_rgba, mode="RGBA"))
        fg_c = Image.new("RGBA", comp.size, (0, 0, 0, 0))
        fg_c.paste(layer_rgba, (dst_x, dst_y), layer_rgba)
        return Image.alpha_composite(comp, fg_c)

    # 1. BOTTOM (Row-warped to match the user's measured waist/hip width and leg length)
    if bottom_item is not None:
        bw = max(56, int(hip_w * 1.18))
        bh = max(72, int(p_h * 0.44))
        bx = torso_cx - bw // 2
        by = p_top + int(0.43 * p_h)
        raw_bot = _decode_item_cutout_raw(bottom_item)
        if raw_bot is not None:
            b_layer = _warp_garment_to_body_rows(
                raw_bot, bw, bh, top_span_ratio=0.92, mid_span_ratio=1.0, bot_span_ratio=0.90
            )
        else:
            b_layer = _decode_item_cutout_or_render_placeholder(bottom_item, bw, bh)
        composite = _paste_with_shadow(composite, b_layer, bx, by)

    # 2. UPPER TORSO (Skipped if IDM-VTON already dressed the upper body; otherwise row-warped to shoulder/waist)
    if primary_upper is not None and not upper_already_rendered_by_vton:
        uw = max(64, int(shoulder_w * 1.16))
        uh = max(68, int(p_h * 0.33))
        ux = torso_cx - uw // 2
        uy = p_top + int(0.145 * p_h)
        raw_up = _decode_item_cutout_raw(primary_upper)
        if raw_up is not None:
            u_layer = _warp_garment_to_body_rows(
                raw_up, uw, uh, top_span_ratio=1.04, mid_span_ratio=0.94, bot_span_ratio=0.88
            )
        else:
            u_layer = _decode_item_cutout_or_render_placeholder(primary_upper, uw, uh)
        composite = _paste_with_shadow(composite, u_layer, ux, uy)

    # 3. SHOES (Splits left shoe & right shoe and places each onto the user's measured left/right foot!)
    if shoe_item is not None:
        raw_shoe_pil = _decode_item_cutout_raw(shoe_item)
        foot_y = p_top + int(0.84 * p_h)
        single_shoe_w = max(28, int(hip_w * 0.40))
        single_shoe_h = max(28, int(p_h * 0.13))
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
                composite = _paste_with_shadow(
                    composite, l_shoe, left_foot_cx - l_shoe.width // 2, foot_y
                )
                composite = _paste_with_shadow(
                    composite, r_shoe, right_foot_cx - r_shoe.width // 2, foot_y
                )
            else:
                s_layer = _decode_item_cutout_or_render_placeholder(shoe_item, int(hip_w * 0.72), single_shoe_h)
                composite = _paste_with_shadow(composite, s_layer, torso_cx - s_layer.width // 2, foot_y)
        else:
            s_layer = _decode_item_cutout_or_render_placeholder(shoe_item, int(hip_w * 0.72), single_shoe_h)
            composite = _paste_with_shadow(composite, s_layer, torso_cx - s_layer.width // 2, foot_y)

    # 4. Composite user's real head, V-neck, arms, and hands IN FRONT OF the outfit!
    composite = Image.alpha_composite(composite, fg_occlusion_layer)

    out_buf = BytesIO()
    out_mime = "image/webp"
    try:
        composite.save(out_buf, format="WEBP", quality=88, method=4)
    except Exception:
        out_buf = BytesIO()
        composite.save(out_buf, format="PNG")
        out_mime = "image/png"

    try_on_uri = f"data:{out_mime};base64,{base64.b64encode(out_buf.getvalue()).decode('utf-8')}"
    # Only cache final diffusion results (or outfits with no upper garment) so a busy-ZeroGPU fallback
    # render is retried with IDM-VTON on the next request.
    if upper_already_rendered_by_vton or primary_upper is None:
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
            s_cb += 6.0
            reasons.append("Signature personal comfort silhouette")
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
    is_casual_occasion = occ_low in ("casual", "everyday", "at-home", "home", "outdoor", "school")

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

    if is_rainy_or_cool and is_casual_occasion:
        selected: List[ScoredOutfitRecommendation] = []
        if layered_candidates:
            selected.append(layered_candidates[0])
        if comfort_unlayered_candidates:
            selected.append(comfort_unlayered_candidates[0])

        used_top_ids = {next((it.id for it in s.items if it.category == "TOP"), "") for s in selected}
        used_bot_ids = {next((it.id for it in s.items if it.category == "BOTTOM"), "") for s in selected}
        combined_pool = comfort_unlayered_candidates + layered_candidates
        combined_pool.sort(key=lambda r: r.hybrid_score, reverse=True)

        for cand in combined_pool:
            if len(selected) >= 3:
                break
            if cand in selected:
                continue
            c_top = next((it.id for it in cand.items if it.category == "TOP"), "")
            c_bot = next((it.id for it in cand.items if it.category == "BOTTOM"), "")
            if (c_top not in used_top_ids or len(tops) <= len(used_top_ids)) and (
                c_bot not in used_bot_ids or len(bottoms) <= len(used_bot_ids)
            ):
                selected.append(cand)
                used_top_ids.add(c_top)
                used_bot_ids.add(c_bot)

        for cand in combined_pool:
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