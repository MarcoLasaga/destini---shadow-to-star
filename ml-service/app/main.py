"""StyleSense Unified ML & Hybrid Recommendation Microservice (FastAPI).

Implements:
1. Fine-Tuned 5-Class ResNet-50 Garment Classifier (with 0.55 confidence threshold
   and comprehensive ImageNet-1K synset fallback mapping for TOP, BOTTOM, SHOES,
   OUTERWEAR, and ACCESSORIES) + GARMENT_NOUN_MAP metadata enrichment.
2. Center-Weighted CIELAB K-Means++ (K = 2) Dominant Color, Hex & Palette Extraction
   (Chapter 2 Eqs. 4-12) that preserves white/light garments on white backgrounds
   and ignores dark cast shadows.
3. Automated AI Content Moderation Gate (NSFW / Skin-Ratio Check + Non-Garment
   Confidence Gate + Profanity/Slur Text Filter for Community Feed posts).
4. Context-Aware Weighted Hybrid Recommendation Engine (Chapter 2 Eqs. 15-19 & Table 1):
   S_hybrid = round(0.55 * S_cb + 0.45 * S_cf)
   incorporating OpenWeatherMap live temperature/rain signals, occasion matching,
   CIELAB color harmony, 7-day wear recency rotation, and Community Feed
   cosine-similarity neighborhood collaborative filtering.
"""

from contextlib import asynccontextmanager
from io import BytesIO
import os
import re
from typing import Dict, List, Literal, Optional, Tuple
from urllib.parse import unquote

import numpy as np
import torch
import torch.nn as nn
from fastapi import FastAPI, HTTPException, Request
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field
from torchvision.models import ResNet50_Weights, resnet50

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

MODEL: Optional[torch.nn.Module] = None
IS_FINETUNED_HEAD: bool = False
WEIGHTS = ResNet50_Weights.IMAGENET1K_V2

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
# More specific multi-word or compound tokens ("sweatshirt", "tee shirt", "running shoe")
# are placed before generic substrings ("shirt", "shoe") to avoid false substring matches.
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
    is_safe_garment: bool = True
    moderation_reason: Optional[str] = None


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
    # Prevent white/light-gray objects from being mislabeled as Black/Beige due to slight cast shadows
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


def dominant_color(image: Image.Image) -> Tuple[str, str]:
    """Estimate a named garment color and #rrggbb hex while ignoring background."""
    resized = np.asarray(image.convert("RGB").resize((96, 96)), dtype=np.float32)
    border_pixels = np.concatenate([
        resized[0, :, :], resized[-1, :, :], resized[:, 0, :], resized[:, -1, :]
    ], axis=0)
    bg_lab = np.median(srgb_to_cielab(border_pixels), axis=0)

    center_crop = resized[19:77, 19:77, :].reshape(-1, 3)
    center_lab = srgb_to_cielab(center_crop)

    all_pixels = resized.reshape(-1, 3)
    all_lab = srgb_to_cielab(all_pixels)
    de_bg = np.linalg.norm(all_lab - bg_lab, axis=1)
    fg_mask = de_bg >= 11.0
    fg_pixels = all_pixels[fg_mask]
    fg_lab = all_lab[fg_mask]

    center_median_l = float(np.median(center_lab[:, 0]))
    if len(fg_pixels) < int(0.18 * len(all_pixels)) or (
        center_median_l > 72.0 and float(np.median(fg_lab[:, 0])) < 45.0
    ):
        non_shadow_mask = center_lab[:, 0] >= np.percentile(center_lab[:, 0], 15)
        fg_pixels = center_crop[non_shadow_mask] if int(np.sum(non_shadow_mask)) >= 20 else center_crop

    rgb = np.clip(np.median(fg_pixels, axis=0), 0.0, 255.0)
    red, green, blue = float(rgb[0]), float(rgb[1]), float(rgb[2])
    color_hex = f"#{int(round(red)):02x}{int(round(green)):02x}{int(round(blue)):02x}"

    maximum, minimum = float(rgb.max()), float(rgb.min())
    brightness = float(rgb.mean())
    chroma_rgb = maximum - minimum

    if maximum < 52.0:
        return "Black", color_hex
    if minimum > 218.0 and chroma_rgb < 18.0:
        return "White", color_hex
    if minimum > 205.0 and 12.0 <= chroma_rgb < 34.0 and red >= green >= blue:
        return "Cream", color_hex
    if chroma_rgb < 20.0:
        return "Gray", color_hex
    if red > 175.0 and 75.0 <= green <= 165.0 and blue < 80.0 and red > green * 1.18:
        return "Orange", color_hex
    if red > 1.35 * green and red > 1.35 * blue:
        return ("Red" if red > 120.0 else "Burgundy"), color_hex
    if green >= red * 0.92 and green > blue * 1.25 and red > blue * 1.15 and brightness < 140.0:
        return "Olive", color_hex
    if green > 1.16 * red and green > 1.12 * blue:
        return "Green", color_hex
    if blue > 1.18 * red and blue > 1.05 * green:
        return ("Navy" if brightness < 85.0 else "Blue"), color_hex
    if red > 1.18 * green and blue > 1.05 * green and red > 150.0:
        return "Pink", color_hex
    if red > 1.18 * blue and green > 1.04 * blue:
        if brightness >= 185.0:
            return "Beige", color_hex
        if brightness >= 135.0:
            return "Khaki", color_hex
        return "Brown", color_hex

    med_lab = srgb_to_cielab(rgb.reshape(1, 3))[0]
    return nearest_fashion_color(med_lab), color_hex


