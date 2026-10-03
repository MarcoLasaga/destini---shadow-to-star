"""Polyvore Fashion Dataset Ingestion, Taxonomy Mapping, and Outfit Compatibility Preparation.

Provides robust functionality for:
- Discovering Polyvore dataset files (Han et al. 2017 & Vasileva et al. 2018 layouts)
- Parsing the canonical 193 Polyvore categories and mapping to StyleSense taxonomy
  (TOP, BOTTOM, SHOES, OUTERWEAR, ACCESSORIES, UNMAPPED)
- Parsing item-level records vs outfit-level records
- Preserving outfit/set co-occurrence structures for compatibility modeling
- Verifying data leakage across splits (disjoint vs nondisjoint evaluation)
- Deterministic group-level outfit splitting
- Exporting and serializing normalized manifests
"""
from __future__ import annotations

import csv
import json
import os
import pathlib
import random
import sys
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple, Union

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

# StyleSense target taxonomy
STYLESENSE_TAXONOMY: tuple[str, ...] = ("TOP", "BOTTOM", "SHOES", "OUTERWEAR", "ACCESSORIES")

# Mapping status constants
STATUS_MAPPED = "MAPPED"
STATUS_UNMAPPED = "UNMAPPED"

# Load category definitions from config file if available, otherwise fallback to embedded dictionary
_CONFIG_PATH = Path(__file__).resolve().parent / "polyvore_config.json"


def load_polyvore_config(config_path: Union[str, Path] = _CONFIG_PATH) -> dict[str, Any]:
    """Load the repository configuration without requiring dataset files."""
    path = Path(config_path)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError(f"Polyvore configuration must be a JSON object: {path}")
    return data


def resolve_polyvore_root(root_dir: Optional[Union[str, Path]] = None) -> Path:
    """Resolve a dataset root from an explicit path or POLYVORE_ROOT."""
    candidate = root_dir or os.environ.get("POLYVORE_ROOT")
    if not candidate:
        raise ValueError("Provide root_dir or set POLYVORE_ROOT to the Polyvore dataset root.")
    return Path(candidate).expanduser().resolve()


def _load_canonical_categories() -> dict[int, dict[str, Any]]:
    if _CONFIG_PATH.exists():
        try:
            with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                mapping = data.get("category_mapping", {})
                return {int(k): v for k, v in mapping.items()}
        except Exception:
            pass
    return {}


CANONICAL_POLYVORE_CATEGORIES: dict[int, dict[str, Any]] = _load_canonical_categories()


@dataclass
class PolyvoreCategory:
    category_id: int
    name: str
    stylesense_category: Optional[str]
    status: str
    reason: str


@dataclass
class PolyvoreItem:
    item_id: str
    category_id: int
    raw_category_name: str
    stylesense_category: Optional[str]
    status: str
    name: str = ""
    image_path: Optional[str] = None
    url: Optional[str] = None
    price: Optional[float] = None
    likes: Optional[int] = None
    outfit_ids: List[str] = field(default_factory=list)


@dataclass
class PolyvoreOutfitItem:
    index: int
    item_id: str
    category_id: int
    stylesense_category: Optional[str]
    name: str = ""
    image_path: Optional[str] = None


@dataclass
class PolyvoreOutfit:
    outfit_id: str
    name: str
    items: List[PolyvoreOutfitItem]
    split: str = "unspecified"  # 'train', 'val', 'test', 'unspecified'
    likes: Optional[int] = None
    views: Optional[int] = None
    date: Optional[str] = None
    set_url: Optional[str] = None

    @property
    def item_ids(self) -> List[str]:
        return [it.item_id for it in self.items]

    @property
    def stylesense_categories(self) -> List[str]:
        return [it.stylesense_category for it in self.items if it.stylesense_category is not None]

    @property
    def has_top(self) -> bool:
        return "TOP" in self.stylesense_categories

    @property
    def has_bottom(self) -> bool:
        return "BOTTOM" in self.stylesense_categories

    @property
    def has_shoes(self) -> bool:
        return "SHOES" in self.stylesense_categories

    @property
    def has_outerwear(self) -> bool:
        return "OUTERWEAR" in self.stylesense_categories

    @property
    def has_accessories(self) -> bool:
        return "ACCESSORIES" in self.stylesense_categories

    @property
    def is_canonical_outfit(self) -> bool:
        """Checks if outfit satisfies the thesis wardrobe combination (Top + Bottom + Shoes)."""
        return self.has_top and self.has_bottom and self.has_shoes


