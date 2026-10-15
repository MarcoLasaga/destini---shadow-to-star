"""StyleSense Unified ML & Hybrid Recommendation Microservice (FastAPI).
 
Implements:
1. Fine-Tuned 5-Class ResNet-50 Garment Classifier (with 0.55 confidence threshold
   and automatic fallback if checkpoint is not yet mounted).
2. CIELAB K-Means++ (K = 2) Dominant Color & Palette Extraction (Chapter 2 Eqs. 4-12)
   with background pixel exclusion via CIE76 Delta-E.
3. Automated AI Content Moderation Gate (NSFW / Skin-Ratio Check + Non-Garment
   Confidence Gate + Profanity/Slur Text Filter for Community Feed posts).
4. Context-Aware Weighted Hybrid Recommendation Engine (Chapter 2 Eqs. 15-19 & Table 1):
   S_hybrid = 0.55 * S_cb + 0.45 * S_cf
   incorporating OpenWeatherMap live temperature/rain signals, occasion matching,
   CIELAB color harmony, 7-day wear recency rotation, and Community Feed
   cosine-similarity neighborhood collaborative filtering.
"""
 
from contextlib import asynccontextmanager
from io import BytesIO
import os
import re
from typing import Literal
 
import numpy as np
import torch
import torch.nn as nn
from fastapi import FastAPI, HTTPException, Request
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field
from torchvision.models import ResNet50_Weights, resnet50
 
