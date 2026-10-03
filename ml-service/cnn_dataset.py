"""Unified, deterministic training-manifest preparation for StyleSense CNN data.

This module normalizes DeepFashion and Polyvore records without requiring either
raw dataset to be checked into the repository. It intentionally does not create
images or infer labels for unmapped records.
"""
from __future__ import annotations

import hashlib
import json
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


def build_cnn_manifest(
    deepfashion: Optional[DeepFashionManifest] = None,
    polyvore: Optional[PolyvoreManifest] = None,
    deepfashion_root: Optional[Union[str, Path]] = None,
    polyvore_root: Optional[Union[str, Path]] = None,
    hash_images: bool = False,
) -> CNNManifest:
    records: list[CNNRecord] = []
    if deepfashion is not None:
        records.extend(from_deepfashion(deepfashion, deepfashion_root, hash_images))
    if polyvore is not None:
        records.extend(from_polyvore(polyvore, polyvore_root, hash_images))
    records.sort(key=lambda record: (record.source, record.split, record.record_id))
    manifest = CNNManifest(records=records, metadata={
        "taxonomy": list(CLASS_NAMES),
        "sources": sorted({record.source for record in records}),
        "record_count": len(records),
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
            if record.item_id:
                ids_by_split[record.split].add(f"{record.source}:{record.item_id}")
            if record.image_sha256:
                hashes_by_split[record.split].add(record.image_sha256)
    for left, right in (("train", "val"), ("train", "test"), ("val", "test")):
        if paths_by_split[left] & paths_by_split[right]:
            errors.append(f"image path overlap: {left}/{right}")
        if ids_by_split[left] & ids_by_split[right]:
            errors.append(f"item ID overlap: {left}/{right}")
        if hashes_by_split[left] & hashes_by_split[right]:
            errors.append(f"image hash overlap: {left}/{right}")
    if require_all_five_classes:
        missing = [name for name in CLASS_NAMES if not any(r.label == name and r.split == "train" for r in manifest.records)]
        if missing:
            errors.append(f"missing training classes: {', '.join(missing)}")
    return sorted(set(errors))
