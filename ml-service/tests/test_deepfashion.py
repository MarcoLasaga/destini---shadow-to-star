"""Comprehensive tests for DeepFashion dataset ingestion, mapping, splitting, and PyTorch training integration."""
import json
import os
import shutil
import tempfile
from collections import Counter
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

import torch
from torch.utils.data import DataLoader, WeightedRandomSampler
from torchvision import datasets, transforms

from deepfashion_dataset import (
    CANONICAL_DEEPFASHION_CATEGORIES,
    STATUS_AMBIGUOUS_UNMAPPED,
    STATUS_MAPPED,
    STATUS_UNAVAILABLE,
    STYLESENSE_TAXONOMY,
    UNAVAILABLE_CATEGORIES,
    DatasetManifest,
    DeepFashionCategory,
    DeepFashionDataset,
    DeepFashionItem,
    balance_manifest,
    build_deepfashion_manifest,
    calculate_class_weights,
    compute_sample_weights,
    export_to_imagefolder,
    find_deepfashion_files,
    parse_bbox,
    parse_category_cloth,
    parse_category_img,
    parse_eval_partition,
    resolve_deepfashion_image_path,
)


@pytest.fixture
def mock_deepfashion_dir(tmp_path):
    """Create a temporary mock DeepFashion dataset with CUHK layout."""
    anno_dir = tmp_path / "Anno"
    eval_dir = tmp_path / "Eval"
    img_dir = tmp_path / "img"

    anno_dir.mkdir(parents=True)
    eval_dir.mkdir(parents=True)
    img_dir.mkdir(parents=True)

    # 1. list_category_cloth.txt (5 sample categories representing top, bottom, outerwear, and ambiguous)
    category_cloth_content = (
        "5\n"
        "category_name  category_type\n"
        "Tee            1\n"
        "Jeans          2\n"
        "Jacket         1\n"
        "Dress          3\n"
        "Blazer         1\n"
    )
    (anno_dir / "list_category_cloth.txt").write_text(category_cloth_content, encoding="utf-8")

    # 2. list_eval_partition.txt
    eval_partition_content = (
        "6\n"
        "image_name                                     eval_status\n"
        "img/Tee/img_001.jpg                            train\n"
        "img/Tee/img_002.jpg                            val\n"
        "img/Jeans/img_001.jpg                          train\n"
        "img/Jacket/img_001.jpg                         train\n"
        "img/Jacket/img_002.jpg                         test\n"
        "img/Dress/img_001.jpg                          train\n"
    )
    (eval_dir / "list_eval_partition.txt").write_text(eval_partition_content, encoding="utf-8")

    # 3. list_category_img.txt (1-indexed matching list_category_cloth.txt)
    category_img_content = (
        "6\n"
        "image_name                                     category_label\n"
        "img/Tee/img_001.jpg                            1\n"
        "img/Tee/img_002.jpg                            1\n"
        "img/Jeans/img_001.jpg                          2\n"
        "img/Jacket/img_001.jpg                         3\n"
        "img/Jacket/img_002.jpg                         3\n"
        "img/Dress/img_001.jpg                          4\n"
    )
    (anno_dir / "list_category_img.txt").write_text(category_img_content, encoding="utf-8")

    # 4. list_bbox.txt
    bbox_content = (
        "6\n"
        "image_name             x_1    y_1    x_2    y_2\n"
        "img/Tee/img_001.jpg    010    010    050    050\n"
        "img/Tee/img_002.jpg    005    005    055    055\n"
        "img/Jeans/img_001.jpg  015    020    060    060\n"
        "img/Jacket/img_001.jpg 010    010    050    050\n"
        "img/Jacket/img_002.jpg 008    008    052    052\n"
        "img/Dress/img_001.jpg  005    005    055    055\n"
    )
    (anno_dir / "list_bbox.txt").write_text(bbox_content, encoding="utf-8")

    # 5. Create actual small images (64x64 RGB)
    for sub, name in [
        ("Tee", "img_001.jpg"),
        ("Tee", "img_002.jpg"),
        ("Jeans", "img_001.jpg"),
        ("Jacket", "img_001.jpg"),
        ("Jacket", "img_002.jpg"),
        ("Dress", "img_001.jpg"),
    ]:
        sub_dir = img_dir / sub
        sub_dir.mkdir(parents=True, exist_ok=True)
        img = Image.new("RGB", (64, 64), color=(100, 150, 200))
        img.save(sub_dir / name)

    return tmp_path


