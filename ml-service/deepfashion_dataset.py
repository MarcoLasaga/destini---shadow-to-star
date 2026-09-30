"""DeepFashion Category & Attribute Prediction Dataset Ingestion & Mapping.

Provides reproducible dataset discovery, annotation parsing, taxonomy mapping
to StyleSense categories (TOP, BOTTOM, OUTERWEAR, SHOES, ACCESSORIES),
preservation of ambiguous/unmapped categories, official train/val/test split
partitioning, class imbalance weighting, manifest serialization, and a PyTorch
Dataset implementation.
"""
from __future__ import annotations

import json
import os
import pathlib
import random
import sys
from collections import Counter
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple, Union

# Bootstrap DLL directories on Windows for PyTorch / Intel MKL if needed
if sys.platform == "win32":
    for _dll_candidate in [
        pathlib.Path(sys.executable).parent / "Library" / "bin",
        pathlib.Path(os.environ.get("LOCALAPPDATA", ""))
        / "Packages"
        / "PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0"
        / "LocalCache"
        / "local-packages"
        / "Library"
        / "bin",
        pathlib.Path(os.environ.get("LOCALAPPDATA", ""))
        / "Packages"
        / "PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0"
        / "LocalCache"
        / "local-packages"
        / "Python311"
        / "site-packages"
        / "torch"
        / "lib",
    ]:
        if _dll_candidate.exists():
            try:
                os.add_dll_directory(str(_dll_candidate))
            except Exception:
                pass

try:
    import torch
    from torch.utils.data import Dataset
    from PIL import Image
except ImportError:
    torch = None
    Dataset = object  # type: ignore[misc,assignment]
    Image = None  # type: ignore[assignment]


# StyleSense target taxonomy
STYLESENSE_TAXONOMY: tuple[str, ...] = ("TOP", "BOTTOM", "SHOES", "OUTERWEAR", "ACCESSORIES")

# Status constants
STATUS_MAPPED = "MAPPED"
STATUS_AMBIGUOUS_UNMAPPED = "AMBIGUOUS_UNMAPPED"
STATUS_UNAVAILABLE = "UNAVAILABLE"

