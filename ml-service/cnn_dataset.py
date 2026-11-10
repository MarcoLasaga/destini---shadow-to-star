"""Unified, deterministic training-manifest preparation for StyleSense CNN data.

This module normalizes DeepFashion and Polyvore records without requiring either
raw dataset to be checked into the repository. It intentionally does not create
images or infer labels for unmapped records.
"""
from __future__ import annotations

import hashlib
import json
import random
from collections import Counter
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable, Optional, Sequence, Union

from deepfashion_dataset import DatasetManifest as DeepFashionManifest
from polyvore_dataset import PolyvoreManifest

_TAXONOMY_PATH = Path(__file__).resolve().parent / "cnn_taxonomy.json"
with open(_TAXONOMY_PATH, "r", encoding="utf-8") as _taxonomy_file:
    _taxonomy = json.load(_taxonomy_file)
CLASS_NAMES: tuple[str, ...] = tuple(entry["name"] for entry in _taxonomy["classes"])
CLASS_TO_ID: dict[str, int] = {name: index for index, name in enumerate(CLASS_NAMES)}
VALID_SPLITS = ("train", "val", "test")

REPOLYVORE_CATEGORY_MAPPING: dict[str, str] = {
    "top": "TOP",
    "pants": "BOTTOM",
    "skirt": "BOTTOM",
    "shoes": "SHOES",
    "outwear": "OUTERWEAR",
    "bag": "ACCESSORIES",
    "bracelet": "ACCESSORIES",
    "brooch": "ACCESSORIES",
    "earrings": "ACCESSORIES",
    "eyewear": "ACCESSORIES",
    "gloves": "ACCESSORIES",
    "hairwear": "ACCESSORIES",
    "hats": "ACCESSORIES",
    "necklace": "ACCESSORIES",
    "neckwear": "ACCESSORIES",
    "rings": "ACCESSORIES",
    "watches": "ACCESSORIES",
}
REPOLYVORE_EXCLUDED_CATEGORIES = frozenset({"dress", "jumpsuit", "legwear"})
REPOLYVORE_IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp", ".bmp"})


@dataclass(frozen=True)
class CNNRecord:
    image_path: str
    label: str
    source: str
    original_label: str
    split: str
    record_id: str
    class_id: int = -1
    item_id: Optional[str] = None
    outfit_id: Optional[str] = None
    image_sha256: Optional[str] = None


@dataclass
class CNNManifest:
    records: list[CNNRecord] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"metadata": self.metadata, "records": [asdict(record) for record in self.records]}

    def to_json(self, filepath: Union[str, Path]) -> None:
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def from_json(cls, filepath: Union[str, Path]) -> "CNNManifest":
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls(
            records=[CNNRecord(**record) for record in data.get("records", [])],
            metadata=data.get("metadata", {}),
        )

    def class_statistics(self) -> dict[str, dict[str, int]]:
        stats = {split: {name: 0 for name in CLASS_NAMES} for split in VALID_SPLITS}
        for record in self.records:
            if record.split in stats and record.label in stats[record.split]:
                stats[record.split][record.label] += 1
        return stats


def _resolved_image(root: Optional[Union[str, Path]], image_path: str) -> str:
    path = Path(image_path)
    return str((Path(root).resolve() / path).resolve()) if root and not path.is_absolute() else str(path)


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def from_deepfashion(
    manifest: DeepFashionManifest,
    root: Optional[Union[str, Path]] = None,
    hash_images: bool = False,
) -> list[CNNRecord]:
    """Normalize mapped DeepFashion records; preserve its official split labels."""
    records: list[CNNRecord] = []
    for item in manifest.items:
        if item.stylesense_category not in CLASS_TO_ID or item.status != "MAPPED":
            continue
        image_path = _resolved_image(root, item.image_path)
        image_hash = _sha256_file(Path(image_path)) if hash_images and Path(image_path).is_file() else None
        records.append(CNNRecord(
            image_path=image_path,
            label=item.stylesense_category,
            source="deepfashion",
            original_label=item.raw_category_name,
            split=item.split,
            record_id=f"deepfashion:{item.image_path}",
            class_id=CLASS_TO_ID[item.stylesense_category],
            item_id=item.image_path,
            image_sha256=image_hash,
        ))
    return records