# =========================================================================
# 1. Dataset Discovery Tests
# =========================================================================

def test_find_deepfashion_files_cuhk_layout(mock_deepfashion_dir):
    """Verify discovery of Anno/ and Eval/ subfolder layout."""
    found = find_deepfashion_files(mock_deepfashion_dir)
    assert "category_cloth" in found
    assert "eval_partition" in found
    assert "category_img" in found
    assert "bbox" in found
    assert found["category_cloth"].name == "list_category_cloth.txt"


def test_find_deepfashion_files_flat_layout(tmp_path):
    """Verify discovery when annotation files are placed directly in root."""
    (tmp_path / "list_category_cloth.txt").write_text("1\nname 1\nTee 1\n", encoding="utf-8")
    (tmp_path / "list_eval_partition.txt").write_text("1\nname status\nimg.jpg train\n", encoding="utf-8")
    (tmp_path / "list_category_img.txt").write_text("1\nname cat\nimg.jpg 1\n", encoding="utf-8")

    found = find_deepfashion_files(tmp_path)
    assert found["category_cloth"] == tmp_path / "list_category_cloth.txt"
    assert found["eval_partition"] == tmp_path / "list_eval_partition.txt"
    assert found["category_img"] == tmp_path / "list_category_img.txt"


def test_find_deepfashion_files_official_anno_coarse_img001_layout(tmp_path):
    """Discover the official extracted Category/Attribute directory layout."""
    anno_dir = tmp_path / "Anno_coarse"
    eval_dir = tmp_path / "Eval"
    image_dir = tmp_path / "img-001" / "img"
    anno_dir.mkdir()
    eval_dir.mkdir()
    image_dir.mkdir(parents=True)

    (anno_dir / "list_category_cloth.txt").write_text("1\ncategory_name category_type\nBlouse 1\n", encoding="utf-8")
    (anno_dir / "list_category_img.txt").write_text(
        "1\nimage_name category_label\nimg/Sheer_Pleated-Front_Blouse/img_00000001.jpg 1\n",
        encoding="utf-8",
    )
    (eval_dir / "list_eval_partition.txt").write_text(
        "1\nimage_name eval_status\nimg/Sheer_Pleated-Front_Blouse/img_00000001.jpg train\n",
        encoding="utf-8",
    )

    found = find_deepfashion_files(tmp_path)
    assert found["category_cloth"] == anno_dir / "list_category_cloth.txt"
    assert found["category_img"] == anno_dir / "list_category_img.txt"
    assert found["eval_partition"] == eval_dir / "list_eval_partition.txt"
    assert found["img_dir"] == image_dir


def test_resolve_deepfashion_image_path_official_img001_layout(tmp_path):
    image = tmp_path / "img-001" / "img" / "Sheer_Pleated-Front_Blouse" / "img_00000001.jpg"
    image.parent.mkdir(parents=True)
    image.write_bytes(b"fixture")

    resolved = resolve_deepfashion_image_path(tmp_path, "img/Sheer_Pleated-Front_Blouse/img_00000001.jpg", tmp_path / "img-001" / "img")
    assert resolved == image.resolve()


