"""Build and validate the unified CNN training manifest."""
from __future__ import annotations

import argparse
import os
from pathlib import Path

from cnn_dataset import build_cnn_manifest, validate_cnn_manifest, write_conflict_report
from deepfashion_dataset import build_deepfashion_manifest
from polyvore_dataset import build_polyvore_manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--deepfashion-root", type=Path, default=os.environ.get("DEEPFASHION_ROOT") or None)
    parser.add_argument("--polyvore-root", type=Path, default=os.environ.get("POLYVORE_ROOT") or None)
    parser.add_argument("--repolyvore-root", type=Path, default=os.environ.get("REPOLYVORE_ROOT") or None)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--hash-images", action="store_true")
    parser.add_argument("--repolyvore-val-ratio", type=float, default=0.1)
    parser.add_argument("--repolyvore-test-ratio", type=float, default=0.1)
    parser.add_argument("--repolyvore-seed", type=int, default=42)
    parser.add_argument("--conflict-report", type=Path)
    args = parser.parse_args()
    if not args.deepfashion_root and not args.polyvore_root and not args.repolyvore_root:
        parser.error("provide at least one real dataset root")
    deepfashion = build_deepfashion_manifest(args.deepfashion_root, include_ambiguous=False, verify_images_exist=True) if args.deepfashion_root else None
    polyvore = build_polyvore_manifest(args.polyvore_root) if args.polyvore_root else None
    hash_images = args.hash_images or bool(args.repolyvore_root)
    manifest = build_cnn_manifest(
        deepfashion=deepfashion,
        polyvore=polyvore,
        repolyvore_root=args.repolyvore_root,
        repolyvore_val_ratio=args.repolyvore_val_ratio,
        repolyvore_test_ratio=args.repolyvore_test_ratio,
        repolyvore_seed=args.repolyvore_seed,
        deepfashion_root=args.deepfashion_root,
        polyvore_root=args.polyvore_root,
        hash_images=hash_images,
    )
    errors = validate_cnn_manifest(manifest, require_files=True, require_all_five_classes=True)
    manifest.metadata["validation_errors"] = errors
    manifest.metadata["five_class_ready"] = not errors
    conflict_report_path = args.conflict_report or args.output.with_name(args.output.stem + "_conflicts.json")
    write_conflict_report(
        manifest.metadata["repolyvore_conflict_resolution"] or manifest.metadata["conflict_resolution"],
        conflict_report_path,
    )
    manifest.to_json(args.output)
    if errors:
        print("Manifest validation failed:")
        print("\n".join(errors))
        raise SystemExit(2)
    print(f"Wrote {len(manifest.records)} records to {args.output}")
    for split, counts in manifest.class_statistics().items():
        print(split, counts)


if __name__ == "__main__":
    main()