@dataclass
class PolyvoreManifest:
    items: Dict[str, PolyvoreItem] = field(default_factory=dict)
    outfits: Dict[str, PolyvoreOutfit] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "metadata": self.metadata,
            "items": {iid: asdict(it) for iid, it in self.items.items()},
            "outfits": {oid: asdict(out) for oid, out in self.outfits.items()},
        }

    def to_json(self, filepath: Union[str, Path]) -> None:
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PolyvoreManifest:
        items = {}
        for iid, idata in data.get("items", {}).items():
            items[iid] = PolyvoreItem(**idata)

        outfits = {}
        for oid, odata in data.get("outfits", {}).items():
            raw_items = [PolyvoreOutfitItem(**it) for it in odata.get("items", [])]
            outfits[oid] = PolyvoreOutfit(
                outfit_id=odata["outfit_id"],
                name=odata.get("name", ""),
                items=raw_items,
                split=odata.get("split", "unspecified"),
                likes=odata.get("likes"),
                views=odata.get("views"),
                date=odata.get("date"),
                set_url=odata.get("set_url"),
            )
        return cls(items=items, outfits=outfits, metadata=data.get("metadata", {}))

    @classmethod
    def from_json(cls, filepath: Union[str, Path]) -> PolyvoreManifest:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls.from_dict(data)

    def get_items_by_category(self, category: str, split: Optional[str] = None) -> List[PolyvoreItem]:
        results = [
            it for it in self.items.values()
            if it.stylesense_category == category
        ]
        if split is not None:
            # Filter items that belong to outfits of this split
            outfit_split_map = {oid: o.split for oid, o in self.outfits.items()}
            results = [
                it for it in results
                if any(outfit_split_map.get(oid) == split for oid in it.outfit_ids)
            ]
        return results

    def get_outfits_by_split(self, split: str) -> List[PolyvoreOutfit]:
        return [o for o in self.outfits.values() if o.split == split]

    def get_compatible_tuples(
        self,
        slots: Sequence[str] = ("TOP", "BOTTOM", "SHOES"),
        split: Optional[str] = None,
    ) -> List[Dict[str, str]]:
        """Extract canonical compatible item tuples from complete outfits."""
        outfits = self.outfits.values() if split is None else self.get_outfits_by_split(split)
        tuples = []
        for out in outfits:
            slot_items: dict[str, list[str]] = {s: [] for s in slots}
            for it in out.items:
                if it.stylesense_category in slot_items:
                    slot_items[it.stylesense_category].append(it.item_id)

            # If all required slots are represented
            if all(len(slot_items[s]) > 0 for s in slots):
                # Form primary tuple from first item of each slot
                primary_tuple = {
                    "outfit_id": out.outfit_id,
                    "split": out.split,
                    **{s: slot_items[s][0] for s in slots},
                }
                tuples.append(primary_tuple)
        return tuples


