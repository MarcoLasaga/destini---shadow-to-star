"""Thesis evaluation for K-Means CIELAB color extraction algorithm.

Evaluates unsupervised clustering quality on real StyleSense garment images
using Silhouette Score and Davies-Bouldin Index across configurable K values.
"""
from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass, field
import json
import logging
from pathlib import Path
import sys
from typing import Any, Dict, List, Optional, Tuple, Union

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for headless execution
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image
from sklearn.metrics import davies_bouldin_score, silhouette_score

# Ensure ml-service directory is importable
_CURRENT_DIR = Path(__file__).resolve().parent
if str(_CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(_CURRENT_DIR))

from kmeans_color import (
    KMeansCIELAB,
    extract_garment_pixels,
    rgb_to_cielab,
    cielab_to_rgb,
    lab_to_color_name,
)

logger = logging.getLogger("evaluate_kmeans")


@dataclass
class EvaluationConfig:
    """Configuration for K-Means clustering evaluation experiment."""
    manifest_path: str = "ml-service/data/stylesense_cnn_manifest.json"
    split: str = "val"
    num_images: int = 100
    seed: int = 42
    k_values: list[int] = field(default_factory=lambda: [2, 3, 4, 5, 6])
    max_pixels_per_image: int = 1000
    output_json: str = "ml-service/data/kmeans_evaluation_results.json"
    output_dir: str = "ml-service/data/kmeans_evaluation"
    stratified: bool = True
    eval_mode: str = "both"  # "per-image", "pooled", or "both"
    max_dimension: int = 128
    silhouette_sample_size: int = 1000


def normalize_split_name(split: str) -> str:
    """Normalize user-facing split names to manifest split conventions."""
    s = split.strip().lower()
    if s in ("validation", "val"):
        return "val"
    if s in ("train", "training"):
        return "train"
    if s in ("test", "testing"):
        return "test"
    return s


def load_manifest_records(manifest_path: Union[str, Path], split: str = "val") -> list[dict[str, Any]]:
    """Load records for the requested split from the authoritative CNN manifest.

    Args:
        manifest_path: Path to stylesense_cnn_manifest.json.
        split: Dataset split ('val', 'train', 'test').

    Returns:
        List of record dictionaries matching the split.
    """
    path = Path(manifest_path)
    if not path.exists():
        raise FileNotFoundError(f"Manifest not found at {path}")

    norm_split = normalize_split_name(split)

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    records = data.get("records", [])
    split_records = [r for r in records if r.get("split") == norm_split]

    if not split_records:
        available_splits = list({r.get("split") for r in records if "split" in r})
        raise ValueError(
            f"No records found for split '{norm_split}'. Available splits in manifest: {available_splits}"
        )

    return split_records


def sample_records(
    records: list[dict[str, Any]],
    num_images: int,
    seed: int = 42,
    stratified: bool = True,
) -> list[dict[str, Any]]:
    """Deterministically sample records, optionally stratified across garment categories.

    Args:
        records: Pool of candidate records.
        num_images: Target number of images to sample.
        seed: Random seed for reproducibility.
        stratified: Whether to stratify across garment category labels.

    Returns:
        Deterministically sampled list of record dictionaries.
    """
    if num_images <= 0:
        raise ValueError(f"num_images must be positive, got {num_images}")

    total_avail = len(records)
    if num_images >= total_avail:
        return list(records)

    rng = np.random.default_rng(seed)

    if not stratified:
        indices = rng.choice(total_avail, size=num_images, replace=False)
        return [records[i] for i in indices]

    # Stratified sampling across categories
    by_category: dict[str, list[dict[str, Any]]] = {}
    for r in records:
        lbl = r.get("label", "UNKNOWN")
        by_category.setdefault(lbl, []).append(r)

    categories = sorted(by_category.keys())
    n_cats = len(categories)
    base_per_cat = num_images // n_cats
    remainder = num_images % n_cats

    sampled: list[dict[str, Any]] = []
    for idx, cat in enumerate(categories):
        cat_records = by_category[cat]
        target_count = base_per_cat + (1 if idx < remainder else 0)
        actual_take = min(target_count, len(cat_records))
        if actual_take > 0:
            cat_indices = rng.choice(len(cat_records), size=actual_take, replace=False)
            sampled.extend([cat_records[i] for i in cat_indices])

    # If some categories had fewer records than requested, top up from remainder
    if len(sampled) < num_images:
        sampled_set = {id(r) for r in sampled}
        remaining = [r for r in records if id(r) not in sampled_set]
        needed = num_images - len(sampled)
        if remaining and needed > 0:
            top_up_idx = rng.choice(len(remaining), size=min(needed, len(remaining)), replace=False)
            sampled.extend([remaining[i] for i in top_up_idx])

    # Shuffle final sampled list deterministically
    perm = rng.permutation(len(sampled))
    return [sampled[i] for i in perm]