# Canonical 50 DeepFashion categories and their explicit StyleSense mapping
CANONICAL_DEEPFASHION_CATEGORIES: dict[str, dict[str, Any]] = {
    # Upper-body (type_id 1)
    "Anorak": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "OUTERWEAR",
        "status": STATUS_MAPPED,
        "rationale": "Hooded weather-resistant pullover jacket designed for outerwear layering.",
    },
    "Blazer": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "OUTERWEAR",
        "status": STATUS_MAPPED,
        "rationale": "Tailored jacket worn over shirts or tops for formal/smart-casual occasions.",
    },
    "Blouse": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "TOP",
        "status": STATUS_MAPPED,
        "rationale": "Standard upper-body shirt garment.",
    },
    "Bomber": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "OUTERWEAR",
        "status": STATUS_MAPPED,
        "rationale": "Short zippered or snap outerwear jacket with ribbed cuffs and hem.",
    },
    "Button-Down": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "TOP",
        "status": STATUS_MAPPED,
        "rationale": "Collared buttoned shirt; core top garment.",
    },
    "Cardigan": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "OUTERWEAR",
        "status": STATUS_MAPPED,
        "rationale": "Knitted open-front layering garment worn over a top.",
    },
    "Flannel": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "TOP",
        "status": STATUS_MAPPED,
        "rationale": "Woven flannel shirt worn as upper-body piece.",
    },
    "Halter": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "TOP",
        "status": STATUS_MAPPED,
        "rationale": "Sleeveless halter top.",
    },
    "Henley": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "TOP",
        "status": STATUS_MAPPED,
        "rationale": "Collarless pullover top with buttoned placket.",
    },
    "Hoodie": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "OUTERWEAR",
        "status": STATUS_MAPPED,
        "rationale": "Layering hooded sweatshirt/jacket.",
    },
    "Jacket": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "OUTERWEAR",
        "status": STATUS_MAPPED,
        "rationale": "Core outerwear layer for warmth and styling.",
    },
    "Jersey": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "TOP",
        "status": STATUS_MAPPED,
        "rationale": "Athletic knit shirt / pullover top.",
    },
    "Parka": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "OUTERWEAR",
        "status": STATUS_MAPPED,
        "rationale": "Heavy cold-weather coat with hood.",
    },
    "Peacoat": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "OUTERWEAR",
        "status": STATUS_MAPPED,
        "rationale": "Double-breasted short coat.",
    },
    "Poncho": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "OUTERWEAR",
        "status": STATUS_MAPPED,
        "rationale": "Outer garment designed to keep the body warm.",
    },
    "Sweater": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "TOP",
        "status": STATUS_MAPPED,
        "rationale": "Knitted top garment.",
    },
    "Tank": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "TOP",
        "status": STATUS_MAPPED,
        "rationale": "Sleeveless top garment.",
    },
    "Tee": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "TOP",
        "status": STATUS_MAPPED,
        "rationale": "T-shirt; staple casual top.",
    },
    "Top": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "TOP",
        "status": STATUS_MAPPED,
        "rationale": "Generic upper-body shirt.",
    },
    "Turtleneck": {
        "type_id": 1,
        "type_name": "upper-body",
        "stylesense_category": "TOP",
        "status": STATUS_MAPPED,
        "rationale": "High close-fitting collar knit top.",
    },
    # Lower-body (type_id 2)
    "Capris": {
        "type_id": 2,
        "type_name": "lower-body",
        "stylesense_category": "BOTTOM",
        "status": STATUS_MAPPED,
        "rationale": "Cropped pants extending between knee and ankle.",
    },
    "Chinos": {
        "type_id": 2,
        "type_name": "lower-body",
        "stylesense_category": "BOTTOM",
        "status": STATUS_MAPPED,
        "rationale": "Cotton twill trousers.",
    },
    "Culottes": {
        "type_id": 2,
        "type_name": "lower-body",
        "stylesense_category": "BOTTOM",
        "status": STATUS_MAPPED,
        "rationale": "Wide-legged knee or calf-length cropped pants.",
    },
    "Cutoffs": {
        "type_id": 2,
        "type_name": "lower-body",
        "stylesense_category": "BOTTOM",
        "status": STATUS_MAPPED,
        "rationale": "Frayed denim shorts.",
    },
    "Gauchos": {
        "type_id": 2,
        "type_name": "lower-body",
        "stylesense_category": "BOTTOM",
        "status": STATUS_MAPPED,
        "rationale": "Wide-legged mid-calf trousers.",
    },
    "Jeans": {
        "type_id": 2,
        "type_name": "lower-body",
        "stylesense_category": "BOTTOM",
        "status": STATUS_MAPPED,
        "rationale": "Denim pants.",
    },
    "Jeggings": {
        "type_id": 2,
        "type_name": "lower-body",
        "stylesense_category": "BOTTOM",
        "status": STATUS_MAPPED,
        "rationale": "Denim-styled stretch leggings.",
    },
    "Jodhpurs": {
        "type_id": 2,
        "type_name": "lower-body",
        "stylesense_category": "BOTTOM",
        "status": STATUS_MAPPED,
        "rationale": "Equestrian trousers.",
    },
    "Joggers": {
        "type_id": 2,
        "type_name": "lower-body",
        "stylesense_category": "BOTTOM",
        "status": STATUS_MAPPED,
        "rationale": "Athletic tapered pants with elastic ankles.",
    },
    "Leggings": {
        "type_id": 2,
        "type_name": "lower-body",
        "stylesense_category": "BOTTOM",
        "status": STATUS_MAPPED,
        "rationale": "Tight-fitting elastic lower-body garment.",
    },
    "Sarong": {
        "type_id": 2,
        "type_name": "lower-body",
        "stylesense_category": "BOTTOM",
        "status": STATUS_MAPPED,
        "rationale": "Wrap-around lower-body garment.",
    },
    "Shorts": {
        "type_id": 2,
        "type_name": "lower-body",
        "stylesense_category": "BOTTOM",
        "status": STATUS_MAPPED,
        "rationale": "Trousers ending above or at the knee.",
    },
    "Skirt": {
        "type_id": 2,
        "type_name": "lower-body",
        "stylesense_category": "BOTTOM",
        "status": STATUS_MAPPED,
        "rationale": "Single-piece garment hanging from waist downwards.",
    },
    "Sweatpants": {
        "type_id": 2,
        "type_name": "lower-body",
        "stylesense_category": "BOTTOM",
        "status": STATUS_MAPPED,
        "rationale": "Casual warm athletic trousers.",
    },
    "Sweatshorts": {
        "type_id": 2,
        "type_name": "lower-body",
        "stylesense_category": "BOTTOM",
        "status": STATUS_MAPPED,
        "rationale": "Athletic shorts made from sweatshirt fleece.",
    },
    "Trunks": {
        "type_id": 2,
        "type_name": "lower-body",
        "stylesense_category": "BOTTOM",
        "status": STATUS_MAPPED,
        "rationale": "Swim/athletic shorts.",
    },
    # Full-body (type_id 3)
    "Coat": {
        "type_id": 3,
        "type_name": "full-body",
        "stylesense_category": "OUTERWEAR",
        "status": STATUS_MAPPED,
        "rationale": "Full-length outer coat worn over outfits for weather protection.",
    },
    "Cape": {
        "type_id": 3,
        "type_name": "full-body",
        "stylesense_category": "OUTERWEAR",
        "status": STATUS_MAPPED,
        "rationale": "Sleeveless outer layering garment.",
    },
    # Ambiguous / Excluded Full-body Categories (preserved explicitly)
    "Dress": {
        "type_id": 3,
        "type_name": "full-body",
        "stylesense_category": None,
        "status": STATUS_AMBIGUOUS_UNMAPPED,
        "rationale": "One-piece garment spanning torso and legs. StyleSense candidate generation is built on Top x Bottom pairing; forcing into TOP or BOTTOM causes incompatible pairing.",
    },
    "Jumpsuit": {
        "type_id": 3,
        "type_name": "full-body",
        "stylesense_category": None,
        "status": STATUS_AMBIGUOUS_UNMAPPED,
        "rationale": "One-piece garment incorporating top and trousers. Excluded to avoid invalid Top x Bottom combinations.",
    },
    "Romper": {
        "type_id": 3,
        "type_name": "full-body",
        "stylesense_category": None,
        "status": STATUS_AMBIGUOUS_UNMAPPED,
        "rationale": "One-piece top-and-shorts garment. Excluded from 5-piece recommendation slots.",
    },
    "Shirtdress": {
        "type_id": 3,
        "type_name": "full-body",
        "stylesense_category": None,
        "status": STATUS_AMBIGUOUS_UNMAPPED,
        "rationale": "Full-body dress with shirt styling. Ambiguous full-body piece.",
    },
    "Sundress": {
        "type_id": 3,
        "type_name": "full-body",
        "stylesense_category": None,
        "status": STATUS_AMBIGUOUS_UNMAPPED,
        "rationale": "Casual summer full-body dress. Ambiguous full-body piece.",
    },
    "Caftan": {
        "type_id": 3,
        "type_name": "full-body",
        "stylesense_category": None,
        "status": STATUS_AMBIGUOUS_UNMAPPED,
        "rationale": "Long loose full-body tunic/robe. Loungewear/full-body piece.",
    },
    "Kaftan": {
        "type_id": 3,
        "type_name": "full-body",
        "stylesense_category": None,
        "status": STATUS_AMBIGUOUS_UNMAPPED,
        "rationale": "Variant spelling of Caftan; full-body garment.",
    },
    "Coverup": {
        "type_id": 3,
        "type_name": "full-body",
        "stylesense_category": None,
        "status": STATUS_AMBIGUOUS_UNMAPPED,
        "rationale": "Beach/swimwear cover garment. Incompatible with standard street outfit taxonomy.",
    },
    "Kimono": {
        "type_id": 3,
        "type_name": "full-body",
        "stylesense_category": None,
        "status": STATUS_AMBIGUOUS_UNMAPPED,
        "rationale": "Full-length traditional/layering robe. Preserved as ambiguous full-body garment.",
    },
    "Nightdress": {
        "type_id": 3,
        "type_name": "full-body",
        "stylesense_category": None,
        "status": STATUS_AMBIGUOUS_UNMAPPED,
        "rationale": "Sleepwear; outside standard daytime wardrobe recommendation.",
    },
    "Onesie": {
        "type_id": 3,
        "type_name": "full-body",
        "stylesense_category": None,
        "status": STATUS_AMBIGUOUS_UNMAPPED,
        "rationale": "One-piece loungewear/sleepwear.",
    },
    "Robe": {
        "type_id": 3,
        "type_name": "full-body",
        "stylesense_category": None,
        "status": STATUS_AMBIGUOUS_UNMAPPED,
        "rationale": "Bathrobe/loungewear; not standard daytime street attire.",
    },
}

