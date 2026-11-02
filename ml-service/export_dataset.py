"""Export approved Supabase wardrobe images into the ImageFolder dataset."""
import argparse
import os
import re
from pathlib import Path

import requests

CATEGORIES = {"TOP", "BOTTOM", "SHOES", "OUTERWEAR", "ACCESSORIES"}


def safe_name(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", value).strip("._") or "image"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://localhost:5000/api")
    parser.add_argument("--output", default="ml-service/dataset")
    args = parser.parse_args()
    token = os.environ.get("STYLESENSE_ADMIN_TOKEN")
    if not token:
        raise SystemExit("Set STYLESENSE_ADMIN_TOKEN to an admin Supabase access token.")

    response = requests.get(f"{args.api.rstrip('/')}/admin/dataset/manifest", headers={"Authorization": f"Bearer {token}"}, timeout=30)
    response.raise_for_status()
    items = response.json()["data"]["items"]
    output = Path(args.output)
    for category in CATEGORIES:
        (output / category).mkdir(parents=True, exist_ok=True)

    exported = 0
    for item in items:
        category = item["category"]
        image_url = item.get("image_url")
        if category not in CATEGORIES or not image_url:
            continue
        image = requests.get(image_url, timeout=30)
        image.raise_for_status()
        filename = f"{item['id']}-{safe_name(item.get('clothing_name', 'image'))}.jpg"
        (output / category / filename).write_bytes(image.content)
        exported += 1
    print(f"Exported {exported} approved images to {output}")


if __name__ == "__main__":
    main()