def extract_sampled_garment_lab(
    image_or_path: Union[Image.Image, str, Path],
    max_pixels: int = 1000,
    seed: int = 42,
    max_dimension: int = 128,
    min_pixels: int = 10,
) -> np.ndarray:
    """Extract garment pixels, convert to CIELAB, and deterministically sample up to max_pixels.

    Args:
        image_or_path: PIL Image or path to image file.
        max_pixels: Maximum number of pixels to sample.
        seed: Random seed for deterministic pixel sampling.
        max_dimension: Maximum dimension for downsampled pixel extraction.
        min_pixels: Minimum pixels required to form valid clusters.

    Returns:
        Array of shape (N, 3) with CIELAB coordinates.
    """
    if isinstance(image_or_path, (str, Path)):
        img_path = Path(image_or_path)
        if not img_path.exists():
            raise FileNotFoundError(f"Image not found at {img_path}")
        image = Image.open(img_path)
    else:
        image = image_or_path

    garment_rgb = extract_garment_pixels(image, max_dimension=max_dimension)
    if len(garment_rgb) < min_pixels:
        raise ValueError(
            f"Insufficient garment pixels extracted ({len(garment_rgb)} < {min_pixels})"
        )

    garment_lab = rgb_to_cielab(garment_rgb)

    if len(garment_lab) > max_pixels:
        rng = np.random.default_rng(seed)
        indices = rng.choice(len(garment_lab), size=max_pixels, replace=False)
        return garment_lab[indices]

    return garment_lab


def compute_clustering_metrics(
    X: np.ndarray,
    labels: np.ndarray,
    centers: Optional[np.ndarray] = None,
    sample_size: int = 1000,
    seed: int = 42,
) -> dict[str, float]:
    """Compute Silhouette Score and Davies-Bouldin Index for clustering output.

    Args:
        X: CIELAB feature array of shape (N, 3).
        labels: Cluster assignment labels of shape (N,).
        centers: Optional cluster centroid coordinates.
        sample_size: Maximum sample size for pairwise silhouette distance calculation.
        seed: Random seed for subsampling if len(X) > sample_size.

    Returns:
        Dict with 'silhouette_score' and 'davies_bouldin_index'.
    """
    n_samples = len(X)
    if n_samples < 2:
        raise ValueError("Cannot compute metrics with fewer than 2 samples")

    unique_labels = np.unique(labels)
    if len(unique_labels) < 2:
        return {
            "silhouette_score": 0.0,
            "davies_bouldin_index": 0.0,
        }

    # Silhouette Score
    if n_samples > sample_size:
        rng = np.random.default_rng(seed)
        sub_idx = rng.choice(n_samples, size=sample_size, replace=False)
        sil = float(silhouette_score(X[sub_idx], labels[sub_idx]))
    else:
        sil = float(silhouette_score(X, labels))

    # Davies-Bouldin Index
    dbi = float(davies_bouldin_score(X, labels))

    return {
        "silhouette_score": sil,
        "davies_bouldin_index": dbi,
    }