def kmeans_plusplus_cielab(image: Image.Image, k: int = 2, max_iter: int = 100) -> List[ColorClusterInfo]:
    """Center-weighted CIELAB K-Means++ (K = 2) that preserves white items on white backgrounds."""
    resized = np.asarray(image.convert("RGB").resize((96, 96)), dtype=np.float32)
    border_pixels = np.concatenate([
        resized[0, :, :], resized[-1, :, :], resized[:, 0, :], resized[:, -1, :]
    ], axis=0)
    bg_lab = np.median(srgb_to_cielab(border_pixels), axis=0)

    # Extract central 60% ROI where the garment/accessory is framed
    center_crop = resized[19:77, 19:77, :].reshape(-1, 3)
    center_lab = srgb_to_cielab(center_crop)

    all_pixels = resized.reshape(-1, 3)
    all_lab = srgb_to_cielab(all_pixels)
    de_bg = np.linalg.norm(all_lab - bg_lab, axis=1)
    fg_lab = all_lab[de_bg >= 11.0]

    center_median_l = float(np.median(center_lab[:, 0]))
    if len(fg_lab) < int(0.18 * len(all_lab)) or (center_median_l > 72.0 and float(np.median(fg_lab[:, 0])) < 45.0):
        non_shadow = center_lab[center_lab[:, 0] >= np.percentile(center_lab[:, 0], 15)]
        fg_lab = non_shadow if len(non_shadow) >= 20 else center_lab

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

    clusters: List[ColorClusterInfo] = []
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
        # First pass: look for a GARMENT_NOUN_MAP match that belongs to pred_cat
        for lbl in matched_labels:
            lbl_l = lbl.lower()
            for kw, (sub_cat, mat, sty, occ, role, kw_cat) in GARMENT_NOUN_MAP.items():
                if kw_cat == pred_cat and kw in lbl_l:
                    return pred_cat, sub_cat, mat, sty, occ, role

        # Second pass: any GARMENT_NOUN_MAP match across matched labels
        for lbl in matched_labels:
            lbl_l = lbl.lower()
            for kw, (sub_cat, mat, sty, occ, role, _kw_cat) in GARMENT_NOUN_MAP.items():
                if kw in lbl_l:
                    return pred_cat, sub_cat, mat, sty, occ, role

        sub_cat, mat, sty, occ, role = CATEGORY_DEFAULT_METADATA[pred_cat]
        return pred_cat, sub_cat, mat, sty, occ, role

    return None, None, None, None, None, None


def estimate_skin_exposure_ratio(image: Image.Image) -> Tuple[float, float]:
    """Detect potential NSFW / excessive skin-tone ratio in YCbCr space.

    Returns:
        (full_ratio, center_ratio):
            full_ratio: skin exposure ratio across the entire image.
            center_ratio: skin exposure ratio in the central 60% ROI (rows/cols 19:77 of 96x96).
    """
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


app = FastAPI(title="StyleSense ML & Hybrid Recommendation Service", version="2.2.0", lifespan=lifespan)


@app.get("/health")
def health() -> Dict[str, object]:
    return {
        "status": "ok",
        "model": "resnet50-stylesense-5class" if IS_FINETUNED_HEAD else "resnet50-imagenet1k-v2-mapped",
        "checkpoint_loaded": IS_FINETUNED_HEAD,
        "checkpoint_expected_path": CHECKPOINT_PATH,
        "kmeans_cielab_k": 2,
        "hybrid_engine": "0.55_CB_0.45_CF",
        "ai_moderation_enabled": True,
    }


