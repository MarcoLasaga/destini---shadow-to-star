"""CLI tool to ingest, map, and prepare the DeepFashion Category & Attribute dataset.

Usage:
  python prepare_deepfashion.py --data-dir /path/to/deepfashion --output-dir ./prepared_data --manifest-only
  python prepare_deepfashion.py --data-dir /path/to/deepfashion --output-dir ./dataset --export-imagefolder --max-per-class 1000
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# Add current folder to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from deepfashion_dataset import (
    CANONICAL_DEEPFASHION_CATEGORIES,
    STATUS_AMBIGUOUS_UNMAPPED,
    STATUS_MAPPED,
    STATUS_UNAVAILABLE,
    STYLESENSE_TAXONOMY,
    UNAVAILABLE_CATEGORIES,
    balance_manifest,
    build_deepfashion_manifest,
    calculate_class_weights,
    export_to_imagefolder,
    find_deepfashion_files,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Ingest and map DeepFashion Category & Attribute dataset to StyleSense taxonomy."
    )
    parser.add_argument(
        "--data-dir",
        default=os.environ.get("DEEPFASHION_ROOT", ""),
        help="Path to DeepFashion Category and Attribute Prediction root directory.",
    )
    parser.add_argument(
        "--output-dir",
        default="ml-service/data/deepfashion_prepared",
        help="Directory where manifest and/or prepared dataset will be written.",
    )
    parser.add_argument(
        "--manifest-only",
        action="store_true",
        help="Only generate the JSON manifest; do not copy/symlink images.",
    )
    parser.add_argument(
        "--export-imagefolder",
        action="store_true",
        help="Export images into ImageFolder layout (TOP, BOTTOM, OUTERWEAR, SHOES, ACCESSORIES) for train.py.",
    )
    parser.add_argument(
        "--split",
        default="train",
        choices=["train", "val", "test", "all"],
        help="Which split to export to ImageFolder (default: train).",
    )
    parser.add_argument(
        "--copy-mode",
        default="copy",
        choices=["copy", "symlink", "hardlink"],
        help="Method for materializing ImageFolder files (default: copy).",
    )
    parser.add_argument(
        "--max-per-class",
        type=int,
        default=None,
        help="Maximum images per category to export/balance (useful for smoke tests or balancing).",
    )
    parser.add_argument(
        "--exclude-ambiguous",
        action="store_true",
        help="Exclude ambiguous categories (e.g. Dress, Jumpsuit) from manifest.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for deterministic sampling.",
    )
    return parser.parse_args()


def print_banner(text: str) -> None:
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60)


def main() -> None:
    args = parse_args()

    if not args.data_dir:
        print_banner("DEEPFASHION DATASET INGESTION TOOL")
        print("Error: No DeepFashion directory specified.")
        print("Please provide --data-dir <path> or set the DEEPFASHION_ROOT environment variable.")
        print("\nExpected directory structure (either flat or Anno/ + Eval/):")
        print("  - list_category_cloth.txt")
        print("  - list_eval_partition.txt")
        print("  - list_category_img.txt")
        print("  - list_bbox.txt (optional)")
        print("  - img/ (image directory)")
        sys.exit(1)

    data_dir = Path(args.data_dir).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    print_banner("1. DATASET DISCOVERY")
    print(f"Scanning DeepFashion root: {data_dir}")
    try:
        found_files = find_deepfashion_files(data_dir)
        for key, path in found_files.items():
            print(f"  [FOUND] {key:18s} -> {path}")
    except FileNotFoundError as err:
        print(f"\nDiscovery failed: {err}")
        sys.exit(1)

    print_banner("2. INGESTION & TAXONOMY MAPPING")
    print("Parsing annotations and mapping to StyleSense taxonomy...")
    manifest = build_deepfashion_manifest(
        root_dir=data_dir,
        include_ambiguous=not args.exclude_ambiguous,
        verify_images_exist=False,
    )

    print(f"Total items indexed: {len(manifest.items):,}")
    print("\nSplit breakdown:")
    for split_name in ["train", "val", "test"]:
        count = len(manifest.get_split(split_name))
        print(f"  - {split_name:5s}: {count:,} images")

    print("\nCategory breakdown across StyleSense taxonomy:")
    dist = manifest.get_class_distribution()
    for cat, count in dist.items():
        print(f"  - {cat:25s}: {count:,} images")

    print("\nUnavailable Categories in DeepFashion Benchmark:")
    for missing_cat, info in UNAVAILABLE_CATEGORIES.items():
        print(f"  - {missing_cat}: {info['reason']}")

    # Class balance weights
    print_banner("3. CLASS BALANCE ANALYSIS")
    train_weights = calculate_class_weights(manifest, split="train")
    print("Inverse-frequency weights for train split:")
    for cat, weight in train_weights.items():
        print(f"  - {cat:12s}: {weight:.4f}")

    # Save manifest
    manifest_path = output_dir / "deepfashion_manifest.json"
    print_banner("4. SAVING MANIFEST")
    manifest.to_json(manifest_path)
    print(f"Saved reproducible dataset manifest to: {manifest_path}")

    # Save mapping documentation
    summary_path = output_dir / "deepfashion_summary.json"
    summary_data = {
        "dataset_name": "DeepFashion Category and Attribute Prediction",
        "total_images": len(manifest.items),
        "split_counts": {s: len(manifest.get_split(s)) for s in ["train", "val", "test"]},
        "category_distribution": dist,
        "train_class_weights": train_weights,
        "taxonomy": list(STYLESENSE_TAXONOMY),
        "unavailable_categories": UNAVAILABLE_CATEGORIES,
    }
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2)
    print(f"Saved dataset summary to: {summary_path}")

    # Export to ImageFolder if requested
    if args.export_imagefolder:
        print_banner("5. EXPORTING TO IMAGEFOLDER")
        imagefolder_dir = output_dir / "imagefolder" / args.split
        print(f"Exporting split '{args.split}' to: {imagefolder_dir}")
        print(f"Copy mode: {args.copy_mode}, max_per_class: {args.max_per_class}")

        counts = export_to_imagefolder(
            manifest=manifest,
            deepfashion_root=data_dir,
            output_dir=imagefolder_dir,
            split=args.split,
            copy_mode=args.copy_mode,
            max_per_class=args.max_per_class,
            create_empty_placeholders=True,
            seed=args.seed,
        )
        print("Export completed:")
        for cat, count in counts.items():
            print(f"  - {cat:12s}: {count:,} images exported")

    print_banner("DEEPFASHION PREPARATION COMPLETE")


if __name__ == "__main__":
    main()