def select_best_k(
    results: list[dict[str, Any]],
    weights: tuple[float, float] = (0.5, 0.5),
) -> tuple[int, str]:
    """Select optimal K from evaluation results using Silhouette and Davies-Bouldin Index.

    Silhouette Score: higher is better.
    Davies-Bouldin Index: lower is better.

    Args:
        results: List of result dicts, each with 'k', 'silhouette_score', 'davies_bouldin_index'.
        weights: (weight_silhouette, weight_davies_bouldin) for composite score.

    Returns:
        Tuple of (best_k, selection_reason).
    """
    if not results:
        raise ValueError("Cannot select best K from empty results list")

    best_sil_entry = max(results, key=lambda r: r["silhouette_score"])
    best_db_entry = min(results, key=lambda r: r["davies_bouldin_index"])

    best_sil_k = best_sil_entry["k"]
    best_db_k = best_db_entry["k"]

    sil_values = np.array([r["silhouette_score"] for r in results], dtype=np.float64)
    db_values = np.array([r["davies_bouldin_index"] for r in results], dtype=np.float64)

    # If both metrics agree unambiguously
    if best_sil_k == best_db_k:
        best_k = best_sil_k
        reason = (
            f"Both Silhouette Score ({best_sil_entry['silhouette_score']:.4f}) and "
            f"Davies-Bouldin Index ({best_db_entry['davies_bouldin_index']:.4f}) unanimously "
            f"agree that K={best_k} provides the optimal color clustering configuration, "
            f"maximizing cluster separation while minimizing intra-cluster dispersion."
        )
        return best_k, reason

    # Metrics disagree: perform principled Min-Max normalization and composite ranking
    sil_min, sil_max = float(sil_values.min()), float(sil_values.max())
    db_min, db_max = float(db_values.min()), float(db_values.max())

    sil_range = sil_max - sil_min if (sil_max - sil_min) > 1e-9 else 1.0
    db_range = db_max - db_min if (db_max - db_min) > 1e-9 else 1.0

    w_sil, w_db = weights

    best_k = results[0]["k"]
    max_composite = -float("inf")
    composite_scores = []

    for r in results:
        k_val = r["k"]
        s_norm = (r["silhouette_score"] - sil_min) / sil_range
        # For Davies-Bouldin, lower is better, so invert normalized score
        db_norm = (db_max - r["davies_bouldin_index"]) / db_range
        composite = w_sil * s_norm + w_db * db_norm
        composite_scores.append((k_val, composite))
        if composite > max_composite:
            max_composite = composite
            best_k = k_val

    reason = (
        f"Multi-criteria trade-off evaluation: Silhouette Score favored K={best_sil_k} "
        f"({best_sil_entry['silhouette_score']:.4f}, strongest cluster separation), whereas "
        f"Davies-Bouldin Index favored K={best_db_k} "
        f"({best_db_entry['davies_bouldin_index']:.4f}, tightest cluster dispersion). "
        f"K={best_k} was selected based on the highest composite quality score ({max_composite:.4f}), "
        f"achieving the most balanced trade-off for fashion garment color representation."
    )
    return best_k, reason


