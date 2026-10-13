# StyleSense CNN service

This service supplies `CNN_ANALYSIS_URL` for the web API. Its fallback uses a
pretrained PyTorch ResNet-50 and maps ImageNet garment labels to StyleSense
categories. That fallback is useful for testing only; dependable category
prefilling requires the fine-tuned model below.

Run it locally:

```powershell
pip install -r ml-service/requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Then set this in the web API environment and restart that API:

```env
CNN_ANALYSIS_URL=http://localhost:8000/analyze
```

Verify it at `http://localhost:8000/health`. The first start downloads the
pretrained ResNet weights. This baseline detects common apparel/shoe/accessory
classes; for thesis-grade accuracy, fine-tune the model on your labeled wardrobe
dataset.

## DeepFashion Dataset Ingestion & Integration

The ML development pipeline includes support for the **DeepFashion Category & Attribute Prediction Benchmark** (Liu et al., CVPR 2016).

### 1. Taxonomy Mapping
DeepFashion's 50 categories map to StyleSense's 5 core taxonomy slots as follows:
- **`TOP` (11 categories):** Blouse, Button-Down, Flannel, Halter, Henley, Jersey, Sweater, Tank, Tee, Top, Turtleneck.
- **`BOTTOM` (16 categories):** Capris, Chinos, Culottes, Cutoffs, Gauchos, Jeans, Jeggings, Jodhpurs, Joggers, Leggings, Sarong, Shorts, Skirt, Sweatpants, Sweatshorts, Trunks.
- **`OUTERWEAR` (11 categories):** Anorak, Blazer, Bomber, Cardigan, Coat, Cape, Hoodie, Jacket, Parka, Peacoat, Poncho.
- **`SHOES` (0 categories):** Unavailable in DeepFashion Category & Attribute Prediction benchmark (supplemented via user wardrobe export).
- **`ACCESSORIES` (0 categories):** Unavailable in DeepFashion Category & Attribute Prediction benchmark (supplemented via user wardrobe export).
- **Preserved Ambiguous Categories (12 categories):** Dress, Jumpsuit, Romper, Shirtdress, Sundress, Caftan, Kaftan, Coverup, Kimono, Nightdress, Onesie, Robe. These full-body/one-piece garments are preserved as `AMBIGUOUS_UNMAPPED` to prevent corrupting the `Top x Bottom` recommendation pairing engine.

See `deepfashion_config.json` for full rationale and attribute mappings.

## Polyvore Dataset Integration

`polyvore_dataset.py` supports the two layouts documented by the Polyvore
compatibility/retrieval releases: category definitions plus train/validation/
test outfit JSON, with optional item metadata, images, and compatibility text
files. The dataset itself is external and is not included in this repository.
Set `POLYVORE_ROOT` or pass a root path to `build_polyvore_manifest`.

Polyvore records are kept at two levels: `PolyvoreItem` represents an item and
its actual category/metadata, while `PolyvoreOutfit` represents an outfit/set
and its ordered item relationships. Outfit membership is never used as an
individual item classification label. The manifest preserves unmapped records
instead of forcing them into a StyleSense slot.

The configured category mapping covers actual Polyvore taxonomy names when
those IDs are present: tops and bottom garments map to `TOP`/`BOTTOM`, shoes
map to `SHOES`, bags/jewelry/etc. map to `ACCESSORIES`, and coats/jackets/
cardigans/vests map to `OUTERWEAR`. Dresses, suits, swimwear, sleepwear,
beauty, home, electronics, and other non-slot or non-wardrobe categories stay
`UNMAPPED`. The mapping is schema-based and should be checked against the
specific release's category file; no local Polyvore data is currently present
for a real-data smoke test. Thus shoes, accessories, and outerwear are
supported by the parser/configuration, but their sample counts in a particular
release remain to be measured.

Official splits are preserved when supplied. `verify_split_leakage` reports
item overlap across those splits; this matters because related items must not
be treated as independent image samples. When no official split exists,
`split_outfits_deterministically(..., ensure_disjoint=True)` groups by item
relationships, uses a fixed seed, and avoids cross-split item leakage where
possible. `validate_polyvore_manifest` checks outfit/item referential
integrity. Outfit data is suitable for future compatibility/co-occurrence
experiments and item images may supplement CNN classification, but this goal
does not train the CNN or alter the hybrid recommendation formula.

