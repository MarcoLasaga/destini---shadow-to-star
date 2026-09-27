"""K-Means clustering in CIELAB color space for StyleSense clothing images.

Provides:
- Perceptually uniform color conversion (sRGB <-> CIE XYZ <-> CIELAB D65)
- Perceptual color distance (Delta E CIE76)
- Garment pixel filtering (removes studio backdrops)
- K-Means++ clustering with multiple random restarts (vectorized NumPy)
- Unsupervised cluster evaluation metrics (Silhouette Score & Davies-Bouldin Index)
- Perceptually grounded fashion color naming from CIELAB anchors
- Palette extraction with hex, RGB, CIELAB coordinates and cluster proportions
"""
from dataclasses import dataclass
from typing import Any
import numpy as np
from PIL import Image


# Reference white point D65 (2° standard observer)
X_N = 0.95047
Y_N = 1.00000
Z_N = 1.08883
DELTA = 6.0 / 29.0
DELTA_SQ = DELTA * DELTA
DELTA_CUBE = DELTA * DELTA * DELTA


def rgb_to_cielab(rgb: np.ndarray) -> np.ndarray:
    """Convert sRGB array in [0, 255] or [0, 1] to CIELAB (L*, a*, b*).

    Args:
        rgb: Array of shape (N, 3) or (H, W, 3).

    Returns:
        Array of shape matching input with (L*, a*, b*) coordinates.
    """
    orig_shape = rgb.shape
    flat_rgb = rgb.reshape(-1, 3).astype(np.float64)

    # Normalize to [0, 1] if in [0, 255]
    if flat_rgb.max() > 1.0:
        flat_rgb = flat_rgb / 255.0

    flat_rgb = np.clip(flat_rgb, 0.0, 1.0)

    # 1. sRGB to linear RGB (gamma expansion)
    linear_mask = flat_rgb > 0.04045
    linear_rgb = np.empty_like(flat_rgb)
    linear_rgb[linear_mask] = ((flat_rgb[linear_mask] + 0.055) / 1.055) ** 2.4
    linear_rgb[~linear_mask] = flat_rgb[~linear_mask] / 12.92

    # 2. Linear RGB to CIE XYZ (standard sRGB matrix with D65)
    r = linear_rgb[:, 0]
    g = linear_rgb[:, 1]
    b = linear_rgb[:, 2]

    x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
    y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b
    z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b

    # 3. Normalize XYZ by D65 reference white
    x_r = x / X_N
    y_r = y / Y_N
    z_r = z / Z_N

    # 4. Nonlinear transform f(t)
    def f(t: np.ndarray) -> np.ndarray:
        out = np.empty_like(t)
        mask = t > DELTA_CUBE
        out[mask] = np.cbrt(t[mask])
        out[~mask] = (t[~mask] / (3.0 * DELTA_SQ)) + (4.0 / 29.0)
        return out

    fx = f(x_r)
    fy = f(y_r)
    fz = f(z_r)

    # 5. CIELAB coordinates
    l_star = 116.0 * fy - 16.0
    a_star = 500.0 * (fx - fy)
    b_star = 200.0 * (fy - fz)

    lab = np.stack([l_star, a_star, b_star], axis=1)
    return lab.reshape(orig_shape)


