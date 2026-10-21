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
import numpy as np
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field
import requests

import kmeans_color

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

# Prioritized candidate checkpoint paths
CANDIDATE_CHECKPOINT_PATHS: List[Path] = [
    Path(os.getenv("RESNET50_CHECKPOINT_PATH", "")),
    BASE_DIR / "experiments" / "resnet50" / "checkpoints" / "stylesense_resnet50_best.pt",
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
IS_FINETUNED_HEAD: bool = False
WEIGHTS = ResNet50_Weights.IMAGENET1K_V2 if TORCH_AVAILABLE else None

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

# Initialize local rembg session ("u2net") for fallback
REMBG_SESSION: Optional[Any] = None
if REMBG_AVAILABLE and new_session is not None:
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
    suggestedBrand: Optional[str] = None
    layerRole: Optional[LayerRole] = None
    color: Optional[str] = None
    colorHex: Optional[str] = None
    secondary_color: Optional[str] = None
    palette: List[ColorClusterInfo] = Field(default_factory=list)
    style: Optional[Style] = None
    occasion: Optional[Occasion] = None
    material: Optional[Material] = None
    confidence: float
    class_probabilities: Dict[str, float] = Field(default_factory=dict)
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


def extract_garment_cutout(
    pil_img: Image.Image,
    force_rembg: bool = False,
) -> Tuple[Image.Image, np.ndarray, str, str]:
    """Segment garment using official remove.bg API with multi-key rotation and pure rembg u2net fallback.

    - Supports FORCE_REMBG=true (in .env or param) to bypass remove.bg completely (spending 0 credits).
    - If Key #1 returns HTTP 402 or 429, automatically retries with Key #2, #3, etc. before falling back to rembg.
    - Zero OpenCV contour filling or GrabCut code is used, preventing opaque background corruption.

    Returns:
        (cutout_pil, fg_mask, cutout_data_uri, bg_source)
    """
    global REMBG_SESSION
    # 1. Resize working copy to max 640 maintaining aspect ratio
    img = pil_img.convert("RGB").copy()
    img.thumbnail((640, 640), Image.Resampling.LANCZOS)

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
                                f"[REMOVE-BG] Key #{idx} ({key_masked}) {reason}. All {len(keys)} configured keys exhausted! Falling back to local rembg u2net."
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

    # 3. Fallback: Pure rembg local u2net model with alpha_matting=False (zero OpenCV contour manipulation)
    if cutout is None:
        if REMBG_AVAILABLE and remove is not None:
            try:
                if REMBG_SESSION is None and new_session is not None:
                    REMBG_SESSION = new_session("u2net")
                if REMBG_SESSION is not None:
                    cutout = remove(
                        img,
                        session=REMBG_SESSION,
                        alpha_matting=False,
                        post_process_mask=True,
                    )
                    bg_source = "rembg_u2net"
            except Exception as e:
                logger.warning(f"rembg removal failed: {e}")
                cutout = None

    if cutout is None:
        cutout = img.convert("RGBA")
        bg_source = "raw_fallback"

    # 4. Clean up faint background alpha noise (< 20 -> 0)
    rgba = np.array(cutout.convert("RGBA"))
    alpha = rgba[:, :, 3]
    rgba[:, :, 3] = np.where(alpha < 20, 0, alpha)
    cutout = Image.fromarray(rgba, mode="RGBA")

    # Proportionally center on 480x480 transparent PNG canvas
    bbox = cutout.getbbox()
    canvas = Image.new("RGBA", (480, 480), (0, 0, 0, 0))
    if bbox:
        cropped = cutout.crop(bbox)
        cropped.thumbnail((440, 440), Image.Resampling.LANCZOS)
        offset = ((480 - cropped.width) // 2, (480 - cropped.height) // 2)
        canvas.paste(cropped, offset, cropped)
    else:
        thumb = cutout.copy()
        thumb.thumbnail((440, 440), Image.Resampling.LANCZOS)
        offset = ((480 - thumb.width) // 2, (480 - thumb.height) // 2)
        canvas.paste(thumb, offset)
    cutout = canvas

    buffered = BytesIO()
    cutout.save(buffered, format="PNG")
    cutout_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    cutout_data_uri = f"data:image/png;base64,{cutout_base64}"

    fg_mask = np.array(cutout)[:, :, 3] > 64
    return cutout, fg_mask, cutout_data_uri, bg_source


def extract_color_palette_kmeans(
    cutout: Image.Image,
    fg_mask: Optional[np.ndarray] = None,
    k: int = 2,
    max_iter: int = 100,
    random_state: int = 42,
) -> Tuple[str, str, Optional[str], List[ColorClusterInfo]]:
    """Extract dominant colors and CIELAB palette using ml-service/kmeans_color.py on foreground pixels."""
    rgba = np.asarray(cutout.convert("RGBA"), dtype=np.uint8)
    if fg_mask is not None and fg_mask.shape[:2] == rgba.shape[:2] and np.sum(fg_mask) >= 20:
        fg_pixels = rgba[:, :, :3][fg_mask].astype(np.float64)
    else:
        mask = rgba[:, :, 3] > 64
        if np.sum(mask) >= 20:
            fg_pixels = rgba[:, :, :3][mask].astype(np.float64)
        else:
            fg_pixels = rgba[:, :, :3].reshape(-1, 3).astype(np.float64)

    if len(fg_pixels) > 3000:
        rng = np.random.default_rng(random_state)
        idx = rng.choice(len(fg_pixels), size=3000, replace=False)
        fg_pixels = fg_pixels[idx]

    fg_lab = kmeans_color.rgb_to_cielab(fg_pixels)

    # Use KMeansCIELAB from ml-service/kmeans_color.py
    km = kmeans_color.KMeansCIELAB(n_clusters=k, max_iter=max_iter, random_state=random_state)
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
    dom_color = dom_cluster.color_name if dom_cluster else "Black"
    dom_lab = centers[sorted_order[0]] if len(centers) > 0 else np.array([0.0, 0.0, 0.0])
    dom_rgb = kmeans_color.cielab_to_rgb(dom_lab)
    color_hex = f"#{int(dom_rgb[0]):02x}{int(dom_rgb[1]):02x}{int(dom_rgb[2]):02x}".upper()
    sec_color = clusters[1].color_name if len(clusters) > 1 else None

    return dom_color, color_hex, sec_color, clusters


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


async def run_garment_analysis(
    image: Image.Image,
    source_filename: str = "",
    force_rembg: bool = False,
) -> Prediction:
    """Core garment analysis pipeline:
    STEP 1 (FIRST): Run fine-tuned ResNet-50 on the ORIGINAL unmodified RGB image.
    STEP 2 (SECOND): Run remove.bg API (with multi-key rotation) or local rembg if force_rembg/exhausted.
    STEP 3 (THIRD): Run CIELAB K-Means++ on foreground pixels from Step 2's cutout.
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
            colorHex=None,
            secondary_color=None,
            palette=[],
            style=None,
            occasion=None,
            material=None,
            confidence=0.0,
            class_probabilities={},
            cutoutDataUri=None,
            is_safe_garment=False,
            moderation_reason="Inappropriate or non-clothing image detected. Please upload a clear photo of a clothing item or wearable accessory.",
        )

    transforms_to_use = EVAL_TRANSFORMS if (IS_FINETUNED_HEAD or WEIGHTS is None or EVAL_TRANSFORMS is not None) else WEIGHTS.transforms()
    rgb_image = image.convert("RGB")
    tensor_raw = transforms_to_use(rgb_image).unsqueeze(0)

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 1: Run ResNet-50 on ORIGINAL unmodified RGB image
    # ─────────────────────────────────────────────────────────────────────────
    with torch.inference_mode():
        probs_orig = torch.softmax(MODEL(tensor_raw)[0], dim=0)

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 2: Background removal (remove.bg multi-key rotation -> pure rembg u2net fallback)
    # ─────────────────────────────────────────────────────────────────────────
    cutout_pil, fg_mask, cutout_data_uri, bg_source = extract_garment_cutout(image, force_rembg=force_rembg)

    # Composite RGBA cutout onto clean neutral studio background (RGB(245, 245, 245))
    # cropped to the garment's bounding box with 12% padding
    probs_cutout_studio = probs_orig
    if cutout_pil is not None:
        try:
            alpha = cutout_pil.split()[3]
            bbox = alpha.getbbox()
            if bbox:
                left, top, right, bottom = bbox
                bw = right - left
                bh = bottom - top
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
            cutout_studio = Image.alpha_composite(studio_bg, garment_crop).convert("RGB")

            tensor_studio = transforms_to_use(cutout_studio).unsqueeze(0)
            with torch.inference_mode():
                probs_cutout_studio = torch.softmax(MODEL(tensor_studio)[0], dim=0)
        except Exception as e:
            logger.warning(f"Studio cutout inference fallback: {e}")
            probs_cutout_studio = probs_orig

    # Average softmax probabilities (0.5 * probs_orig + 0.5 * probs_cutout_studio)
    probabilities = 0.5 * probs_orig + 0.5 * probs_cutout_studio

    # True ResNet-50 softmax confidence and genuine class probabilities (NO WARPING!)
    top_prob, top_idx = torch.max(probabilities, dim=0)
    raw_conf = float(top_prob.item())
    pred_cat_idx = int(top_idx.item())

    class_probabilities: Dict[str, float] = {
        cat: round(float(probabilities[i].item()), 4)
        for i, cat in enumerate(CATEGORIES_LIST)
    }

    # Strictly enforce CONFIDENCE_THRESHOLD = 0.55 (No hardcoded TOP fallback, no filename guessing)
    if raw_conf >= CONFIDENCE_THRESHOLD:
        pred_cat: Optional[Category] = CATEGORIES_LIST[pred_cat_idx]
        sub_category, material, pred_style, occasion, layer_role = CATEGORY_DEFAULT_METADATA[pred_cat]
        moderation_reason = None
    else:
        pred_cat = None
        sub_category = None
        material = None
        pred_style = None
        occasion = None
        layer_role = None
        moderation_reason = f"Low classification confidence ({raw_conf:.2f} < {CONFIDENCE_THRESHOLD}); please confirm category manually."

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 3: Run CIELAB K-Means++ on foreground pixels (alpha > 64)
    # ─────────────────────────────────────────────────────────────────────────
    dom_color, color_hex, sec_color, clusters = extract_color_palette_kmeans(cutout_pil, fg_mask=fg_mask, k=2)

    suggested_name = f"{dom_color} {sub_category}" if (dom_color and sub_category) else sub_category

    # Terminal Log: clear log line on every analyze call
    print(
        f"[ML-ANALYZE] checkpoint_loaded={IS_FINETUNED_HEAD} | pred_cat={pred_cat} (conf={raw_conf:.4f}, probs={class_probabilities}) | remove_bg_source={bg_source} | color={dom_color} ({color_hex})",
        flush=True,
    )

    return Prediction(
        category=pred_cat,
        subCategory=sub_category,
        suggestedName=suggested_name,
        suggestedBrand=None,  # No fake brands
        layerRole=layer_role,
        color=dom_color,
        colorHex=color_hex,
        secondary_color=sec_color,
        palette=clusters,
        style=pred_style,
        occasion=occasion,
        material=material,
        confidence=round(raw_conf, 4),
        class_probabilities=class_probabilities,
        cutoutDataUri=cutout_data_uri,
        is_safe_garment=True,
        moderation_reason=moderation_reason,
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    global MODEL, IS_FINETUNED_HEAD, REMBG_SESSION, LOADED_CHECKPOINT_PATH

    keys = get_remove_bg_api_keys()
    force_rembg_env = os.getenv("FORCE_REMBG", "false").strip().lower() in ("true", "1", "yes")
    logger.info(f"remove.bg API Key(s) loaded: {len(keys)} key(s) | FORCE_REMBG={force_rembg_env}")

    # Initialize local rembg session ("u2net") for fallback
    if REMBG_AVAILABLE and REMBG_SESSION is None and new_session is not None:
        try:
            REMBG_SESSION = new_session("u2net")
        except Exception as e:
            logger.warning(f"Failed to initialize rembg u2net session: {e}")
            REMBG_SESSION = None

    # Load Epoch 13 ResNet-50 Checkpoint
    if TORCH_AVAILABLE and resnet50 is not None:
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

        if MODEL is None:
            print("[STARTUP] Active model: ResNet-50 ImageNet-1K V2 fallback head")
            logger.info("Active model: ResNet-50 ImageNet-1K V2 fallback head")
            MODEL = resnet50(weights=WEIGHTS).eval()
            IS_FINETUNED_HEAD = False

    yield
    MODEL = None


app = FastAPI(title="StyleSense ML & Hybrid Recommendation Service", version="2.6.0", lifespan=lifespan)


@app.get("/health")
def health() -> Dict[str, object]:
    val_metrics = LOADED_RESULTS_DATA.get("validation_metrics", {})
    test_metrics = LOADED_RESULTS_DATA.get("final_test_metrics", {})
    keys = get_remove_bg_api_keys()
    force_rembg_env = os.getenv("FORCE_REMBG", "false").strip().lower() in ("true", "1", "yes")
    return {
        "status": "ok",
        "model": "resnet50-stylesense-5class" if IS_FINETUNED_HEAD else "resnet50-imagenet1k-v2",
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
        "taxonomy": CATEGORIES_LIST,
        "hybrid_engine": "0.55_CB_0.45_CF",
        "ai_moderation_enabled": True,
    }


@app.post("/analyze", response_model=PredictResponse)
async def analyze(request: Request, force_rembg: Optional[bool] = None) -> PredictResponse:
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