### 2. Preparing DeepFashion
Set `DEEPFASHION_ROOT` or pass `--data-dir`:

```powershell
# Ingest annotations and produce a reproducible manifest
python ml-service/prepare_deepfashion.py --data-dir "C:/path/to/DeepFashion" --output-dir "ml-service/data/deepfashion_prepared" --manifest-only

# Or export train split directly into the ImageFolder layout with class balancing
python ml-service/prepare_deepfashion.py --data-dir "C:/path/to/DeepFashion" --output-dir "ml-service/dataset" --export-imagefolder --max-per-class 1000
```

### 3. Programmatic PyTorch Dataset
You can load the prepared dataset directly in PyTorch:

```python
from deepfashion_dataset import DatasetManifest, DeepFashionDataset
from torch.utils.data import DataLoader

manifest = DatasetManifest.from_json("ml-service/data/deepfashion_prepared/deepfashion_manifest.json")
dataset = DeepFashionDataset(manifest, deepfashion_root="C:/path/to/DeepFashion", split="train")
loader = DataLoader(dataset, batch_size=32, shuffle=True)
```

## Fine-tune for real wardrobe accuracy

Place labeled images in `dataset/TOP`, `dataset/BOTTOM`, `dataset/SHOES`,
`dataset/OUTERWEAR`, and `dataset/ACCESSORIES`, then run:

```bash
python train.py --data ./dataset --output ./models/stylesense-resnet50.pt --epochs 15
```

The trainer refuses to run unless every category has at least 200 images by
default. Use `--min-per-class 10` only for an explicitly experimental smoke
test; that is not enough data for a credible model.

Approved images can be exported from the admin API after review. Set an admin
JWT and run the exporter from the repository root:

```powershell
$env:STYLESENSE_ADMIN_TOKEN = "<admin Supabase access token>"
python ml-service/export_dataset.py --api http://localhost:5000/api
python ml-service/train.py --data ml-service/dataset --output ml-service/models/stylesense-resnet50.pt
```

The training command creates a stratified validation split, applies realistic
image augmentation, balances uneven categories, fine-tunes only the useful
ResNet layers, saves the best validation macro-F1 checkpoint, and stops when
validation quality stops improving. Do not judge accuracy from training accuracy
alone; use the printed `val_macro_f1` (each category has equal importance).

For a credible first model, collect at least **200 varied images per category**;
aim for **500–1,000 per category** for a production-quality result. Include
different angles, lighting, backgrounds, garment colors, and real phone photos.
Keep duplicate or near-duplicate shots together, otherwise validation accuracy
will be misleadingly high. All images must be correctly labeled.

After training, set `MODEL_CHECKPOINT` to the resulting checkpoint path:

```powershell
$env:MODEL_CHECKPOINT = "ml-service/models/stylesense-resnet50.pt"
python -m uvicorn ml-service.app.main:app --host 0.0.0.0 --port 8000
```

The service automatically switches from ImageNet label heuristics to the
fine-tuned five-class CNN. It leaves category blank below 0.55 confidence rather
than prefilling an unreliable label; lower or raise that threshold with
`MIN_CATEGORY_CONFIDENCE` after reviewing validation and real-upload results.

## CNN Dataset Consolidation and Training Status

`cnn_taxonomy.json` is the single authoritative class order:

`0 TOP`, `1 BOTTOM`, `2 SHOES`, `3 OUTERWEAR`, `4 ACCESSORIES`.

`cnn_dataset.py` normalizes mapped records from DeepFashion and Polyvore into
records containing image path, normalized label, source, original label, split,
and stable item/record identifiers. It reports per-class train/validation/test
statistics and validates duplicate paths, item overlap, optional image hashes,
invalid splits, Polyvore split conflicts, and missing classes. Unmapped records
are excluded; their labels are never guessed.

Once real dataset roots are available, build a validated manifest with:

```powershell
python prepare_cnn_dataset.py --deepfashion-root C:/path/to/DeepFashion --polyvore-root C:/path/to/Polyvore --output data/cnn_manifest.json --hash-images
```

The final unified manifest is available at
`data/stylesense_cnn_manifest.json`. Train directly from it with:

```powershell
python train.py --manifest data/stylesense_cnn_manifest.json `
  --output models/stylesense-resnet50-final.pt `
  --results data/stylesense-resnet50-final-results.json
```

