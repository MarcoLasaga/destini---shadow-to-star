"""Automated tests for K-Means CIELAB color extraction evaluation utilities."""
from __future__ import annotations

import json
from pathlib import Path
import numpy as np
import pytest
from PIL import Image

from evaluate_kmeans import (
    EvaluationConfig,
    compute_clustering_metrics,
    extract_sampled_garment_lab,
    load_manifest_records,
    normalize_split_name,
    plot_metrics,
    run_kmeans_evaluation,
    sample_records,
    select_best_k,
)
from kmeans_color import KMeansCIELAB


class TestSamplingAndNormalization:
    """Test deterministic sampling and manifest split normalization."""

    def test_normalize_split_name(self):
        assert normalize_split_name("validation") == "val"
        assert normalize_split_name("VAL") == "val"
        assert normalize_split_name("train") == "train"
        assert normalize_split_name("test") == "test"
        assert normalize_split_name("custom") == "custom"

    def test_deterministic_sampling_reproducibility(self):
        records = [{"record_id": f"rec_{i}", "label": "TOP", "image_path": f"img_{i}.jpg"} for i in range(100)]
        sample_a = sample_records(records, num_images=20, seed=42, stratified=False)
        sample_b = sample_records(records, num_images=20, seed=42, stratified=False)
        sample_c = sample_records(records, num_images=20, seed=99, stratified=False)

        assert [r["record_id"] for r in sample_a] == [r["record_id"] for r in sample_b]
        assert [r["record_id"] for r in sample_a] != [r["record_id"] for r in sample_c]
        assert len(sample_a) == 20

    def test_stratified_sampling_distribution(self):
        records = []
        for cat in ["TOP", "BOTTOM", "SHOES", "OUTERWEAR", "ACCESSORIES"]:
            for i in range(30):
                records.append({"record_id": f"{cat}_{i}", "label": cat})

        sampled = sample_records(records, num_images=25, seed=42, stratified=True)
        assert len(sampled) == 25
        counts = {}
        for r in sampled:
            counts[r["label"]] = counts.get(r["label"], 0) + 1

        # Each of the 5 categories should have 5 items
        for cat in ["TOP", "BOTTOM", "SHOES", "OUTERWEAR", "ACCESSORIES"]:
            assert counts[cat] == 5

    def test_invalid_num_images(self):
        records = [{"record_id": "1", "label": "TOP"}]
        with pytest.raises(ValueError, match="num_images must be positive"):
            sample_records(records, num_images=0)


class TestPixelExtractionAndSampling:
    """Test garment pixel extraction and CIELAB sampling."""

    def test_deterministic_pixel_sampling(self):
        # Create synthetic 2-color clothing image
        img_arr = np.zeros((80, 80, 3), dtype=np.uint8)
        img_arr[:40, :] = [200, 30, 30]  # Red
        img_arr[40:, :] = [30, 30, 200]  # Blue
        image = Image.fromarray(img_arr)

        pts_a = extract_sampled_garment_lab(image, max_pixels=50, seed=42)
        pts_b = extract_sampled_garment_lab(image, max_pixels=50, seed=42)
        pts_c = extract_sampled_garment_lab(image, max_pixels=50, seed=99)

        assert pts_a.shape == (50, 3)
        assert np.allclose(pts_a, pts_b)
        assert not np.allclose(pts_a, pts_c)

    def test_insufficient_pixels_handling(self):
        # Tiny 2x2 image should fail min_pixels threshold
        tiny_img = Image.fromarray(np.zeros((2, 2, 3), dtype=np.uint8))
        with pytest.raises(ValueError, match="Insufficient garment pixels"):
            extract_sampled_garment_lab(tiny_img, min_pixels=50)


