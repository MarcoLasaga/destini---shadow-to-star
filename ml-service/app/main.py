"""StyleSense Unified ML & Hybrid Recommendation Microservice (FastAPI).

Implements:
1. Official remove.bg API Background Removal (size="preview") with graceful local
   rembg "u2net" fallback (alpha_matting=False, zero OpenCV GrabCut/contour mask corruption).
2. Fine-Tuned 5-Class ResNet-50 Garment Classifier (loading Epoch 13 checkpoint
   stylesense_resnet50_best.pt with Git LFS pointer checks, standard 224x224 evaluation
   transforms, true softmax probabilities, and strict 0.55 confidence threshold).
3. Foreground Garment Color & Palette Extraction using ml-service/kmeans_color.py
   (CIE XYZ -> CIELAB D65, Delta-E CIE76, and KMeansCIELAB clustering).
4. 5-Class Fashion Taxonomy wired directly to ml-service/cnn_taxonomy.json.
5. Batch Wardrobe Image Analysis endpoint (POST /analyze-batch) accepting up to 15 images.
6. Automated AI Content Moderation Gate (NSFW / Skin-Ratio Check + Profanity Filter).
7. Context-Aware Weighted Hybrid Recommendation Engine: S_hybrid = round(0.55 * S_cb + 0.45 * S_cf).
"""

import base64
from contextlib import asynccontextmanager
import gc
from io import BytesIO
import json
import logging
import os
from pathlib import Path
import re
import sys
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

# Ensure REMOVE_BG_API_KEY and REMOVE_BG_API_KEYS are loaded directly from .env if present
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
    # 1. Comma-separated REMOVE_BG_API_KEYS (e.g. key1,key2,key3,key4)
    multi = os.getenv("REMOVE_BG_API_KEYS", "").strip()
    if multi:
        for k in multi.split(","):
            k = k.strip()
            if k and k not in keys:
                keys.append(k)
    # 2. Single REMOVE_BG_API_KEY
    single = os.getenv("REMOVE_BG_API_KEY", "").strip()
    if single and single not in keys:
        keys.append(single)
    # 3. Default fallback
    if not keys:
        keys.append("6BLesBsiyabbtYwoR3Cer6DE")
    return keys

# Add ml-service root directory to sys.path so kmeans_color and local modules import cleanly
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

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

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import math
import numpy as np
from PIL import Image, ImageFilter, UnidentifiedImageError
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

# Prioritized candidate checkpoint paths (experiments/resnet50/checkpoints/stylesense_resnet50_best.pt first relative to ml-service)
CANDIDATE_CHECKPOINT_PATHS: List[Path] = [
    Path(os.getenv("RESNET50_CHECKPOINT_PATH", "")),
    BASE_DIR / "experiments" / "resnet50" / "checkpoints" / "stylesense_resnet50_best.pt",
    Path("experiments/resnet50/checkpoints/stylesense_resnet50_best.pt"),
    BASE_DIR / "experiments" / "resnet50" / "stylesense_resnet50_best.pt",
    BASE_DIR / "models" / "stylesense_resnet50_best.pt",
    BASE_DIR / "models" / "resnet50_stylesense_epoch13.pth",
    BASE_DIR / "stylesense_resnet50_best.pt",
]

# Prioritized candidate results paths
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

# Standard evaluation transforms matching train_resnet50 validation configuration
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

# Initialize local rembg session ("u2netp") for fast sub-second fallback
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


class ColorClusterInfo(BaseModel):
    color_name: str
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
    pattern: Optional[str] = None
    palette: List[ColorClusterInfo] = Field(default_factory=list)
    style: Optional[Style] = None
    occasion: Optional[Occasion] = None
    material: Optional[Material] = None
    confidence: float
    class_probabilities: Dict[str, float] = Field(default_factory=dict)
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


class ModerationResponse(BaseModel):
    approved: bool
    sanitized_caption: str
    reason: Optional[str] = None


class WardrobeItemInput(BaseModel):
    id: str
    clothing_name: str
    category: Category
    color: str
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    style: Style = "CASUAL"
    occasion: str = "Casual"
    vector_subtype: Optional[str] = None
    texture: Optional[str] = None
    fit: Optional[str] = None
    target_gender: Optional[str] = "unisex"
    image_url: Optional[str] = None
    is_favorite: bool = False
    is_disliked: bool = False
    laundry_status: Optional[str] = "CLEAN"  # Backwards compatibility; ignored for scoring
    worn_within_7_days: Optional[bool] = False  # Backwards compatibility; wear penalty removed


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


class HybridRecommendationRequest(BaseModel):
    user_id: str
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


def extract_garment_cutout(
    pil_img: Image.Image,
    force_rembg: bool = False,
) -> Tuple[Image.Image, np.ndarray, str, str]:
    """Segment garment using official remove.bg API with multi-key rotation and pure rembg u2netp fallback.

    - Supports FORCE_REMBG=true (in .env or param) to bypass remove.bg completely (spending 0 credits).
    - If Key #1 returns HTTP 402 or 429, automatically retries with Key #2, #3, etc. before falling back to rembg.
    - Zero OpenCV GrabCut code is used, preventing opaque background corruption.
    - Fast sub-secondBILINEAR downsampling to 384x384 and lightweight WebP encoding.

    Returns:
        (cutout_pil, fg_mask, cutout_data_uri, bg_source)
    """
    global REMBG_SESSION
    # 1. Resize working copy to 384x384 (BILINEAR) for sub-second inference & low RAM
    img = pil_img.convert("RGB").copy()
    img.thumbnail((384, 384), Image.Resampling.BILINEAR)

    cutout: Optional[Image.Image] = None
    bg_source = "none"
    keys = get_remove_bg_api_keys()
    size_setting = (os.getenv("REMOVE_BG_SIZE", "preview").strip()) or "preview"

    # Check FORCE_REMBG toggle
    env_force = os.getenv("FORCE_REMBG", "false").strip().lower() in ("true", "1", "yes")
    should_force_rembg = force_rembg or env_force

    # 2. Primary: Official remove.bg API with multi-key rotation (skipped if should_force_rembg)
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
                            logger.warning(f"[REMOVE-BG] Automatically retrying with Key #{idx+1}...")
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
                        logger.warning(f"[REMOVE-BG] Automatically retrying with Key #{idx+1}...")
                        continue
                    break
        except Exception as e:
            logger.warning(f"[REMOVE-BG] Image encoding failed: {e}")

    # 3. Fallback: Pure rembg local u2netp model with alpha_matting=False (fast, never alpha_matting=True)
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

    # 4. Clean up faint background alpha noise (< 20 -> 0)
    rgba = np.array(cutout.convert("RGBA"))
    alpha = rgba[:, :, 3]
    alpha = np.where(alpha < 20, 0, alpha).astype(np.uint8)

    # Morphological closing (5, 5 ellipse) and (3, 3) GaussianBlur
    if cv2 is not None:
        try:
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, kernel)
            alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
        except Exception as e:
            logger.warning(f"Morphological smoothing skipped: {e}")

    rgba[:, :, 3] = alpha
    cutout = Image.fromarray(rgba, mode="RGBA")

    # Center tight bounding-box crop on 400x400 RGBA canvas
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

    # Encode cutout into BytesIO as WEBP (quality=85, method=4), falling back to PNG
    buffered = BytesIO()
    mime_type = "image/webp"
    try:
        cutout.save(buffered, format="WEBP", quality=85, method=4)
    except Exception as e:
        logger.warning(f"WebP encoding failed, falling back to PNG: {e}")
        buffered = BytesIO()
        cutout.save(buffered, format="PNG")
        mime_type = "image/png"

    cutout_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    cutout_data_uri = f"data:{mime_type};base64,{cutout_base64}"

    fg_mask = np.array(cutout)[:, :, 3] > 64
    return cutout, fg_mask, cutout_data_uri, bg_source