Category = Literal['TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'ACCESSORIES']
Style = Literal[
    'CASUAL', 'FORMAL', 'SPORTY', 'STREETWEAR',
    'MINIMALIST', 'BOHEMIAN', 'VINTAGE', 'CLASSIC'
]
 
CATEGORIES_LIST: list[Category] = ['TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'ACCESSORIES']
CONFIDENCE_THRESHOLD = 0.55
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
CHECKPOINT_PATH = os.getenv('RESNET50_CHECKPOINT_PATH', 'models/resnet50_stylesense_epoch13.pth')
 
MODEL: torch.nn.Module | None = None
IS_FINETUNED_HEAD: bool = False
WEIGHTS = ResNet50_Weights.IMAGENET1K_V2
 
# Reference Fashion Colors in CIELAB (L*, a*, b*) for CIE76 Delta-E naming (Eq. 11)
REFERENCE_COLORS_LAB: dict[str, tuple[float, float, float]] = {
    'Black': (15.0, 0.0, 0.0),
    'White': (95.0, 0.0, 0.0),
    'Gray': (55.0, 0.0, 0.0),
    'Beige': (82.0, 2.0, 14.0),
    'Khaki': (68.0, 1.0, 20.0),
    'Navy': (25.0, 8.0, -32.0),
    'Blue': (45.0, 5.0, -48.0),
    'Red': (48.0, 62.0, 35.0),
    'Burgundy': (30.0, 42.0, 18.0),
    'Green': (52.0, -45.0, 30.0),
    'Brown': (38.0, 15.0, 22.0),
    'Pink': (72.0, 35.0, 5.0),
    'Yellow': (85.0, -5.0, 75.0),
}
NEUTRAL_COLORS = {'Black', 'White', 'Gray', 'Beige', 'Khaki', 'Navy'}
 
# Fallback ImageNet garment hints if fine-tuned .pth is not mounted yet
LABEL_CATEGORY_HINTS: dict[Category, tuple[str, ...]] = {
    'TOP': ('jersey', 'sweatshirt', 'cardigan', 'shirt', 'maillot', 'vestment'),
    'BOTTOM': ('jean', 'miniskirt', 'kilt', 'sarong', 'trouser', 'pant'),
    'SHOES': ('shoe', 'sandal', 'loafer', 'boot', 'sneaker', 'clog'),
    'OUTERWEAR': ('coat', 'jacket', 'suit', 'trench', 'poncho', 'abaya'),
    'ACCESSORIES': ('backpack', 'handbag', 'purse', 'wallet', 'tie', 'scarf', 'belt', 'hat', 'watch', 'sunglass'),
}
 
# Automated Profanity / Slur Blocklist for Community Feed Captions & Notes
BLOCKED_TERMS_PATTERN = re.compile(
    r'\b(nigger|nigga|faggot|fuck|shit|bitch|cunt|whore|slut|retard|porn|nsfw|nude|naked|sex)\b',
    re.IGNORECASE,
)
 
 
class ColorClusterInfo(BaseModel):
    color_name: str
    proportion: float
    lab: tuple[float, float, float]
 
 
class Prediction(BaseModel):
    category: Category | None = None
    color: str | None = None
    secondary_color: str | None = None
    palette: list[ColorClusterInfo] = Field(default_factory=list)
    style: Style | None = None
    confidence: float
    is_safe_garment: bool = True
    moderation_reason: str | None = None
 
 
class ModerationRequest(BaseModel):
    caption: str = ''
    garment_confidence: float = 1.0
    skin_exposure_ratio: float = 0.0
 
 
class ModerationResponse(BaseModel):
    approved: bool
    sanitized_caption: str
    reason: str | None = None
 
 
class WardrobeItemInput(BaseModel):
    id: str
    clothing_name: str
    category: Category
    color: str
    style: Style = 'CASUAL'
    occasion: str = 'Casual'
    laundry_status: Literal['CLEAN', 'DIRTY', 'LAUNDRY', 'NEEDS_WASHING'] = 'CLEAN'
    worn_within_7_days: bool = False
    is_favorite: bool = False
    is_disliked: bool = False
 
 
class WeatherContextInput(BaseModel):
    temperature_c: float = 28.0
    condition: str = 'Clear'
    humidity: float = 70.0
    precipitation_mm: float = 0.0
 
 
class CommunityRatingSignal(BaseModel):
    neighbor_similarity: float = Field(ge=0.0, le=1.0)
    style: Style
    dominant_color: str
    rating: float = Field(ge=1.0, le=5.0)
 
 
class HybridRecommendationRequest(BaseModel):
    user_id: str
    target_occasion: str = 'Casual'
    no_new_clothes_mode: bool = True
    wardrobe: list[WardrobeItemInput]
    preferred_styles: list[Style] = Field(default_factory=lambda: ['CASUAL'])
    preferred_colors: list[str] = Field(default_factory=lambda: ['Black', 'White', 'Navy'])
    weather: WeatherContextInput = Field(default_factory=WeatherContextInput)
    community_signals: list[CommunityRatingSignal] = Field(default_factory=list)
    alpha: float = 0.55
 
 
class ScoredOutfitRecommendation(BaseModel):
    item_ids: list[str]
    items: list[WardrobeItemInput]
    content_score: float
    collaborative_score: float
    hybrid_score: float
    weather_tag: str
    reasons: list[str]
 
 
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
    best_name = 'Black'
    best_de = float('inf')
    for name, ref_lab in REFERENCE_COLORS_LAB.items():
        ref = np.array(ref_lab, dtype=np.float32)
        de = float(np.linalg.norm(lab_centroid - ref))
        if de < best_de:
            best_de = de
            best_name = name
    return best_name
 
 
def kmeans_plusplus_cielab(image: Image.Image, k: int = 2, max_iter: int = 100) -> list[ColorClusterInfo]:
    """Extract dominant garment colors in CIELAB using K-Means++ (K = 2, Chapter 2 Eqs. 4-12)."""
    resized = np.asarray(image.convert('RGB').resize((96, 96)), dtype=np.float32)
    border_pixels = np.concatenate([
        resized[0, :, :], resized[-1, :, :], resized[:, 0, :], resized[:, -1, :]
    ], axis=0)
    bg_lab = np.median(srgb_to_cielab(border_pixels), axis=0)
 
    all_pixels = resized.reshape(-1, 3)
    all_lab = srgb_to_cielab(all_pixels)
    # Exclude background pixels whose CIE76 distance to border median is < 12.0
    de_bg = np.linalg.norm(all_lab - bg_lab, axis=1)
    fg_lab = all_lab[de_bg >= 12.0]
    if len(fg_lab) < 20:
        fg_lab = all_lab
 
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
 
    clusters: list[ColorClusterInfo] = []
    for c_i in range(k):
        count = int(np.sum(labels == c_i))
        prop = round(count / max(1, n_pts), 4)
        c_lab = centroids[c_i]
        clusters.append(ColorClusterInfo(
            color_name=nearest_fashion_color(c_lab),
            proportion=prop,
            lab=(round(float(c_lab[0]), 2), round(float(c_lab[1]), 2), round(float(c_lab[2]), 2)),
        ))
    clusters.sort(key=lambda x: x.proportion, reverse=True)
    return clusters
 
 
def estimate_skin_exposure_ratio(image: Image.Image) -> float:
    """Detect potential NSFW / excessive skin-tone ratio in YCbCr space."""
    ycbcr = np.asarray(image.convert('YCbCr').resize((96, 96)), dtype=np.float32)
    y, cb, cr = ycbcr[:, :, 0], ycbcr[:, :, 1], ycbcr[:, :, 2]
    skin_mask = (y > 80) & (cb >= 77) & (cb <= 127) & (cr >= 133) & (cr <= 173)
    return float(np.mean(skin_mask))
 
 
def check_text_moderation(text: str) -> tuple[bool, str, str | None]:
    """Check and sanitize captions/notes against profanity and slurs."""
    match = BLOCKED_TERMS_PATTERN.search(text or '')
    if match:
        sanitized = BLOCKED_TERMS_PATTERN.sub('***', text)
        return False, sanitized, 'Post blocked: Caption contains inappropriate or prohibited language.'
    return True, (text or '').strip(), None
 
 
@asynccontextmanager
async def lifespan(_: FastAPI):
    global MODEL, IS_FINETUNED_HEAD
    if os.path.exists(CHECKPOINT_PATH):
        base = resnet50(weights=None)
        base.fc = nn.Linear(base.fc.in_features, len(CATEGORIES_LIST))
        state = torch.load(CHECKPOINT_PATH, map_location='cpu')
        if isinstance(state, dict) and 'model_state_dict' in state:
            state = state['model_state_dict']
        base.load_state_dict(state, strict=False)
        MODEL = base.eval()
        IS_FINETUNED_HEAD = True
    else:
        MODEL = resnet50(weights=WEIGHTS).eval()
        IS_FINETUNED_HEAD = False
    yield
    MODEL = None
 
 
app = FastAPI(title='StyleSense ML & Hybrid Recommendation Service', version='2.0.0', lifespan=lifespan)
 
 
@app.get('/health')
def health() -> dict[str, str | bool]:
    return {
        'status': 'ok',
        'model': 'resnet50-stylesense-5class' if IS_FINETUNED_HEAD else 'resnet50-imagenet1k-v2',
        'kmeans_cielab_k': '2',
        'hybrid_engine': '0.55_CB_0.45_CF',
        'ai_moderation_enabled': True,
    }
 
 
@app.post('/analyze', response_model=Prediction)
async def analyze(request: Request) -> Prediction:
    if request.headers.get('content-type', '').split(';')[0] not in {'image/jpeg', 'image/png', 'image/webp'}:
        raise HTTPException(status_code=415, detail='Send a JPEG, PNG, or WebP image body.')
    body = await request.body()
    if not body or len(body) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail='Image must be between 1 byte and 5 MB.')
    try:
        image = Image.open(BytesIO(body)).convert('RGB')
    except UnidentifiedImageError as error:
        raise HTTPException(status_code=422, detail='The request body is not a valid image.') from error
    if MODEL is None:
        raise HTTPException(status_code=503, detail='CNN model is still loading.')
 
    skin_ratio = estimate_skin_exposure_ratio(image)
    clusters = kmeans_plusplus_cielab(image, k=2)
    dom_color = clusters[0].color_name if clusters else 'Black'
    sec_color = clusters[1].color_name if len(clusters) > 1 else None
 
    tensor = WEIGHTS.transforms()(image).unsqueeze(0)
    with torch.inference_mode():
        probabilities = torch.softmax(MODEL(tensor)[0], dim=0)
 
    if IS_FINETUNED_HEAD:
        top_prob, top_idx = torch.max(probabilities, dim=0)
        conf = float(top_prob.item())
        pred_cat: Category | None = CATEGORIES_LIST[int(top_idx.item())] if conf >= CONFIDENCE_THRESHOLD else None
        pred_style: Style | None = 'CASUAL' if pred_cat else None
    else:
        top = torch.topk(probabilities, k=8)
        labels = [WEIGHTS.meta['categories'][idx] for idx in top.indices.tolist()]
        scores = top.values.tolist()
        pred_cat, conf, matched_label = None, float(scores[0]), labels[0].lower()
        for lbl, prob in zip(labels, scores):
            lbl_l = lbl.lower()
            for cat_key, hints in LABEL_CATEGORY_HINTS.items():
                if any(h in lbl_l for h in hints):
                    pred_cat, conf, matched_label = cat_key, float(prob), lbl_l
                    break
            if pred_cat:
                break
        pred_style = 'CASUAL' if pred_cat else None
 
    # Automated NSFW / Non-Garment Safety Gate
    if skin_ratio > 0.55 and (pred_cat is None or conf < CONFIDENCE_THRESHOLD):
        return Prediction(
            category=None,
            color=dom_color,
            secondary_color=sec_color,
            palette=clusters,
            style=None,
            confidence=round(conf, 4),
            is_safe_garment=False,
            moderation_reason='Image rejected by AI Safety Gate: Potential NSFW or non-garment photo detected.',
        )
 
    return Prediction(
        category=pred_cat,
        color=dom_color,
        secondary_color=sec_color,
        palette=clusters,
        style=pred_style,
        confidence=round(conf, 4),
        is_safe_garment=True,
        moderation_reason=None if pred_cat else 'Low classification confidence (<0.55); please confirm category manually.',
    )
 
 
@app.post('/moderate', response_model=ModerationResponse)
def moderate_post(payload: ModerationRequest) -> ModerationResponse:
    """Automated AI guard for Community Feed posts (blocks NSFW images & profanity)."""
    text_ok, sanitized, reason = check_text_moderation(payload.caption)
    if not text_ok:
        return ModerationResponse(approved=False, sanitized_caption=sanitized, reason=reason)
    if payload.skin_exposure_ratio > 0.55 or payload.garment_confidence < 0.35:
        return ModerationResponse(
            approved=False,
            sanitized_caption=sanitized,
            reason='Post blocked: Uploaded photo did not pass garment verification or NSFW safety checks.',
        )
    return ModerationResponse(approved=True, sanitized_caption=sanitized, reason=None)
 
 
@app.post('/recommend', response_model=list[ScoredOutfitRecommendation])
def recommend_outfits(req: HybridRecommendationRequest) -> list[ScoredOutfitRecommendation]:
    """Generate Top-3 outfits via Weighted Hybrid Filtering (0.55 Content-Based + 0.45 Collaborative)."""
    eligible = [
        item for item in req.wardrobe
        if item.laundry_status == 'CLEAN' and not item.is_disliked
    ]
    tops = [i for i in eligible if i.category == 'TOP']
    bottoms = [i for i in eligible if i.category == 'BOTTOM']
    shoes = [i for i in eligible if i.category == 'SHOES']
    outerwear = [i for i in eligible if i.category == 'OUTERWEAR']
 
    if not tops or not bottoms or not shoes:
        return []
 
    is_rainy_or_cool = (
        req.weather.temperature_c < 24.0
        or req.weather.precipitation_mm > 0.5
        or any(w in req.weather.condition.lower() for w in ('rain', 'storm', 'drizzle', 'thunder'))
    )
    weather_tag = (
        f'Rainy/Cool ({req.weather.temperature_c:.0f} deg C, {req.weather.condition})'
        if is_rainy_or_cool
        else f'Warm/Humid ({req.weather.temperature_c:.0f} deg C, {req.weather.condition})'
    )
 
    recommendations: list[ScoredOutfitRecommendation] = []
    for top in tops:
        for bottom in bottoms:
            for shoe in shoes:
                items = [top, bottom, shoe]
                if is_rainy_or_cool and outerwear:
                    items.append(outerwear[0])
 
                # 1. Content-Based Score S_cb (Chapter 2 Eqs. 16-17 & Table 1)
                s_cb = 55.0
                reasons: list[str] = []
 
                if len({top.style, bottom.style, shoe.style}) == 1:
                    s_cb += 18.0
                    reasons.append(f'Consistent {top.style.title()} style silhouette (+18)')
                if any(it.occasion.lower() == req.target_occasion.lower() for it in items):
                    s_cb += 15.0
                    reasons.append(f'Suited for {req.target_occasion} occasion (+15)')
                if any(it.color in NEUTRAL_COLORS for it in (top, bottom)):
                    s_cb += 10.0
                    reasons.append(f'Balanced CIELAB color harmony with {top.color} & {bottom.color} (+10)')
 
                # Preference bonuses (capped per Eq. 16)
                style_bonus = min(sum(5.0 for it in items if it.style in req.preferred_styles), 15.0)
                color_bonus = min(sum(4.0 for it in items if it.color in req.preferred_colors), 10.0)
                s_cb += style_bonus + color_bonus
 
                # Weather adjustment
                if is_rainy_or_cool and len(items) > 3:
                    s_cb += 8.0
                    reasons.append(f'Includes outerwear layer for {weather_tag}')
                elif not is_rainy_or_cool and len(items) == 3:
                    s_cb += 6.0
                    reasons.append(f'Breathable 3-piece pairing for {weather_tag}')
 
                # 7-day wear recency penalty (-18)
                if any(it.worn_within_7_days for it in items):
                    s_cb -= 18.0
 
                s_cb = float(np.clip(s_cb, 0.0, 100.0))
 
                # 2. Collaborative Filtering Score S_cf (Chapter 2 Eq. 18)
                matching_signals = [
                    sig for sig in req.community_signals
                    if sig.style in {top.style, bottom.style} or sig.dominant_color in {top.color, bottom.color}
                ]
                if matching_signals:
                    num = sum(sig.neighbor_similarity * sig.rating for sig in matching_signals)
                    den = sum(abs(sig.neighbor_similarity) for sig in matching_signals)
                    pred_rating = (num / den) if den > 1e-6 else 4.0
                    s_cf = float(np.clip((pred_rating - 1.0) / 4.0 * 100.0, 0.0, 100.0))
                    reasons.append(f'Rated {pred_rating:.1f}/5.0 by similar Community Feed profiles')
                else:
                    # Cold-start fallback blends favorite flags and style affinity
                    fav_boost = sum(8.0 for it in items if it.is_favorite)
                    s_cf = float(np.clip(72.0 + fav_boost, 0.0, 100.0))
 
                # 3. Weighted Hybrid Combination (Chapter 2 Eq. 19: alpha = 0.55)
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