# Unavailable taxonomy categories in this benchmark
UNAVAILABLE_CATEGORIES: dict[str, dict[str, str]] = {
    "SHOES": {
        "reason": "DeepFashion Category and Attribute Prediction benchmark contains only apparel garments (upper, lower, full body). Footwear is not included.",
        "resolution": "Must be supplemented via StyleSense user wardrobe export (ml-service/export_dataset.py) or external shoe datasets.",
    },
    "ACCESSORIES": {
        "reason": "DeepFashion Category and Attribute Prediction benchmark does not include bags, belts, hats, jewelry, or watches.",
        "resolution": "Must be supplemented via StyleSense user wardrobe export or external accessories datasets.",
    },
}

# Style attribute mapping
STYLE_ATTRIBUTE_MAPPING: dict[str, str] = {
    "casual": "CASUAL",
    "everyday": "CASUAL",
    "relaxed": "CASUAL",
    "basic": "CASUAL",
    "formal": "FORMAL",
    "business": "FORMAL",
    "office": "FORMAL",
    "work": "FORMAL",
    "suit": "FORMAL",
    "sporty": "SPORTY",
    "athletic": "SPORTY",
    "active": "SPORTY",
    "gym": "SPORTY",
    "workout": "SPORTY",
    "track": "SPORTY",
    "street": "STREETWEAR",
    "streetwear": "STREETWEAR",
    "punk": "STREETWEAR",
    "grunge": "STREETWEAR",
    "skate": "STREETWEAR",
    "hip-hop": "STREETWEAR",
    "minimal": "MINIMALIST",
    "minimalist": "MINIMALIST",
    "simple": "MINIMALIST",
    "clean": "MINIMALIST",
    "neutral": "MINIMALIST",
    "boho": "BOHEMIAN",
    "bohemian": "BOHEMIAN",
    "ethnic": "BOHEMIAN",
    "tribal": "BOHEMIAN",
    "peasant": "BOHEMIAN",
    "folk": "BOHEMIAN",
    "vintage": "VINTAGE",
    "retro": "VINTAGE",
    "nostalgic": "VINTAGE",
    "classic": "CLASSIC",
    "elegant": "CLASSIC",
    "traditional": "CLASSIC",
    "preppy": "CLASSIC",
    "tailored": "CLASSIC",
}


