"""Tests for the layout-tolerant Polyvore integration."""

import json
from pathlib import Path

from polyvore_dataset import (
    STATUS_UNMAPPED,
    build_polyvore_manifest,
    find_polyvore_files,
    load_polyvore_config,
    parse_compatibility_file,
    parse_polyvore_categories,
    parse_polyvore_outfits,
    split_outfits_deterministically,
    validate_polyvore_manifest,
    verify_split_leakage,
)


def make_polyvore_fixture(tmp_path: Path) -> Path:
    root = tmp_path / "polyvore"
    root.mkdir()
    (root / "images").mkdir()
    (root / "categories.csv").write_text(
        "id,name\n11,Tops\n23,Outerwear\n41,Shoes\n51,Accessories\n999,Novelty\n",
        encoding="utf-8",
    )
    outfits = [
        {"set_id": "set-a", "name": "A", "items": [
            {"item_id": "a-top", "categoryid": 11, "index": 0},
            {"item_id": "a-shoe", "categoryid": 41, "index": 1, "image": "custom/a-shoe.png"},
        ]},
        {"set_id": "set-b", "name": "B", "items": [
            {"item_id": "b-bottom", "category_id": 999, "index": "bad"},
        ]},
    ]
    for name in ("train.json", "valid.json", "test.json"):
        (root / name).write_text(json.dumps(outfits), encoding="utf-8")
    (root / "polyvore_item_metadata.json").write_text(json.dumps([
        {"id": "a-top", "title": "Blue top", "url": "https://example.test/a", "price": "12.5", "likes": "7"},
        {"id": "a-shoe", "image_path": "metadata/shoe.jpg"},
    ]), encoding="utf-8")
    (root / "compatibility_train.txt").write_text("1 a-top a-shoe\n0 a-top b-bottom\n", encoding="utf-8")
    return root


def test_config_loads_without_dataset():
    config = load_polyvore_config()
    assert config["stylesense_taxonomy"] == ["TOP", "BOTTOM", "SHOES", "OUTERWEAR", "ACCESSORIES"]
    assert "category_mapping" in config


def test_discovery_and_category_mapping(tmp_path):
    root = make_polyvore_fixture(tmp_path)
    files = find_polyvore_files(root)
    assert files["categories_csv"].name == "categories.csv"
    categories = parse_polyvore_categories(files["categories_csv"])
    assert categories[41].stylesense_category == "SHOES"
    assert categories[51].stylesense_category == "ACCESSORIES"
    assert categories[23].stylesense_category == "OUTERWEAR"
    assert categories[999].status == STATUS_UNMAPPED
    assert categories[999].stylesense_category is None


def test_outfit_parser_preserves_relationships_and_image_references(tmp_path):
    root = make_polyvore_fixture(tmp_path)
    categories = parse_polyvore_categories(root / "categories.csv")
    outfits = parse_polyvore_outfits(root / "train.json", categories, split="train")
    assert outfits[0].item_ids == ["a-top", "a-shoe"]
    assert outfits[0].items[0].image_path == "images/a-top.jpg"
    assert outfits[0].items[1].image_path == "custom/a-shoe.png"
    assert outfits[1].items[0].index == 0


def test_manifest_metadata_and_validation(tmp_path):
    manifest = build_polyvore_manifest(make_polyvore_fixture(tmp_path))
    assert len(manifest.items) == 3
    assert manifest.items["a-top"].price == 12.5
    assert manifest.items["a-top"].likes == 7
    assert manifest.items["a-top"].outfit_ids == ["set-a"]
    assert validate_polyvore_manifest(manifest) == []
    assert verify_split_leakage(manifest)["test_items_count"] == 3


def test_compatibility_parser(tmp_path):
    root = make_polyvore_fixture(tmp_path)
    records = parse_compatibility_file(root / "compatibility_train.txt")
    assert records == [
        {"is_compatible": True, "items": ["a-top", "a-shoe"]},
        {"is_compatible": False, "items": ["a-top", "b-bottom"]},
    ]


def test_deterministic_disjoint_split():
    from polyvore_dataset import PolyvoreOutfit, PolyvoreOutfitItem

    outfits = [PolyvoreOutfit(str(i), "", [PolyvoreOutfitItem(0, f"item-{i}", 11, "TOP")]) for i in range(10)]
    first = split_outfits_deterministically(outfits, val_ratio=.2, test_ratio=.2, seed=9)
    second = split_outfits_deterministically(outfits, val_ratio=.2, test_ratio=.2, seed=9)
    assert [[o.outfit_id for o in group] for group in first] == [[o.outfit_id for o in group] for group in second]
    assert verify_split_leakage(type("M", (), {"outfits": {o.outfit_id: o for group in first for o in group}})())["is_disjoint"]