def extract_color_palette_kmeans(
    cutout: Image.Image,
    fg_mask: Optional[np.ndarray] = None,
    k: int = 2,
    max_iter: int = 30,
    tol: float = 1e-3,
    random_state: int = 42,
) -> Tuple[str, str, Optional[str], Optional[str], float, List[ColorClusterInfo]]:
    """Extract dominant colors and CIELAB palette using ml-service/kmeans_color.py on interior foreground pixels.

    1. Composites cutout onto a pure white background (255, 255, 255, 255) first for RGB pixel reading,
       eliminating transparent black canvas (0, 0, 0, 0) anti-aliased edge-bleeding.
    2. Builds a strict interior foreground mask (alpha > 210) eroded by 1 iteration with a 3x3 elliptical kernel.
    3. Applies Shadow Crevice Outlier Filtering: when median L* > 65.0, filters out deep shadow crevice pixels (L* < 25.0).
    """
    cutout_rgba = cutout.convert("RGBA")
    rgba_raw = np.asarray(cutout_rgba, dtype=np.uint8)
    alpha = rgba_raw[:, :, 3]

    # 1. Composite onto pure white background (255, 255, 255, 255) for RGB reading
    white_canvas = Image.new("RGBA", cutout_rgba.size, (255, 255, 255, 255))
    comp_rgb = np.asarray(Image.alpha_composite(white_canvas, cutout_rgba).convert("RGB"), dtype=np.uint8)

    # 2. Strict interior foreground mask (alpha > 210) + 1-iteration 3x3 elliptical erosion
    interior_mask = (alpha > 210).astype(np.uint8)
    if cv2 is not None:
        try:
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            interior_mask = cv2.erode(interior_mask, kernel, iterations=1)
        except Exception:
            pass

    interior_bool = interior_mask > 0
    if int(np.sum(interior_bool)) < 30:
        interior_bool = alpha > 128
    if int(np.sum(interior_bool)) < 20:
        if fg_mask is not None and fg_mask.shape[:2] == comp_rgb.shape[:2] and int(np.sum(fg_mask)) >= 20:
            interior_bool = fg_mask
        else:
            interior_bool = alpha > 0

    if int(np.sum(interior_bool)) >= 10:
        fg_pixels = comp_rgb[interior_bool].astype(np.float64)
    else:
        fg_pixels = comp_rgb.reshape(-1, 3).astype(np.float64)

    # Subsample at most 1200 foreground pixels for <4ms CIELAB K-Means++
    if len(fg_pixels) > 1200:
        rng = np.random.default_rng(random_state)
        idx = rng.choice(len(fg_pixels), size=1200, replace=False)
        fg_pixels = fg_pixels[idx]

    fg_lab = kmeans_color.rgb_to_cielab(fg_pixels)

    # 3. Shadow Crevice Outlier Filter: if light-colored item (median L* > 65.0), remove deep crevices (L* < 25.0)
    if len(fg_lab) > k and float(np.median(fg_lab[:, 0])) > 65.0:
        non_shadow_lab = fg_lab[fg_lab[:, 0] >= 25.0]
        if len(non_shadow_lab) >= max(k, 10):
            fg_lab = non_shadow_lab

    # Use KMeansCIELAB from ml-service/kmeans_color.py with max_iter=30 and tol=1e-3
    km = kmeans_color.KMeansCIELAB(n_clusters=k, max_iter=max_iter, tol=tol, random_state=random_state)
    km.fit(fg_lab)

    centers = km.cluster_centers_
    labels = km.labels_
    counts = np.bincount(labels, minlength=k)
    weights = counts / max(1, len(labels))
    sorted_order = np.argsort(-weights)

    clusters: List[ColorClusterInfo] = []
    for idx in sorted_order:
        c_lab = centers[idx]
        c_name = kmeans_color.lab_to_color_name(c_lab)
        clusters.append(
            ColorClusterInfo(
                color_name=c_name,
                proportion=round(float(weights[idx]), 4),
                lab=(round(float(c_lab[0]), 2), round(float(c_lab[1]), 2), round(float(c_lab[2]), 2)),
            )
        )

    dom_cluster = clusters[0] if clusters else None
    dom_color = dom_cluster.color_name if dom_cluster else "White"
    dom_lab = centers[sorted_order[0]] if len(centers) > 0 else np.array([95.0, 0.0, 0.0])
    dom_rgb = kmeans_color.cielab_to_rgb(dom_lab)
    color_hex = f"#{int(dom_rgb[0]):02x}{int(dom_rgb[1]):02x}{int(dom_rgb[2]):02x}".upper()

    sec_color: Optional[str] = None
    sec_color_hex: Optional[str] = None
    if len(clusters) > 1:
        sec_color = clusters[1].color_name
        sec_lab = centers[sorted_order[1]]
        sec_rgb = kmeans_color.cielab_to_rgb(sec_lab)
        sec_color_hex = f"#{int(sec_rgb[0]):02x}{int(sec_rgb[1]):02x}{int(sec_rgb[2]):02x}".upper()

    color_conf = round(float(dom_cluster.proportion), 4) if dom_cluster else 1.0

    return dom_color, color_hex, sec_color, sec_color_hex, color_conf, clusters