def cielab_to_rgb(lab: np.ndarray) -> np.ndarray:
    """Convert CIELAB (L*, a*, b*) array to sRGB in [0, 255] uint8.

    Args:
        lab: Array of shape (N, 3) or (H, W, 3).

    Returns:
        Array of shape matching input with (R, G, B) uint8 coordinates.
    """
    orig_shape = lab.shape
    flat_lab = lab.reshape(-1, 3).astype(np.float64)

    l_star = flat_lab[:, 0]
    a_star = flat_lab[:, 1]
    b_star = flat_lab[:, 2]

    # Inverse nonlinear transform
    fy = (l_star + 16.0) / 116.0
    fx = (a_star / 500.0) + fy
    fz = fy - (b_star / 200.0)

    def inv_f(t: np.ndarray) -> np.ndarray:
        out = np.empty_like(t)
        mask = t > DELTA
        out[mask] = t[mask] ** 3
        out[~mask] = 3.0 * DELTA_SQ * (t[~mask] - 4.0 / 29.0)
        return out

    x = inv_f(fx) * X_N
    y = inv_f(fy) * Y_N
    z = inv_f(fz) * Z_N

    # CIE XYZ to linear sRGB
    r_lin = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z
    g_lin = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z
    b_lin = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z

    linear = np.stack([r_lin, g_lin, b_lin], axis=1)
    linear = np.clip(linear, 0.0, 1.0)

    # Linear RGB to gamma-compressed sRGB
    gamma_mask = linear > 0.0031308
    srgb = np.empty_like(linear)
    srgb[gamma_mask] = 1.055 * (linear[gamma_mask] ** (1.0 / 2.4)) - 0.055
    srgb[~gamma_mask] = 12.92 * linear[~gamma_mask]

    srgb_uint8 = np.clip(np.round(srgb * 255.0), 0, 255).astype(np.uint8)
    return srgb_uint8.reshape(orig_shape)


def delta_e_cie76(lab1: np.ndarray, lab2: np.ndarray) -> np.ndarray:
    """Compute Euclidean perceptual color distance (Delta E CIE76)."""
    return np.sqrt(np.sum((lab1 - lab2) ** 2, axis=-1))


def extract_garment_pixels(image: Image.Image, max_dimension: int = 128) -> np.ndarray:
    """Extract RGB pixels of the clothing item, filtering studio and surface backdrops.

    Downsamples image for speed, computes perimeter border color distribution,
    and removes background pixels that match either the dominant border backdrop
    or bright white studio backgrounds (L* > 92).
    """
    img = image.convert('RGB')
    width, height = img.size
    scale = min(max_dimension / max(width, height), 1.0)
    if scale < 1.0:
        new_size = (max(1, int(width * scale)), max(1, int(height * scale)))
        img = img.resize(new_size, Image.Resampling.BILINEAR)

    arr = np.asarray(img, dtype=np.float32)
    h_small, w_small, _ = arr.shape
    pixels = arr.reshape(-1, 3)

    # 1. Estimate perimeter border background color
    b_size = max(2, int(min(h_small, w_small) * 0.08))
    top = arr[:b_size, :].reshape(-1, 3)
    bottom = arr[-b_size:, :].reshape(-1, 3)
    left = arr[:, :b_size].reshape(-1, 3)
    right = arr[:, -b_size:].reshape(-1, 3)
    borders = np.concatenate([top, bottom, left, right], axis=0)

    border_lab = rgb_to_cielab(borders)
    med_border_lab = np.median(border_lab, axis=0)

    lab_pixels = rgb_to_cielab(pixels)
    dist_to_border = delta_e_cie76(lab_pixels, med_border_lab)

    # Filter out pixels within Delta E 18 of the border backdrop
    is_not_border = dist_to_border > 18.0

    # Also filter pure white studio backdrops (high L*, low saturation)
    saturation = pixels.max(axis=1) - pixels.min(axis=1)
    is_not_white_studio = (lab_pixels[:, 0] < 92.0) | (saturation > 15.0)

    garment_mask = is_not_border & is_not_white_studio

    # If filter removed too much (e.g., solid color garment matching backdrop), fallback to center 60%
    if garment_mask.sum() < len(pixels) * 0.08:
        y1, y2 = int(h_small * 0.2), int(h_small * 0.8)
        x1, x2 = int(w_small * 0.2), int(w_small * 0.8)
        center_pts = arr[y1:y2, x1:x2].reshape(-1, 3)
        return center_pts if len(center_pts) > 0 else pixels

    return pixels[garment_mask]


