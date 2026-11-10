"""Unit tests for normalized CNN manifest preparation."""

from deepfashion_dataset import DatasetManifest, DeepFashionItem
from polyvore_dataset import PolyvoreItem, PolyvoreManifest, PolyvoreOutfit, PolyvoreOutfitItem
from cnn_dataset import (
    CLASS_NAMES,
    CNNRecord,
    REPOLYVORE_CATEGORY_MAPPING,
    build_cnn_manifest,
    audit_hash_conflicts,
    canonicalize_hash_groups,
    discover_repolyvore_categories,
    from_repolyvore,
    validate_cnn_manifest,
)
from PIL import Image


def test_authoritative_five_class_mapping_is_stable():
    assert CLASS_NAMES == ("TOP", "BOTTOM", "SHOES", "OUTERWEAR", "ACCESSORIES")


def test_deepfashion_normalization_excludes_unmapped_items():
    source = DatasetManifest(items=[
        DeepFashionItem("top.jpg", "Tee", 1, "TOP", "train", "MAPPED"),
        DeepFashionItem("dress.jpg", "Dress", 2, None, "train", "AMBIGUOUS_UNMAPPED"),
    ])
    manifest = build_cnn_manifest(deepfashion=source)
    assert len(manifest.records) == 1
    assert manifest.records[0].source == "deepfashion"
    assert manifest.records[0].label == "TOP"
    assert manifest.records[0].class_id == 0
    assert manifest.class_statistics()["train"]["TOP"] == 1


def test_polyvore_normalization_tracks_item_and_outfit():
    outfit = PolyvoreOutfit("set-1", "", [PolyvoreOutfitItem(0, "shoe-1", 41, "SHOES")], split="train")
    source = PolyvoreManifest(
        items={"shoe-1": PolyvoreItem("shoe-1", 41, "Shoes", "SHOES", "MAPPED", outfit_ids=["set-1"])},
        outfits={"set-1": outfit},
    )
    record = build_cnn_manifest(polyvore=source).records[0]
    assert record.label == "SHOES"
    assert record.item_id == "shoe-1"
    assert record.outfit_id is None  # item-level CNN records do not invent one outfit relationship
    assert record.split == "train"


def test_manifest_validation_catches_duplicates_and_missing_classes():
    source = DatasetManifest(items=[
        DeepFashionItem("same.jpg", "Tee", 1, "TOP", "train", "MAPPED"),
        DeepFashionItem("same.jpg", "Tee", 1, "TOP", "test", "MAPPED"),
    ])
    manifest = build_cnn_manifest(deepfashion=source)
    errors = validate_cnn_manifest(manifest, require_all_five_classes=True)
    assert any("image path overlap" in error for error in errors)
    assert any("missing training classes" in error for error in errors)


def test_polyvore_split_conflict_is_blocked():
    outfits = {
        "train-set": PolyvoreOutfit("train-set", "", [PolyvoreOutfitItem(0, "item-1", 11, "TOP")], split="train"),
        "test-set": PolyvoreOutfit("test-set", "", [PolyvoreOutfitItem(0, "item-1", 11, "TOP")], split="test"),
    }
    source = PolyvoreManifest(
        items={"item-1": PolyvoreItem("item-1", 11, "Tops", "TOP", "MAPPED", outfit_ids=list(outfits))},
        outfits=outfits,
    )
    manifest = build_cnn_manifest(polyvore=source)
    assert manifest.records[0].split == "conflict"
    assert validate_cnn_manifest(manifest)


def test_repolyvore_mapping_and_excluded_categories(tmp_path):
    for category in list(REPOLYVORE_CATEGORY_MAPPING) + ["dress", "jumpsuit", "legwear"]:
        category_dir = tmp_path / category
        category_dir.mkdir()
        if category in REPOLYVORE_CATEGORY_MAPPING:
            Image.new("RGB", (8, 8), color=(len(category), 20, 40)).save(category_dir / f"{category}.jpg")

    found = discover_repolyvore_categories(tmp_path)
    assert set(found) == set(REPOLYVORE_CATEGORY_MAPPING)
    records = from_repolyvore(tmp_path, val_ratio=0.1, test_ratio=0.1, seed=7)
    assert {record.original_label for record in records} == set(REPOLYVORE_CATEGORY_MAPPING)
    assert {record.label for record in records} == set(CLASS_NAMES)
    assert all(record.source == "re-polyvore" for record in records)
    assert all(record.class_id >= 0 for record in records)