@dataclass
class DeepFashionCategory:
    name: str
    type_id: int
    type_name: str
    stylesense_category: Optional[str]
    status: str
    rationale: str


@dataclass
class DeepFashionItem:
    image_path: str
    raw_category_name: str
    raw_category_id: int
    stylesense_category: Optional[str]
    split: str  # 'train', 'val', 'test'
    status: str  # 'MAPPED', 'AMBIGUOUS_UNMAPPED'
    bbox: Optional[Tuple[int, int, int, int]] = None  # (x1, y1, x2, y2)
    style: Optional[str] = None
    attributes: List[str] = field(default_factory=list)


@dataclass
class DatasetManifest:
    items: List[DeepFashionItem]
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "metadata": self.metadata,
            "items": [asdict(item) for item in self.items],
        }

    def to_json(self, filepath: Union[str, Path]) -> None:
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DatasetManifest:
        items = []
        for item_dict in data.get("items", []):
            bbox = item_dict.get("bbox")
            if bbox is not None:
                bbox = tuple(bbox)
            items.append(
                DeepFashionItem(
                    image_path=item_dict["image_path"],
                    raw_category_name=item_dict["raw_category_name"],
                    raw_category_id=item_dict["raw_category_id"],
                    stylesense_category=item_dict.get("stylesense_category"),
                    split=item_dict["split"],
                    status=item_dict["status"],
                    bbox=bbox,  # type: ignore[arg-type]
                    style=item_dict.get("style"),
                    attributes=item_dict.get("attributes", []),
                )
            )
        return cls(items=items, metadata=data.get("metadata", {}))

    @classmethod
    def from_json(cls, filepath: Union[str, Path]) -> DatasetManifest:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls.from_dict(data)

    def get_split(self, split: str) -> List[DeepFashionItem]:
        return [item for item in self.items if item.split == split]

    def filter_mapped_only(self) -> DatasetManifest:
        filtered = [item for item in self.items if item.status == STATUS_MAPPED and item.stylesense_category is not None]
        new_meta = dict(self.metadata)
        new_meta["filtered_mapped_only"] = True
        new_meta["item_count"] = len(filtered)
        return DatasetManifest(items=filtered, metadata=new_meta)

    def get_class_distribution(self, split: Optional[str] = None) -> Dict[str, int]:
        items = self.items if split is None else self.get_split(split)
        counts: Counter[str] = Counter()
        for item in items:
            key = item.stylesense_category or f"AMBIGUOUS:{item.raw_category_name}"
            counts[key] += 1
        return dict(sorted(counts.items()))