# ─────────────────────────────────────────────────────────────────────────────
# Reference Fashion Colors in CIELAB
# ─────────────────────────────────────────────────────────────────────────────
# Pre-computed reference points in CIELAB space for StyleSense fashion taxonomy
NAMED_FASHION_COLORS: dict[str, tuple[float, float, float]] = {
    # Neutrals
    'Black': (12.0, 0.0, 0.0),
    'White': (97.0, 0.0, 0.0),
    'Gray': (55.0, 0.0, 0.0),
    'Navy': (22.0, 4.0, -32.0),
    'Beige': (86.0, 2.0, 18.0),
    'Brown': (36.0, 16.0, 26.0),
    'Cream': (93.0, -1.0, 14.0),
    'Khaki': (66.0, 4.0, 25.0),
    # Chromatic
    'Red': (50.0, 72.0, 52.0),
    'Burgundy': (28.0, 38.0, 12.0),
    'Pink': (74.0, 38.0, -4.0),
    'Orange': (65.0, 45.0, 70.0),
    'Yellow': (88.0, -4.0, 84.0),
    'Green': (48.0, -45.0, 35.0),
    'Olive': (45.0, -8.0, 38.0),
    'Blue': (44.0, 6.0, -58.0),
    'Light Blue': (75.0, -14.0, -28.0),
    'Teal': (52.0, -32.0, -12.0),
    'Purple': (38.0, 48.0, -40.0),
}


def lab_to_color_name(lab: np.ndarray) -> str:
    """Find closest fashion color name by minimizing Delta E CIE76 in CIELAB space."""
    lab_vec = np.asarray(lab, dtype=np.float64).reshape(3)
    best_name = 'Gray'
    min_dist = float('inf')

    for name, ref_lab in NAMED_FASHION_COLORS.items():
        ref_vec = np.asarray(ref_lab, dtype=np.float64)
        dist = float(np.sqrt(np.sum((lab_vec - ref_vec) ** 2)))
        if dist < min_dist:
            min_dist = dist
            best_name = name

    return best_name


# ─────────────────────────────────────────────────────────────────────────────
# Vectorized K-Means Algorithm
# ─────────────────────────────────────────────────────────────────────────────
class KMeansCIELAB:
    """Vectorized K-Means clustering implementation in CIELAB space with K-Means++."""

    def __init__(
        self,
        n_clusters: int = 5,
        max_iter: int = 100,
        n_init: int = 3,
        tol: float = 1e-4,
        random_state: int | None = 42,
    ) -> None:
        self.n_clusters = n_clusters
        self.max_iter = max_iter
        self.n_init = n_init
        self.tol = tol
        self.random_state = random_state

        self.cluster_centers_: np.ndarray | None = None
        self.labels_: np.ndarray | None = None
        self.inertia_: float = float('inf')

    def _kmeans_plus_plus_init(self, X: np.ndarray, rng: np.random.Generator) -> np.ndarray:
        """K-Means++ initialization algorithm."""
        n_samples = X.shape[0]
        centers = np.empty((self.n_clusters, X.shape[1]), dtype=X.dtype)

        # 1. Choose first center uniformly at random
        first_idx = rng.integers(0, n_samples)
        centers[0] = X[first_idx]

        # 2. Compute distances squared to closest existing center
        dist_sq = np.sum((X - centers[0]) ** 2, axis=1)

        for c_idx in range(1, self.n_clusters):
            total_dist = dist_sq.sum()
            if total_dist <= 0:
                probs = np.full(n_samples, 1.0 / n_samples)
            else:
                probs = dist_sq / total_dist

            next_idx = rng.choice(n_samples, p=probs)
            centers[c_idx] = X[next_idx]

            # Update squared distances
            new_dist_sq = np.sum((X - centers[c_idx]) ** 2, axis=1)
            dist_sq = np.minimum(dist_sq, new_dist_sq)

        return centers

    def fit(self, X: np.ndarray) -> 'KMeansCIELAB':
        """Fit K-Means clustering on data points X (shape N, D)."""
        X = np.asarray(X, dtype=np.float64)
        n_samples, n_features = X.shape

        if n_samples < self.n_clusters:
            raise ValueError(f"Number of samples ({n_samples}) must be >= n_clusters ({self.n_clusters}).")

        base_seed = self.random_state if self.random_state is not None else np.random.randint(0, 1000000)
        best_inertia = float('inf')
        best_centers = None
        best_labels = None

        for init_idx in range(self.n_init):
            rng = np.random.default_rng(base_seed + init_idx)
            centers = self._kmeans_plus_plus_init(X, rng)

            prev_centers = centers.copy()
            for _ in range(self.max_iter):
                # 1. Assign points to nearest centroid: (N, K) distance matrix
                # ||x - c||^2 = ||x||^2 - 2 x.c^T + ||c||^2
                dists_sq = (
                    np.sum(X ** 2, axis=1, keepdims=True)
                    - 2.0 * np.dot(X, centers.T)
                    + np.sum(centers ** 2, axis=1, keepdims=True).T
                )
                labels = np.argmin(dists_sq, axis=1)

                # 2. Centroid update
                new_centers = np.empty_like(centers)
                for k in range(self.n_clusters):
                    cluster_points = X[labels == k]
                    if len(cluster_points) > 0:
                        new_centers[k] = cluster_points.mean(axis=0)
                    else:
                        # Empty cluster fallback: pick sample with max distance
                        max_pt_idx = np.argmax(np.min(dists_sq, axis=1))
                        new_centers[k] = X[max_pt_idx]

                # 3. Check convergence
                center_shift = np.max(np.sqrt(np.sum((new_centers - prev_centers) ** 2, axis=1)))
                centers = new_centers
                prev_centers = centers.copy()

                if center_shift < self.tol:
                    break

            # Calculate inertia: sum of squared distances to closest centroid
            min_dists = np.min(
                np.sum(X ** 2, axis=1, keepdims=True)
                - 2.0 * np.dot(X, centers.T)
                + np.sum(centers ** 2, axis=1, keepdims=True).T,
                axis=1,
            )
            inertia = float(np.sum(min_dists))

            if inertia < best_inertia:
                best_inertia = inertia
                best_centers = centers
                best_labels = labels

        self.cluster_centers_ = best_centers
        self.labels_ = best_labels
        self.inertia_ = best_inertia
        return self


