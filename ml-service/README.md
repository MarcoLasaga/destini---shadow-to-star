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

The current repository has neither `DEEPFASHION_ROOT` nor `POLYVORE_ROOT`
configured, so no real class counts or five-class training metrics are claimed.
The trainer defaults to the final five-class taxonomy and supports an explicit
`--class-set deepfashion-3` mode only for a clearly labelled DeepFashion
baseline. It uses the existing ResNet-50, weighted sampling, staged fine-tuning,
and early stopping. Checkpoints now store class order, architecture,
preprocessing, training arguments, dataset mode, and validation macro-F1 so
FastAPI can reject incompatible class-order metadata.

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