def find_deepfashion_files(root_dir: Union[str, Path]) -> dict[str, Path]:
    """Discover DeepFashion Category and Attribute Prediction annotation files and img folder.

    Supports both flat directory structure and official CUHK Anno/Eval structure.
    """
    root = Path(root_dir).resolve()
    if not root.exists():
        raise FileNotFoundError(f"DeepFashion root directory does not exist: {root}")

    found: dict[str, Path] = {}

    candidates: dict[str, list[str]] = {
        "category_cloth": ["list_category_cloth.txt", "Anno/list_category_cloth.txt", "Anno_fine/list_category_cloth.txt"],
        "eval_partition": ["list_eval_partition.txt", "Eval/list_eval_partition.txt"],
        "category_img": ["list_category_img.txt", "Anno/list_category_img.txt", "Anno_fine/list_category_img.txt"],
        "bbox": ["list_bbox.txt", "Anno/list_bbox.txt"],
        "attr_cloth": ["list_attr_cloth.txt", "Anno/list_attr_cloth.txt"],
        "attr_img": ["list_attr_img.txt", "Anno/list_attr_img.txt"],
        "img_dir": ["img", "images", "."],
    }

    for key, relative_paths in candidates.items():
        for rel_path in relative_paths:
            candidate_path = root / rel_path
            if candidate_path.exists():
                found[key] = candidate_path
                break

    # Required files for category ingestion
    required = ["category_cloth", "eval_partition", "category_img"]
    missing = [req for req in required if req not in found]
    if missing:
        raise FileNotFoundError(
            f"Missing required DeepFashion annotation files in '{root}': {missing}.\n"
            f"Expected either at root or inside 'Anno/' and 'Eval/' subdirectories."
        )

    return found


def parse_category_cloth(filepath: Union[str, Path]) -> dict[int, DeepFashionCategory]:
    """Parse list_category_cloth.txt into 1-indexed dictionary of categories."""
    path = Path(filepath)
    categories: dict[int, DeepFashionCategory] = {}
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        lines = [line.strip() for line in f if line.strip()]

    # Skip count if line is a single integer
    start_idx = 0
    if lines and lines[0].isdigit():
        start_idx = 1
    # Skip header line if present
    if start_idx < len(lines) and ("category_name" in lines[start_idx].lower() or "type" in lines[start_idx].lower()):
        start_idx += 1

    idx = 1
    for line in lines[start_idx:]:
        parts = line.split()
        if len(parts) >= 2:
            name = parts[0]
            try:
                type_id = int(parts[1])
            except ValueError:
                type_id = 1
        elif len(parts) == 1:
            name = parts[0]
            type_id = 1
        else:
            continue

        type_names = {1: "upper-body", 2: "lower-body", 3: "full-body"}
        type_name = type_names.get(type_id, "unknown")

        mapping_info = CANONICAL_DEEPFASHION_CATEGORIES.get(name)
        if mapping_info:
            cat = DeepFashionCategory(
                name=name,
                type_id=type_id,
                type_name=type_name,
                stylesense_category=mapping_info["stylesense_category"],
                status=mapping_info["status"],
                rationale=mapping_info["rationale"],
            )
        else:
            # Fallback for unknown categories: preserve as ambiguous, do not invent mapping
            cat = DeepFashionCategory(
                name=name,
                type_id=type_id,
                type_name=type_name,
                stylesense_category=None,
                status=STATUS_AMBIGUOUS_UNMAPPED,
                rationale="Unrecognized DeepFashion category; preserved as ambiguous.",
            )
        categories[idx] = cat
        idx += 1

    return categories


def parse_eval_partition(filepath: Union[str, Path]) -> dict[str, str]:
    """Parse list_eval_partition.txt returning {image_relpath: 'train'|'val'|'test'}."""
    path = Path(filepath)
    partitions: dict[str, str] = {}
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        lines = [line.strip() for line in f if line.strip()]

    start_idx = 0
    if lines and lines[0].isdigit():
        start_idx = 1
    if start_idx < len(lines) and ("image_name" in lines[start_idx].lower() or "eval_status" in lines[start_idx].lower()):
        start_idx += 1

    for line in lines[start_idx:]:
        parts = line.split()
        if len(parts) >= 2:
            img_name = parts[0].replace("\\", "/")
            split = parts[1].lower()
            partitions[img_name] = split

    return partitions