def test_repolyvore_split_is_deterministic_and_hash_groups_stay_together(tmp_path):
    for category in REPOLYVORE_CATEGORY_MAPPING:
        (tmp_path / category).mkdir()
    for category in ("top", "shoes", "bag"):
        category_dir = tmp_path / category
        for index in range(8):
            # Identical bytes in different files model duplicate images; their
            # hashes must receive the same split.
            color = (index, 30, 60) if index != 0 else (1, 2, 3)
            Image.new("RGB", (8, 8), color=color).save(category_dir / f"item-{index}.jpg")
        if category == "top":
            (category_dir / "duplicate.jpg").write_bytes((category_dir / "item-0.jpg").read_bytes())

    first = from_repolyvore(tmp_path, val_ratio=0.2, test_ratio=0.2, seed=123)
    second = from_repolyvore(tmp_path, val_ratio=0.2, test_ratio=0.2, seed=123)
    first_splits = {record.record_id: record.split for record in first}
    second_splits = {record.record_id: record.split for record in second}
    assert first_splits == second_splits
    duplicate_splits = {record.split for record in first if record.image_sha256 == first[0].image_sha256}
    assert len(duplicate_splits) == 1


def test_cross_dataset_hash_overlap_is_reported():
    from cnn_dataset import CNNManifest, CNNRecord

    duplicate_hash = "a" * 64
    manifest = CNNManifest(records=[
        CNNRecord("deep.jpg", "TOP", "deepfashion", "Tee", "train", "df:1", 0, "df:1", image_sha256=duplicate_hash),
        CNNRecord("re.jpg", "TOP", "re-polyvore", "top", "train", "rp:1", 0, "rp:1", image_sha256=duplicate_hash),
    ])
    assert any("cross-dataset image hash overlap" in error for error in validate_cnn_manifest(manifest))


def test_conflicting_duplicate_labels_are_reported():
    from cnn_dataset import CNNManifest, CNNRecord

    duplicate_hash = "b" * 64
    manifest = CNNManifest(records=[
        CNNRecord("top.jpg", "TOP", "re-polyvore", "top", "train", "rp:top", 0, "rp:top", image_sha256=duplicate_hash),
        CNNRecord("pants.jpg", "BOTTOM", "re-polyvore", "pants", "train", "rp:pants", 1, "rp:pants", image_sha256=duplicate_hash),
    ])
    assert any("conflicting labels" in error for error in validate_cnn_manifest(manifest))


def test_same_stylesense_conflict_is_canonicalized():
    duplicate_hash = "c" * 64
    records = [
        CNNRecord("z-skirt.jpg", "BOTTOM", "re-polyvore", "skirt", "train", "z", 1, "z", image_sha256=duplicate_hash),
        CNNRecord("a-pants.jpg", "BOTTOM", "re-polyvore", "pants", "train", "a", 1, "a", image_sha256=duplicate_hash),
    ]
    report = audit_hash_conflicts(records)
    assert report[0]["conflict_type"] == "SAME_STYLE_SENSE_CLASS"
    resolved, summary = canonicalize_hash_groups(records)
    assert [record.record_id for record in resolved] == ["a"]
    assert summary["canonicalized_records"] == 1
    assert summary["excluded_records"] == 0


def test_cross_stylesense_conflict_excludes_entire_group():
    duplicate_hash = "d" * 64
    records = [
        CNNRecord("top.jpg", "TOP", "re-polyvore", "top", "train", "top", 0, "top", image_sha256=duplicate_hash),
        CNNRecord("shoes.jpg", "SHOES", "re-polyvore", "shoes", "train", "shoes", 2, "shoes", image_sha256=duplicate_hash),
    ]
    report = audit_hash_conflicts(records)
    assert report[0]["conflict_type"] == "CROSS_STYLE_SENSE_CLASS"
    resolved, summary = canonicalize_hash_groups(records)
    assert resolved == []
    assert summary["excluded_records"] == 2
    assert summary["excluded_hashes"] == [duplicate_hash]
