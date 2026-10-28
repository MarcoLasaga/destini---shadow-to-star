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
    gemini_api_key: Optional[str] = None


class BeautifyResponse(BaseModel):
    beautifiedDataUri: str
    method: str


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


class TryOn2DRequest(BaseModel):
    user_photo_base64: str
    items: List[WardrobeItemInput] = Field(default_factory=list)
    skin_tone_hex: Optional[str] = None
    gemini_api_key: Optional[str] = None


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

    # Step A — Erase Coat Hanger Hook FIRST inside extract_garment_cutout
    # Scan the top 16% of the foreground alpha mask; if row_w < 0.28 * max_width, set alpha = 0
    ys_h, xs_h = np.where(alpha > 40)
    if len(ys_h) > 20 and len(xs_h) > 20:
        b_top, b_bot = int(np.min(ys_h)), int(np.max(ys_h))
        b_left, b_right = int(np.min(xs_h)), int(np.max(xs_h))
        b_h = max(b_bot - b_top, 1)
        b_w = max(b_right - b_left, 1)
        top_strip_end = b_top + max(1, int(0.16 * b_h))
        chest_widths = []
        for ry in range(top_strip_end, b_bot + 1):
            r_xs = np.where(alpha[ry, b_left : b_right + 1] > 64)[0]
            if len(r_xs) > 0:
                chest_widths.append(int(r_xs[-1] - r_xs[0] + 1))
        max_chest_w = float(max(chest_widths)) if chest_widths else float(b_w)
        for ry in range(b_top, top_strip_end):
            r_xs = np.where(alpha[ry, b_left : b_right + 1] > 40)[0]
            if len(r_xs) == 0:
                continue
            row_w = float(r_xs[-1] - r_xs[0] + 1)
            if row_w < 0.28 * max_chest_w:
                alpha[ry, b_left : b_right + 1] = 0

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
    if not sec_color or sec_color == dom_color or sec_prop < 0.10 or sec_lab is None:
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
    """Extract dominant colors and CIELAB palette using ml-service/kmeans_color.py with strict K = 2.

    Upgrades in v6.5:
    1. Strictly locks K = 2 (Silhouette = 0.6439, DBI = 0.5946).
    2. Eliminates specular window glare on dark garments (e.g., shiny black quarter-zip in image_9a9d28.jpg
       that previously turned 'Gray #667475') by checking 25th-percentile lightness L*_p25 and filtering glare outliers.
    3. Eliminates muddy shadow hexes on white garments (e.g., '#BCC4BB' in image_9a9d20.jpg) via
       kmeans_color.lab_to_display_hex().
    4. Preserves chromatic graphic prints & shoe accents (e.g., Green print on Black Tee in image_9a9d41.jpg,
       Yellow accents on Running Shoes in image_9a9d08.jpg) in Cluster #2 (secondary_color + secondary_color_hex).
    """
    k = 2  # Strictly lock K = 2 per thesis evaluation
    cutout_rgba = cutout.convert("RGBA")
    rgba_raw = np.asarray(cutout_rgba, dtype=np.uint8)
    alpha = rgba_raw[:, :, 3]

    # 1. Composite onto pure white background (255, 255, 255, 255) for RGB reading
    white_canvas = Image.new("RGBA", cutout_rgba.size, (255, 255, 255, 255))
    comp_rgb = np.asarray(Image.alpha_composite(white_canvas, cutout_rgba).convert("RGB"), dtype=np.uint8)

    # 2. Strict interior foreground mask (alpha > 215) eroded by 2 iterations so zero boundary halo pixels enter K=2
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

    # 3. Illumination & Specular Glare Outlier Filtering before K = 2 fit:
    if len(fg_lab) > 20:
        l_vals = fg_lab[:, 0]
        c_vals = np.hypot(fg_lab[:, 1], fg_lab[:, 2])
        med_l = float(np.median(l_vals))
        p25_l = float(np.percentile(l_vals, 25))
        p75_c = float(np.percentile(c_vals, 75))

        # Case A: Light-colored garment (median L* > 62.0) -> strip deep fold/collar shadows (L* < 38.0 and C* < 12.0)
        # so white hoodies/shirts never get dragged down to muddy #BCC4BB
        if med_l > 62.0:
            clean_light = fg_lab[(l_vals >= 38.0) | (c_vals >= 15.0)]
            if len(clean_light) >= 15:
                fg_lab = clean_light
        # Case B: Dark achromatic garment (p25_l < 28.0 and med_l < 50.0 and p75_c < 11.0) -> strip harsh window specular glare
        # (L* > 56.0 and C* < 10.0) so shiny black rashguards/jackets (image_9a9d28.jpg) stay 'Black' instead of 'Gray'
        elif p25_l < 28.0 and med_l < 50.0 and p75_c < 11.0:
            non_glare = fg_lab[(l_vals <= 48.0) | (c_vals >= 14.0)]
            if len(non_glare) >= 15:
                fg_lab = non_glare

    # 4. Fit Chromatic-Aware KMeansCIELAB with strictly K = 2
    km = kmeans_color.KMeansCIELAB(n_clusters=2, max_iter=max_iter, tol=tol, random_state=random_state)
    km.fit(fg_lab)

    centers = km.cluster_centers_
    labels = km.labels_
    counts = np.bincount(labels, minlength=2)
    weights = counts / max(1, len(labels))
    sorted_order = np.argsort(-weights)

    # 5. If both clusters are low-chroma achromatic on a dark garment where Cluster 0 is glare-gray and Cluster 1 is true Black,
    # promote the true Black base when p25_l < 27.0
    c0_lab = centers[sorted_order[0]]
    c1_lab = centers[sorted_order[1]]
    n0 = kmeans_color.lab_to_color_name(c0_lab)
    n1 = kmeans_color.lab_to_color_name(c1_lab)
    if (
        n0 == "Gray"
        and n1 == "Black"
        and weights[sorted_order[1]] >= 0.28
        and float(np.hypot(c0_lab[1], c0_lab[2])) < 9.0
        and float(c0_lab[0]) < 52.0
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
    """Tier 2 Local OpenCV Piece-Wise Contour Symmetrization + Frequency-Separated Steam-Ironing:
    1. Hanger Eraser: Strips remaining top hanger hook pixels (top 16% where row width < 28% of torso width).
    2. Principal-Axis Rotation & Waistband/Shoulder Leveling (-18 deg to +18 deg).
    3. Row-by-Row Horizontal Midline Straightening (cv2.remap):
       - TOP / OUTERWEAR: Centers each horizontal row around x = 200 with vertical moving-average smoothing.
       - BOTTOM (Pants, Jeans, Trousers, Cargo Pants, Shorts): Centers upper hip/waistband around x = 200 and
         symmetrizes left/right split legs onto balanced target axes x_target_L(y) and x_target_R(y) with equalized leg widths.
    4. Frequency-Separated CIELAB L* Steam-Ironing:
       L_ironed = 0.65 * L_low + 0.35 * L_bilat + 0.90 * L_detail inside eroded interior mask (preserving seam stitching).
    5. Soft Studio Drop-Shadow on a 400x400 WebP canvas.
    """
    rgba = np.asarray(cutout_rgba.convert("RGBA"), dtype=np.uint8).copy()
    alpha = rgba[:, :, 3].copy()

    ys, xs = np.where(alpha > 40)
    if len(ys) > 20 and len(xs) > 20:
        top, bottom = int(np.min(ys)), int(np.max(ys))
        left, right = int(np.min(xs)), int(np.max(xs))
        bh = max(bottom - top, 1)
        bw = max(right - left, 1)

        # 1. Automatic Top Hanger & Hook Eraser (top 16% of garment bounding box)
        hanger_end_y = top + max(1, int(0.16 * bh))
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
            if row_span < 0.28 * max_torso_width:
                alpha[y, left : right + 1] = 0
            elif dom_l_star > 55.0 and top_strip_lab is not None:
                ry = y - top
                l_row = top_strip_lab[ry, :, 0]
                c_row = np.hypot(top_strip_lab[ry, :, 1], top_strip_lab[ry, :, 2])
                dark_hanger_px = (l_row < 28.0) & (c_row < 14.0)
                alpha[y, left : right + 1][dark_hanger_px] = 0

        rgba[:, :, 3] = alpha

        # 2. Principal-Axis Rotation & Waistband/Shoulder Leveling (-18 to +18 deg)
        if cv2 is not None:
            try:
                m = cv2.moments((alpha > 64).astype(np.uint8))
                if m["m00"] > 50:
                    denom = m["mu02"] - m["mu20"]
                    if abs(denom) > 1e-3:
                        theta_rad = 0.5 * math.atan2(2.0 * m["mu11"], denom)
                        theta_deg = math.degrees(theta_rad)
                        if 1.0 <= abs(theta_deg) <= 18.0:
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

    # Center cropped garment on a 400x400 workspace before row-by-row symmetrization
    stage_pil = Image.fromarray(rgba, mode="RGBA")
    s_bbox = stage_pil.getbbox()
    work_canvas = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    if s_bbox:
        s_crop = stage_pil.crop(s_bbox)
        s_crop.thumbnail((356, 356), Image.Resampling.BILINEAR)
        sox = (400 - s_crop.width) // 2
        soy = (400 - s_crop.height) // 2
        work_canvas.paste(s_crop, (sox, soy), s_crop)
    else:
        work_canvas = stage_pil.resize((400, 400), Image.Resampling.BILINEAR)

    rgba = np.asarray(work_canvas, dtype=np.uint8).copy()
    alpha = rgba[:, :, 3]

    # 3. Row-by-Row Horizontal Midline Straightening & Split-Leg Symmetrization (cv2.remap)
    if cv2 is not None:
        try:
            ys2, xs2 = np.where(alpha > 40)
            if len(ys2) > 30:
                y_top, y_bot = int(np.min(ys2)), int(np.max(ys2))
                g_h = max(1, y_bot - y_top)
                cat_up = (category or "").upper()
                sub_low = (sub_category or "").lower()
                is_bottom = cat_up == "BOTTOM" or any(
                    w in sub_low for w in ("pant", "jean", "trouser", "cargo", "short", "jogger")
                )

                grid_y, grid_x = np.meshgrid(
                    np.arange(400, dtype=np.float32),
                    np.arange(400, dtype=np.float32),
                    indexing="ij",
                )
                map_x = grid_x.copy()
                map_y = grid_y.copy()

                row_shifts = np.zeros(400, dtype=np.float32)
                for y in range(y_top, y_bot + 1):
                    r_xs = np.where(alpha[y, :] > 40)[0]
                    if len(r_xs) >= 4:
                        x_c = 0.5 * float(r_xs[0] + r_xs[-1])
                        row_shifts[y] = x_c - 200.0

                # Smooth row_shifts with a vertical moving average window (size 21)
                kernel_1d = np.ones(21, dtype=np.float32) / 21.0
                smooth_shifts = np.convolve(row_shifts, kernel_1d, mode="same")

                split_start_y = y_top + int(0.35 * g_h)
                for y in range(y_top, y_bot + 1):
                    r_xs = np.where(alpha[y, :] > 40)[0]
                    if len(r_xs) < 6:
                        continue
                    diffs = np.diff(r_xs)
                    max_gap_idx = int(np.argmax(diffs)) if len(diffs) > 0 else -1
                    max_gap = int(diffs[max_gap_idx]) if max_gap_idx >= 0 else 0

                    if is_bottom and y >= split_start_y and max_gap >= 6:
                        xs_l = r_xs[: max_gap_idx + 1]
                        xs_r = r_xs[max_gap_idx + 1 :]
                        if len(xs_l) >= 4 and len(xs_r) >= 4:
                            x_cl = 0.5 * float(xs_l[0] + xs_l[-1])
                            x_cr = 0.5 * float(xs_r[0] + xs_r[-1])
                            w_l = max(6.0, float(xs_l[-1] - xs_l[0]))
                            w_r = max(6.0, float(xs_r[-1] - xs_r[0]))
                            sym_offset = max(18.0, 0.5 * ((200.0 - x_cl) + (x_cr - 200.0)))
                            w_sym = 0.5 * (w_l + w_r)
                            x_target_l = 200.0 - sym_offset
                            x_target_r = 200.0 + sym_offset

                            row_x = grid_x[y, :]
                            left_side = row_x < 200.0
                            map_x[y, left_side] = (row_x[left_side] - x_target_l) * (w_l / w_sym) + x_cl
                            map_x[y, ~left_side] = (row_x[~left_side] - x_target_r) * (w_r / w_sym) + x_cr
                            continue

                    # Single torso / upper-hip row centering around x = 200
                    map_x[y, :] = grid_x[y, :] + smooth_shifts[y] * 0.85

                rgba = cv2.remap(
                    rgba,
                    map_x,
                    map_y,
                    interpolation=cv2.INTER_LINEAR,
                    borderMode=cv2.BORDER_CONSTANT,
                    borderValue=(0, 0, 0, 0),
                )
                alpha = rgba[:, :, 3]
        except Exception as e:
            logger.debug(f"Row midline straightening skipped: {e}")

    # 4. Frequency-Separated CIELAB L* Steam-Ironing (Wrinkle Removal Without Losing Seam Stitching)
    if cv2 is not None:
        try:
            rgb_chan = rgba[:, :, :3]
            lab_cv = cv2.cvtColor(rgb_chan, cv2.COLOR_RGB2LAB)
            l_chan, a_chan, b_chan = cv2.split(lab_cv)

            l_low = cv2.GaussianBlur(l_chan, (31, 31), 0)
            l_bilat = cv2.bilateralFilter(l_chan, d=9, sigmaColor=35, sigmaSpace=35)
            l_detail = l_chan.astype(np.float32) - l_bilat.astype(np.float32)
            l_ironed = np.clip(
                0.65 * l_low.astype(np.float32) + 0.35 * l_bilat.astype(np.float32) + 0.90 * l_detail,
                0.0,
                255.0,
            ).astype(np.uint8)

            erode_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            interior_fg = cv2.erode((alpha > 180).astype(np.uint8), erode_k, iterations=1) > 0
            l_out = np.where(interior_fg, l_ironed, l_chan).astype(np.uint8)
            lab_merged = cv2.merge((l_out, a_chan, b_chan))
            rgba[:, :, :3] = cv2.cvtColor(lab_merged, cv2.COLOR_LAB2RGB)
        except Exception as e:
            logger.debug(f"Frequency-separated L* steam-ironing skipped: {e}")

    # 5. Soft Studio Drop-Shadow & Crisp Silhouette Edge on 400x400 WebP canvas
    clean_pil = Image.fromarray(rgba, mode="RGBA")
    bbox = clean_pil.getbbox()
    canvas = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    if bbox:
        cropped = clean_pil.crop(bbox)
        cropped.thumbnail((360, 360), Image.Resampling.BILINEAR)
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


def create_studio_beautified_cutout(
    cutout_rgba: Image.Image,
    dom_l_star: float = 50.0,
    category: Optional[str] = None,
    sub_category: Optional[str] = None,
) -> str:
    """Wrapper invoking the geometric + frequency-separated studio beautifier."""
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
    """5-Class NSFWJS-Equivalent Image Safety Gate (Drawing, Hentai, Neutral, Porn, Sexy).

    - Rejects Drawing > 0.40 or Hentai > 0.15 with:
      'Upload blocked (Drawing/Anime detected): Please upload a real photograph of a physical garment.'
    - Rejects Porn > 0.15 or Sexy > 0.35 with:
      'Upload blocked (NSFW / Excessive Skin Exposure): Image did not pass the 5-class safety check.'
    - Requires Neutral >= 0.50.
    """
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

    # Detect cartoon/line-art ink contours combined with flat quantized color cells
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
    "track_pants": "Cotton",
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
    """Zero-retraining visual calibrator for StyleSense v6.0:
    A) Out-of-Distribution (OOD) Non-Wearable Object Gate (rejects AirPods, phones, mugs, furniture).
    B) Short-Sleeve T-Shirt Detector (is_short_sleeve_tee) & Chest Graphic vs. Zipper/Placket discriminator.
    C) 32 Detailed Subtypes + Accurate Subtype Material Mapping + Visual Pattern Detection.
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
    # Compute foreground silhouette & edge geometry on hanger-cleaned tight crop
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
    is_short_sleeve_tee = False
    leg_gap_ratio = 0.0
    has_graphic = False
    has_stripes = False

    if ch >= 24 and cw >= 24:
        grad_x = np.abs(np.diff(crop_gray, axis=1))
        grad_y = np.abs(np.diff(crop_gray, axis=0))

        # Step C — Distinguish Chest Graphic Print from Zipper/Placket FIRST
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
        chest_color_std = float(np.mean(np.std(chest_rgb, axis=0))) if len(chest_rgb) > 1 else 0.0

        hem_y0, hem_y1 = int(0.74 * ch), max(int(0.74 * ch) + 2, min(ch - 1, int(0.92 * ch)))
        hem_edge = float(0.5 * (np.mean(grad_x[hem_y0:hem_y1, gx0:gx1]) + np.mean(grad_y[hem_y0:hem_y1, gx0:gx1])))

        if (
            std_a > 12.0
            or std_b > 12.0
            or (chest_edge > 13.0 and chest_color_std > 20.0 and chest_edge > 1.30 * max(hem_edge, 4.0))
        ):
            has_graphic = True

        # 1) Center Vertical Zipper/Placket Edge Score (must be a narrow continuous line from collar 0.15*H to hem 0.90*H)
        cy0, cy1 = int(0.15 * ch), max(int(0.15 * ch) + 3, int(0.90 * ch))
        cx0, cx1 = int(0.47 * cw), max(int(0.47 * cw) + 1, min(cw - 1, int(0.53 * cw)))
        lx0, lx1 = int(0.22 * cw), max(int(0.22 * cw) + 1, int(0.42 * cw))
        rx0, rx1 = int(0.58 * cw), max(int(0.58 * cw) + 1, min(cw - 1, int(0.78 * cw)))

        center_strip_edge = float(np.mean(grad_x[cy0:cy1, cx0:cx1])) if cx1 > cx0 else 0.0
        hem_placket_edge = float(np.mean(grad_x[hem_y0:hem_y1, cx0:cx1])) if cx1 > cx0 else 0.0
        left_panel_edge = float(np.mean(grad_x[cy0:cy1, lx0:lx1])) if lx1 > lx0 else 0.0
        right_panel_edge = float(np.mean(grad_x[cy0:cy1, rx0:rx1])) if rx1 > rx0 else 0.0
        panel_edge = 0.5 * (left_panel_edge + right_panel_edge)
        # Only count as a continuous zipper/placket if the vertical seam continues through the bottom hem!
        if center_strip_edge > 4.0 and hem_placket_edge > 3.5 and not (has_graphic and hem_placket_edge < 5.0):
            center_placket_score = float(center_strip_edge / max(panel_edge, 2.5))

        # 2) Top Hood / High-Collar Projection (y in [0.0, 0.16*H], x in [0.30*W, 0.70*W])
        # A real hood rises above the shoulders as a dome in the top 10% of the bounding box while the outer shoulder corners (x < 0.24*W, x > 0.76*W) are empty.
        hy1 = max(2, int(0.16 * ch))
        hx0, hx1 = int(0.30 * cw), max(int(0.30 * cw) + 2, int(0.70 * cw))
        top_center_cov = float(np.mean(crop_alpha[0:hy1, hx0:hx1] > 128))
        top_left_cov = float(np.mean(crop_alpha[0:hy1, 0 : max(1, int(0.24 * cw))] > 128))
        top_right_cov = float(np.mean(crop_alpha[0:hy1, min(cw - 1, int(0.76 * cw)) : cw] > 128))
        corner_cov = 0.5 * (top_left_cov + top_right_cov)
        top6_cov = float(np.mean(crop_alpha[0 : max(1, int(0.06 * ch)), int(0.35 * cw) : int(0.65 * cw)] > 128))
        # A T-shirt crewneck or track-jacket stand collar has wide shoulders right below the top edge; only score a hood when the top dome is tall & narrow
        shoulder_band_y = crop_alpha[int(0.06 * ch) : int(0.18 * ch), :] > 128
        shoulder_spread = float(np.mean(shoulder_band_y)) if shoulder_band_y.size > 0 else 0.0
        if top6_cov > 0.52 and corner_cov < 0.14 and shoulder_spread < 0.46 and not has_graphic:
            hood_score = top_center_cov * max(0.0, 1.0 - 1.1 * corner_cov)

        # 3) Step B — Short-Sleeve T-Shirt Detector (is_short_sleeve_tee)
        # Compare horizontal row span in the upper sleeve band (0.18..0.48*ch) vs lower torso band (0.58..0.88*ch),
        # plus outer 12% wrist columns (x < 0.12*cw and x > 0.88*cw) in the lower half!
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

        # Also check if a vertical gap exists between sleeve cuff and torso in y in [0.42*ch, 0.58*ch]
        if upper_sleeve_cov > 0.18 and (
            (max_upper_span >= 1.14 * max(mean_lower_span, 1.0) and lower_outer_cov < 0.12)
            or lower_outer_cov < 0.045
            or (has_graphic and bbox_aspect_ratio >= 0.72 and lower_outer_cov < 0.16)
        ):
            is_short_sleeve_tee = True
            short_sleeve_score = 1.0

        # 4) Lower-center leg separation gap for trousers vs. skirts
        leg_strip = crop_alpha[int(0.55 * ch) : int(0.92 * ch), int(0.44 * cw) : max(int(0.44 * cw) + 1, int(0.56 * cw))]
        if leg_strip.size > 0:
            leg_gap_ratio = float(np.mean(leg_strip < 40))

        # 5) Visual Pattern: Side-seam stripe detection (x in [0.02*W, 0.20*W] or [0.80*W, 0.98*W])
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
        # Require distinct secondary color name for side stripes so shiny fabric folds on a solid black top never trigger 'Striped'!
        has_distinct_sec_color = (len(clusters) > 1 and clusters[1].color_name != clusters[0].color_name and sec_prop >= 0.10)
        if has_distinct_sec_color and side_edge > 8.5 and side_edge > 1.32 * max(mid_edge, 3.5):
            has_stripes = True

    if "graphic" in fn:
        has_graphic = True
    if "stripe" in fn or "striped" in fn:
        has_stripes = True

    # ─────────────────────────────────────────────────────────────────────────
    # B) Resolve TOP vs. OUTERWEAR Confusion (Hard Rule for is_short_sleeve_tee & Graphic Tee)
    # ─────────────────────────────────────────────────────────────────────────
    prob_top = float(class_probabilities.get("TOP", 0.0))
    prob_outer = float(class_probabilities.get("OUTERWEAR", 0.0))
    sorted_cats = sorted(class_probabilities.items(), key=lambda kv: kv[1], reverse=True)
    top2_set = {sorted_cats[0][0], sorted_cats[1][0]} if len(sorted_cats) >= 2 else set()

    # Hard Rule: Whenever is_short_sleeve_tee == True on an upper-body garment, lock pred_cat = "TOP"!
    if is_short_sleeve_tee and (
        pred_cat in ("TOP", "OUTERWEAR")
        or top2_set == {"TOP", "OUTERWEAR"}
        or (pred_cat is None and (prob_top + prob_outer) >= 0.65)
    ):
        if not any(w in fn for w in ("hoodie", "jacket", "blazer", "cardigan", "coat", "windbreaker")):
            pred_cat = "TOP"
            raw_conf = max(raw_conf, round(min(0.96, prob_top + prob_outer * 0.85), 4), CONFIDENCE_THRESHOLD + 0.10)
    elif (
        top2_set == {"TOP", "OUTERWEAR"}
        or (pred_cat in ("TOP", "OUTERWEAR") and abs(prob_top - prob_outer) < 0.28)
        or (pred_cat is None and max(prob_top, prob_outer) >= 0.42 and (prob_top + prob_outer) >= 0.72)
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
    # C) 32 Detailed Subtypes + Accurate Subtype Material Mapping + Pattern Detection
    # ─────────────────────────────────────────────────────────────────────────
    _, material, pred_style, occasion, layer_role = CATEGORY_DEFAULT_METADATA[pred_cat]
    sub_category = "T-Shirt"
    vector_subtype = "tshirt"
    is_two_tone = (
        len(clusters) > 1
        and clusters[1].proportion >= 0.20
        and clusters[0].color_name != clusters[1].color_name
    )

    if pred_cat == "TOP":
        if is_short_sleeve_tee and has_graphic and "crop" not in fn and "polo" not in fn:
            sub_category, vector_subtype = "Graphic T-Shirt", "tshirt"
            pred_style = "STREETWEAR"
        elif "crop" in fn or (bbox_aspect_ratio > 1.22 and short_sleeve_score > 0.0 and not has_graphic):
            sub_category, vector_subtype = "Crop Top", "crop_top"
        elif "tank" in fn or "sleeveless" in fn or any(k in top_imagenet_name for k in ("maillot", "bikini", "brassiere")):
            sub_category, vector_subtype = "Tank Top", "tank_top"
        elif "polo" in fn or (center_placket_score > 1.35 and short_sleeve_score > 0.0 and hood_score > 0.25 and not has_graphic):
            sub_category, vector_subtype = "Polo Shirt", "polo"
            pred_style = "CLASSIC"
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
        # Note: Do NOT trigger Overcoat/Trench from bbox_aspect_ratio < 0.64 (fixes image_9a9d28.jpg)!
        if ("zip" in fn and ("hood" in fn or "sweat" in fn)) or (hood_score > 0.40 and center_placket_score > 1.42):
            sub_category, vector_subtype = "Zip-Up Hoodie", "zip_hoodie"
            pred_style = "STREETWEAR"
        elif "track" in fn or (is_two_tone and hood_score <= 0.38) or (has_stripes and center_placket_score > 1.20):
            sub_category, vector_subtype = "Track Jacket", "windbreaker"
            pred_style = "SPORTY"
        elif "windbreaker" in fn or "anorak" in fn or (center_placket_score > 1.32 and hood_score <= 0.36 and not has_graphic):
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
        elif "track" in fn or "jogger" in fn or "sweatpant" in fn or has_stripes:
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
        # Note: Do NOT trigger Combat Boots from bbox_aspect_ratio < 0.85 (fixes side-by-side Running Shoes in image_9a9d08.jpg)!
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
        if "watch" in fn or any(k in top_imagenet_name for k in ("watch", "stopwatch", "digital watch", "analog clock")):
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

    # Step D — Accurate Material Mapping by Subtype (never Nylon for shoes or hoodies/tees!)
    material = SUBTYPE_MATERIAL_MAP.get(vector_subtype, material)
    if sub_category == "Blouse":
        material = "Silk"
    elif sub_category == "Track Jacket":
        material = "Polyester"

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

    # Construct suggestedName:
    # - When sub_category == "Graphic T-Shirt", format as f"{dom_color} Graphic T-Shirt" (e.g., "Black Graphic T-Shirt")
    # - When pattern_prefix is present on other subtypes (e.g., "Pullover Hoodie" or "Track Pants"), format as f"{pattern_prefix} {dom_color} {sub_category}"
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
    """Core StyleSense v6.0 garment analysis pipeline:
    STEP 1: 5-Class NSFWJS-Equivalent Image Safety Gate (Drawing, Hentai, Neutral, Porn, Sexy).
    STEP 2: Background removal + Step A Coat Hanger Hook Eraser (top 16% strip).
    STEP 3: Fine-tuned Epoch 13 ResNet-50 forward pass + Auxiliary ImageNet-1K V2 fine-grained prior pass.
    STEP 4: Strict K = 2 CIELAB K-Means++ on white-composited eroded interior foreground pixels.
    STEP 5: OOD Non-Wearable Gate, Short-Sleeve Tee Hard Rule, Chest Graphic vs. Zipper/Placket, and 32-Subtype Classifier.
    """
    transforms_to_use = EVAL_TRANSFORMS if (IS_FINETUNED_HEAD or WEIGHTS is None or EVAL_TRANSFORMS is not None) else WEIGHTS.transforms()
    rgb_image = image.convert("RGB")

    # Run auxiliary ImageNet pass early if needed for 5-class NSFW safety + OOD / subtype calibration
    aux_probs_np: Optional[np.ndarray] = None
    if AUX_IMAGENET_MODEL is not None and transforms_to_use is not None and torch is not None:
        try:
            with torch.inference_mode():
                t_raw = transforms_to_use(rgb_image).unsqueeze(0)
                aux_probs_np = torch.softmax(AUX_IMAGENET_MODEL(t_raw)[0], dim=0).cpu().numpy()
        except Exception as e:
            logger.debug(f"Initial aux ImageNet pass skipped: {e}")

    # STEP 1: 5-Class NSFWJS-Equivalent Image Safety Check
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

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 2: Background removal + Step A Coat Hanger Hook Eraser
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
    # STEP 3: Fast ResNet-50 forward pass + Auxiliary ImageNet-1K V2 fine-grained pass on clean cutout
    # ─────────────────────────────────────────────────────────────────────────
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
    # STEP 4: Strict K = 2 Calibrated CIELAB K-Means++ on white-composited eroded interior pixels
    # ─────────────────────────────────────────────────────────────────────────
    dom_color, color_hex, sec_color, sec_color_hex, color_conf, clusters = extract_color_palette_kmeans(
        cutout_pil, fg_mask=fg_mask, k=2
    )

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 5: OOD Non-Wearable Gate, Short-Sleeve Tee Hard Rule & 32-Subtype Classifier
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

    # Terminal Log: clear log line on every analyze call including K=2 Secondary Color & Harmony Note
    print(
        f"[ML-ANALYZE] checkpoint_loaded={IS_FINETUNED_HEAD} | pred_cat={pred_cat} (conf={calibrated_conf:.4f}, sub={sub_category}, vec={vector_subtype}, mat={material}, pattern={pattern_label}) | remove_bg_source={bg_source} | fg_cov={fg_coverage:.3f} | K=2 color={dom_color} ({color_hex}, {color_conf*100:.0f}%) + sec={sec_color} ({sec_color_hex})",
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


app = FastAPI(title="StyleSense ML & Hybrid Recommendation Service", version="6.0.0", lifespan=lifespan)

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
        "version": "6.0.0",
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
        "subtypes_count": 32,
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
    """True Acloset-Style On-Demand POST /beautify Endpoint (2-Tier Studio Reconstruction Pipeline):
    Tier 1: Free-Tier Cloud AI Studio Flat-Lay Reconstruction (GEMINI_API_KEY or HF_TOKEN if configured).
    Tier 2: Local OpenCV Piece-Wise Contour Symmetrization + Frequency-Separated CIELAB L* Steam-Ironing.
    """
    raw_b64 = req.image_base64.strip()
    if "," in raw_b64:
        raw_b64 = raw_b64.split(",", 1)[1]
    try:
        cutout_pil = Image.open(BytesIO(base64.b64decode(raw_b64))).convert("RGBA")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid image_base64 for beautify: {e}") from e

    # Tier 1 — Free-Tier Cloud AI Studio Flat-Lay Reconstruction (Google Gemini Free Tier)
    gemini_key = (
        (req.gemini_api_key or "").strip()
        or request.headers.get("x-gemini-api-key", "").strip()
        or os.getenv("GEMINI_API_KEY", "").strip()
        or os.getenv("GOOGLE_API_KEY", "").strip()
    )
    print(f"[ML-BEAUTIFY] POST /beautify invoked | cat={req.category} | sub={req.sub_category} | gemini_key_present={bool(gemini_key)}", flush=True)
    if gemini_key:
        try:
            white_bg = Image.new("RGBA", cutout_pil.size, (255, 255, 255, 255))
            flat_rgb = Image.alpha_composite(white_bg, cutout_pil).convert("RGB")
            png_buf = BytesIO()
            flat_rgb.save(png_buf, format="PNG")
            img_b64 = base64.b64encode(png_buf.getvalue()).decode("utf-8")

            prompt_text = (
                "Reconstruct this clothing item into a crisp, steam-ironed, perfectly symmetrical front-facing "
                "studio flat-lay product photograph on a solid pure white background (#FFFFFF), exactly like "
                "Acloset's Beautify feature. Remove any coat hanger. Straighten skewed pant legs, waistbands, "
                "or sleeves so left and right sides are symmetrical. Remove messy wrinkles and crumples while "
                "preserving the exact fabric color, seam stitching lines, drawstrings, pockets, collar/hood, "
                "and any graphic print."
            )
            for model_id in ("gemini-2.0-flash-exp-image-generation", "gemini-2.5-flash-image"):
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={gemini_key}"
                payload = {
                    "contents": [
                        {
                            "parts": [
                                {"text": prompt_text},
                                {"inlineData": {"mimeType": "image/png", "data": img_b64}},
                            ]
                        }
                    ],
                    "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
                }
                resp = requests.post(url, json=payload, timeout=18)
                if resp.status_code == 200:
                    data = resp.json()
                    for cand in data.get("candidates", []):
                        for part in cand.get("content", {}).get("parts", []):
                            inline = part.get("inlineData") or part.get("inline_data")
                            if inline and inline.get("data"):
                                gen_bytes = base64.b64decode(inline["data"])
                                gen_img = Image.open(BytesIO(gen_bytes)).convert("RGBA")
                                _, _, clean_uri, _ = extract_garment_cutout(gen_img, force_rembg=True)
                                return BeautifyResponse(beautifiedDataUri=clean_uri, method="ai_studio_flatlay")
        except Exception as e:
            logger.warning(f"Tier 1 Gemini Studio Flat-Lay fallback to Tier 2: {e}")

    # Tier 2 — Local OpenCV Piece-Wise Contour Symmetrization + Frequency-Separated Steam-Ironing
    beautified_uri = beautify_garment_geometric_studio(
        cutout_rgba=cutout_pil,
        category=req.category,
        sub_category=req.sub_category,
    )
    return BeautifyResponse(beautifiedDataUri=beautified_uri, method="geometric_studio_iron")


def _decode_item_cutout_or_render_placeholder(item: WardrobeItemInput, target_w: int, target_h: int) -> Image.Image:
    """Decode item's cutout/beautified image_url if base64/HTTP, or synthesize a clean 2D garment layer."""
    img_url = (item.image_url or "").strip()
    pil_rgba: Optional[Image.Image] = None
    if img_url.startswith("data:image/"):
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
        bbox = pil_rgba.getbbox()
        if bbox:
            pil_rgba = pil_rgba.crop(bbox)
        return pil_rgba.resize((max(16, target_w), max(16, target_h)), Image.Resampling.BILINEAR)

    # Fallback stylized silhouette in item.color
    ref_lab = kmeans_color.NAMED_FASHION_COLORS.get(item.color, (35.0, 0.0, 0.0))
    rgb_tup = kmeans_color.cielab_to_rgb(np.asarray(ref_lab, dtype=np.float64))
    fill_rgba = (int(rgb_tup[0]), int(rgb_tup[1]), int(rgb_tup[2]), 235)
    layer = Image.new("RGBA", (max(16, target_w), max(16, target_h)), (0, 0, 0, 0))
    from PIL import ImageDraw

    d = ImageDraw.Draw(layer)
    d.rounded_rectangle([2, 2, max(14, target_w - 3), max(14, target_h - 3)], radius=12, fill=fill_rgba)
    return layer


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
    """Cladwell-Style 2D Virtual Try-On Endpoint ('See It On Me'):
    Step 1: 5-Class NSFW Safety Check on user's full-body photo (Neutral dominant, rejecting Drawing, Hentai, Porn, Sexy).
    Step 2: 2D Body Landmark Proportion & Garment Composite keeping Head & Face Zone (top 14%) 100% visible.
    """
    raw_b64 = req.user_photo_base64.strip()
    if "," in raw_b64:
        raw_b64 = raw_b64.split(",", 1)[1]
    try:
        user_img = Image.open(BytesIO(base64.b64decode(raw_b64))).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid user_photo_base64: {e}") from e

    # Step 1: 5-Class NSFW Safety Check on User Full-Body Photo
    is_safe, nsfw_scores, safety_reason = evaluate_5class_nsfw_safety(user_img)
    if not is_safe:
        raise HTTPException(status_code=422, detail=safety_reason or "User photo did not pass 5-class safety check.")

    req.items = sort_outfit_items_canonically(req.items)
    gemini_key = (
        (req.gemini_api_key or "").strip()
        or request.headers.get("x-gemini-api-key", "").strip()
        or os.getenv("GEMINI_API_KEY", "").strip()
        or os.getenv("GOOGLE_API_KEY", "").strip()
    )
    print(f"[ML-TRYON-2D] POST /try-on-2d invoked | items={len(req.items)} | gemini_key_present={bool(gemini_key)}", flush=True)

    if gemini_key and req.items:
        try:
            u_buf = BytesIO()
            user_img.save(u_buf, format="PNG")
            u_b64 = base64.b64encode(u_buf.getvalue()).decode("utf-8")
            item_desc = ", ".join(
                f"{it.color} {it.clothing_name} ({it.category})" for it in req.items if it.category != "ACCESSORIES"
            )
            vton_prompt = (
                f"Generate a photorealistic 2D virtual try-on ('See It On Me') image of this exact standing person "
                f"wearing the following outfit: {item_desc}. Keep the person's exact face, head, hair, skin tone, "
                f"body build, standing posture, and background identical, and naturally fit the garments onto their body."
            )
            for model_id in ("gemini-2.5-flash-image", "gemini-2.0-flash-exp-image-generation"):
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={gemini_key}"
                payload = {
                    "contents": [
                        {
                            "parts": [
                                {"text": vton_prompt},
                                {"inlineData": {"mimeType": "image/png", "data": u_b64}},
                            ]
                        }
                    ],
                    "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]},
                }
                resp = requests.post(url, json=payload, timeout=20)
                if resp.status_code == 200:
                    data = resp.json()
                    for cand in data.get("candidates", []):
                        for part in cand.get("content", {}).get("parts", []):
                            inline = part.get("inlineData") or part.get("inline_data")
                            if inline and inline.get("data"):
                                gen_bytes = base64.b64decode(inline["data"])
                                gen_img = Image.open(BytesIO(gen_bytes)).convert("RGB")
                                out_b = BytesIO()
                                gen_img.save(out_b, format="WEBP", quality=88, method=4)
                                vton_uri = f"data:image/webp;base64,{base64.b64encode(out_b.getvalue()).decode('utf-8')}"
                                return TryOn2DResponse(
                                    tryOnDataUri=vton_uri,
                                    skinHexDetected=req.skin_tone_hex or "#D8A988",
                                    nsfw_scores=nsfw_scores,
                                )
        except Exception as e:
            logger.warning(f"Gemini Try-On fallback to 2D landmark composite: {e}")

    # Resize working full-body photo to max 512px height for sub-second try-on composite
    base_rgba = user_img.copy()
    base_rgba.thumbnail((512, 512), Image.Resampling.BILINEAR)
    base_rgba = base_rgba.convert("RGBA")
    W, H = base_rgba.size

    # Step 2: Detect person's foreground silhouette bounding box (p_left, p_top, p_right, p_bottom) via rembg (u2netp)
    p_left, p_top, p_right, p_bottom = int(0.18 * W), int(0.06 * H), int(0.82 * W), int(0.95 * H)
    person_mask_pil: Optional[Image.Image] = None
    if REMBG_AVAILABLE and remove is not None and REMBG_SESSION is not None:
        try:
            person_cutout = remove(base_rgba.convert("RGB"), session=REMBG_SESSION, alpha_matting=False)
            p_bbox = person_cutout.getbbox()
            if p_bbox and (p_bbox[2] - p_bbox[0]) >= 30 and (p_bbox[3] - p_bbox[1]) >= 50:
                p_left, p_top, p_right, p_bottom = p_bbox
                person_mask_pil = person_cutout
        except Exception as e:
            logger.debug(f"Try-on person segmentation fallback to proportional frame: {e}")

    p_w = max(40, p_right - p_left)
    p_h = max(80, p_bottom - p_top)
    p_cx = p_left + p_w // 2

    # Detect skin tone hex from face/neck zone (y in [p_top + 0.04*p_h, p_top + 0.14*p_h])
    skin_hex = req.skin_tone_hex or "#D8A988"
    if not req.skin_tone_hex:
        try:
            face_crop = np.asarray(
                base_rgba.crop(
                    (
                        max(0, p_cx - int(0.12 * p_w)),
                        max(0, p_top + int(0.04 * p_h)),
                        min(W, p_cx + int(0.12 * p_w)),
                        min(H, p_top + int(0.14 * p_h)),
                    )
                ).convert("RGB"),
                dtype=np.uint8,
            )
            if face_crop.size >= 3:
                med_rgb = np.median(face_crop.reshape(-1, 3), axis=0)
                skin_hex = f"#{int(med_rgb[0]):02x}{int(med_rgb[1]):02x}{int(med_rgb[2]):02x}".upper()
        except Exception:
            skin_hex = "#D8A988"

    # Anatomical Body Zones on User's Standing Silhouette:
    # - Head & Face Zone: y in [p_top, p_top + 0.14 * p_h] (kept 100% visible)
    # - Upper Torso Zone (TOP / OUTERWEAR): y in [p_top + 0.14 * p_h, p_top + 0.52 * p_h], width = p_w * 0.88
    # - Lower Body Zone (BOTTOM): y in [p_top + 0.46 * p_h, p_top + 0.86 * p_h], width = p_w * 0.78
    # - Footwear Zone (SHOES): y in [p_top + 0.84 * p_h, p_bottom], width = p_w * 0.58
    head_y_end = p_top + int(0.14 * p_h)
    head_snapshot = base_rgba.crop((0, 0, W, head_y_end))

    composite = base_rgba.copy()

    bottom_item = next((i for i in req.items if i.category == "BOTTOM"), None)
    top_item = next((i for i in req.items if i.category == "TOP"), None)
    outer_item = next((i for i in req.items if i.category == "OUTERWEAR"), None)
    shoe_item = next((i for i in req.items if i.category == "SHOES"), None)

    def _paste_with_shadow(comp: Image.Image, layer_rgba: Image.Image, dst_x: int, dst_y: int) -> Image.Image:
        l_alpha = layer_rgba.split()[3]
        sh_canvas = Image.new("L", comp.size, 0)
        sh_canvas.paste(l_alpha, (dst_x, dst_y + 4))
        sh_blur = sh_canvas.filter(ImageFilter.GaussianBlur(radius=4))
        sh_np = (np.asarray(sh_blur, dtype=np.float32) * (42.0 / 255.0)).clip(0, 255).astype(np.uint8)
        sh_rgba = np.zeros((comp.size[1], comp.size[0], 4), dtype=np.uint8)
        sh_rgba[:, :, 3] = sh_np
        comp = Image.alpha_composite(comp, Image.fromarray(sh_rgba, mode="RGBA"))
        fg_c = Image.new("RGBA", comp.size, (0, 0, 0, 0))
        fg_c.paste(layer_rgba, (dst_x, dst_y), layer_rgba)
        return Image.alpha_composite(comp, fg_c)

    # 1. BOTTOM Layer (y in [p_top + 0.46 * p_h, p_top + 0.86 * p_h])
    if bottom_item is not None:
        bw = int(p_w * 0.78)
        bh = int(p_h * 0.40)
        bx = p_cx - bw // 2
        by = p_top + int(0.46 * p_h)
        b_layer = _decode_item_cutout_or_render_placeholder(bottom_item, bw, bh)
        composite = _paste_with_shadow(composite, b_layer, bx, by)

    # 2. TOP Layer (y in [p_top + 0.14 * p_h, p_top + 0.52 * p_h], width = p_w * 0.88)
    if top_item is not None:
        tw = int(p_w * 0.88)
        th = int(p_h * 0.38)
        tx = p_cx - tw // 2
        ty = p_top + int(0.14 * p_h)
        t_layer = _decode_item_cutout_or_render_placeholder(top_item, tw, th)
        composite = _paste_with_shadow(composite, t_layer, tx, ty)

    # 3. OUTERWEAR Layer (slightly wider over TOP)
    if outer_item is not None:
        ow = int(p_w * 0.94)
        oh = int(p_h * 0.40)
        ox = p_cx - ow // 2
        oy = p_top + int(0.14 * p_h)
        o_layer = _decode_item_cutout_or_render_placeholder(outer_item, ow, oh)
        composite = _paste_with_shadow(composite, o_layer, ox, oy)

    # 4. SHOES Layer (y in [p_top + 0.84 * p_h, p_bottom])
    if shoe_item is not None:
        sw = int(p_w * 0.56)
        sh = int(p_h * 0.16)
        sx = p_cx - sw // 2
        sy = p_top + int(0.84 * p_h)
        s_layer = _decode_item_cutout_or_render_placeholder(shoe_item, sw, sh)
        composite = _paste_with_shadow(composite, s_layer, sx, sy)

    # Restore Head & Face Zone (y in [0, p_top + 0.14 * p_h]) so user's face and hair stay 100% visible
    composite.paste(head_snapshot, (0, 0))

    out_buf = BytesIO()
    out_mime = "image/webp"
    try:
        composite.save(out_buf, format="WEBP", quality=88, method=4)
    except Exception:
        out_buf = BytesIO()
        composite.save(out_buf, format="PNG")
        out_mime = "image/png"

    try_on_uri = f"data:{out_mime};base64,{base64.b64encode(out_buf.getvalue()).decode('utf-8')}"
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
    """Tier 1 Hard Dress-Code Exclusion check for Work/Office/Corporate/Formal occasions.
    Fixes image_9a3048.jpg so Office/Formal never recommends Pullover Hoodies, Spiked Leather Chokers, or Chrome Spike Earrings!
    """
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
    """Calculates S_cb, S_cf, and S_hybrid = round(0.55 * S_cb + 0.45 * S_cf) with:
    - Cross-Gender Taste Affinity (All -> For You feed signal weighting)
    - Tier 1 Dress-Code Violation Penalty (P_violation = -100)
    - Tier 2 Weather vs. Personal Comfort Balance
    """
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

    # Tier 1 Hard Dress-Code Exclusion Penalty (P_violation = -100)
    if any(_is_item_dress_code_violation(it, target_occasion) for it in items):
        s_cb -= 100.0
        reasons.append(f"Dress-code mismatch for {target_occasion} (-100)")

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

    # Weather suitability (Tier 2 Weather vs. Personal Comfort Balance)
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

    # User Onboarding Preferences:
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

    # 2. Cross-Gender Collaborative Filtering (All -> For You Affinity)
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

    # 3. Weighted Hybrid Score
    s_hyb = round(alpha * s_cb + (1.0 - alpha) * s_cf, 1)

    return round(s_cb, 1), round(s_cf, 1), s_hyb, weather_tag, reasons


@app.post("/recommend", response_model=List[ScoredOutfitRecommendation])
def recommend_outfits(req: HybridRecommendationRequest) -> List[ScoredOutfitRecommendation]:
    """Generate Top-3 outfits via Weighted Hybrid Filtering (0.55 Content-Based + 0.45 Collaborative) with
    StyleSense v6.0 3-Tier Occasion x Weather Personalization Rubric:
    - Tier 1: Hard Dress-Code Exclusions for Work/Office/Corporate/Formal.
    - Tier 2: Soft Weather vs. Personal Comfort Balance (Rank #1 Weather-Smart Look, Rank #2 Your Signature Comfort Look, Rank #3 Fresh Closet Mix).
    - Cross-Gender Collaborative Filtering (All -> For You affinity).
    """
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

    # Tier 1 — Hard Dress-Code Exclusions (Filtered Before Ranking when valid alternatives exist)
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

    # Tier 2 — Soft Weather vs. Personal Comfort Balance
    layered_candidates: List[ScoredOutfitRecommendation] = []
    comfort_unlayered_candidates: List[ScoredOutfitRecommendation] = []
    all_candidates: List[ScoredOutfitRecommendation] = []

    for top in tops:
        for bottom in bottoms:
            for shoe in shoes:
                # 1) Base 3-piece unlayered candidate (TOP + BOTTOM + SHOES)
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

                # 2) Layered 4-piece candidate when outerwear is appropriate
                if outerwear and (is_rainy_or_cool or occ_low in ("formal", "office", "work", "corporate")):
                    if occ_low in ("formal", "office", "work", "corporate"):
                        matching_out = next((o for o in outerwear if o.vector_subtype == "blazer"), outerwear[0])
                    else:
                        matching_out = next((o for o in outerwear if o.style == top.style), outerwear[0])
                    layered_items = sort_outfit_items_canonically([top, outline_it if (outline_it := matching_out) else matching_out, bottom, shoe] + ([matching_acc] if matching_acc else []))
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

    # When Casual/Everyday/At-Home AND rainy/cool:
    # - Rank #1 Slot (Weather-Smart Look): Best layered outfit with OUTERWEAR (if outerwear available)
    # - Rank #2 Slot (Your Signature Comfort Look): Best 3-piece unlayered outfit (TOP + BOTTOM + SHOES, NO forced outerwear)
    # - Rank #3 Slot (Fresh Closet Mix): Distinct TOP and BOTTOM combination maximizing rotation diversity
    if is_rainy_or_cool and is_casual_occasion:
        selected: List[ScoredOutfitRecommendation] = []
        if layered_candidates:
            selected.append(layered_candidates[0])
        if comfort_unlayered_candidates:
            # Prefer a comfort combo; if Rank #1 already used the exact same top+bottom and another comfort combo exists, pick best comfort combo
            best_comfort = comfort_unlayered_candidates[0]
            selected.append(best_comfort)

        used_top_ids = {next((it.id for it in s.items if it.category == "TOP"), "") for s in selected}
        used_bot_ids = {next((it.id for it in s.items if it.category == "BOTTOM"), "") for s in selected}
        combined_pool = comfort_unlayered_candidates + layered_candidates
        combined_pool.sort(key=lambda r: r.hybrid_score, reverse=True)

        # Rank #3 Slot: Fresh Closet Mix (distinct TOP and BOTTOM if possible)
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

    # Standard diverse Top-3 selection
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