def from_polyvore(
    manifest: PolyvoreManifest,
    root: Optional[Union[str, Path]] = None,
    hash_images: bool = False,
) -> list[CNNRecord]:
    """Normalize one record per Polyvore item with an unambiguous outfit split.

    Items associated with multiple official splits are emitted with split
    ``conflict`` so validation blocks accidental leakage rather than silently
    choosing one split.
    """
    records: list[CNNRecord] = []
    for item_id in sorted(manifest.items):
        item = manifest.items[item_id]
        if item.stylesense_category not in CLASS_TO_ID:
            continue
        linked = [manifest.outfits[outfit_id] for outfit_id in item.outfit_ids if outfit_id in manifest.outfits]
        splits = sorted({outfit.split for outfit in linked if outfit.split in VALID_SPLITS})
        split = splits[0] if len(splits) == 1 else ("conflict" if len(splits) > 1 else "unspecified")
        image_path = _resolved_image(root, item.image_path or f"images/{item_id}.jpg")
        image_hash = _sha256_file(Path(image_path)) if hash_images and Path(image_path).is_file() else None
        records.append(CNNRecord(
            image_path=image_path,
            label=item.stylesense_category,
            source="polyvore",
            original_label=item.raw_category_name,
            split=split,
            record_id=f"polyvore:{item_id}",
            class_id=CLASS_TO_ID[item.stylesense_category],
            item_id=item_id,
            image_sha256=image_hash,
        ))
    return records


def discover_repolyvore_categories(root_dir: Union[str, Path]) -> dict[str, Path]:
    """Discover Re-PolyVore category directories without touching their files."""
    root = Path(root_dir).resolve()
    if not root.is_dir():
        raise FileNotFoundError(f"Re-PolyVore root directory does not exist: {root}")
    directories = {entry.name.lower(): entry for entry in root.iterdir() if entry.is_dir()}
    missing = sorted(set(REPOLYVORE_CATEGORY_MAPPING) - set(directories))
    if missing:
        raise FileNotFoundError(f"Missing Re-PolyVore category directories in '{root}': {missing}")
    return {name: directories[name] for name in sorted(REPOLYVORE_CATEGORY_MAPPING)}


def from_repolyvore(
    root_dir: Union[str, Path],
    val_ratio: float = 0.1,
    test_ratio: float = 0.1,
    seed: int = 42,
) -> list[CNNRecord]:
    """Normalize Re-PolyVore images and split duplicate groups deterministically.

    Re-PolyVore has category folders but no train/validation/test folders. Every
    supported image is hashed before splitting, so byte-identical images stay in
    one split. Non-image files (for example Windows shortcut files) are ignored.
    """
    if not 0 <= val_ratio < 1 or not 0 <= test_ratio < 1 or val_ratio + test_ratio >= 1:
        raise ValueError("val_ratio and test_ratio must be non-negative and sum to less than 1")

    root = Path(root_dir).resolve()
    category_dirs = discover_repolyvore_categories(root)
    entries: list[tuple[str, str, Path, str]] = []
    for native_label, category_dir in category_dirs.items():
        for path in sorted(category_dir.rglob("*")):
            if path.is_file() and path.suffix.lower() in REPOLYVORE_IMAGE_EXTENSIONS:
                entries.append((native_label, REPOLYVORE_CATEGORY_MAPPING[native_label], path, _sha256_file(path)))

    groups: dict[str, list[tuple[str, str, Path, str]]] = {}
    for entry in entries:
        groups.setdefault(entry[3], []).append(entry)
    group_keys = sorted(groups)
    random.Random(seed).shuffle(group_keys)

    total = len(entries)
    test_target = round(total * test_ratio)
    val_target = round(total * val_ratio)
    test_count = val_count = 0
    split_by_hash: dict[str, str] = {}
    for image_hash in group_keys:
        group_size = len(groups[image_hash])
        if test_count < test_target:
            split_by_hash[image_hash] = "test"
            test_count += group_size
        elif val_count < val_target:
            split_by_hash[image_hash] = "val"
            val_count += group_size
        else:
            split_by_hash[image_hash] = "train"

    records: list[CNNRecord] = []
    for native_label, label, path, image_hash in entries:
        relative = path.relative_to(root).as_posix()
        records.append(CNNRecord(
            image_path=str(path),
            label=label,
            source="re-polyvore",
            original_label=native_label,
            split=split_by_hash[image_hash],
            record_id=f"re-polyvore:{relative}",
            class_id=CLASS_TO_ID[label],
            item_id=relative,
            image_sha256=image_hash,
        ))
    return records


