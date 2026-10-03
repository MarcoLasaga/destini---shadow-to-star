"""Unit tests for normalized CNN manifest preparation."""

from deepfashion_dataset import DatasetManifest, DeepFashionItem
from polyvore_dataset import PolyvoreItem, PolyvoreManifest, PolyvoreOutfit, PolyvoreOutfitItem
from cnn_dataset import CLASS_NAMES, build_cnn_manifest, validate_cnn_manifest


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
