"""CPU-friendly clothing image analysis service for StyleSense.

The service accepts the normalized JPEG emitted by the Node API and returns the
same prediction shape expected by POST /api/wardrobe/analyze.
"""

from contextlib import asynccontextmanager
from io import BytesIO
from typing import Literal

import numpy as np
import torch
from fastapi import FastAPI, HTTPException, Request
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel
from torchvision.models import ResNet50_Weights, resnet50

Category = Literal['TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'ACCESSORIES']
Style = Literal['CASUAL', 'FORMAL', 'SPORTY', 'STREETWEAR', 'MINIMALIST', 'BOHEMIAN', 'VINTAGE', 'CLASSIC']

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MODEL: torch.nn.Module | None = None
WEIGHTS = ResNet50_Weights.IMAGENET1K_V2

# ImageNet has no general "clothing" class. These are the garment labels in its
# pretrained CNN vocabulary, ordered by the product categories we support.
LABEL_CATEGORY_HINTS: dict[Category, tuple[str, ...]] = {
    'TOP': ('jersey', 'sweatshirt', 'cardigan', 'shirt', 'maillot', 'vestment'),
    'BOTTOM': ('jean', 'miniskirt', 'kilt', 'sarong'),
    'SHOES': ('shoe', 'sandal', 'loafer', 'boot', 'sneaker'),
    'OUTERWEAR': ('coat', 'jacket', 'suit', 'trench', 'poncho'),
    'ACCESSORIES': ('backpack', 'handbag', 'purse', 'wallet', 'tie', 'scarf', 'belt', 'hat', 'watch'),
}


class Prediction(BaseModel):
    category: Category | None = None
    color: str | None = None
    style: Style | None = None
    confidence: float


def category_from_labels(labels: list[str], probabilities: list[float]) -> tuple[Category | None, float, str]:
    for label, probability in zip(labels, probabilities):
        label_lower = label.lower()
        for category, hints in LABEL_CATEGORY_HINTS.items():
            if any(hint in label_lower for hint in hints):
                return category, probability, label_lower
    return None, probabilities[0], labels[0].lower()


def style_from_label(category: Category | None, label: str) -> Style | None:
    if any(hint in label for hint in ('running shoe', 'sneaker', 'jersey', 'maillot')):
        return 'SPORTY'
    if any(hint in label for hint in ('suit', 'tie', 'loafer', 'trench')):
        return 'FORMAL'
    if category in ('TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR'):
        return 'CASUAL'
    return None


def dominant_color(image: Image.Image) -> str:
    """Estimate a named garment color while ignoring near-white backgrounds."""
    pixels = np.asarray(image.convert('RGB').resize((96, 96)), dtype=np.float32).reshape(-1, 3)
    saturation = pixels.max(axis=1) - pixels.min(axis=1)
    brightness = pixels.mean(axis=1)
    garment_pixels = pixels[(brightness < 242) & ((saturation > 12) | (brightness < 100))]
    rgb = np.median(garment_pixels if len(garment_pixels) else pixels, axis=0)
    red, green, blue = rgb
    maximum, minimum = rgb.max(), rgb.min()
    if maximum < 55:
        return 'Black'
    if minimum > 215 and maximum - minimum < 24:
        return 'White'
    if maximum - minimum < 22:
        return 'Gray'
    if red > 1.35 * green and red > 1.35 * blue:
        return 'Red' if red > 115 else 'Burgundy'
    if green > 1.18 * red and green > 1.12 * blue:
        return 'Green'
    if blue > 1.18 * red and blue > 1.05 * green:
        return 'Blue'
    if red > 1.25 * blue and green > 1.05 * blue:
        return 'Brown' if brightness < 145 else 'Beige'
    if red > 1.18 * green and blue > 1.08 * green:
        return 'Pink'
    return 'Navy' if blue > red else 'Brown'


@asynccontextmanager
async def lifespan(_: FastAPI):
    global MODEL
    # Weights download once on the first container start and are cached by torch.
    MODEL = resnet50(weights=WEIGHTS).eval()
    yield
    MODEL = None


app = FastAPI(title='StyleSense CNN image analysis', version='1.0.0', lifespan=lifespan)


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok', 'model': 'resnet50-imagenet1k-v2'}


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

    tensor = WEIGHTS.transforms()(image).unsqueeze(0)
    with torch.inference_mode():
        probabilities = torch.softmax(MODEL(tensor)[0], dim=0)
    top = torch.topk(probabilities, k=8)
    labels = [WEIGHTS.meta['categories'][index] for index in top.indices.tolist()]
    scores = top.values.tolist()
    category, confidence, label = category_from_labels(labels, scores)
    return Prediction(category=category, color=dominant_color(image), style=style_from_label(category, label), confidence=round(float(confidence), 4))