def parse_category_img(filepath: Union[str, Path]) -> dict[str, int]:
    """Parse list_category_img.txt returning {image_relpath: 1_indexed_category_id}."""
    path = Path(filepath)
    cat_img: dict[str, int] = {}
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        lines = [line.strip() for line in f if line.strip()]

    start_idx = 0
    if lines and lines[0].isdigit():
        start_idx = 1
    if start_idx < len(lines) and ("image_name" in lines[start_idx].lower() or "category_label" in lines[start_idx].lower()):
        start_idx += 1

    for line in lines[start_idx:]:
        parts = line.split()
        if len(parts) >= 2:
            img_name = parts[0].replace("\\", "/")
            try:
                cat_id = int(parts[1])
                cat_img[img_name] = cat_id
            except ValueError:
                continue

    return cat_img


def parse_bbox(filepath: Union[str, Path]) -> dict[str, Tuple[int, int, int, int]]:
    """Parse list_bbox.txt returning {image_relpath: (x1, y1, x2, y2)}."""
    path = Path(filepath)
    bboxes: dict[str, Tuple[int, int, int, int]] = {}
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        lines = [line.strip() for line in f if line.strip()]

    start_idx = 0
    if lines and lines[0].isdigit():
        start_idx = 1
    if start_idx < len(lines) and "image_name" in lines[start_idx].lower():
        start_idx += 1

    for line in lines[start_idx:]:
        parts = line.split()
        if len(parts) >= 5:
            img_name = parts[0].replace("\\", "/")
            try:
                x1, y1, x2, y2 = int(parts[1]), int(parts[2]), int(parts[3]), int(parts[4])
                bboxes[img_name] = (x1, y1, x2, y2)
            except ValueError:
                continue

    return bboxes


def build_deepfashion_manifest(
    root_dir: Union[str, Path],
    include_ambiguous: bool = True,
    verify_images_exist: bool = False,
) -> DatasetManifest:
    """Ingest DeepFashion annotations and build a comprehensive DatasetManifest.

    Args:
        root_dir: DeepFashion dataset directory.
        include_ambiguous: If True, ambiguous items (Dress, Jumpsuit, etc.) are included
                           with stylesense_category=None and status='AMBIGUOUS_UNMAPPED'.
        verify_images_exist: If True, checks that the image file exists on disk.
    """
    files = find_deepfashion_files(root_dir)
    categories = parse_category_cloth(files["category_cloth"])
    partitions = parse_eval_partition(files["eval_partition"])
    category_imgs = parse_category_img(files["category_img"])

    bboxes: dict[str, Tuple[int, int, int, int]] = {}
    if "bbox" in files:
        bboxes = parse_bbox(files["bbox"])

    root = Path(root_dir).resolve()
    items: List[DeepFashionItem] = []

    # Iterate over all images registered in partitions
    for img_relpath, split in partitions.items():
        cat_id = category_imgs.get(img_relpath)
        if cat_id is None:
            continue

        cat_info = categories.get(cat_id)
        if not cat_info:
            continue

        if not include_ambiguous and cat_info.status != STATUS_MAPPED:
            continue

        if verify_images_exist:
            full_img_path = root / img_relpath
            if not full_img_path.exists():
                continue

        bbox = bboxes.get(img_relpath)

        item = DeepFashionItem(
            image_path=img_relpath,
            raw_category_name=cat_info.name,
            raw_category_id=cat_id,
            stylesense_category=cat_info.stylesense_category,
            split=split,
            status=cat_info.status,
            bbox=bbox,
        )
        items.append(item)

    metadata = {
        "dataset_name": "DeepFashion Category and Attribute Prediction",
        "root_dir": str(root),
        "total_items": len(items),
        "mapped_categories": sorted(list({c.stylesense_category for c in categories.values() if c.stylesense_category})),
        "unavailable_categories": list(UNAVAILABLE_CATEGORIES.keys()),
        "splits": dict(Counter(item.split for item in items)),
        "class_distribution_all": dict(Counter(item.stylesense_category or f"AMBIGUOUS:{item.raw_category_name}" for item in items)),
    }

    return DatasetManifest(items=items, metadata=metadata)