def test_build_manifest_resolves_official_img001_layout(tmp_path):
    anno_dir = tmp_path / "Anno_coarse"
    eval_dir = tmp_path / "Eval"
    image = tmp_path / "img-001" / "img" / "Sheer_Pleated-Front_Blouse" / "img_00000001.jpg"
    anno_dir.mkdir()
    eval_dir.mkdir()
    image.parent.mkdir(parents=True)
    image.write_bytes(b"fixture")
    (anno_dir / "list_category_cloth.txt").write_text("1\ncategory_name category_type\nBlouse 1\n", encoding="utf-8")
    annotation = "img/Sheer_Pleated-Front_Blouse/img_00000001.jpg"
    (anno_dir / "list_category_img.txt").write_text(f"1\nimage_name category_label\n{annotation} 1\n", encoding="utf-8")
    (eval_dir / "list_eval_partition.txt").write_text(f"1\nimage_name eval_status\n{annotation} train\n", encoding="utf-8")

    manifest = build_deepfashion_manifest(tmp_path, include_ambiguous=False, verify_images_exist=True)
    assert len(manifest.items) == 1
    assert manifest.items[0].image_path == "img-001/img/Sheer_Pleated-Front_Blouse/img_00000001.jpg"


def test_find_deepfashion_files_missing_raises(tmp_path):
    """Verify informative FileNotFoundError when required files are absent."""
    with pytest.raises(FileNotFoundError, match="Missing required DeepFashion annotation files"):
        find_deepfashion_files(tmp_path)


# =========================================================================
# 2. Taxonomy & Category Mapping Tests
# =========================================================================

def test_canonical_50_categories_coverage():
    """Verify all 50 canonical categories are explicitly accounted for."""
    assert len(CANONICAL_DEEPFASHION_CATEGORIES) == 50

    mapped_tops = [k for k, v in CANONICAL_DEEPFASHION_CATEGORIES.items() if v["stylesense_category"] == "TOP"]
    mapped_bottoms = [k for k, v in CANONICAL_DEEPFASHION_CATEGORIES.items() if v["stylesense_category"] == "BOTTOM"]
    mapped_outerwear = [k for k, v in CANONICAL_DEEPFASHION_CATEGORIES.items() if v["stylesense_category"] == "OUTERWEAR"]
    ambiguous = [k for k, v in CANONICAL_DEEPFASHION_CATEGORIES.items() if v["status"] == STATUS_AMBIGUOUS_UNMAPPED]

    assert len(mapped_tops) == 11
    assert len(mapped_bottoms) == 16
    assert len(mapped_outerwear) == 11
    assert len(ambiguous) == 12
    assert len(mapped_tops) + len(mapped_bottoms) + len(mapped_outerwear) + len(ambiguous) == 50


def test_ambiguous_categories_preserved():
    """Ensure ambiguous items (Dress, Jumpsuit, etc.) are NOT mapped to TOP/BOTTOM."""
    for item_name in ["Dress", "Jumpsuit", "Romper", "Sundress", "Shirtdress", "Caftan", "Nightdress"]:
        info = CANONICAL_DEEPFASHION_CATEGORIES[item_name]
        assert info["stylesense_category"] is None
        assert info["status"] == STATUS_AMBIGUOUS_UNMAPPED
        assert len(info["rationale"]) > 10


def test_unavailable_categories_documented():
    """Ensure SHOES and ACCESSORIES are recognized as unavailable in this benchmark."""
    assert "SHOES" in UNAVAILABLE_CATEGORIES
    assert "ACCESSORIES" in UNAVAILABLE_CATEGORIES
    for cat, info in UNAVAILABLE_CATEGORIES.items():
        assert "resolution" in info
        assert "reason" in info


def test_parse_category_cloth(mock_deepfashion_dir):
    """Test parsing list_category_cloth.txt and taxonomy mapping."""
    cats = parse_category_cloth(mock_deepfashion_dir / "Anno" / "list_category_cloth.txt")
    assert len(cats) == 5
    assert cats[1].name == "Tee"
    assert cats[1].stylesense_category == "TOP"
    assert cats[1].status == STATUS_MAPPED

    assert cats[2].name == "Jeans"
    assert cats[2].stylesense_category == "BOTTOM"
    assert cats[2].status == STATUS_MAPPED

    assert cats[3].name == "Jacket"
    assert cats[3].stylesense_category == "OUTERWEAR"
    assert cats[3].status == STATUS_MAPPED

    assert cats[4].name == "Dress"
    assert cats[4].stylesense_category is None
    assert cats[4].status == STATUS_AMBIGUOUS_UNMAPPED