def create_studio_beautified_cutout(cutout_rgba: Image.Image, dom_l_star: float = 50.0) -> str:
    """Free-Tier Studio Beautify Mode (<25ms, 0 MB extra model weights):
    1. Automatic Top Hanger & Hook Eraser (erases narrow top neck/hook protrusions & dark low-chroma hanger pixels).
    2. Principal-Axis Symmetry Deskewing via cv2.moments & cv2.warpAffine.
    3. CIELAB L* Studio De-Wrinkling (bilateralFilter) & Relighting (CLAHE strictly on L* channel).
    4. Soft Studio Drop-Shadow & Crisp Silhouette Edge on a centered 400x400 WebP canvas.
    """
    rgba = np.asarray(cutout_rgba.convert("RGBA"), dtype=np.uint8).copy()
    alpha = rgba[:, :, 3].copy()

    ys, xs = np.where(alpha > 40)
    if len(ys) > 20 and len(xs) > 20:
        top, bottom = int(np.min(ys)), int(np.max(ys))
        left, right = int(np.min(xs)), int(np.max(xs))
        bh = max(bottom - top, 1)
        bw = max(right - left, 1)

        # 1. Automatic Top Hanger & Hook Eraser (top 14% of garment bounding box)
        hanger_end_y = top + max(1, int(0.14 * bh))
        body_widths = []
        for y in range(hanger_end_y, bottom + 1):
            row_xs = np.where(alpha[y, left : right + 1] > 64)[0]
            if len(row_xs) > 0:
                body_widths.append(int(row_xs[-1] - row_xs[0] + 1))
        max_torso_width = float(max(body_widths)) if body_widths else float(bw)

        top_strip_rgb = rgba[top:hanger_end_y, left : right + 1, :3].reshape(-1, 3).astype(np.float64)
        top_strip_lab = (
            kmeans_color.rgb_to_cielab(top_strip_rgb).reshape(hanger_end_y - top, right - left + 1, 3)
            if len(top_strip_rgb) > 0
            else None
        )

        for y in range(top, hanger_end_y):
            row_xs = np.where(alpha[y, left : right + 1] > 40)[0]
            if len(row_xs) == 0:
                continue
            row_span = float(row_xs[-1] - row_xs[0] + 1)
            row_count = float(len(row_xs))
            if row_span < 0.22 * max_torso_width or row_count < 0.18 * max_torso_width:
                alpha[y, left : right + 1] = 0
            elif dom_l_star > 55.0 and top_strip_lab is not None:
                ry = y - top
                l_row = top_strip_lab[ry, :, 0]
                c_row = np.hypot(top_strip_lab[ry, :, 1], top_strip_lab[ry, :, 2])
                dark_hanger_px = (l_row < 28.0) & (c_row < 14.0)
                alpha[y, left : right + 1][dark_hanger_px] = 0

        rgba[:, :, 3] = alpha

        # 2. Principal-Axis Symmetry Deskewing
        if cv2 is not None:
            try:
                m = cv2.moments((alpha > 64).astype(np.uint8))
                if m["m00"] > 50:
                    # Estimate tilt angle relative to vertical axis
                    denom = m["mu02"] - m["mu20"]
                    if abs(denom) > 1e-3:
                        theta_rad = 0.5 * math.atan2(2.0 * m["mu11"], denom)
                        theta_deg = math.degrees(theta_rad)
                        if 1.5 <= abs(theta_deg) <= 14.0:
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

        # 3. CIELAB L* Studio De-Wrinkling & Relighting (Color-Preserving)
        if cv2 is not None:
            try:
                rgb_chan = rgba[:, :, :3]
                lab_cv = cv2.cvtColor(rgb_chan, cv2.COLOR_RGB2LAB)
                l_chan, a_chan, b_chan = cv2.split(lab_cv)
                l_smooth = cv2.bilateralFilter(l_chan, d=7, sigmaColor=22, sigmaSpace=22)
                clahe = cv2.createCLAHE(clipLimit=1.35, tileGridSize=(8, 8))
                l_clahe = clahe.apply(l_smooth)
                l_final = cv2.addWeighted(l_clahe, 0.65, l_smooth, 0.35, 0)
                fg_bool = alpha > 20
                l_out = np.where(fg_bool, l_final, l_chan).astype(np.uint8)
                lab_merged = cv2.merge((l_out, a_chan, b_chan))
                rgba[:, :, :3] = cv2.cvtColor(lab_merged, cv2.COLOR_LAB2RGB)
            except Exception as e:
                logger.debug(f"L* studio relighting skipped: {e}")

    # 4. Soft Studio Drop-Shadow & Crisp Silhouette Edge on centered 400x400 WebP canvas
    clean_pil = Image.fromarray(rgba, mode="RGBA")
    bbox = clean_pil.getbbox()
    canvas = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    if bbox:
        cropped = clean_pil.crop(bbox)
        cropped.thumbnail((360, 360), Image.Resampling.BILINEAR)
        ox = (400 - cropped.width) // 2
        oy = (400 - cropped.height) // 2

        # Create soft blurred drop shadow (offset=(0, 5), sigma=6, opacity=38)
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
        canvas = clean_pil.resize((400, 400), Image.Resampling.BILINEAR)

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
    """Multi-layer bilingual (Tagalog + English) profanity and slur detector.

    Layer A: Leetspeak & symbol normalization + repeated character collapse.
    Layer B: Masked / asterisk pattern detection (e.g., p*ta, p*tangina, f*ck, sh*t).
    Layer C: Comprehensive English & Tagalog profanity, slur, and insult lexicon.
    """
    raw = (text or "").strip()
    if not raw:
        return True, "", None

    is_bad = False
    sanitized = raw

    # 1. Direct masked regex check & sanitize
    if MASKED_REGEX.search(sanitized):
        is_bad = True
        sanitized = MASKED_REGEX.sub("***", sanitized)

    # 2. Direct term regex check & sanitize
    if ALL_TERMS_REGEX.search(sanitized):
        is_bad = True
        sanitized = ALL_TERMS_REGEX.sub("***", sanitized)

    # 3. Check obfuscated variants (Layer A - Leetspeak, Spaced, Repeated characters)
    lower = raw.lower()
    variants = []

    # Spaced / symbol separated letters: 'p u t a' or 'g.a.g.o'
    c_spaced = SPACED_PATTERN.sub(lambda m: re.sub(r"[\s._\-\*#~/]+", "", m.group(0)), lower)
    variants.append(c_spaced)

    # Leetspeak translation
    leet = lower.translate(LEET_MAP)
    variants.append(leet)

    # Leet + spaced collapse
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
        # Mask spaced tokens
        def repl_spaced(m):
            token = re.sub(r"[\s._\-\*#~/]+", "", m.group(0)).lower().translate(LEET_MAP)
            token = REPEATED_PATTERN.sub(r"\1", token)
            if ALL_TERMS_REGEX.search(token) or MASKED_REGEX.search(token):
                return "***"
            return m.group(0)

        sanitized = SPACED_PATTERN.sub(repl_spaced, sanitized)

        # Mask individual leet / repeated words
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
        if any(w in text for w in ("earring", "earrings", "stud")):
            return "earrings"
        if any(w in text for w in ("cap", "hat", "beanie", "snapback", "bucket hat")):
            return "cap"
        return "cap"

    return "tshirt"


OOD_NON_WEARABLE_KEYWORDS: Tuple[str, ...] = (
    "ipod", "cellular telephone", "dial telephone", "hand-held computer",
    "laptop", "notebook", "modem", "mouse", "remote control",
    "earphone", "headphone", "microphone", "coffee mug", "cup",
    "water bottle", "pop bottle", "pill bottle", "wine bottle",
    "plate", "bowl", "chair", "folding chair", "barber chair",
    "toilet tissue", "paper towel", "ashcan", "electric fan",
    "toaster", "refrigerator",
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
)

OUTERWEAR_IMAGENET_KEYWORDS: Tuple[str, ...] = (
    "sweatshirt", "cardigan", "trench coat", "suit", "windsor tie",
    "jean", "poncho", "fur coat", "lab coat", "bulletproof vest",
    "academic gown", "cloak",
)