def find_polyvore_files(root_dir: Union[str, Path]) -> dict[str, Path]:
    """Discover Polyvore dataset files in root_dir.

    Supports:
    - Han et al. 2017: category_id.txt, train_no_dup.json, valid_no_dup.json, test_no_dup.json
    - Vasileva et al. 2018: categories.csv, train.json, valid.json, test.json, polyvore_item_metadata.json
    """
    root = Path(root_dir).resolve()
    if not root.exists():
        raise FileNotFoundError(f"Polyvore root directory does not exist: {root}")

    found: dict[str, Path] = {}

    candidates: dict[str, list[str]] = {
        "category_id": ["category_id.txt", "category_id.csv", "categories.txt"],
        "categories_csv": ["categories.csv", "categories_coarse.csv"],
        "train_outfits": ["train_no_dup.json", "train.json", "train_no_dup.jsonlines", "train_disjoint.json"],
        "val_outfits": ["valid_no_dup.json", "valid.json", "val.json", "valid_no_dup.jsonlines", "val_disjoint.json"],
        "test_outfits": ["test_no_dup.json", "test.json", "test_no_dup.jsonlines", "test_disjoint.json"],
        "item_metadata": ["polyvore_item_metadata.json", "item_metadata.json"],
        "compatibility_train": ["compatibility_train.txt"],
        "compatibility_val": ["compatibility_valid.txt"],
        "compatibility_test": ["compatibility_test.txt"],
        "images_dir": ["images", "img"],
    }

    for key, relative_paths in candidates.items():
        for rel_path in relative_paths:
            candidate_path = root / rel_path
            if candidate_path.exists():
                found[key] = candidate_path
                break

    # At least one category definition file and one outfit file must exist
    has_category = "category_id" in found or "categories_csv" in found
    has_outfits = any(k in found for k in ["train_outfits", "val_outfits", "test_outfits"])

    if not has_category:
        raise FileNotFoundError(
            f"Missing category mapping file in '{root}'. Expected 'category_id.txt' or 'categories.csv'."
        )
    if not has_outfits:
        raise FileNotFoundError(
            f"Missing outfit annotation files in '{root}'. Expected 'train_no_dup.json', 'train.json', etc."
        )

    return found


def parse_polyvore_categories(filepath: Union[str, Path]) -> dict[int, PolyvoreCategory]:
    """Parse category_id.txt or categories.csv into structured PolyvoreCategory mappings."""
    path = Path(filepath)
    categories: dict[int, PolyvoreCategory] = {}

    if path.suffix == ".csv":
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            for row in reader:
                if not row or not row[0].strip().isdigit():
                    continue
                cid = int(row[0].strip())
                name = row[1].strip() if len(row) > 1 else f"Category_{cid}"
                mapping = CANONICAL_POLYVORE_CATEGORIES.get(cid)
                if mapping:
                    cat = PolyvoreCategory(
                        category_id=cid,
                        name=name,
                        stylesense_category=mapping.get("stylesense_category"),
                        status=mapping.get("status", STATUS_UNMAPPED),
                        reason=mapping.get("reason", ""),
                    )
                else:
                    cat = PolyvoreCategory(
                        category_id=cid,
                        name=name,
                        stylesense_category=None,
                        status=STATUS_UNMAPPED,
                        reason="Unrecognized category in canonical dictionary.",
                    )
                categories[cid] = cat
    else:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split(None, 1)
                if len(parts) == 2 and parts[0].isdigit():
                    cid = int(parts[0])
                    name = parts[1].strip()
                    mapping = CANONICAL_POLYVORE_CATEGORIES.get(cid)
                    if mapping:
                        cat = PolyvoreCategory(
                            category_id=cid,
                            name=name,
                            stylesense_category=mapping.get("stylesense_category"),
                            status=mapping.get("status", STATUS_UNMAPPED),
                            reason=mapping.get("reason", ""),
                        )
                    else:
                        cat = PolyvoreCategory(
                            category_id=cid,
                            name=name,
                            stylesense_category=None,
                            status=STATUS_UNMAPPED,
                            reason="Unrecognized category in canonical dictionary.",
                        )
                    categories[cid] = cat

    return categories