Manifest mode verifies the exact five-class split counts and image paths before
training, uses the official train split for optimization, uses validation only
for model selection, and evaluates test only after selection. It records the
epoch history, actual test metrics, confusion matrix, inference timing, and
checkpoint metadata in the results JSON. The trainer also retains the original
ImageFolder mode and explicitly labelled `--class-set deepfashion-3` baseline.
It uses ResNet-50, weighted sampling, staged fine-tuning, mixed precision when
CUDA is available, and early stopping. No final CNN performance metrics are
claimed until a complete run writes the checkpoint and results JSON.

### Goal 5 real-data readiness status

Status: **BLOCKED / MISSING REAL DATA**. No DeepFashion annotation root or
Polyvore root is present locally. `ml-service/dataset` contains only empty
placeholder folders, so actual class counts, image readability, duplicate
hashes, leakage, and five-class readiness are all `UNKNOWN`, not zero.

To supply DeepFashion, obtain the **DeepFashion Category and Attribute
Prediction Benchmark** from the official CUHK project page:
<https://mmlab.ie.cuhk.edu.hk/projects/DeepFashion/AttributePrediction.html>.
The page identifies the benchmark as 289,222 images, 50 clothing categories,
and provides category, image, bounding-box, and train/validation/test
annotations. Extract it outside Git and set `DEEPFASHION_ROOT` to its root, or
pass `--deepfashion-root` to `prepare_cnn_dataset.py`. The download may require
the access/password flow described by the project page.

For Polyvore, use the dataset release and instructions from the author-linked
repository <https://github.com/xthan/polyvore-dataset>. Its README documents
the Han release as 21,889 outfits split into 17,316 train, 1,497 validation,
and 3,076 test outfits, with `category_id.txt`, `train_no_dup.json`,
`valid_no_dup.json`, and `test_no_dup.json`. Extract it outside Git and set
`POLYVORE_ROOT` or pass `--polyvore-root`. The repository notes that original
image URLs are no longer available and refers to an unofficial image source;
do not use that source without separately verifying permission and suitability.

After both roots are supplied, run:

```powershell
python prepare_cnn_dataset.py --output data/cnn_manifest.json --hash-images
```

The command preserves the manifest even when readiness fails, records
validation errors and `five_class_ready`, prints actual split/class counts,
and exits nonzero until all required checks pass. It does not train the CNN.

### Re-PolyVore supplemental image dataset

The extracted Re-PolyVore layout is supported through `REPOLYVORE_ROOT` or
`--repolyvore-root`. The supported native folders normalize as follows:

- `top` → `TOP`; `pants`, `skirt` → `BOTTOM`; `shoes` → `SHOES`;
  `outwear` → `OUTERWEAR`.
- `bag`, `bracelet`, `brooch`, `earrings`, `eyewear`, `gloves`, `hairwear`,
  `hats`, `necklace`, `neckwear`, `rings`, `watches` → `ACCESSORIES`.
- `dress`, `jumpsuit`, and `legwear` are excluded from the five-class CNN.

Because Re-PolyVore has no split folders, supported images are SHA-256 grouped
and assigned deterministically to train/validation/test (default 80/10/10,
seed 42). Non-image files are ignored. Validation reports duplicate image
paths, hash groups crossing splits, conflicting labels, and cross-dataset hash
overlap with DeepFashion. A zero cross-dataset overlap is only reported after
both datasets have actually been hashed; it is never assumed from paths.

### Re-PolyVore conflict resolution and final manifest

The real Re-PolyVore audit found 221 native-category hash-conflict groups:
123 collapsed to one StyleSense class and were canonicalized to one stable
path; 98 mapped to different StyleSense classes and all 265 records in those
groups were excluded. No labels were inferred or majority-voted. The complete
machine-readable audit is written beside the manifest as
`repolyvore_conflict_report.json`.

The final exact-hash-validated manifest is generated at
`ml-service/data/stylesense_cnn_manifest.json` and contains 294,604 records:

| Class | Total | Train | Validation | Test |
| --- | ---: | ---: | ---: | ---: |
| TOP | 117,096 | 85,895 | 15,643 | 15,558 |
| BOTTOM | 69,830 | 51,514 | 9,229 | 9,087 |
| SHOES | 16,343 | 13,110 | 1,653 | 1,580 |
| OUTERWEAR | 47,253 | 34,713 | 6,187 | 6,353 |
| ACCESSORIES | 44,082 | 35,250 | 4,349 | 4,483 |
| **Total** | **294,604** | **220,482** | **37,061** | **37,061** |