TOP_IMAGENET_KEYWORDS: Tuple[str, ...] = (
    "jersey", "maillot", "overskirt", "brassiere", "bikini", "swimming trunks",
)


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
    """Zero-retraining visual calibrator for StyleSense v5.0:
    A) Out-of-Distribution (OOD) Non-Wearable Object Gate (rejects AirPods, phones, mugs, furniture).
    B) TOP vs. OUTERWEAR Calibrator (combines ImageNet priors, center zipper/placket edges, hood projection, and short-sleeve geometry).
    C) 32 Detailed Subtypes + Visual Pattern Detection (Graphic, Striped, Two-Tone, Solid).
    """
    fn = (source_filename or "").lower()

    # 1. Extract ImageNet fine-grained priors if available
    non_wearable_prob = 0.0
    aux_outer_score = 0.0
    aux_top_score = 0.0
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

    top_is_wearable = any(k in top_imagenet_name for k in WEARABLE_IMAGENET_KEYWORDS) if top_imagenet_name else False

    # ─────────────────────────────────────────────────────────────────────────
    # A) Out-of-Distribution (OOD) Non-Wearable Object Gate (Rejects AirPods, Phones, Mugs, Furniture)
    # ─────────────────────────────────────────────────────────────────────────
    is_compact_non_wearable_case = (
        pred_cat == "ACCESSORIES"
        and fg_coverage < 0.11
        and (0.75 <= bbox_aspect_ratio <= 1.30)
        and not top_is_wearable
    )
    if non_wearable_prob >= 0.18 or is_compact_non_wearable_case:
        ood_conf = round(min(raw_conf, 0.34), 4)
        ood_reason = (
            "Detected a non-wearable object (e.g., electronics or household item). "
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

    # ─────────────────────────────────────────────────────────────────────────
    # Compute foreground silhouette & edge geometry on tight-cropped garment
    # ─────────────────────────────────────────────────────────────────────────
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
    hood_score = 0.0
    short_sleeve_score = 0.0
    leg_gap_ratio = 0.0
    has_graphic = False
    has_stripes = False

    if ch >= 24 and cw >= 24:
        # Horizontal gradient |dI/dx| for vertical zipper/placket & side stripes
        grad_x = np.abs(np.diff(crop_gray, axis=1))
        grad_y = np.abs(np.diff(crop_gray, axis=0))

        # 1) Center Vertical Zipper/Placket Edge Score (x in [0.46*W, 0.54*W], y in [0.20*H, 0.85*H])
        cy0, cy1 = int(0.20 * ch), max(int(0.20 * ch) + 2, int(0.85 * ch))
        cx0, cx1 = int(0.46 * cw), max(int(0.46 * cw) + 1, min(cw - 1, int(0.54 * cw)))
        lx0, lx1 = int(0.22 * cw), max(int(0.22 * cw) + 1, int(0.42 * cw))
        rx0, rx1 = int(0.58 * cw), max(int(0.58 * cw) + 1, min(cw - 1, int(0.78 * cw)))

        center_strip_edge = float(np.mean(grad_x[cy0:cy1, cx0:cx1])) if cx1 > cx0 else 0.0
        left_panel_edge = float(np.mean(grad_x[cy0:cy1, lx0:lx1])) if lx1 > lx0 else 0.0
        right_panel_edge = float(np.mean(grad_x[cy0:cy1, rx0:rx1])) if rx1 > rx0 else 0.0
        panel_edge = 0.5 * (left_panel_edge + right_panel_edge)
        if center_strip_edge > 3.5:
            center_placket_score = float(center_strip_edge / max(panel_edge, 2.5))

        # 2) Top Hood / High-Collar Projection (y in [0.0, 0.18*H], x in [0.28*W, 0.72*W])
        hy1 = max(2, int(0.18 * ch))
        hx0, hx1 = int(0.28 * cw), max(int(0.28 * cw) + 2, int(0.72 * cw))
        top_center_cov = float(np.mean(crop_alpha[0:hy1, hx0:hx1] > 128))
        top_left_cov = float(np.mean(crop_alpha[0:hy1, 0 : max(1, int(0.20 * cw))] > 128))
        top_right_cov = float(np.mean(crop_alpha[0:hy1, min(cw - 1, int(0.80 * cw)) : cw] > 128))
        corner_cov = 0.5 * (top_left_cov + top_right_cov)
        # A genuine hood or high stand collar projects in the center while top shoulder corners are empty
        hood_score = top_center_cov * max(0.0, 1.0 - 0.85 * corner_cov)

        # 3) Short-Sleeve Tee Silhouette
        ll_alpha = crop_alpha[int(0.52 * ch) : ch, 0 : max(1, int(0.22 * cw))]
        lr_alpha = crop_alpha[int(0.52 * ch) : ch, min(cw - 1, int(0.78 * cw)) : cw]
        ll_outer = crop_alpha[int(0.52 * ch) : ch, 0 : max(1, int(0.16 * cw))]
        lr_outer = crop_alpha[int(0.52 * ch) : ch, min(cw - 1, int(0.84 * cw)) : cw]
        lower_sides_empty = (
            (float(np.mean(ll_alpha > 64)) < 0.15)
            and (float(np.mean(lr_alpha > 64)) < 0.15)
            and (float(np.mean(ll_outer > 64)) < 0.03)
            and (float(np.mean(lr_outer > 64)) < 0.03)
        )
        if bbox_aspect_ratio > 0.82 and lower_sides_empty:
            short_sleeve_score = 1.0

        # 4) Lower-center leg separation gap for trousers vs. skirts
        leg_strip = crop_alpha[int(0.55 * ch) : int(0.92 * ch), int(0.44 * cw) : max(int(0.44 * cw) + 1, int(0.56 * cw))]
        if leg_strip.size > 0:
            leg_gap_ratio = float(np.mean(leg_strip < 40))

        # 5) Visual Pattern: Graphic chest print detection
        gx0, gx1 = int(0.32 * cw), max(int(0.32 * cw) + 2, min(cw - 1, int(0.68 * cw)))
        gy0, gy1 = int(0.25 * ch), max(int(0.25 * ch) + 2, min(ch - 1, int(0.60 * ch)))
        chest_edge = float(0.5 * (np.mean(grad_x[gy0:gy1, gx0:gx1]) + np.mean(grad_y[gy0:gy1, gx0:gx1])))
        chest_rgb = crop_rgba[gy0:gy1, gx0:gx1, :3].astype(np.float32)
        chest_color_std = float(np.mean(np.std(chest_rgb, axis=(0, 1)))) if chest_rgb.size > 0 else 0.0

        hem_y0, hem_y1 = int(0.70 * ch), max(int(0.70 * ch) + 2, min(ch - 1, int(0.90 * ch)))
        hem_edge = float(0.5 * (np.mean(grad_x[hem_y0:hem_y1, gx0:gx1]) + np.mean(grad_y[hem_y0:hem_y1, gx0:gx1])))
        if chest_edge > 14.0 and chest_color_std > 22.0 and chest_edge > 1.35 * max(hem_edge, 4.0):
            has_graphic = True

        # 6) Visual Pattern: Side-seam stripe detection (x in [0.02*W, 0.20*W] or [0.80*W, 0.98*W])
        sx_l0, sx_l1 = int(0.02 * cw), max(int(0.02 * cw) + 2, int(0.20 * cw))
        sx_r0, sx_r1 = int(0.80 * cw), max(int(0.80 * cw) + 2, min(cw - 1, int(0.98 * cw)))
        sy0, sy1 = int(0.20 * ch), max(int(0.20 * ch) + 2, min(ch - 1, int(0.85 * ch)))
        side_edge = max(
            float(np.mean(grad_x[sy0:sy1, sx_l0:sx_l1])),
            float(np.mean(grad_x[sy0:sy1, sx_r0:sx_r1])),
        )
        # Compare against interior leg/torso panels (excluding center seam/gap)
        in_l = float(np.mean(grad_x[sy0:sy1, int(0.22 * cw) : max(int(0.22 * cw) + 2, int(0.40 * cw))]))
        in_r = float(np.mean(grad_x[sy0:sy1, int(0.60 * cw) : max(int(0.60 * cw) + 2, int(0.78 * cw))]))
        mid_edge = 0.5 * (in_l + in_r)
        sec_prop = clusters[1].proportion if len(clusters) > 1 else 0.0
        if sec_prop >= 0.08 and side_edge > 7.5 and side_edge > 1.25 * max(mid_edge, 3.0):
            has_stripes = True

    if "graphic" in fn:
        has_graphic = True
    if "stripe" in fn or "striped" in fn:
        has_stripes = True

    # ─────────────────────────────────────────────────────────────────────────
    # B) Resolve TOP vs. OUTERWEAR Confusion
    # ─────────────────────────────────────────────────────────────────────────
    prob_top = float(class_probabilities.get("TOP", 0.0))
    prob_outer = float(class_probabilities.get("OUTERWEAR", 0.0))
    sorted_cats = sorted(class_probabilities.items(), key=lambda kv: kv[1], reverse=True)
    top2_set = {sorted_cats[0][0], sorted_cats[1][0]} if len(sorted_cats) >= 2 else set()

    if (
        top2_set == {"TOP", "OUTERWEAR"}
        or (pred_cat in ("TOP", "OUTERWEAR") and abs(prob_top - prob_outer) < 0.28)
        or (pred_cat is None and max(prob_top, prob_outer) >= 0.42 and (prob_top + prob_outer) >= 0.72)
    ):
        if (
            (aux_outer_score > aux_top_score + 0.08)
            or (hood_score > 0.38 and short_sleeve_score == 0.0)
            or (center_placket_score > 1.45 and short_sleeve_score == 0.0)
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

    # ─────────────────────────────────────────────────────────────────────────
    # C) 32 Detailed Subtypes + Visual Pattern Detection (Graphic, Striped, Two-Tone)
    # ─────────────────────────────────────────────────────────────────────────
    _, material, pred_style, occasion, layer_role = CATEGORY_DEFAULT_METADATA[pred_cat]
    sub_category = "T-Shirt"
    vector_subtype = "tshirt"

    if pred_cat == "TOP":
        if "crop" in fn or (bbox_aspect_ratio > 1.18 and short_sleeve_score > 0.0):
            sub_category, vector_subtype = "Crop Top", "crop_top"
        elif "tank" in fn or "sleeveless" in fn or any(k in top_imagenet_name for k in ("maillot", "bikini", "brassiere")):
            sub_category, vector_subtype = "Tank Top", "tank_top"
        elif "polo" in fn or (center_placket_score > 1.25 and short_sleeve_score > 0.0 and hood_score > 0.22):
            sub_category, vector_subtype = "Polo Shirt", "polo"
            pred_style = "CLASSIC"
        elif "blouse" in fn or any(k in top_imagenet_name for k in ("overskirt", "gown", "kimono")):
            sub_category, vector_subtype = "Blouse", "button_down"
            material, pred_style = "Silk", "FORMAL"
        elif "button" in fn or "oxford" in fn or "dress shirt" in fn or (center_placket_score > 1.32 and short_sleeve_score == 0.0):
            sub_category, vector_subtype = "Button-Down Shirt", "button_down"
            pred_style, occasion = "FORMAL", "WORK"
        elif "long" in fn or "sweater" in fn or "crewneck" in fn or (short_sleeve_score == 0.0 and bbox_aspect_ratio < 0.78):
            sub_category, vector_subtype = "Long-Sleeve Top", "long_sleeve"
        elif has_graphic:
            sub_category, vector_subtype = "Graphic T-Shirt", "tshirt"
            pred_style = "STREETWEAR"
        else:
            sub_category, vector_subtype = "T-Shirt", "tshirt"

    elif pred_cat == "OUTERWEAR":
        if ("zip" in fn and ("hood" in fn or "sweat" in fn)) or (hood_score > 0.36 and center_placket_score > 1.38):
            sub_category, vector_subtype = "Zip-Up Hoodie", "zip_hoodie"
            pred_style = "STREETWEAR"
        elif "track" in fn or (has_stripes and center_placket_score > 1.20):
            sub_category, vector_subtype = "Track Jacket", "windbreaker"
            material, pred_style = "Polyester", "SPORTY"
        elif "windbreaker" in fn or "anorak" in fn:
            sub_category, vector_subtype = "Windbreaker Jacket", "windbreaker"
            material, pred_style, occasion = "Nylon", "SPORTY", "OUTDOOR"
        elif "blazer" in fn or "suit" in top_imagenet_name:
            sub_category, vector_subtype = "Structured Blazer", "blazer"
            material, pred_style, occasion = "Wool", "FORMAL", "WORK"
        elif "denim" in fn or "jean" in top_imagenet_name or (dom_color in ("Blue", "Light Blue", "Navy") and center_placket_score > 1.35 and hood_score <= 0.36):
            sub_category, vector_subtype = "Denim Jacket", "denim_jacket"
            material, pred_style = "Denim", "STREETWEAR"
        elif "cardigan" in fn or "cardigan" in top_imagenet_name:
            sub_category, vector_subtype = "Knit Cardigan", "cardigan"
            material, pred_style = "Knit", "CLASSIC"
        elif "coat" in fn or "trench" in fn or any(k in top_imagenet_name for k in ("trench coat", "fur coat", "lab coat", "cloak")) or bbox_aspect_ratio < 0.64:
            sub_category, vector_subtype = "Overcoat / Trench", "coat"
            material, pred_style, occasion = "Wool", "FORMAL", "WORK"
        elif center_placket_score > 1.42 and hood_score <= 0.32:
            sub_category, vector_subtype = "Windbreaker Jacket", "windbreaker"
            material, pred_style = "Nylon", "CASUAL"
        else:
            sub_category, vector_subtype = "Pullover Hoodie", "hoodie"
            pred_style = "STREETWEAR"

    elif pred_cat == "BOTTOM":
        if "skirt" in fn or any(k in top_imagenet_name for k in ("miniskirt", "hoopskirt", "overskirt", "sarong")) or (leg_gap_ratio < 0.04 and bbox_aspect_ratio > 0.74):
            sub_category, vector_subtype = "Pleated Skirt", "skirt"
            material = "Polyester"
        elif "short" in fn or "swimming trunks" in top_imagenet_name or bbox_aspect_ratio > 0.88:
            sub_category, vector_subtype = "Casual Shorts", "shorts"
            material = "Cotton"
        elif "track" in fn or "jogger" in fn or "sweatpant" in fn or has_stripes:
            sub_category, vector_subtype = "Track Pants", "track_pants"
            material, pred_style = "Polyester", "SPORTY"
        elif "cargo" in fn:
            sub_category, vector_subtype = "Cargo Pants", "cargo_pants"
            material, pred_style = "Cotton", "STREETWEAR"
        elif "dress pant" in fn or "slack" in fn or ("suit" in top_imagenet_name and dom_color in ("Black", "Gray", "Navy")):
            sub_category, vector_subtype = "Dress Pants", "trousers"
            material, pred_style, occasion = "Wool", "FORMAL", "WORK"
        elif "trouser" in fn or "chino" in fn or "tailored" in fn or (dom_color in ("Black", "Beige", "Khaki", "Cream", "Gray", "Brown") and "jean" not in top_imagenet_name):
            sub_category, vector_subtype = "Tailored Trousers", "trousers"
            material, pred_style = "Cotton", "CLASSIC"
        else:
            sub_category, vector_subtype = "Denim Jeans", "jeans"
            material, pred_style = "Denim", "CASUAL"

    elif pred_cat == "SHOES":
        if "boot" in fn or "cowboy boot" in top_imagenet_name or bbox_aspect_ratio < 0.85:
            sub_category, vector_subtype = "Combat Boots", "combat_boots"
            material, pred_style = "Leather", "STREETWEAR"
        elif "heel" in fn or "stiletto" in fn or "sandal" in top_imagenet_name:
            sub_category, vector_subtype = "Strappy Heels", "heels"
            material, pred_style, occasion = "Leather", "FORMAL", "PARTY"
        elif "loafer" in fn or "oxford" in fn or "clog" in top_imagenet_name or (dom_color in ("Brown", "Black", "Tan", "Burgundy") and len(clusters) > 0 and clusters[0].proportion > 0.82):
            sub_category, vector_subtype = "Leather Loafers", "loafers"
            material, pred_style, occasion = "Leather", "FORMAL", "WORK"
        elif "run" in fn or "running shoe" in top_imagenet_name or (len(clusters) > 1 and clusters[1].proportion >= 0.22):
            sub_category, vector_subtype = "Running Shoes", "running_shoes"
            material, pred_style, occasion = "Nylon", "SPORTY", "GYM"
        else:
            sub_category, vector_subtype = "Low-Top Sneakers", "sneakers"
            material, pred_style = "Leather", "CASUAL"

    elif pred_cat == "ACCESSORIES":
        if "watch" in fn or any(k in top_imagenet_name for k in ("watch", "stopwatch")):
            sub_category, vector_subtype = "Wristwatch", "watch"
            material, pred_style = "Leather", "CLASSIC"
        elif "choker" in fn:
            sub_category, vector_subtype = "Choker", "choker"
            material, pred_style = "Other", "STREETWEAR"
        elif "necklace" in fn or "chain" in fn or any(k in top_imagenet_name for k in ("necklace", "chain")):
            sub_category, vector_subtype = "Chain Necklace", "chain_necklace"
            material, pred_style = "Other", "STREETWEAR"
        elif "belt" in fn or "belt" in top_imagenet_name or "buckle" in top_imagenet_name or bbox_aspect_ratio > 2.4:
            sub_category, vector_subtype = "Leather Belt", "belt"
            material, pred_style = "Leather", "CLASSIC"
        elif "sunglass" in fn or "shades" in fn or "glass" in fn or "sunglass" in top_imagenet_name or (1.75 <= bbox_aspect_ratio <= 2.4):
            sub_category, vector_subtype = "Sunglasses", "sunglasses"
            material, pred_style = "Other", "CASUAL"
        elif "earring" in fn:
            sub_category, vector_subtype = "Drop Earrings", "earrings"
            material, pred_style = "Other", "FORMAL"
        elif "bag" in fn or "purse" in fn or "tote" in fn or "crossbody" in fn or "backpack" in fn or any(k in top_imagenet_name for k in ("bag", "backpack", "purse", "mailbag", "wallet")):
            sub_category, vector_subtype = "Crossbody Bag", "crossbody_bag"
            material, pred_style = "Leather", "CASUAL"
        else:
            sub_category, vector_subtype = "Baseball Cap", "cap"
            material, pred_style = "Cotton", "STREETWEAR"

    # Determine pattern modifier & pattern label
    pattern_prefix = ""
    pattern_label = "Solid"
    if has_graphic and pred_cat in ("TOP", "OUTERWEAR"):
        pattern_prefix = "Graphic"
        pattern_label = "Graphic"
    elif has_stripes and pred_cat in ("BOTTOM", "TOP", "OUTERWEAR"):
        pattern_prefix = "Striped"
        pattern_label = "Striped"
    elif len(clusters) > 1 and clusters[1].proportion >= 0.28 and clusters[0].color_name != clusters[1].color_name:
        pattern_label = "Two-Tone"

    # Construct suggestedName as f"{pattern_prefix} {dom_color} {sub_category}".strip() avoiding duplicate words
    clean_sub = sub_category
    if pattern_prefix and clean_sub.lower().startswith(pattern_prefix.lower() + " "):
        clean_sub = clean_sub[len(pattern_prefix) :].strip()

    if pattern_prefix:
        suggested_name = f"{pattern_prefix} {dom_color} {clean_sub}".strip()
    else:
        suggested_name = f"{dom_color} {clean_sub}".strip()

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
    """Core StyleSense v5.0 garment analysis pipeline:
    STEP 1: Background removal (remove.bg multi-key rotation -> local rembg u2netp fallback).
    STEP 2: Fine-tuned Epoch 13 ResNet-50 forward pass + Auxiliary ImageNet-1K V2 fine-grained prior pass.
    STEP 3: Calibrated CIELAB K-Means++ on eroded white-composited interior foreground pixels.
    STEP 4: Zero-retraining OOD Non-Wearable Gate, TOP vs. OUTERWEAR Calibrator, and 32-Subtype + Pattern Classifier.
    STEP 5: Free-Tier Studio Beautify Mode (Hanger eraser, Principal-Axis deskewing, L* de-wrinkling/CLAHE, drop shadow).
    """
    full_skin_ratio, center_skin_ratio = estimate_skin_exposure_ratio(image)

    # Moderate NSFW / skin-dominant images
    if center_skin_ratio > 0.30 or full_skin_ratio > 0.45:
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
            cutoutDataUri=None,
            beautifiedDataUri=None,
            is_safe_garment=False,
            moderation_reason="Inappropriate or non-clothing image detected. Please upload a clear photo of a clothing item or wearable accessory.",
        )

    transforms_to_use = EVAL_TRANSFORMS if (IS_FINETUNED_HEAD or WEIGHTS is None or EVAL_TRANSFORMS is not None) else WEIGHTS.transforms()
    rgb_image = image.convert("RGB")

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 1: Background removal (remove.bg multi-key rotation -> pure rembg u2netp fallback)
    # ─────────────────────────────────────────────────────────────────────────
    cutout_pil, fg_mask, cutout_data_uri, bg_source = extract_garment_cutout(image, force_rembg=force_rembg)

    fg_coverage = float(np.mean(fg_mask)) if (fg_mask is not None and fg_mask.size > 0) else 0.0
    bbox_aspect_ratio = 1.0

    # Composite RGBA cutout onto clean neutral studio background (RGB(245, 245, 245))
    # cropped to the garment's bounding box with 12% padding
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

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 2: Fast ResNet-50 forward pass + Auxiliary ImageNet-1K V2 fine-grained pass
    # ─────────────────────────────────────────────────────────────────────────
    aux_probs_np: Optional[np.ndarray] = None
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

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 3: Calibrated CIELAB K-Means++ on white-composited eroded interior pixels
    # ─────────────────────────────────────────────────────────────────────────
    dom_color, color_hex, sec_color, sec_color_hex, color_conf, clusters = extract_color_palette_kmeans(
        cutout_pil, fg_mask=fg_mask, k=2
    )

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 4: OOD Non-Wearable Gate, TOP vs. OUTERWEAR Calibrator & 32-Subtype Classifier
    # ─────────────────────────────────────────────────────────────────────────
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

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 5: Free-Tier Studio Beautify Mode (<25ms, 0 MB extra RAM)
    # ─────────────────────────────────────────────────────────────────────────
    dom_l_star = float(clusters[0].lab[0]) if clusters else 50.0
    try:
        beautified_data_uri = create_studio_beautified_cutout(cutout_pil, dom_l_star=dom_l_star)
    except Exception as e:
        logger.warning(f"Studio beautify fallback to cutoutDataUri: {e}")
        beautified_data_uri = cutout_data_uri

    # Terminal Log: clear log line on every analyze call
    print(
        f"[ML-ANALYZE] checkpoint_loaded={IS_FINETUNED_HEAD} | pred_cat={pred_cat} (conf={calibrated_conf:.4f}, sub={sub_category}, vec={vector_subtype}, pattern={pattern_label}) | remove_bg_source={bg_source} | fg_cov={fg_coverage:.3f} | color={dom_color} ({color_hex})",
        flush=True,
    )

    return Prediction(
        category=pred_cat,
        subCategory=sub_category,
        suggestedName=suggested_name,
        suggestedBrand=None,  # No fake brands
        layerRole=layer_role,
        vector_subtype=vector_subtype,
        color=dom_color,
        primary_color=dom_color,
        colorHex=color_hex,
        secondary_color=sec_color,
        secondary_color_hex=sec_color_hex,
        color_confidence=color_conf,
        pattern=pattern_label,
        palette=clusters,
        style=pred_style,
        occasion=occasion,
        material=material,
        confidence=round(calibrated_conf, 4),
        class_probabilities=class_probabilities,
        cutoutDataUri=cutout_data_uri,
        beautifiedDataUri=beautified_data_uri,
        is_safe_garment=pred_cat is not None or calibrated_conf >= CONFIDENCE_THRESHOLD,
        moderation_reason=moderation_reason,
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    global MODEL, AUX_IMAGENET_MODEL, IS_FINETUNED_HEAD, REMBG_SESSION, LOADED_CHECKPOINT_PATH

    # Constrain torch thread count for low CPU usage & predictable latency
    if TORCH_AVAILABLE and torch is not None:
        try:
            torch.set_num_threads(2)
        except Exception as e:
            logger.warning(f"Could not set torch num threads: {e}")

    keys = get_remove_bg_api_keys()
    force_rembg_env = os.getenv("FORCE_REMBG", "false").strip().lower() in ("true", "1", "yes")
    logger.info(f"remove.bg API Key(s) loaded: {len(keys)} key(s) | FORCE_REMBG={force_rembg_env}")

    # Initialize and pre-warm local rembg session ("u2netp") for fast sub-second fallback
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

    # Load Epoch 13 ResNet-50 Checkpoint + Auxiliary ImageNet-1K V2 Calibrator
    if TORCH_AVAILABLE and resnet50 is not None:
        try:
            AUX_IMAGENET_MODEL = resnet50(weights=WEIGHTS).eval()
            logger.info("Loaded auxiliary ImageNet-1K V2 ResNet-50 calibrator for 32-subtype & OOD detection.")
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

        # Pre-warm MODEL and AUX_IMAGENET_MODEL so first user request never times out
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


app = FastAPI(title="StyleSense ML & Hybrid Recommendation Service", version="5.0.0", lifespan=lifespan)

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
    force_rembg_env = os.getenv("FORCE_REMBG", "false").strip().lower() in ("true", "1", "yes")
    return {
        "status": "ok",
        "version": "5.0.0",
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
        "studio_beautify_enabled": True,
        "subtypes_count": 32,
        "ood_non_wearable_gate_enabled": True,
        "taxonomy": CATEGORIES_LIST,
        "hybrid_engine": "0.55_CB_0.45_CF",
        "ai_moderation_enabled": True,
        "system_catalog_size": len(SYSTEM_DATASET_CATALOG),
        "mel_mascot_commentary_enabled": True,
        "gender_isolated_cf": True,
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
) -> Tuple[float, float, float, str, List[str]]:
    """Calculates S_cb, S_cf, and S_hybrid = round(0.55 * S_cb + 0.45 * S_cf) with Gender-Isolation and zero wear penalty."""
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

    # 1. Content-Based Scoring (S_cb)
    s_cb = 55.0
    reasons: List[str] = []

    # Style consistency (+18)
    styles = [it.style for it in items if it.style]
    if len(styles) > 1 and len(set(styles)) == 1:
        s_cb += 18.0
        reasons.append(f"Consistent {styles[0].title()} style silhouette (+18)")

    # Occasion match (+15)
    if any(it.occasion.lower() == target_occasion.lower() for it in items):
        s_cb += 15.0
        reasons.append(f"Suited for {target_occasion} occasion (+15)")

    # CIELAB neutral / color harmony (+10)
    if any(it.color in NEUTRAL_COLORS for it in items):
        s_cb += 10.0
        reasons.append("Balanced color harmony with neutral foundation (+10)")

    # Weather suitability
    has_outerwear = any(it.category == "OUTERWEAR" for it in items)
    if is_rainy_or_cool:
        if has_outerwear:
            s_cb += 8.0
            reasons.append(f"Layered with protective outerwear for {weather_tag}")
        else:
            s_cb -= 6.0
    else:
        if not has_outerwear:
            s_cb += 6.0
            reasons.append(f"Breathable silhouette suited for {weather_tag}")
        else:
            s_cb -= 6.0

    # User Onboarding Preferences:
    # preferred_styles (+15 max)
    if preferred_styles:
        style_bonus = min(sum(5.0 for it in items if it.style in preferred_styles), 15.0)
        s_cb += style_bonus

    # colors (+10 max)
    all_fav_colors = set(preferred_colors or []) | set(favorite_colors or [])
    if all_fav_colors:
        color_bonus = min(sum(4.0 for it in items if it.color in all_fav_colors), 10.0)
        s_cb += color_bonus

    # textures (+9 max)
    if textures:
        tex_set = {t.lower() for t in textures}
        tex_matches = [it for it in items if it.texture and it.texture.lower() in tex_set]
        if tex_matches:
            tex_bonus = min(len(tex_matches) * 3.0, 9.0)
            s_cb += tex_bonus
            reasons.append(f"Features preferred {tex_matches[0].texture.lower()} texture")

    # fit preference (+6)
    if fit_preference:
        fit_norm = fit_preference.lower()
        if any(it.fit and it.fit.lower() == fit_norm for it in items):
            s_cb += 6.0
            reasons.append(f"Matches your {fit_preference.lower()} fit preference")

    # common occasions (+5)
    if common_occasions:
        occ_set = {o.lower() for o in common_occasions}
        if any(it.occasion.lower() in occ_set for it in items):
            s_cb += 5.0

    # Disliked penalty (-30)
    if any(it.is_disliked for it in items):
        s_cb -= 30.0
        reasons.append("Contains item marked as disliked (-30)")

    # (7-day wear recency penalty P_worn = -18 completely removed!)
    s_cb = float(np.clip(s_cb, 0.0, 100.0))

    # 2. Gender-Isolated Collaborative Filtering (S_cf)
    norm_gender = (user_gender or "unisex").strip().lower()
    if norm_gender in ("male", "female"):
        isolated_signals = [
            sig for sig in community_signals
            if (not sig.author_gender or sig.author_gender.strip().lower() == norm_gender)
            and (not sig.rater_gender or sig.rater_gender.strip().lower() == norm_gender)
        ]
    else:
        isolated_signals = community_signals

    item_styles = {it.style for it in items}
    item_colors = {it.color for it in items}
    matching_signals = [
        sig for sig in isolated_signals
        if sig.style in item_styles or sig.dominant_color in item_colors
    ]

    if matching_signals:
        num = sum(sig.neighbor_similarity * sig.rating for sig in matching_signals)
        den = sum(abs(sig.neighbor_similarity) for sig in matching_signals)
        pred_rating = (num / den) if den > 1e-6 else 4.0
        s_cf = float(np.clip((pred_rating - 1.0) / 4.0 * 100.0, 0.0, 100.0))
        gender_label = norm_gender.capitalize() if norm_gender in ("male", "female") else "Community"
        reasons.append(f"Rated {pred_rating:.1f}/5.0 by verified {gender_label} Community Feed profiles")
    else:
        fav_boost = sum(8.0 for it in items if it.is_favorite)
        s_cf = float(np.clip(72.0 + fav_boost, 0.0, 100.0))

    # 3. Weighted Hybrid Score
    s_hyb = round(alpha * s_cb + (1.0 - alpha) * s_cf, 1)

    return round(s_cb, 1), round(s_cf, 1), s_hyb, weather_tag, reasons


@app.post("/recommend", response_model=List[ScoredOutfitRecommendation])
def recommend_outfits(req: HybridRecommendationRequest) -> List[ScoredOutfitRecommendation]:
    """Generate Top-3 outfits via Weighted Hybrid Filtering (0.55 Content-Based + 0.45 Collaborative).

    Supports:
    - 2D Mannequin Visualizer & System Dataset Catalog fallback (when wardrobe is empty or source_mode='system_catalog')
    - Gender-Isolated Collaborative Filtering (male-to-male & female-to-female only)
    - Zero 7-day wear penalty & zero laundry filter
    - Mel Chameleon Mascot commentary
    """
    eligible_wardrobe = [item for item in req.wardrobe if not item.is_disliked]
    w_tops = [i for i in eligible_wardrobe if i.category == "TOP"]
    w_bottoms = [i for i in eligible_wardrobe if i.category == "BOTTOM"]
    w_shoes = [i for i in eligible_wardrobe if i.category == "SHOES"]
    has_complete_wardrobe = bool(w_tops and w_bottoms and w_shoes)

    source_mode_req = (req.source_mode or "wardrobe").lower()

    if source_mode_req == "wardrobe":
        # Strict My Wardrobe mode: NEVER silently substitute or inject SYSTEM_DATASET_CATALOG!
        if not has_complete_wardrobe:
            # If user's uploaded wardrobe is empty or lacks at least 1 TOP, 1 BOTTOM, and 1 SHOES,
            # return an empty list [] so mobile app displays "Add Wardrobe First or Try Mix & Match" card.
            return []
        pool = eligible_wardrobe
        used_catalog = False
        actual_source_mode = "wardrobe"
    else:
        # Mix & Match mode ("mix" or "system_catalog"):
        # Combine user's eligible_wardrobe with SYSTEM_DATASET_CATALOG (from DeepFashion & Re-Polyvore)
        # so the engine blends user's real wardrobe items with system dataset items (or uses catalog if empty).
        catalog_raw = get_system_catalog_items(req.gender or "unisex")
        catalog_items = [WardrobeItemInput(**c) for c in catalog_raw]
        pool = eligible_wardrobe + catalog_items
        used_catalog = True
        actual_source_mode = "mix"

    tops = [i for i in pool if i.category == "TOP"]
    bottoms = [i for i in pool if i.category == "BOTTOM"]
    shoes = [i for i in pool if i.category == "SHOES"]
    outerwear = [i for i in pool if i.category == "OUTERWEAR"]

    is_rainy_or_cool = (
        req.weather.temperature_c < 24.0
        or req.weather.precipitation_mm > 0.5
        or any(w in req.weather.condition.lower() for w in ("rain", "storm", "drizzle", "thunder", "cool", "cold"))
    )

    candidates: List[ScoredOutfitRecommendation] = []
    for top in tops:
        for bottom in bottoms:
            for shoe in shoes:
                items = [top, bottom, shoe]
                if is_rainy_or_cool and outerwear:
                    matching_out = next((o for o in outerwear if o.style == top.style), outerwear[0])
                    items.append(matching_out)
                elif req.target_occasion.lower() in ("formal", "office") and outerwear:
                    blazer_out = next((o for o in outerwear if o.vector_subtype == "blazer"), None)
                    if blazer_out:
                        items.append(blazer_out)

                s_cb, s_cf, s_hyb, weather_tag, reasons = score_outfit_combination(
                    items=items,
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

                mel_commentary = generate_mel_recommendation_commentary(
                    items=items,
                    weather_tag=weather_tag,
                    target_occasion=req.target_occasion,
                    preferred_styles=req.preferred_styles,
                    fit_preference=req.fit_preference,
                )

                candidates.append(ScoredOutfitRecommendation(
                    item_ids=[it.id for it in items],
                    items=items,
                    content_score=s_cb,
                    collaborative_score=s_cf,
                    hybrid_score=s_hyb,
                    weather_tag=weather_tag,
                    reasons=reasons[:3],
                    mel_commentary=mel_commentary,
                    used_system_catalog=used_catalog,
                    source_mode=actual_source_mode,
                ))

    candidates.sort(key=lambda r: r.hybrid_score, reverse=True)

    # Ensure diverse Top-3 recommendations
    selected: List[ScoredOutfitRecommendation] = []
    seen_tops = set()
    for cand in candidates:
        top_id = next((it.id for it in cand.items if it.category == "TOP"), None)
        if top_id not in seen_tops or len(seen_tops) >= len(tops):
            selected.append(cand)
            if top_id:
                seen_tops.add(top_id)
        if len(selected) == 3:
            break

    if len(selected) < 3:
        for cand in candidates:
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

    # Determine swapped item
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