def audit_hash_conflicts(records: Sequence[CNNRecord]) -> list[dict[str, Any]]:
    """Create a stable report for hash groups spanning native categories."""
    groups: dict[str, list[CNNRecord]] = {}
    for record in records:
        if record.image_sha256:
            groups.setdefault(record.image_sha256, []).append(record)

    report: list[dict[str, Any]] = []
    for image_hash, group in groups.items():
        native_categories = sorted({record.original_label for record in group})
        if len(native_categories) < 2:
            continue
        stylesense_categories = sorted({record.label for record in group})
        conflict_type = (
            "SAME_STYLE_SENSE_CLASS"
            if len(stylesense_categories) == 1
            else "CROSS_STYLE_SENSE_CLASS"
        )
        report.append({
            "sha256": image_hash,
            "image_paths": sorted(record.image_path for record in group),
            "native_categories": native_categories,
            "stylesense_categories": stylesense_categories,
            "record_count": len(group),
            "conflict_type": conflict_type,
        })
    return sorted(report, key=lambda entry: entry["sha256"])


def canonicalize_hash_groups(
    records: Sequence[CNNRecord],
) -> tuple[list[CNNRecord], dict[str, Any]]:
    """Resolve exact duplicate hashes without inventing or silently relabeling data."""
    grouped: dict[str, list[CNNRecord]] = {}
    unhashed: list[CNNRecord] = []
    for record in records:
        if record.image_sha256:
            grouped.setdefault(record.image_sha256, []).append(record)
        else:
            unhashed.append(record)

    audit = audit_hash_conflicts(records)
    conflict_by_hash = {entry["sha256"]: entry for entry in audit}
    kept: list[CNNRecord] = list(unhashed)
    excluded_records = 0
    canonicalized_records = 0
    excluded_hashes: list[str] = []

    for image_hash in sorted(grouped):
        group = sorted(grouped[image_hash], key=lambda record: (record.source, record.image_path, record.record_id))
        stylesense_categories = {record.label for record in group}
        if len(stylesense_categories) > 1:
            excluded_records += len(group)
            excluded_hashes.append(image_hash)
            if image_hash in conflict_by_hash:
                conflict_by_hash[image_hash]["resolution"] = "EXCLUDED_ALL_RECORDS"
            continue
        kept.append(group[0])
        canonicalized_records += len(group) - 1
        if len(group) > 1 and image_hash in conflict_by_hash:
            conflict_by_hash[image_hash]["resolution"] = "CANONICALIZED_ONE_RECORD"

    resolved_report = sorted(conflict_by_hash.values(), key=lambda entry: entry["sha256"])
    return sorted(kept, key=lambda record: (record.source, record.split, record.record_id)), {
        "groups": resolved_report,
        "group_count": len(resolved_report),
        "same_stylesense_class_groups": sum(
            entry["conflict_type"] == "SAME_STYLE_SENSE_CLASS" for entry in resolved_report
        ),
        "cross_stylesense_class_groups": sum(
            entry["conflict_type"] == "CROSS_STYLE_SENSE_CLASS" for entry in resolved_report
        ),
        "canonicalized_records": canonicalized_records,
        "excluded_records": excluded_records,
        "excluded_hashes": excluded_hashes,
    }


def write_conflict_report(report: dict[str, Any], filepath: Union[str, Path]) -> None:
    """Write a deterministic machine-readable exact-hash conflict report."""
    path = Path(filepath)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)