def parse_polyvore_outfits(
    filepath: Union[str, Path],
    categories: dict[int, PolyvoreCategory],
    split: str = "unspecified",
    image_dir: Optional[Union[str, Path]] = "images",
) -> List[PolyvoreOutfit]:
    """Parse Polyvore outfit JSON / JSONLines file."""
    path = Path(filepath)
    outfits: List[PolyvoreOutfit] = []

    # Handle standard JSON list vs JSONLines
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            raw_data = json.load(f)
    except json.JSONDecodeError:
        raw_data = []
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.strip()
                if line:
                    raw_data.append(json.loads(line))

    if isinstance(raw_data, dict):
        raw_data = raw_data.get("outfits", [raw_data])

    for entry in raw_data:
        set_id = str(entry.get("set_id", entry.get("outfit_id", "")))
        if not set_id:
            continue

        name = entry.get("name", "")
        raw_items = entry.get("items", [])
        parsed_items: List[PolyvoreOutfitItem] = []

        for it in raw_items:
            # Handle both 'categoryid' (Han et al.) and 'category_id' (Vasileva et al.)
            cid_raw = it.get("categoryid", it.get("category_id"))
            try:
                cid = int(cid_raw) if cid_raw is not None else -1
            except (ValueError, TypeError):
                cid = -1

            item_id = str(it.get("item_id", it.get("index", f"{set_id}_{len(parsed_items)}")))
            try:
                index = int(it.get("index", len(parsed_items)))
            except (TypeError, ValueError):
                index = len(parsed_items)
            item_name = it.get("name", "")

            raw_image = it.get("image", it.get("image_path"))
            if raw_image:
                image_path = str(raw_image)
            elif item_id and image_dir is not None:
                image_path = str(Path(str(image_dir)) / f"{item_id}.jpg").replace("\\", "/")
            else:
                image_path = None

            cat_info = categories.get(cid)
            stylesense_cat = cat_info.stylesense_category if cat_info else None

            parsed_items.append(
                PolyvoreOutfitItem(
                    index=index,
                    item_id=item_id,
                    category_id=cid,
                    stylesense_category=stylesense_cat,
                    name=item_name,
                    image_path=image_path,
                )
            )

        outfit = PolyvoreOutfit(
            outfit_id=set_id,
            name=name,
            items=parsed_items,
            split=split,
            likes=entry.get("likes"),
            views=entry.get("views"),
            date=entry.get("date"),
            set_url=entry.get("set_url"),
        )
        outfits.append(outfit)

    return outfits


def parse_compatibility_file(filepath: Union[str, Path]) -> List[dict[str, Any]]:
    """Parse compatibility_*.txt file containing binary compatibility annotations."""
    path = Path(filepath)
    records: List[dict[str, Any]] = []

    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) >= 2:
                try:
                    label = int(parts[0])  # 1 for compatible, 0 for incompatible
                except ValueError:
                    continue
                item_specifiers = parts[1:]
                records.append({
                    "is_compatible": bool(label),
                    "items": item_specifiers,
                })
    return records