def calculate_class_weights(
    manifest: DatasetManifest,
    split: str = "train",
    classes: Optional[Sequence[str]] = None,
) -> dict[str, float]:
    """Calculate balanced inverse-frequency class weights for training.

    Weight formula: total_samples / (num_classes * class_count)
    """
    target_classes = list(classes or [c for c in STYLESENSE_TAXONOMY if c not in UNAVAILABLE_CATEGORIES])
    items = [
        item
        for item in manifest.get_split(split)
        if item.stylesense_category in target_classes
    ]
    if not items:
        return {c: 1.0 for c in target_classes}

    counts = Counter(item.stylesense_category for item in items)
    total = len(items)
    num_classes = len(target_classes)

    weights: dict[str, float] = {}
    for c in target_classes:
        count = counts.get(c, 0)
        weights[c] = (total / (num_classes * count)) if count > 0 else 0.0

    return weights


def compute_sample_weights(
    manifest: DatasetManifest,
    split: str = "train",
    classes: Optional[Sequence[str]] = None,
) -> list[float]:
    """Compute per-sample weights for torch.utils.data.WeightedRandomSampler."""
    class_weights = calculate_class_weights(manifest, split=split, classes=classes)
    items = manifest.get_split(split)
    sample_weights: list[float] = []
    for item in items:
        if item.stylesense_category and item.stylesense_category in class_weights:
            sample_weights.append(class_weights[item.stylesense_category])
        else:
            sample_weights.append(0.0)
    return sample_weights


def balance_manifest(
    manifest: DatasetManifest,
    max_per_class: Optional[int] = None,
    min_per_class: int = 0,
    seed: int = 42,
) -> DatasetManifest:
    """Balance the manifest across classes and splits.

    Caps classes at max_per_class per split while ensuring reproducible stratification.
    """
    rng = random.Random(seed)
    grouped: dict[tuple[str, str], list[DeepFashionItem]] = {}

    for item in manifest.items:
        key = (item.split, item.stylesense_category or "AMBIGUOUS")
        grouped.setdefault(key, []).append(item)

    balanced_items: list[DeepFashionItem] = []
    for key, items in grouped.items():
        if len(items) < min_per_class:
            continue
        rng.shuffle(items)
        if max_per_class is not None and len(items) > max_per_class:
            balanced_items.extend(items[:max_per_class])
        else:
            balanced_items.extend(items)

    new_meta = dict(manifest.metadata)
    new_meta["balanced"] = True
    new_meta["max_per_class"] = max_per_class
    new_meta["item_count"] = len(balanced_items)
    return DatasetManifest(items=balanced_items, metadata=new_meta)