def build_cnn_manifest(
    deepfashion: Optional[DeepFashionManifest] = None,
    polyvore: Optional[PolyvoreManifest] = None,
    deepfashion_root: Optional[Union[str, Path]] = None,
    polyvore_root: Optional[Union[str, Path]] = None,
    hash_images: bool = False,
    repolyvore_root: Optional[Union[str, Path]] = None,
    repolyvore_val_ratio: float = 0.1,
    repolyvore_test_ratio: float = 0.1,
    repolyvore_seed: int = 42,
) -> CNNManifest:
    records: list[CNNRecord] = []
    repolyvore_conflict_report: Optional[dict[str, Any]] = None
    if deepfashion is not None:
        records.extend(from_deepfashion(deepfashion, deepfashion_root, hash_images))
    if polyvore is not None:
        records.extend(from_polyvore(polyvore, polyvore_root, hash_images))
    if repolyvore_root is not None:
        repolyvore_records = from_repolyvore(
            repolyvore_root,
            val_ratio=repolyvore_val_ratio,
            test_ratio=repolyvore_test_ratio,
            seed=repolyvore_seed,
        )
        repolyvore_records, repolyvore_conflict_report = canonicalize_hash_groups(repolyvore_records)
        records.extend(repolyvore_records)
    records, conflict_report = canonicalize_hash_groups(records)
    manifest = CNNManifest(records=records, metadata={
        "taxonomy": list(CLASS_NAMES),
        "sources": sorted({record.source for record in records}),
        "record_count": len(records),
        "conflict_resolution": conflict_report,
        "repolyvore_conflict_resolution": repolyvore_conflict_report,
    })
    manifest.metadata["class_statistics"] = manifest.class_statistics()
    return manifest


def validate_cnn_manifest(
    manifest: CNNManifest,
    require_files: bool = False,
    require_all_five_classes: bool = False,
) -> list[str]:
    """Return deterministic errors for labels, splits, duplicates, and leakage."""
    errors: list[str] = []
    seen_records: set[str] = set()
    paths_by_split: dict[str, set[str]] = {split: set() for split in VALID_SPLITS}
    ids_by_split: dict[str, set[str]] = {split: set() for split in VALID_SPLITS}
    hashes_by_split: dict[str, set[str]] = {split: set() for split in VALID_SPLITS}
    path_records: dict[str, list[str]] = {}
    hash_records: dict[str, list[tuple[str, str, str]]] = {}
    hash_labels: dict[str, set[str]] = {}
    for record in manifest.records:
        if record.label not in CLASS_TO_ID:
            errors.append(f"{record.record_id}: unknown label {record.label!r}")
        elif record.class_id != CLASS_TO_ID[record.label]:
            errors.append(f"{record.record_id}: class_id does not match label")
        if record.split not in VALID_SPLITS:
            errors.append(f"{record.record_id}: invalid split {record.split!r}")
        if record.record_id in seen_records:
            errors.append(f"duplicate record_id: {record.record_id}")
        seen_records.add(record.record_id)
        if require_files and not Path(record.image_path).is_file():
            errors.append(f"missing image: {record.image_path}")
        if record.split in VALID_SPLITS:
            paths_by_split[record.split].add(record.image_path)
            path_records.setdefault(record.image_path, []).append(record.record_id)
            if record.item_id:
                ids_by_split[record.split].add(f"{record.source}:{record.item_id}")
            if record.image_sha256:
                hashes_by_split[record.split].add(record.image_sha256)
                hash_records.setdefault(record.image_sha256, []).append((record.source, record.split, record.record_id))
                hash_labels.setdefault(record.image_sha256, set()).add(record.label)
    for image_path, record_ids in path_records.items():
        if len(record_ids) > 1:
            errors.append(f"duplicate image path: {image_path}")
    for left, right in (("train", "val"), ("train", "test"), ("val", "test")):
        if paths_by_split[left] & paths_by_split[right]:
            errors.append(f"image path overlap: {left}/{right}")
        if ids_by_split[left] & ids_by_split[right]:
            errors.append(f"item ID overlap: {left}/{right}")
        if hashes_by_split[left] & hashes_by_split[right]:
            errors.append(f"image hash overlap: {left}/{right}")
    for image_hash, records in hash_records.items():
        sources = {source for source, _, _ in records}
        splits = {split for _, split, _ in records}
        if len(sources) > 1:
            errors.append(f"cross-dataset image hash overlap: {image_hash}")
        if len(splits) > 1:
            errors.append(f"image hash crosses splits: {image_hash}")
        if len(hash_labels[image_hash]) > 1:
            errors.append(f"image hash has conflicting labels: {image_hash}")
    if require_all_five_classes:
        missing = [name for name in CLASS_NAMES if not any(r.label == name and r.split == "train" for r in manifest.records)]
        if missing:
            errors.append(f"missing training classes: {', '.join(missing)}")
    return sorted(set(errors))