def plot_metrics(
    results: list[dict[str, Any]],
    output_dir: Union[str, Path],
    best_k: Optional[int] = None,
) -> dict[str, str]:
    """Generate thesis-ready plots for Silhouette Score and Davies-Bouldin Index vs K.

    Args:
        results: Results list containing 'k', 'silhouette_score', 'davies_bouldin_index'.
        output_dir: Destination directory for plot image files.
        best_k: Highlighted optimal K value.

    Returns:
        Dictionary mapping plot identifiers to file paths.
    """
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    k_vals = [r["k"] for r in results]
    sil_scores = [r["silhouette_score"] for r in results]
    db_indices = [r["davies_bouldin_index"] for r in results]

    # Check for std errors if per-image evaluation was performed
    sil_stds = [r.get("per_image", {}).get("silhouette_std", 0.0) for r in results]
    db_stds = [r.get("per_image", {}).get("davies_bouldin_std", 0.0) for r in results]
    has_stds = any(s > 0 for s in sil_stds)

    paths = {}

    # 1. Silhouette Score vs K
    fig, ax = plt.subplots(figsize=(7, 4.5), dpi=300)
    if has_stds:
        ax.errorbar(
            k_vals, sil_scores, yerr=sil_stds, fmt='-o', color='#2563EB',
            ecolor='#93C5FD', elinewidth=2, capsize=4, capthick=1.5,
            linewidth=2.2, markersize=7, label='Mean Silhouette ± 1 SD'
        )
    else:
        ax.plot(k_vals, sil_scores, '-o', color='#2563EB', linewidth=2.2, markersize=7, label='Silhouette Score')

    if best_k is not None and best_k in k_vals:
        best_idx = k_vals.index(best_k)
        ax.plot(best_k, sil_scores[best_idx], 'o', color='#DC2626', markersize=11, zorder=5, label=f'Selected Optimal K={best_k}')
        ax.annotate(
            f'Optimal K={best_k}\n({sil_scores[best_idx]:.4f})',
            xy=(best_k, sil_scores[best_idx]),
            xytext=(0, 18),
            textcoords='offset points',
            ha='center',
            fontweight='bold',
            color='#991B1B',
            arrowprops=dict(arrowstyle='->', color='#DC2626', lw=1.5),
        )

    ax.set_title("Silhouette Score vs. Number of Clusters (K)\n[Higher is Better: Cluster Separation Quality]", fontsize=12, pad=12, fontweight='bold')
    ax.set_xlabel("Number of Clusters (K)", fontsize=11)
    ax.set_ylabel("Silhouette Score", fontsize=11)
    ax.set_xticks(k_vals)
    ax.grid(True, linestyle='--', alpha=0.6)
    ax.legend(frameon=True, facecolor='white', loc='best')
    fig.tight_layout()
    sil_path = out_dir / "silhouette_vs_k.png"
    fig.savefig(sil_path, dpi=300)
    plt.close(fig)
    paths["silhouette_vs_k"] = str(sil_path)

    # 2. Davies-Bouldin Index vs K
    fig, ax = plt.subplots(figsize=(7, 4.5), dpi=300)
    if has_stds:
        ax.errorbar(
            k_vals, db_indices, yerr=db_stds, fmt='-s', color='#D97706',
            ecolor='#FDE68A', elinewidth=2, capsize=4, capthick=1.5,
            linewidth=2.2, markersize=7, label='Mean Davies-Bouldin ± 1 SD'
        )
    else:
        ax.plot(k_vals, db_indices, '-s', color='#D97706', linewidth=2.2, markersize=7, label='Davies-Bouldin Index')

    if best_k is not None and best_k in k_vals:
        best_idx = k_vals.index(best_k)
        ax.plot(best_k, db_indices[best_idx], 's', color='#DC2626', markersize=11, zorder=5, label=f'Selected Optimal K={best_k}')
        ax.annotate(
            f'Optimal K={best_k}\n({db_indices[best_idx]:.4f})',
            xy=(best_k, db_indices[best_idx]),
            xytext=(0, 18),
            textcoords='offset points',
            ha='center',
            fontweight='bold',
            color='#991B1B',
            arrowprops=dict(arrowstyle='->', color='#DC2626', lw=1.5),
        )

    ax.set_title("Davies-Bouldin Index vs. Number of Clusters (K)\n[Lower is Better: Within-Cluster Compactness & Separation]", fontsize=12, pad=12, fontweight='bold')
    ax.set_xlabel("Number of Clusters (K)", fontsize=11)
    ax.set_ylabel("Davies-Bouldin Index", fontsize=11)
    ax.set_xticks(k_vals)
    ax.grid(True, linestyle='--', alpha=0.6)
    ax.legend(frameon=True, facecolor='white', loc='best')
    fig.tight_layout()
    db_path = out_dir / "davies_bouldin_vs_k.png"
    fig.savefig(db_path, dpi=300)
    plt.close(fig)
    paths["davies_bouldin_vs_k"] = str(db_path)

    # 3. Dual-Panel Summary Figure
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5), dpi=300)

    # Left: Silhouette
    ax1.plot(k_vals, sil_scores, '-o', color='#2563EB', linewidth=2, markersize=6)
    if best_k is not None and best_k in k_vals:
        ax1.plot(best_k, sil_scores[k_vals.index(best_k)], 'o', color='#DC2626', markersize=9)
    ax1.set_title("Silhouette Score (Higher is Better)", fontsize=11, fontweight='bold')
    ax1.set_xlabel("Number of Clusters (K)")
    ax1.set_ylabel("Silhouette Score")
    ax1.set_xticks(k_vals)
    ax1.grid(True, linestyle='--', alpha=0.6)

    # Right: Davies-Bouldin
    ax2.plot(k_vals, db_indices, '-s', color='#D97706', linewidth=2, markersize=6)
    if best_k is not None and best_k in k_vals:
        ax2.plot(best_k, db_indices[k_vals.index(best_k)], 's', color='#DC2626', markersize=9)
    ax2.set_title("Davies-Bouldin Index (Lower is Better)", fontsize=11, fontweight='bold')
    ax2.set_xlabel("Number of Clusters (K)")
    ax2.set_ylabel("Davies-Bouldin Index")
    ax2.set_xticks(k_vals)
    ax2.grid(True, linestyle='--', alpha=0.6)

    fig.suptitle("StyleSense CIELAB K-Means Clustering Quality Across Candidate K Values", fontsize=13, fontweight='bold', y=0.98)
    fig.tight_layout()
    summary_path = out_dir / "kmeans_metrics_summary.png"
    fig.savefig(summary_path, dpi=300)
    plt.close(fig)
    paths["kmeans_metrics_summary"] = str(summary_path)

    return paths


