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
