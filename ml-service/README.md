# StyleSense CNN service

This service supplies `CNN_ANALYSIS_URL` for the web API. It uses a pretrained
PyTorch ResNet-50 CNN to recognize ImageNet garment labels, maps those labels to
StyleSense wardrobe categories, and extracts a dominant color from the image.

Run it with Docker:

```bash
docker build -t stylesense-cnn ./ml-service
docker run --rm -p 8000:8000 stylesense-cnn
```

Then set this in the web API environment and restart that API:

```env
CNN_ANALYSIS_URL=http://localhost:8000/analyze
```

Verify it at `http://localhost:8000/health`. The first start downloads the
pretrained ResNet weights. This baseline detects common apparel/shoe/accessory
classes; for thesis-grade accuracy, fine-tune the model on your labeled wardrobe
dataset and replace the checkpoint in `app/main.py`.