def build_polyvore_manifest(
    root_dir: Union[str, Path],
    category_file: Optional[Union[str, Path]] = None,
) -> PolyvoreManifest:
    """Build unified PolyvoreManifest from a Polyvore dataset directory."""
    root = resolve_polyvore_root(root_dir)
    files = find_polyvore_files(root)

    cat_file = Path(category_file) if category_file else (files.get("category_id") or files["categories_csv"])
    categories = parse_polyvore_categories(cat_file)

    all_outfits: dict[str, PolyvoreOutfit] = {}
    all_items: dict[str, PolyvoreItem] = {}

    split_file_keys = [
        ("train", "train_outfits"),
        ("val", "val_outfits"),
        ("test", "test_outfits"),
    ]

    for split_name, key in split_file_keys:
        if key in files:
            split_outfits = parse_polyvore_outfits(
                files[key], categories, split=split_name,
                image_dir="images" if "images_dir" in files else None,
            )
            for out in split_outfits:
                all_outfits[out.outfit_id] = out
                for it in out.items:
                    if it.item_id not in all_items:
                        cat_info = categories.get(it.category_id)
                        raw_name = cat_info.name if cat_info else "Unknown"
                        stylesense_cat = cat_info.stylesense_category if cat_info else None
                        status = cat_info.status if cat_info else STATUS_UNMAPPED

                        all_items[it.item_id] = PolyvoreItem(
                            item_id=it.item_id,
                            category_id=it.category_id,
                            raw_category_name=raw_name,
                            stylesense_category=stylesense_cat,
                            status=status,
                            name=it.name,
                            image_path=it.image_path,
                            outfit_ids=[out.outfit_id],
                        )
                    else:
                        if out.outfit_id not in all_items[it.item_id].outfit_ids:
                            all_items[it.item_id].outfit_ids.append(out.outfit_id)

    # Optional item metadata enrichment
    if "item_metadata" in files:
        try:
            with open(files["item_metadata"], "r", encoding="utf-8") as f:
                item_meta = json.load(f)
                if isinstance(item_meta, list):
                    item_meta = {
                        str(m.get("item_id", m.get("id"))): m
                        for m in item_meta
                        if isinstance(m, dict) and m.get("item_id", m.get("id")) is not None
                    }
                for iid, m in item_meta.items():
                    if not isinstance(m, dict):
                        continue
                    if iid in all_items:
                        if "url" in m:
                            all_items[iid].url = m["url"]
                        if "title" in m and not all_items[iid].name:
                            all_items[iid].name = m["title"]
                        if "price" in m:
                            try:
                                all_items[iid].price = float(m["price"])
                            except (TypeError, ValueError):
                                pass
                        if "likes" in m:
                            try:
                                all_items[iid].likes = int(m["likes"])
                            except (TypeError, ValueError):
                                pass
                        if m.get("image") or m.get("image_path"):
                            all_items[iid].image_path = str(m.get("image", m.get("image_path")))
        except Exception:
            pass

    # Compute dataset metadata
    mapped_categories = sorted(list({
        it.stylesense_category for it in all_items.values() if it.stylesense_category is not None
    }))

    outfit_splits = dict(Counter(o.split for o in all_outfits.values()))
    class_dist = dict(Counter(
        it.stylesense_category or f"UNMAPPED:{it.raw_category_name}" for it in all_items.values()
    ))

    canonical_outfits_count = sum(1 for o in all_outfits.values() if o.is_canonical_outfit)

    metadata = {
        "dataset_name": "Polyvore Fashion Dataset",
        "root_dir": str(root),
        "total_unique_items": len(all_items),
        "total_outfits": len(all_outfits),
        "canonical_top_bottom_shoes_outfits": canonical_outfits_count,
        "outfit_splits": outfit_splits,
        "mapped_categories": mapped_categories,
        "class_distribution": class_dist,
    }

    return PolyvoreManifest(items=all_items, outfits=all_outfits, metadata=metadata)


def validate_polyvore_manifest(manifest: PolyvoreManifest) -> list[str]:
    """Return deterministic validation errors without rejecting unmapped items."""
    errors: list[str] = []
    seen_items: set[str] = set()
    for outfit_id in sorted(manifest.outfits):
        outfit = manifest.outfits[outfit_id]
        if not outfit.outfit_id:
            errors.append(f"outfit {outfit_id!r} has no outfit_id")
        for item in outfit.items:
            if not item.item_id:
                errors.append(f"outfit {outfit_id!r} contains an item without item_id")
            if item.item_id not in manifest.items:
                errors.append(f"outfit {outfit_id!r} references missing item {item.item_id!r}")
            seen_items.add(item.item_id)
    for item_id, item in sorted(manifest.items.items()):
        if item_id != item.item_id:
            errors.append(f"item key {item_id!r} does not match item_id {item.item_id!r}")
        if not set(item.outfit_ids).issubset(manifest.outfits):
            errors.append(f"item {item_id!r} references a missing outfit")
    return errors