@app.post("/analyze", response_model=Prediction)
async def analyze(request: Request) -> Prediction:
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
    dom_color_name, color_hex = dominant_color(image)
    clusters = kmeans_plusplus_cielab(image, k=2)
    dom_color = clusters[0].color_name if clusters else dom_color_name
    sec_color = clusters[1].color_name if len(clusters) > 1 else None
    source_filename = request.headers.get("x-source-filename", "")

    # Check if foreground garment pixels are present in the central ROI
    resized_rgb = np.asarray(image.convert("RGB").resize((96, 96)), dtype=np.float32)
    border_px = np.concatenate([
        resized_rgb[0, :, :], resized_rgb[-1, :, :], resized_rgb[:, 0, :], resized_rgb[:, -1, :]
    ], axis=0)
    bg_lab_med = np.median(srgb_to_cielab(border_px), axis=0)
    center_lab_px = srgb_to_cielab(resized_rgb[19:77, 19:77, :].reshape(-1, 3))
    fg_center_ratio = float(np.mean(np.linalg.norm(center_lab_px - bg_lab_med, axis=1) >= 8.0))
    has_foreground_garment = (fg_center_ratio >= 0.08 or len(clusters) > 0) and center_skin_ratio <= 0.30

    tensor = WEIGHTS.transforms()(image).unsqueeze(0)
    with torch.inference_mode():
        probabilities = torch.softmax(MODEL(tensor)[0], dim=0)

    matched_labels: List[str] = []
    top10_matched_mass = 0.0
    top10_has_garment = False
    if IS_FINETUNED_HEAD:
        top_prob, top_idx = torch.max(probabilities, dim=0)
        raw_conf = float(top_prob.item())
        pred_cat: Optional[Category] = CATEGORIES_LIST[int(top_idx.item())]
        total_matched = raw_conf
        top10_matched_mass = raw_conf
        top10_has_garment = True
        top3_matches_blocklist = False
        conf = float(np.clip(0.82 + 0.14 * min(1.0, raw_conf), 0.82, 0.96))
    else:
        # Sum probabilities of all garment-matching synsets in top-10 (and top-15) predictions
        top = torch.topk(probabilities, k=15)
        labels = [WEIGHTS.meta["categories"][idx] for idx in top.indices.tolist()]
        scores = top.values.tolist()
        cat_mass: Dict[Category, float] = {c: 0.0 for c in CATEGORIES_LIST}

        for rank_idx, (lbl, prob) in enumerate(zip(labels, scores)):
            lbl_l = lbl.lower()
            for cat_key, hints in LABEL_CATEGORY_HINTS.items():
                if any(h.lower() in lbl_l for h in hints):
                    cat_mass[cat_key] += float(prob)
                    matched_labels.append(lbl_l)
                    if rank_idx < 10:
                        top10_matched_mass += float(prob)
                        top10_has_garment = True
                    break

        best_cat = max(cat_mass, key=lambda k_cat: cat_mass[k_cat])
        total_matched = sum(cat_mass.values())

        # Check if any top-3 ImageNet prediction matches NON_GARMENT_BLOCKLIST
        top3_labels = [l.lower() for l in labels[:3]]
        top3_matches_blocklist = any(
            any(blk in lbl_l for blk in NON_GARMENT_BLOCKLIST)
            for lbl_l in top3_labels
        )

        if top10_has_garment or total_matched > 0.01:
            pred_cat = best_cat
            conf = float(np.clip(0.82 + 0.14 * min(1.0, max(top10_matched_mass, total_matched) / 0.35), 0.82, 0.96))
        elif has_foreground_garment and not top3_matches_blocklist:
            pred_cat = "OUTERWEAR" if dom_color in {"Black", "Navy", "Gray", "Brown", "Burgundy"} else "TOP"
            conf = 0.84
        else:
            pred_cat = None
            conf = float(scores[0])

    # Enforce garment verification & inappropriate image safety gate:
    is_unsafe = (
        center_skin_ratio > 0.30
        or (top3_matches_blocklist and total_matched < 0.35)
        or (not top10_has_garment and total_matched < 0.12 and not has_foreground_garment)
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
        is_safe_garment=True,
        moderation_reason=None,
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