def plot_palette_visualizations(
    sampled_records: list[dict[str, Any]],
    best_k: int,
    output_dir: Union[str, Path],
    seed: int = 42,
    num_examples: int = 5,
    candidate_k_values: Optional[list[int]] = None,
) -> dict[str, str]:
    """Generate visual examples showing original garments and extracted color palettes.

    Args:
        sampled_records: Evaluated garment records.
        best_k: Best K configuration for palette extraction.
        output_dir: Output directory.
        seed: Random seed for selecting example images.
        num_examples: Number of example garments to visualize.
        candidate_k_values: Candidate K values to compare.


    Returns:
        Dict mapping visualization identifiers to file paths.
    """
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = {}

    # Pick 1 example per category if possible, or diverse selection
    by_category: dict[str, list[dict[str, Any]]] = {}
    for r in sampled_records:
        cat = r.get("label", "UNKNOWN")
        by_category.setdefault(cat, []).append(r)

    selected: list[dict[str, Any]] = []
    rng = np.random.default_rng(seed)

    for cat in sorted(by_category.keys()):
        candidates = by_category[cat]
        # Verify file exists
        valid = [c for c in candidates if Path(c.get("image_path", "")).exists()]
        if valid:
            chosen = valid[int(rng.integers(0, len(valid)))]
            selected.append(chosen)
        if len(selected) >= num_examples:
            break

    # Top up if needed
    if len(selected) < num_examples:
        for r in sampled_records:
            if r not in selected and Path(r.get("image_path", "")).exists():
                selected.append(r)
            if len(selected) >= num_examples:
                break

    if not selected:
        logger.warning("No valid images found for palette visualization")
        return paths

    # 1. Palette extraction examples at optimal K
    n_rows = len(selected)
    fig, axes = plt.subplots(n_rows, 2, figsize=(10, 2.5 * n_rows), dpi=300, gridspec_kw={'width_ratios': [1, 2.5]})
    if n_rows == 1:
        axes = np.array([axes])

    for row_idx, rec in enumerate(selected):
        img_path = Path(rec["image_path"])
        label = rec.get("label", "GARMENT")
        img = Image.open(img_path).convert("RGB")

        # Display original garment
        ax_img = axes[row_idx, 0]
        ax_img.imshow(img)
        ax_img.set_title(f"{label} ({img_path.name})", fontsize=10, fontweight='bold')
        ax_img.axis("off")

        # Extract palette at best_k
        ax_pal = axes[row_idx, 1]
        try:
            lab_pixels = extract_sampled_garment_lab(img, max_pixels=1000, seed=seed)
            km = KMeansCIELAB(n_clusters=best_k, random_state=seed).fit(lab_pixels)
            counts = np.bincount(km.labels_, minlength=best_k)
            weights = counts / len(km.labels_)
            order = np.argsort(-weights)

            # Draw palette swatches
            ax_pal.set_xlim(0, 1)
            ax_pal.set_ylim(0, best_k)
            ax_pal.axis("off")

            for swatch_idx, k_idx in enumerate(order):
                lab_center = km.cluster_centers_[k_idx]
                rgb = cielab_to_rgb(np.asarray(lab_center).reshape(1, 3))[0]
                r, g, b = int(rgb[0]), int(rgb[1]), int(rgb[2])
                hex_str = f"#{r:02x}{g:02x}{b:02x}".upper()
                name = lab_to_color_name(lab_center)
                weight = weights[k_idx]

                y_pos = best_k - swatch_idx - 1
                # Draw color box
                rect = plt.Rectangle((0.02, y_pos + 0.1), 0.22, 0.8, facecolor=np.array([r, g, b]) / 255.0, edgecolor="#333333", lw=1)
                ax_pal.add_patch(rect)
                ax_pal.text(
                    0.28, y_pos + 0.5,
                    f"{name} ({hex_str})  —  {weight * 100:.1f}% weight",
                    va='center', fontsize=9, fontweight='medium'
                )
            ax_pal.set_title(f"Extracted CIELAB Palette (K={best_k})", fontsize=10, fontweight='bold')
        except Exception as e:
            ax_pal.text(0.1, 0.5, f"Extraction failed: {e}", fontsize=9, color="red")
            ax_pal.axis("off")

    fig.suptitle(f"StyleSense Real Garment Color Extraction Examples (K={best_k})", fontsize=12, fontweight='bold', y=0.99)
    fig.tight_layout()
    pal_path = out_dir / "palette_extraction_examples.png"
    fig.savefig(pal_path, dpi=300)
    plt.close(fig)
    paths["palette_extraction_examples"] = str(pal_path)

    # 2. Multi-K Comparison for representative garment
    rep_rec = selected[0]
    rep_img = Image.open(rep_rec["image_path"]).convert("RGB")
    rep_lab = extract_sampled_garment_lab(rep_img, max_pixels=1000, seed=seed)
    if candidate_k_values is None:
        candidate_k_values = [2, 3, 4, 5, 6]

    candidate_k_list = [k for k in candidate_k_values if k <= len(rep_lab)]
    if not candidate_k_list:
        candidate_k_list = [best_k]

    fig, axes = plt.subplots(1, len(candidate_k_list) + 1, figsize=(3.2 * (len(candidate_k_list) + 1), 3.5), dpi=300)

    # First axis: Original garment
    axes[0].imshow(rep_img)
    axes[0].set_title(f"Original Garment\n({rep_rec.get('label', 'GARMENT')})", fontsize=10, fontweight='bold')
    axes[0].axis("off")

    max_k_in_list = max(candidate_k_list)

    for col_idx, k_val in enumerate(candidate_k_list):
        ax = axes[col_idx + 1]
        km = KMeansCIELAB(n_clusters=k_val, random_state=seed).fit(rep_lab)
        counts = np.bincount(km.labels_, minlength=k_val)
        weights = counts / len(km.labels_)
        order = np.argsort(-weights)

        ax.set_xlim(0, 1)
        ax.set_ylim(0, max_k_in_list)
        ax.axis("off")

        for swatch_idx, k_idx in enumerate(order):
            lab_center = km.cluster_centers_[k_idx]
            rgb = cielab_to_rgb(np.asarray(lab_center).reshape(1, 3))[0]
            r, g, b = int(rgb[0]), int(rgb[1]), int(rgb[2])
            hex_str = f"#{r:02x}{g:02x}{b:02x}".upper()
            name = lab_to_color_name(lab_center)
            weight = weights[k_idx]

            y_pos = max_k_in_list - swatch_idx - 1
            rect = plt.Rectangle((0.05, y_pos + 0.1), 0.35, 0.8, facecolor=np.array([r, g, b]) / 255.0, edgecolor="#333333", lw=1)
            ax.add_patch(rect)
            ax.text(0.45, y_pos + 0.5, f"{name}\n{weight*100:.0f}%", va='center', fontsize=8)

        is_best = (k_val == best_k)
        title_color = "#DC2626" if is_best else "black"
        title_suffix = " (Selected)" if is_best else ""
        ax.set_title(f"K = {k_val}{title_suffix}", fontsize=10, fontweight='bold', color=title_color)

    fig.suptitle(f"Garment Palette Granularity Across Evaluated K Values in CIELAB Space", fontsize=12, fontweight='bold', y=0.98)
    fig.tight_layout()
    comp_path = out_dir / "k_variation_comparison.png"
    fig.savefig(comp_path, dpi=300)
    plt.close(fig)
    paths["k_variation_comparison"] = str(comp_path)

    return paths


