"""Comprehensive test suite for K-Means CIELAB color extraction module."""
import numpy as np
import pytest
from PIL import Image
from pathlib import Path

from kmeans_color import (
    rgb_to_cielab,
    cielab_to_rgb,
    delta_e_cie76,
    lab_to_color_name,
    KMeansCIELAB,
    compute_silhouette_score,
    compute_davies_bouldin_index,
    extract_garment_pixels,
    extract_clothing_palette,
)


class TestColorSpaceConversion:
    """Test standard sRGB <-> CIELAB conversions and Delta E."""

    def test_pure_black(self):
        rgb = np.array([[0, 0, 0]], dtype=np.uint8)
        lab = rgb_to_cielab(rgb)
        assert np.isclose(lab[0, 0], 0.0, atol=0.1), "Pure black L* should be ~0"
        rgb_recovered = cielab_to_rgb(lab)
        assert np.allclose(rgb, rgb_recovered, atol=1)

    def test_pure_white(self):
        rgb = np.array([[255, 255, 255]], dtype=np.uint8)
        lab = rgb_to_cielab(rgb)
        assert np.isclose(lab[0, 0], 100.0, atol=0.5), "Pure white L* should be ~100"
        assert np.isclose(lab[0, 1], 0.0, atol=1.0), "Pure white a* should be ~0"
        assert np.isclose(lab[0, 2], 0.0, atol=1.0), "Pure white b* should be ~0"
        rgb_recovered = cielab_to_rgb(lab)
        assert np.allclose(rgb, rgb_recovered, atol=1)

    def test_round_trip_accuracy(self):
        """Random RGB values should reconstruct with average Delta E < 1.5."""
        rng = np.random.default_rng(12345)
        rgb_samples = rng.integers(0, 256, size=(100, 3), dtype=np.uint8)
        lab = rgb_to_cielab(rgb_samples)
        rgb_rec = cielab_to_rgb(lab)
        lab_rec = rgb_to_cielab(rgb_rec)

        delta_e = delta_e_cie76(lab, lab_rec)
        assert np.mean(delta_e) < 1.5, f"Mean round-trip Delta E too high: {np.mean(delta_e)}"

    def test_delta_e_distance(self):
        lab1 = np.array([50.0, 20.0, -10.0])
        lab2 = np.array([50.0, 23.0, -6.0])
        # sqrt(0^2 + 3^2 + 4^2) = 5.0
        dist = delta_e_cie76(lab1, lab2)
        assert np.isclose(dist, 5.0, atol=1e-5)


class TestColorNaming:
    """Test perceptual mapping to named fashion colors."""

    @pytest.mark.parametrize(
        "rgb, expected_name",
        [
            ([10, 10, 10], "Black"),
            ([250, 250, 250], "White"),
            ([128, 128, 128], "Gray"),
            ([15, 25, 60], "Navy"),
            ([210, 20, 20], "Red"),
            ([20, 120, 210], "Blue"),
            ([30, 160, 40], "Green"),
            ([240, 140, 160], "Pink"),
            ([245, 235, 210], "Cream"),
            ([180, 165, 120], "Khaki"),
        ],
    )
    def test_named_colors(self, rgb, expected_name):
        lab = rgb_to_cielab(np.array([rgb], dtype=np.uint8))[0]
        name = lab_to_color_name(lab)
        assert name == expected_name, f"RGB {rgb} expected {expected_name}, got {name}"


class TestKMeansAlgorithm:
    """Test vectorized K-Means++ clustering algorithm and metrics."""

    def test_synthetic_clusters_separation(self):
        """K-Means should correctly cluster well-separated synthetic blobs."""
        rng = np.random.default_rng(42)
        # 3 separated clusters in 3D: centered at (0,0,0), (100, 0, 0), (0, 100, 100)
        c1 = rng.normal(loc=[0, 0, 0], scale=2.0, size=(100, 3))
        c2 = rng.normal(loc=[100, 0, 0], scale=2.0, size=(100, 3))
        c3 = rng.normal(loc=[0, 100, 100], scale=2.0, size=(100, 3))
        data = np.vstack([c1, c2, c3])

        kmeans = KMeansCIELAB(n_clusters=3, random_state=42)
        kmeans.fit(data)

        assert kmeans.cluster_centers_.shape == (3, 3)
        assert len(np.unique(kmeans.labels_)) == 3

        # Check silhouette score: well-separated clusters should have silhouette > 0.8
        sil = compute_silhouette_score(data, kmeans.labels_)
        assert sil > 0.8, f"Silhouette score should be high for separated blobs, got {sil}"

        # Check Davies-Bouldin: should be low (< 0.3)
        dbi = compute_davies_bouldin_index(data, kmeans.labels_, kmeans.cluster_centers_)
        assert dbi < 0.3, f"Davies-Bouldin index should be small for separated blobs, got {dbi}"

    def test_convergence_and_inertia(self):
        """Multiple restarts should yield stable, non-negative inertia."""
        rng = np.random.default_rng(99)
        data = rng.uniform(0, 100, size=(200, 3))
        kmeans = KMeansCIELAB(n_clusters=4, n_init=3, random_state=99)
        kmeans.fit(data)

        assert kmeans.inertia_ > 0.0
        assert kmeans.labels_.shape == (200,)
        assert set(kmeans.labels_).issubset({0, 1, 2, 3})


class TestClothingPaletteExtraction:
    """Test full garment extraction on synthetic and real images."""

    def test_synthetic_two_tone_garment(self):
        """Image with 70% Navy and 30% White should identify Navy as dominant."""
        img_arr = np.zeros((100, 100, 3), dtype=np.uint8)
        # 70% Navy: RGB (20, 30, 70)
        img_arr[:70, :] = [20, 30, 70]
        # 30% White: RGB (240, 240, 240)
        img_arr[70:, :] = [240, 240, 240]
        image = Image.fromarray(img_arr)

        result = extract_clothing_palette(image, k=3, random_state=42)

        assert result.dominant_color == "Navy"
        assert result.palette[0].name == "Navy"
        assert result.palette[0].weight >= 0.60
        assert any(c.name == "White" for c in result.palette)
        assert -1.0 <= result.silhouette_score <= 1.0
        assert result.davies_bouldin_index >= 0.0

    def test_white_slippers_real_image(self):
        """Test on actual uploaded clothing asset white_slippers.jpeg."""
        img_path = Path("server/uploads/1784266756978-white_slippers.jpeg")
        if not img_path.exists():
            img_path = Path("../server/uploads/1784266756978-white_slippers.jpeg")

        if img_path.exists():
            image = Image.open(img_path)
            result = extract_clothing_palette(image, k=5, random_state=42)

            assert result.dominant_color in ["White", "Cream", "Gray", "Beige"], (
                f"White slippers should have white/cream/neutral dominant color, got {result.dominant_color}"
            )
            assert len(result.palette) == 5
            assert result.silhouette_score > 0.0
            assert result.davies_bouldin_index > 0.0
            print(f"\nReal Image Test: Dominant={result.dominant_color} (#{result.dominant_hex})")
            print(f"Silhouette={result.silhouette_score:.3f}, DBI={result.davies_bouldin_index:.3f}")
            for c in result.palette:
                print(f"  - {c.name}: {c.hex_code} (weight={c.weight * 100:.1f}%)")