# ─────────────────────────────────────────────────────────────────────────────
# Unsupervised Clustering Evaluation Metrics
# ─────────────────────────────────────────────────────────────────────────────
def compute_silhouette_score(X: np.ndarray, labels: np.ndarray, sample_size: int = 1000) -> float:
    """Compute mean Silhouette Coefficient over sample of points.

    s(i) = (b(i) - a(i)) / max(a(i), b(i))
    where:
    - a(i) is mean intra-cluster distance
    - b(i) is mean nearest-cluster distance
    """
    n_samples = len(X)
    if n_samples < 2:
        return 0.0

    unique_labels = np.unique(labels)
    if len(unique_labels) < 2:
        return 0.0

    # Subsample if dataset is large to guarantee sub-millisecond evaluation
    if n_samples > sample_size:
        indices = np.random.choice(n_samples, size=sample_size, replace=False)
        X_sub = X[indices]
        labels_sub = labels[indices]
    else:
        X_sub = X
        labels_sub = labels

    sub_n = len(X_sub)
    # Compute pairwise Euclidean distance matrix
    # dist[i, j] = ||X[i] - X[j]||
    diff = X_sub[:, np.newaxis, :] - X_sub[np.newaxis, :, :]
    dist_matrix = np.sqrt(np.sum(diff ** 2, axis=-1))

    silhouettes = np.empty(sub_n, dtype=np.float64)

    for i in range(sub_n):
        point_label = labels_sub[i]
        same_cluster_mask = labels_sub == point_label
        same_count = same_cluster_mask.sum()

        if same_count > 1:
            a_i = dist_matrix[i, same_cluster_mask].sum() / (same_count - 1)
        else:
            a_i = 0.0

        # Compute mean distance to points in each of the other clusters
        b_i = float('inf')
        for other_label in unique_labels:
            if other_label == point_label:
                continue
            other_mask = labels_sub == other_label
            if other_mask.any():
                dist_to_other = dist_matrix[i, other_mask].mean()
                if dist_to_other < b_i:
                    b_i = dist_to_other

        max_ab = max(a_i, b_i)
        silhouettes[i] = (b_i - a_i) / max_ab if max_ab > 0 else 0.0

    return float(np.mean(silhouettes))