# =========================================================================
# 3. Annotation Parsing & Bounding Boxes
# =========================================================================

def test_parse_eval_partition(mock_deepfashion_dir):
    partitions = parse_eval_partition(mock_deepfashion_dir / "Eval" / "list_eval_partition.txt")
    assert len(partitions) == 6
    assert partitions["img/Tee/img_001.jpg"] == "train"
    assert partitions["img/Tee/img_002.jpg"] == "val"
    assert partitions["img/Jacket/img_002.jpg"] == "test"


def test_parse_bbox(mock_deepfashion_dir):
    bboxes = parse_bbox(mock_deepfashion_dir / "Anno" / "list_bbox.txt")
    assert len(bboxes) == 6
    assert bboxes["img/Tee/img_001.jpg"] == (10, 10, 50, 50)


# =========================================================================
# 4. Manifest Building & Serialization
# =========================================================================

def test_build_manifest(mock_deepfashion_dir):
    manifest = build_deepfashion_manifest(mock_deepfashion_dir, include_ambiguous=True, verify_images_exist=True)
    assert len(manifest.items) == 6

    # Verify split counts
    assert len(manifest.get_split("train")) == 4
    assert len(manifest.get_split("val")) == 1
    assert len(manifest.get_split("test")) == 1

    # Verify category counts
    dist = manifest.get_class_distribution()
    assert dist["TOP"] == 2
    assert dist["BOTTOM"] == 1
    assert dist["OUTERWEAR"] == 2
    assert dist["AMBIGUOUS:Dress"] == 1


def test_manifest_json_roundtrip(mock_deepfashion_dir, tmp_path):
    manifest = build_deepfashion_manifest(mock_deepfashion_dir, include_ambiguous=True)
    json_path = tmp_path / "manifest.json"
    manifest.to_json(json_path)

    loaded = DatasetManifest.from_json(json_path)
    assert len(loaded.items) == len(manifest.items)
    assert loaded.items[0].image_path == manifest.items[0].image_path
    assert loaded.items[0].bbox == manifest.items[0].bbox


def test_filter_mapped_only(mock_deepfashion_dir):
    manifest = build_deepfashion_manifest(mock_deepfashion_dir, include_ambiguous=True)
    mapped = manifest.filter_mapped_only()
    assert len(mapped.items) == 5  # Dress is excluded
    assert all(item.stylesense_category in {"TOP", "BOTTOM", "OUTERWEAR"} for item in mapped.items)


# =========================================================================
# 5. Class Imbalance & Weighting Tests
# =========================================================================

def test_calculate_class_weights(mock_deepfashion_dir):
    manifest = build_deepfashion_manifest(mock_deepfashion_dir, include_ambiguous=True)
    # train split has: Tee (TOP), Jeans (BOTTOM), Jacket (OUTERWEAR) -> counts: TOP:1, BOTTOM:1, OUTERWEAR:1
    weights = calculate_class_weights(manifest, split="train", classes=["TOP", "BOTTOM", "OUTERWEAR"])
    assert "TOP" in weights
    assert "BOTTOM" in weights
    assert "OUTERWEAR" in weights
    assert all(w > 0.0 for w in weights.values())


def test_compute_sample_weights(mock_deepfashion_dir):
    manifest = build_deepfashion_manifest(mock_deepfashion_dir, include_ambiguous=True)
    sample_weights = compute_sample_weights(manifest, split="train", classes=["TOP", "BOTTOM", "OUTERWEAR"])
    assert len(sample_weights) == len(manifest.get_split("train"))
    # Dress sample gets weight 0.0 since it is ambiguous
    assert any(w == 0.0 for w in sample_weights)
    assert any(w > 0.0 for w in sample_weights)