def export_to_imagefolder(
    manifest: DatasetManifest,
    deepfashion_root: Union[str, Path],
    output_dir: Union[str, Path],
    split: str = "train",
    copy_mode: str = "copy",  # 'copy', 'symlink', 'hardlink'
    max_per_class: Optional[int] = None,
    create_empty_placeholders: bool = True,
    seed: int = 42,
) -> dict[str, int]:
    """Export items to the ImageFolder directory structure expected by train.py.

    Layout:
      output_dir/
        TOP/*.jpg
        BOTTOM/*.jpg
        OUTERWEAR/*.jpg
        SHOES/ (placeholder / supplemented)
        ACCESSORIES/ (placeholder / supplemented)

    Args:
        manifest: Ingested DatasetManifest.
        deepfashion_root: Root folder containing the image files.
        output_dir: Output folder.
        split: Split to export ('train', 'val', 'test', or 'all').
        copy_mode: 'copy', 'symlink', or 'hardlink'.
        max_per_class: Optional limit per class.
        create_empty_placeholders: Create SHOES and ACCESSORIES folders with documentation
                                  to satisfy train.py VALID_CLASSES requirements.
        seed: Random seed for subsampling.
    """
    root = Path(deepfashion_root).resolve()
    out = Path(output_dir).resolve()
    rng = random.Random(seed)

    # Initialize all 5 StyleSense category directories
    for cat in STYLESENSE_TAXONOMY:
        cat_dir = out / cat
        cat_dir.mkdir(parents=True, exist_ok=True)
        # Create .gitkeep so empty directories are trackable if needed without tracking images
        (cat_dir / ".gitkeep").touch()

    if create_empty_placeholders:
        for missing_cat, info in UNAVAILABLE_CATEGORIES.items():
            readme = out / missing_cat / "README.md"
            if not readme.exists():
                readme.write_text(
                    f"# {missing_cat}\n\n"
                    f"**Notice:** {info['reason']}\n\n"
                    f"**Supplementation Strategy:** {info['resolution']}\n",
                    encoding="utf-8",
                )

    # Filter items
    items_to_export = [
        item
        for item in manifest.items
        if (split == "all" or item.split == split)
        and item.stylesense_category is not None
        and item.status == STATUS_MAPPED
    ]

    # Group by category for optional subsampling
    by_category: dict[str, list[DeepFashionItem]] = {}
    for item in items_to_export:
        by_category.setdefault(item.stylesense_category, []).append(item)  # type: ignore[arg-type]

    exported_counts: dict[str, int] = {c: 0 for c in STYLESENSE_TAXONOMY}

    for cat, items in by_category.items():
        rng.shuffle(items)
        selected = items[:max_per_class] if max_per_class is not None else items

        for item in selected:
            src_path = root / item.image_path
            if not src_path.exists():
                continue

            # Deterministic, collision-resistant filename
            safe_name = f"df_{item.split}_{Path(item.image_path).parent.name}_{Path(item.image_path).name}"
            dst_path = out / cat / safe_name

            if dst_path.exists():
                exported_counts[cat] += 1
                continue

            try:
                if copy_mode == "symlink":
                    dst_path.symlink_to(src_path)
                elif copy_mode == "hardlink":
                    os.link(src_path, dst_path)
                else:
                    import shutil
                    shutil.copy2(src_path, dst_path)
                exported_counts[cat] += 1
            except Exception as e:
                # Fallback to copy if symlink/hardlink fails on Windows
                try:
                    import shutil
                    shutil.copy2(src_path, dst_path)
                    exported_counts[cat] += 1
                except Exception:
                    pass

    return exported_counts


class DeepFashionDataset(Dataset):
    """PyTorch Dataset for DeepFashion mapped to StyleSense taxonomy.

    Directly compatible with PyTorch DataLoader and WeightedRandomSampler.
    """

    def __init__(
        self,
        manifest_or_path: Union[DatasetManifest, str, Path],
        deepfashion_root: Union[str, Path],
        split: str = "train",
        transform: Optional[Any] = None,
        crop_bbox: bool = False,
        classes: Optional[Sequence[str]] = None,
    ):
        if torch is None:
            raise RuntimeError("PyTorch is required to use DeepFashionDataset.")

        if isinstance(manifest_or_path, (str, Path)):
            self.manifest = DatasetManifest.from_json(manifest_or_path)
        else:
            self.manifest = manifest_or_path

        self.root = Path(deepfashion_root).resolve()
        self.split = split
        self.transform = transform
        self.crop_bbox = crop_bbox

        # Classes configured
        self.classes: list[str] = list(classes or [c for c in STYLESENSE_TAXONOMY if c not in UNAVAILABLE_CATEGORIES])
        self.class_to_idx: dict[str, int] = {c: i for i, c in enumerate(self.classes)}

        # Filter items for this split and active classes
        self.samples: list[DeepFashionItem] = [
            item
            for item in self.manifest.get_split(split)
            if item.status == STATUS_MAPPED and item.stylesense_category in self.class_to_idx
        ]

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[Any, int]:
        item = self.samples[idx]
        img_path = self.root / item.image_path

        if Image is None:
            raise RuntimeError("PIL (Pillow) is required to load images.")

        image = Image.open(img_path).convert("RGB")

        if self.crop_bbox and item.bbox:
            x1, y1, x2, y2 = item.bbox
            # Guard against invalid box coordinates
            w, h = image.size
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            if x2 > x1 and y2 > y1:
                image = image.crop((x1, y1, x2, y2))

        if self.transform:
            image = self.transform(image)

        label_idx = self.class_to_idx[item.stylesense_category]  # type: ignore[index]
        return image, label_idx

    def get_sample_weights(self) -> list[float]:
        """Compute sample weights for WeightedRandomSampler."""
        targets = [self.class_to_idx[item.stylesense_category] for item in self.samples]  # type: ignore[index]
        class_counts = Counter(targets)
        total = len(targets)
        weights = [total / (len(self.classes) * class_counts[t]) for t in targets]
        return weights