def run_kmeans_evaluation(config: EvaluationConfig) -> dict[str, Any]:
    """Execute the full deterministic K-Means evaluation experiment.

    Args:
        config: Experiment configuration dataclass.

    Returns:
        Structured results dictionary.
    """
    print("=" * 60)
    print("STYLESENSE K-MEANS COLOR EXTRACTION EVALUATION")
    print("=" * 60)
    print(f"Manifest Path:           {config.manifest_path}")
    print(f"Dataset Split:           {config.split}")
    print(f"Target Images:           {config.num_images}")
    print(f"Random Seed:             {config.seed}")
    print(f"Candidate K Values:      {config.k_values}")
    print(f"Max Pixels per Image:    {config.max_pixels_per_image}")
    print(f"Stratified Sampling:     {config.stratified}")
    print(f"Evaluation Mode:         {config.eval_mode}")
    print(f"Output JSON:             {config.output_json}")
    print(f"Output Plots Dir:        {config.output_dir}")
    print("-" * 60)

    # 1. Load manifest split records
    records = load_manifest_records(config.manifest_path, split=config.split)
    print(f"Available records in '{config.split}' split: {len(records):,}")

    # 2. Deterministically sample records
    candidate_records = sample_records(
        records=records,
        num_images=config.num_images,
        seed=config.seed,
        stratified=config.stratified,
    )
    print(f"Sampled candidate records: {len(candidate_records)}")

    # 3. Process images and extract CIELAB pixels
    processed_images: list[dict[str, Any]] = []
    skipped_records: list[dict[str, Any]] = []
    skipped_reasons: dict[str, int] = {}

    for idx, rec in enumerate(candidate_records):
        img_path = Path(rec.get("image_path", ""))
        rec_id = rec.get("record_id", f"img_{idx}")
        label = rec.get("label", "UNKNOWN")
        source = rec.get("source", "unknown")

        if not img_path.exists():
            reason = "FileNotFound"
            skipped_records.append({"record_id": rec_id, "path": str(img_path), "reason": reason})
            skipped_reasons[reason] = skipped_reasons.get(reason, 0) + 1
            continue

        try:
            # Deterministic per-image seed derived from base seed and record index
            img_seed = config.seed + idx * 17
            lab_pts = extract_sampled_garment_lab(
                image_or_path=img_path,
                max_pixels=config.max_pixels_per_image,
                seed=img_seed,
                max_dimension=config.max_dimension,
                min_pixels=max(config.k_values),
            )
            processed_images.append({
                "record": rec,
                "lab_pixels": lab_pts,
                "label": label,
                "source": source,
                "image_path": str(img_path),
            })
        except Exception as exc:
            reason = type(exc).__name__
            skipped_records.append({"record_id": rec_id, "path": str(img_path), "reason": f"{reason}: {exc}"})
            skipped_reasons[reason] = skipped_reasons.get(reason, 0) + 1

    num_eval = len(processed_images)
    num_skip = len(skipped_records)
    print(f"Successfully processed images: {num_eval} / {len(candidate_records)}")
    if num_skip > 0:
        print(f"Skipped images ({num_skip}): {skipped_reasons}")

    if num_eval == 0:
        raise RuntimeError("No garment images were successfully processed for evaluation.")

    # Category and source distributions
    cat_counts: dict[str, int] = {}
    source_counts: dict[str, int] = {}
    for item in processed_images:
        cat_counts[item["label"]] = cat_counts.get(item["label"], 0) + 1
        source_counts[item["source"]] = source_counts.get(item["source"], 0) + 1

    print(f"Evaluated Categories:    {cat_counts}")
    print(f"Evaluated Sources:       {source_counts}")
    print("-" * 60)

    # 4. Run K-Means and compute metrics for each K
    results: list[dict[str, Any]] = []

    # Prepare pooled array if needed
    pooled_lab: Optional[np.ndarray] = None
    if config.eval_mode in ("pooled", "both"):
        pooled_lab = np.vstack([item["lab_pixels"] for item in processed_images])
        print(f"Pooled CIELAB pixel dataset size: {len(pooled_lab):,} samples")

    print("\nRunning clustering evaluation across candidate K values:")
    print(f"{'K':<4} | {'Silhouette':<12} | {'Davies-Bouldin':<14} | {'Images':<8}")
    print("-" * 46)

    for k_val in config.k_values:
        per_image_sil: list[float] = []
        per_image_db: list[float] = []
        by_cat_sil: dict[str, list[float]] = {}
        by_cat_db: dict[str, list[float]] = {}

        for item in processed_images:
            lab_pts = item["lab_pixels"]
            cat = item["label"]
            km = KMeansCIELAB(n_clusters=k_val, random_state=config.seed).fit(lab_pts)
            metrics = compute_clustering_metrics(
                X=lab_pts,
                labels=km.labels_,
                centers=km.cluster_centers_,
                sample_size=min(len(lab_pts), config.silhouette_sample_size),
                seed=config.seed,
            )
            s_val = metrics["silhouette_score"]
            d_val = metrics["davies_bouldin_index"]

            per_image_sil.append(s_val)
            per_image_db.append(d_val)
            by_cat_sil.setdefault(cat, []).append(s_val)
            by_cat_db.setdefault(cat, []).append(d_val)

        mean_sil = float(np.mean(per_image_sil))
        std_sil = float(np.std(per_image_sil))
        mean_db = float(np.mean(per_image_db))
        std_db = float(np.std(per_image_db))

        cat_summary: dict[str, dict[str, float]] = {}
        for c in by_cat_sil:
            cat_summary[c] = {
                "silhouette_mean": float(np.mean(by_cat_sil[c])),
                "davies_bouldin_mean": float(np.mean(by_cat_db[c])),
                "count": len(by_cat_sil[c]),
            }

        result_entry: dict[str, Any] = {
            "k": k_val,
            "silhouette_score": mean_sil,
            "davies_bouldin_index": mean_db,
            "num_images_evaluated": num_eval,
            "per_image": {
                "silhouette_mean": mean_sil,
                "silhouette_std": std_sil,
                "davies_bouldin_mean": mean_db,
                "davies_bouldin_std": std_db,
                "by_category": cat_summary,
            },
        }

        # If pooled mode requested, evaluate on pooled dataset as well
        if pooled_lab is not None:
            km_pool = KMeansCIELAB(n_clusters=k_val, random_state=config.seed).fit(pooled_lab)
            pool_metrics = compute_clustering_metrics(
                X=pooled_lab,
                labels=km_pool.labels_,
                centers=km_pool.cluster_centers_,
                sample_size=config.silhouette_sample_size,
                seed=config.seed,
            )
            result_entry["pooled"] = {
                "silhouette_score": pool_metrics["silhouette_score"],
                "davies_bouldin_index": pool_metrics["davies_bouldin_index"],
                "total_pixels": len(pooled_lab),
            }

        results.append(result_entry)
        print(f"{k_val:<4} | {mean_sil:<12.4f} | {mean_db:<14.4f} | {num_eval:<8}")

    # 5. Determine optimal K
    best_k, selection_reason = select_best_k(results)
    print("-" * 46)
    print(f"SELECTED OPTIMAL K: {best_k}")
    print(f"Selection Rationale:\n  {selection_reason}\n")

    # 6. Generate visualizations
    print("Generating thesis-ready visualizations...")
    plot_paths = plot_metrics(results, config.output_dir, best_k=best_k)
    palette_plot_paths = plot_palette_visualizations(
        sampled_records=[p["record"] for p in processed_images],
        best_k=best_k,
        output_dir=config.output_dir,
        seed=config.seed,
        candidate_k_values=config.k_values,
    )
    plot_paths.update(palette_plot_paths)
    for name, p in plot_paths.items():
        print(f"  Saved plot [{name}]: {p}")

    # 7. Construct final JSON results structure
    final_output: dict[str, Any] = {
        "experiment": {
            "random_seed": config.seed,
            "num_images": config.num_images,
            "k_values": config.k_values,
            "max_pixels_per_image": config.max_pixels_per_image,
            "dataset_split": config.split,
            "color_space": "CIELAB",
            "evaluation_mode": config.eval_mode,
            "manifest_path": config.manifest_path,
        },
        "results": results,
        "best_k": best_k,
        "selection_reason": selection_reason,
        "execution_summary": {
            "num_candidate_images": len(candidate_records),
            "num_images_evaluated": num_eval,
            "num_images_skipped": num_skip,
            "skipped_reasons": skipped_reasons,
            "categories_evaluated": cat_counts,
            "sources_evaluated": source_counts,
            "total_pixels_evaluated": sum(len(p["lab_pixels"]) for p in processed_images),
            "generated_visualizations": plot_paths,
        },
    }

    # 8. Write results JSON
    json_path = Path(config.output_json)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=2)
    print(f"\nSaved structured results JSON: {json_path}")
    print("=" * 60)

    return final_output