Exact duplicate/hash validation passed: no duplicate image hashes cross
splits, and no DeepFashion/Re-PolyVore hash overlap was found. The final
manifest retains DeepFashion's official partitions and Re-PolyVore's seeded
80/10/10 split. Near-duplicate visual leakage was not evaluated; this remains
a limitation before CNN training.

## K-Means Evaluation

### Purpose & ML Pipeline Placement
The StyleSense recommendation pipeline processes garment images through a two-stage computer vision workflow:
1. **Garment Classification**: ResNet-50 CNN extracts high-level category taxonomy (`TOP`, `BOTTOM`, `SHOES`, `OUTERWEAR`, `ACCESSORIES`).
2. **Color Extraction**: K-Means clustering in CIELAB color space (`kmeans_color.py`) extracts the dominant color, palette swatches, hex codes, and cluster proportions for garment color representation.
3. **Recommendation**: Hybrid scoring matches wardrobe items by category compatibility, user style preferences, and color harmony.

The purpose of this evaluation experiment is to assess the unsupervised clustering quality of the CIELAB K-Means algorithm using actual garment images, determining the optimal number of color clusters ($K$) based on authoritative clustering validation metrics: **Silhouette Score** and **Davies-Bouldin Index**.

### Dataset Split Policy & Test Set Protection
- **Authoritative Manifest**: Evaluation strictly loads records from `ml-service/data/stylesense_cnn_manifest.json`.
- **Partition Used**: The validation split (`val`, containing 37,061 records across DeepFashion and Re-PolyVore) was used.
- **Zero Leakage**: The CNN test split (`test`, 37,061 records) is strictly protected and was not touched, preserving independent evaluation integrity for subsequent CNN benchmarks. No new splits were created and the authoritative CNN manifest was not modified.

### CIELAB Color Pipeline
Garment color extraction must reflect perceptual human vision rather than raw non-linear display spaces:
$$\text{Garment Image} \longrightarrow \text{Garment Pixel Extraction} \longrightarrow \text{sRGB} \longrightarrow \text{CIE XYZ (D65)} \longrightarrow \text{CIELAB } (L^*, a^*, b^*) \longrightarrow \text{K-Means++} \longrightarrow \text{Metrics}$$
1. Studio and perimeter background pixels are filtered using border distribution estimation and Delta E CIE76 thresholding ($\Delta E > 18.0$, $L^* < 92.0$).
2. RGB pixel coordinates are mapped through non-linear gamma expansion to linear sRGB, transformed to CIE XYZ with D65 standard reference white, and converted to perceptually uniform CIELAB coordinates.
3. Clustering distances correspond to perceptual color difference ($\Delta E$ CIE76 Euclidean distance in $L^*, a^*, b^*$).

### Deterministic Sampling Strategy
To ensure computational feasibility without sacrificing diversity or statistical power:
- **Number of Images**: 100 garment images sampled from the validation partition.
- **Stratified Distribution**: Exactly balanced across all 5 StyleSense classes (20 `TOP`, 20 `BOTTOM`, 20 `OUTERWEAR`, 20 `SHOES`, 20 `ACCESSORIES`), spanning both DeepFashion (55 images) and Re-PolyVore (45 images).
- **Pixel Sampling**: For each image, valid garment pixels are extracted and deterministically subsampled up to a maximum of 1,000 pixels using random seed `42` (totaling 99,590 evaluated pixels).
- **Reproducibility**: Explicit random seed (`seed = 42`) governs record selection, per-image pixel subsampling, and K-Means++ initializations.

### Evaluation Metrics & Interpretation
Two complementary unsupervised clustering validation metrics were calculated:
1. **Silhouette Score** ($S \in [-1, +1]$, **Higher is Better**):
   $$s(i) = \frac{b(i) - a(i)}{\max(a(i), b(i))}$$
   Measures how tightly grouped each pixel is within its assigned cluster compared to the nearest neighboring cluster. Values close to $+1.0$ indicate distinct, well-separated color clusters.