def verify_split_leakage(manifest: PolyvoreManifest) -> dict[str, Any]:
    """Inspect and report data leakage across train, val, and test splits.

    Detects item-level overlap between splits to identify whether the dataset
    follows a disjoint (leakage-free) or nondisjoint partition.
    """
    items_by_split: dict[str, Set[str]] = defaultdict(set)
    for out in manifest.outfits.values():
        for it in out.items:
            items_by_split[out.split].add(it.item_id)

    train_val_overlap = items_by_split["train"] & items_by_split["val"]
    train_test_overlap = items_by_split["train"] & items_by_split["test"]
    val_test_overlap = items_by_split["val"] & items_by_split["test"]

    total_overlap = len(train_val_overlap | train_test_overlap | val_test_overlap)
    is_disjoint = total_overlap == 0

    return {
        "is_disjoint": is_disjoint,
        "leakage_detected": not is_disjoint,
        "train_items_count": len(items_by_split["train"]),
        "val_items_count": len(items_by_split["val"]),
        "test_items_count": len(items_by_split["test"]),
        "train_val_overlap_count": len(train_val_overlap),
        "train_test_overlap_count": len(train_test_overlap),
        "val_test_overlap_count": len(val_test_overlap),
        "total_overlapping_items": total_overlap,
    }


def split_outfits_deterministically(
    outfits: Sequence[PolyvoreOutfit],
    val_ratio: float = 0.1,
    test_ratio: float = 0.1,
    seed: int = 42,
    ensure_disjoint: bool = True,
) -> Tuple[List[PolyvoreOutfit], List[PolyvoreOutfit], List[PolyvoreOutfit]]:
    """Deterministically partition outfits into train, validation, and test splits.

    If ensure_disjoint is True, ensures no shared items exist between splits.
    """
    rng = random.Random(seed)
    sorted_outfits = sorted(list(outfits), key=lambda o: o.outfit_id)
    rng.shuffle(sorted_outfits)

    if not ensure_disjoint:
        n_total = len(sorted_outfits)
        n_val = int(n_total * val_ratio)
        n_test = int(n_total * test_ratio)

        test_outfits = sorted_outfits[:n_test]
        val_outfits = sorted_outfits[n_test : n_test + n_val]
        train_outfits = sorted_outfits[n_test + n_val :]

        for o in train_outfits:
            o.split = "train"
        for o in val_outfits:
            o.split = "val"
        for o in test_outfits:
            o.split = "test"

        return train_outfits, val_outfits, test_outfits

    # First form connected components of outfits linked by shared items. A
    # component must stay together; assigning individual outfits can either
    # leak items or silently discard conflict cases.
    components: List[List[PolyvoreOutfit]] = []
    component_items: List[Set[str]] = []
    for out in sorted_outfits:
        out_items = set(out.item_ids)
        matching = [i for i, items in enumerate(component_items) if out_items & items]
        if not matching:
            components.append([out])
            component_items.append(set(out_items))
            continue
        target = matching[0]
        components[target].append(out)
        component_items[target].update(out_items)
        for other in reversed(matching[1:]):
            components[target].extend(components.pop(other))
            component_items[target].update(component_items.pop(other))

    # Stable component order plus seeded shuffle makes the result reproducible.
    components = [sorted(group, key=lambda o: o.outfit_id) for group in components]
    components.sort(key=lambda group: group[0].outfit_id)
    rng.shuffle(components)
    n_val_target = int(len(sorted_outfits) * val_ratio)
    n_test_target = int(len(sorted_outfits) * test_ratio)
    test_count = val_count = 0
    train_outfits: List[PolyvoreOutfit] = []
    val_outfits: List[PolyvoreOutfit] = []
    test_outfits: List[PolyvoreOutfit] = []

    for component in components:
        if test_count < n_test_target:
            destination, label = test_outfits, "test"
            test_count += len(component)
        elif val_count < n_val_target:
            destination, label = val_outfits, "val"
            val_count += len(component)
        else:
            destination, label = train_outfits, "train"
        for out in component:
            out.split = label
        destination.extend(component)

    return train_outfits, val_outfits, test_outfits