class TestClusteringMetricsAndSelection:
    """Test metrics computation and best K decision logic."""

    def test_metric_result_structure(self):
        rng = np.random.default_rng(42)
        c1 = rng.normal(loc=[20, 0, 0], scale=1.0, size=(50, 3))
        c2 = rng.normal(loc=[80, 0, 0], scale=1.0, size=(50, 3))
        X = np.vstack([c1, c2])

        km = KMeansCIELAB(n_clusters=2, random_state=42).fit(X)
        metrics = compute_clustering_metrics(X, km.labels_, km.cluster_centers_)

        assert "silhouette_score" in metrics
        assert "davies_bouldin_index" in metrics
        assert isinstance(metrics["silhouette_score"], float)
        assert isinstance(metrics["davies_bouldin_index"], float)
        assert -1.0 <= metrics["silhouette_score"] <= 1.0
        assert metrics["davies_bouldin_index"] >= 0.0

    def test_metric_direction_and_unanimous_selection(self):
        # Mock results where K=3 has highest silhouette and lowest Davies-Bouldin
        mock_results = [
            {"k": 2, "silhouette_score": 0.50, "davies_bouldin_index": 0.90},
            {"k": 3, "silhouette_score": 0.85, "davies_bouldin_index": 0.30},
            {"k": 4, "silhouette_score": 0.60, "davies_bouldin_index": 0.70},
            {"k": 5, "silhouette_score": 0.45, "davies_bouldin_index": 1.10},
        ]
        best_k, reason = select_best_k(mock_results)
        assert best_k == 3
        assert "unanimously" in reason.lower()

    def test_tradeoff_metric_disagreement_selection(self):
        # Silhouette favors K=2 (0.75 vs 0.68), DB favors K=3 (0.35 vs 0.55)
        mock_results = [
            {"k": 2, "silhouette_score": 0.75, "davies_bouldin_index": 0.55},
            {"k": 3, "silhouette_score": 0.68, "davies_bouldin_index": 0.35},
            {"k": 4, "silhouette_score": 0.40, "davies_bouldin_index": 1.20},
        ]
        best_k, reason = select_best_k(mock_results)
        assert best_k in (2, 3)
        assert "trade-off" in reason.lower()
        assert "composite" in reason.lower()


class TestSerializationAndEndToEnd:
    """Test results serialization and synthetic end-to-end evaluation."""

    def test_results_serialization_schema(self, tmp_path: Path):
        results_data = {
            "experiment": {
                "random_seed": 42,
                "num_images": 5,
                "k_values": [2, 3],
                "max_pixels_per_image": 100,
                "dataset_split": "val",
                "color_space": "CIELAB",
            },
            "results": [
                {
                    "k": 2,
                    "silhouette_score": 0.612345,
                    "davies_bouldin_index": 0.543210,
                    "num_images_evaluated": 5,
                },
                {
                    "k": 3,
                    "silhouette_score": 0.587654,
                    "davies_bouldin_index": 0.621098,
                    "num_images_evaluated": 5,
                },
            ],
            "best_k": 2,
            "selection_reason": "Both metrics agree.",
        }

        out_file = tmp_path / "test_results.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(results_data, f, indent=2)

        with open(out_file, "r", encoding="utf-8") as f:
            loaded = json.load(f)

        assert loaded["best_k"] == 2
        assert len(loaded["results"]) == 2
        assert loaded["results"][0]["silhouette_score"] == pytest.approx(0.612345, rel=1e-5)

    def test_synthetic_end_to_end_smoke(self, tmp_path: Path):
        # 1. Create 4 small synthetic images on disk
        img_dir = tmp_path / "images"
        img_dir.mkdir()
        records = []
        for i, cat in enumerate(["TOP", "BOTTOM", "SHOES", "OUTERWEAR"]):
            img_file = img_dir / f"test_{i}.jpg"
            arr = np.zeros((64, 64, 3), dtype=np.uint8)
            arr[:32, :] = [200, 40 * (i + 1), 30]
            arr[32:, :] = [30, 40 * (i + 1), 200]
            Image.fromarray(arr).save(img_file)
            records.append({
                "image_path": str(img_file),
                "label": cat,
                "source": "synthetic",
                "split": "val",
                "record_id": f"syn_{i}",
            })

        # 2. Create synthetic manifest
        manifest_file = tmp_path / "manifest.json"
        with open(manifest_file, "w", encoding="utf-8") as f:
            json.dump({"records": records, "metadata": {}}, f)

        # 3. Run evaluation
        output_json = tmp_path / "results.json"
        output_dir = tmp_path / "plots"

        config = EvaluationConfig(
            manifest_path=str(manifest_file),
            split="val",
            num_images=4,
            seed=42,
            k_values=[2, 3],
            max_pixels_per_image=100,
            output_json=str(output_json),
            output_dir=str(output_dir),
            stratified=True,
            eval_mode="both",
            silhouette_sample_size=100,
        )

        output = run_kmeans_evaluation(config)

        assert output["best_k"] in (2, 3)
        assert len(output["results"]) == 2
        assert output["execution_summary"]["num_images_evaluated"] == 4
        assert output_json.exists()
        assert (output_dir / "silhouette_vs_k.png").exists()
        assert (output_dir / "davies_bouldin_vs_k.png").exists()
        assert (output_dir / "kmeans_metrics_summary.png").exists()