def test_balance_manifest(mock_deepfashion_dir):
    manifest = build_deepfashion_manifest(mock_deepfashion_dir, include_ambiguous=True)
    balanced = balance_manifest(manifest, max_per_class=1)
    # Should cap each class in each split to at most 1 item
    train_dist = Counter(item.stylesense_category for item in balanced.get_split("train") if item.stylesense_category)
    assert all(count <= 1 for count in train_dist.values())


# =========================================================================
# 6. PyTorch Dataset & DataLoader Compatibility
# =========================================================================

def test_pytorch_dataset_and_dataloader(mock_deepfashion_dir):
    manifest = build_deepfashion_manifest(mock_deepfashion_dir, include_ambiguous=True)
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    dataset = DeepFashionDataset(
        manifest_or_path=manifest,
        deepfashion_root=mock_deepfashion_dir,
        split="train",
        transform=transform,
        crop_bbox=True,
        classes=["TOP", "BOTTOM", "OUTERWEAR"],
    )

    # In train split, mapped items are 3 (1 TOP, 1 BOTTOM, 1 OUTERWEAR; Dress is ambiguous)
    assert len(dataset) == 3
    sample_img, sample_label = dataset[0]
    assert isinstance(sample_img, torch.Tensor)
    assert sample_img.shape == (3, 224, 224)
    assert 0 <= sample_label < 3

    # Test sample weights for WeightedRandomSampler
    weights = dataset.get_sample_weights()
    assert len(weights) == len(dataset)
    sampler = WeightedRandomSampler(weights, num_samples=len(weights), replacement=True)

    # Test PyTorch DataLoader integration
    loader = DataLoader(dataset, batch_size=2, sampler=sampler)
    batch_images, batch_labels = next(iter(loader))
    assert batch_images.shape == (2, 3, 224, 224)
    assert batch_labels.shape == (2,)


# =========================================================================
# 7. ImageFolder Export & train.py Compatibility
# =========================================================================

def test_export_to_imagefolder_train_compatibility(mock_deepfashion_dir, tmp_path):
    """Verify export creates layout with 5 category folders expected by train.py."""
    manifest = build_deepfashion_manifest(mock_deepfashion_dir, include_ambiguous=True)
    out_dir = tmp_path / "imagefolder_test"

    counts = export_to_imagefolder(
        manifest=manifest,
        deepfashion_root=mock_deepfashion_dir,
        output_dir=out_dir,
        split="train",
        copy_mode="copy",
        create_empty_placeholders=True,
    )

    # Check all 5 folders exist
    for cat in STYLESENSE_TAXONOMY:
        cat_path = out_dir / cat
        assert cat_path.exists(), f"Directory {cat} should exist"
        assert (cat_path / ".gitkeep").exists()

    # SHOES and ACCESSORIES have documentation explaining external supplementation
    assert (out_dir / "SHOES" / "README.md").exists()
    assert (out_dir / "ACCESSORIES" / "README.md").exists()

    # TOP, BOTTOM, OUTERWEAR have exported image files
    top_files = [f for f in (out_dir / "TOP").glob("*.jpg")]
    assert len(top_files) >= 1

    # Without supplementation, torchvision ImageFolder raises FileNotFoundError for missing classes
    with pytest.raises(FileNotFoundError, match="Found no valid file for the classes ACCESSORIES, SHOES"):
        datasets.ImageFolder(str(out_dir))

    # Supplement SHOES and ACCESSORIES with wardrobe sample images (e.g. from export_dataset.py)
    for missing_cat in ["SHOES", "ACCESSORIES"]:
        dummy = Image.new("RGB", (64, 64), color=(50, 50, 50))
        dummy.save(out_dir / missing_cat / "wardrobe_item_01.jpg")

    # Now verify torchvision ImageFolder loads all 5 classes matching train.py VALID_CLASSES
    source = datasets.ImageFolder(str(out_dir))
    assert set(source.classes) == set(STYLESENSE_TAXONOMY)
    assert len(source.samples) >= 4