2. **Davies-Bouldin Index** ($DBI \ge 0$, **Lower is Better**):
   $$DBI = \frac{1}{K} \sum_{i=1}^K \max_{j \neq i} \left( \frac{s_i + s_j}{d(c_i, c_j)} \right)$$
   Measures the maximum ratio of within-cluster dispersion ($s_i + s_j$) to between-cluster centroid distance ($d(c_i, c_j)$). Lower values indicate tight, compact clusters with wide separation between distinct hues.

### How to Execute the Evaluation
Execute the evaluation script via command line:

```powershell
python ml-service/evaluate_kmeans.py `
  --manifest ml-service/data/stylesense_cnn_manifest.json `
  --split val `
  --num-images 100 `
  --seed 42 `
  --k-values 2 3 4 5 6 `
  --max-pixels-per-image 1000 `
  --output ml-service/data/kmeans_evaluation_results.json `
  --output-dir ml-service/data/kmeans_evaluation
```

### Actual Experimental Results
All reported metrics originate from actual execution on the 100 validation garments:

| $K$ | Mean Silhouette Score (Higher is Better) | Std Dev ($S$) | Mean Davies-Bouldin Index (Lower is Better) | Std Dev ($DB$) | Pooled Silhouette | Pooled DBI | Evaluated Images |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **2** | **0.6439** | ±0.1422 | **0.5946** | ±0.2264 | 0.4737 | 0.7637 | 100 / 100 |
| **3** | **0.5868** | ±0.1249 | **0.6651** | ±0.1538 | 0.4515 | 0.9560 | 100 / 100 |
| **4** | **0.5490** | ±0.1162 | **0.6997** | ±0.1347 | 0.3970 | 0.9913 | 100 / 100 |
| **5** | **0.5164** | ±0.1084 | **0.7274** | ±0.1361 | 0.4113 | 0.9450 | 100 / 100 |
| **6** | **0.5002** | ±0.1076 | **0.7430** | ±0.1222 | 0.3896 | 0.9679 | 100 / 100 |

### Per-Category Performance Breakdown
Performance across individual fashion taxonomy categories at optimal $K=2$:
- **Accessories** ($N=20$): Silhouette = `0.6825`, DBI = `0.5421`
- **Shoes** ($N=20$): Silhouette = `0.6670`, DBI = `0.5565`
- **Top** ($N=20$): Silhouette = `0.6394`, DBI = `0.6203`
- **Outerwear** ($N=20$): Silhouette = `0.6248`, DBI = `0.6026`
- **Bottom** ($N=20$): Silhouette = `0.6058`, DBI = `0.6513`

### Best $K$ Selection & Decision Rationale
- **Optimal $K$**: **$K = 2$**
- **Unanimous Agreement**: Both Silhouette Score (`0.6439`, highest across all candidate $K$) and Davies-Bouldin Index (`0.5946`, lowest across all candidate $K$) unanimously agree that $K=2$ achieves the optimal color clustering configuration.
- **Scientific Rationale**: Real clothing items are predominantly composed of a primary garment base color and a secondary trim/accent color (or model skin/shadow contrast). At $K=2$, cluster boundaries correspond to distinct perceptual color regions. As $K$ increases from 3 to 6, cohesive color regions are progressively partitioned into adjacent sub-shades, narrowing between-cluster centroid distances and lowering the Silhouette Score.
- **Recommendation for Wardrobe Modeling**: While $K=2$ is the mathematically optimal configuration for core dominant color identification, $K=3$ serves as a viable secondary configuration (Silhouette = `0.5868`, DBI = `0.6651`) when detailed accent color extraction is required for complex patterned garments.

### Output Artifacts
- **Structured JSON Results**: `ml-service/data/kmeans_evaluation_results.json`
- **Visualizations**:
  - `ml-service/data/kmeans_evaluation/silhouette_vs_k.png`: Silhouette Score vs. $K$ curve.
  - `ml-service/data/kmeans_evaluation/davies_bouldin_vs_k.png`: Davies-Bouldin Index vs. $K$ curve.
  - `ml-service/data/kmeans_evaluation/kmeans_metrics_summary.png`: Dual-panel comparative trade-off figure.
  - `ml-service/data/kmeans_evaluation/palette_extraction_examples.png`: Real garment photos paired with extracted color palettes, swatches, hex codes, and cluster weights.
  - `ml-service/data/kmeans_evaluation/k_variation_comparison.png`: Palette granularity across $K \in [2, 6]$ on representative garments.