def build_parser() -> argparse.ArgumentParser:
    """Build CLI argument parser."""
    parser = argparse.ArgumentParser(
        description="Evaluate StyleSense CIELAB K-Means clustering algorithm on garment images."
    )
    parser.add_argument(
        "--manifest",
        default="ml-service/data/stylesense_cnn_manifest.json",
        help="Path to authoritative CNN dataset manifest JSON.",
    )
    parser.add_argument(
        "--split",
        default="val",
        help="Dataset split to evaluate ('val', 'validation', 'train', 'test').",
    )
    parser.add_argument(
        "--num-images",
        type=int,
        default=100,
        help="Number of garment images to sample and evaluate (default: 100).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for deterministic sampling and clustering (default: 42).",
    )
    parser.add_argument(
        "--k-values",
        type=int,
        nargs="+",
        default=[2, 3, 4, 5, 6],
        help="List of candidate K cluster values (default: 2 3 4 5 6).",
    )
    parser.add_argument(
        "--max-pixels-per-image",
        type=int,
        default=1000,
        help="Maximum garment pixels sampled per image (default: 1000).",
    )
    parser.add_argument(
        "--output",
        default="ml-service/data/kmeans_evaluation_results.json",
        help="Path to save evaluation results JSON.",
    )
    parser.add_argument(
        "--output-dir",
        default="ml-service/data/kmeans_evaluation",
        help="Directory to save generated visualization figures.",
    )
    parser.add_argument(
        "--eval-mode",
        choices=["both", "per-image", "pooled"],
        default="both",
        help="Clustering evaluation mode (default: both).",
    )
    parser.add_argument(
        "--no-stratified",
        action="store_true",
        help="Disable category-stratified image sampling.",
    )
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    """CLI entrypoint."""
    parser = build_parser()
    args = parser.parse_args(argv)

    config = EvaluationConfig(
        manifest_path=args.manifest,
        split=args.split,
        num_images=args.num_images,
        seed=args.seed,
        k_values=args.k_values,
        max_pixels_per_image=args.max_pixels_per_image,
        output_json=args.output,
        output_dir=args.output_dir,
        stratified=not args.no_stratified,
        eval_mode=args.eval_mode,
    )

    try:
        run_kmeans_evaluation(config)
        return 0
    except Exception as exc:
        print(f"\nEvaluation failed with error: {exc}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