def compute_davies_bouldin_index(X: np.ndarray, labels: np.ndarray, centers: np.ndarray) -> float:
    """Compute Davies-Bouldin Index for cluster separation.

    DBI = (1 / K) * sum_i(max_{j != i} (s_i + s_j) / d(c_i, c_j))
    where s_i is the average distance of points in cluster i to center c_i.
    Lower values indicate better clustering.
    """
    k = len(centers)
    if k < 2:
        return 0.0

    # Intra-cluster dispersion s_i
    s = np.zeros(k, dtype=np.float64)
    for i in range(k):
        pts = X[labels == i]
        if len(pts) > 0:
            s[i] = np.mean(np.sqrt(np.sum((pts - centers[i]) ** 2, axis=1)))
        else:
            s[i] = 0.0

    # Pairwise centroid distances
    center_diff = centers[:, np.newaxis, :] - centers[np.newaxis, :, :]
    center_dists = np.sqrt(np.sum(center_diff ** 2, axis=-1))

    # Compute R_ij ratios
    max_r = np.zeros(k, dtype=np.float64)
    for i in range(k):
        r_vals = []
        for j in range(k):
            if i != j and center_dists[i, j] > 1e-6:
                r_vals.append((s[i] + s[j]) / center_dists[i, j])
        max_r[i] = max(r_vals) if r_vals else 0.0

    return float(np.mean(max_r))


# ─────────────────────────────────────────────────────────────────────────────
# High-Level Color Palette Extraction
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class ColorCluster:
    name: str
    rgb: tuple[int, int, int]
    hex_code: str
    lab: tuple[float, float, float]
    weight: float


@dataclass
class PaletteResult:
    dominant_color: str
    dominant_rgb: tuple[int, int, int]
    dominant_hex: str
    dominant_lab: tuple[float, float, float]
    palette: list[ColorCluster]
    silhouette_score: float
    davies_bouldin_index: float
    inertia: float


def extract_clothing_palette(image: Image.Image, k: int = 5, random_state: int = 42) -> PaletteResult:
    """Extract dominant clothing color and palette using K-Means in CIELAB space.

    Args:
        image: PIL Image of the clothing item.
        k: Number of color clusters (default: 5).
        random_state: Seed for reproducible clustering.

    Returns:
        PaletteResult containing dominant color, palette clusters, and unsupervised metrics.
    """
    garment_rgb = extract_garment_pixels(image, max_dimension=128)
    garment_lab = rgb_to_cielab(garment_rgb)

    # Subsample if image pixel count is high to maintain < 50ms latency
    max_pixels = 3000
    if len(garment_lab) > max_pixels:
        rng = np.random.default_rng(random_state)
        sample_indices = rng.choice(len(garment_lab), size=max_pixels, replace=False)
        fit_lab = garment_lab[sample_indices]
    else:
        fit_lab = garment_lab

    kmeans = KMeansCIELAB(n_clusters=k, random_state=random_state)
    kmeans.fit(fit_lab)

    centers = kmeans.cluster_centers_
    labels = kmeans.labels_

    # Calculate cluster weights (proportion of pixels)
    counts = np.bincount(labels, minlength=k)
    weights = counts / len(labels)

    # Sort clusters descending by weight
    sorted_order = np.argsort(-weights)

    clusters: list[ColorCluster] = []
    for idx in sorted_order:
        lab_coord = centers[idx]
        rgb_coord = cielab_to_rgb(lab_coord)
        r, g, b = int(rgb_coord[0]), int(rgb_coord[1]), int(rgb_coord[2])
        hex_code = f"#{r:02x}{g:02x}{b:02x}".upper()
        color_name = lab_to_color_name(lab_coord)

        clusters.append(
            ColorCluster(
                name=color_name,
                rgb=(r, g, b),
                hex_code=hex_code,
                lab=(float(lab_coord[0]), float(lab_coord[1]), float(lab_coord[2])),
                weight=round(float(weights[idx]), 4),
            )
        )

    # Evaluation metrics
    sil_score = compute_silhouette_score(fit_lab, labels, sample_size=800)
    db_index = compute_davies_bouldin_index(fit_lab, labels, centers)

    dominant = clusters[0]
    return PaletteResult(
        dominant_color=dominant.name,
        dominant_rgb=dominant.rgb,
        dominant_hex=dominant.hex_code,
        dominant_lab=dominant.lab,
        palette=clusters,
        silhouette_score=round(sil_score, 4),
        davies_bouldin_index=round(db_index, 4),
        inertia=round(kmeans.inertia_, 2),
    )
