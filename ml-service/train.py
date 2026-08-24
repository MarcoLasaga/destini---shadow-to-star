"""Fine-tune and validate the StyleSense category CNN.

Expected layout: dataset/TOP/*.jpg, dataset/BOTTOM/*.jpg, dataset/SHOES/*.jpg,
dataset/OUTERWEAR/*.jpg, dataset/ACCESSORIES/*.jpg.
"""
import argparse
import copy
import random
from collections import defaultdict
from pathlib import Path

import torch
from torch import nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import ReduceLROnPlateau
from torch.utils.data import DataLoader, Subset, WeightedRandomSampler
from torchvision import datasets, transforms
from torchvision.models import ResNet50_Weights, resnet50

VALID_CLASSES = {'TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'ACCESSORIES'}
WEIGHTS = ResNet50_Weights.IMAGENET1K_V2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', required=True, help='Directory with one folder per wardrobe category')
    parser.add_argument('--output', default='models/stylesense-resnet50.pt')
    parser.add_argument('--epochs', type=int, default=15)
    parser.add_argument('--freeze-epochs', type=int, default=2)
    parser.add_argument('--batch-size', type=int, default=16)
    parser.add_argument('--val-split', type=float, default=0.2)
    parser.add_argument('--patience', type=int, default=4)
    parser.add_argument('--min-per-class', type=int, default=200, help='Minimum images required in every category')
    parser.add_argument('--seed', type=int, default=42)
    return parser.parse_args()


def evaluate(model: nn.Module, loader: DataLoader, device: str, class_count: int) -> tuple[float, float]:
    model.eval()
    correct = total = 0
    true_positive = [0] * class_count
    false_positive = [0] * class_count
    false_negative = [0] * class_count
    with torch.inference_mode():
        for images, labels in loader:
            predictions = model(images.to(device)).argmax(1).cpu()
            for prediction, label in zip(predictions.tolist(), labels.tolist()):
                total += 1
                correct += prediction == label
                if prediction == label:
                    true_positive[label] += 1
                else:
                    false_positive[prediction] += 1
                    false_negative[label] += 1
    f1_scores = []
    for index in range(class_count):
        denominator = 2 * true_positive[index] + false_positive[index] + false_negative[index]
        f1_scores.append((2 * true_positive[index] / denominator) if denominator else 0.0)
    return correct / max(total, 1), sum(f1_scores) / class_count


def main() -> None:
    args = parse_args()
    if not 0.05 <= args.val_split < 0.5:
        raise SystemExit('--val-split must be between 0.05 and 0.49.')
    random.seed(args.seed)
    torch.manual_seed(args.seed)

    train_transform = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.65, 1.0), ratio=(0.8, 1.25)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(12),
        transforms.ColorJitter(brightness=0.18, contrast=0.16, saturation=0.14, hue=0.03),
        transforms.ToTensor(),
        transforms.Normalize(mean=WEIGHTS.transforms().mean, std=WEIGHTS.transforms().std),
    ])
    source = datasets.ImageFolder(args.data)
    if set(source.classes) != VALID_CLASSES:
        raise SystemExit(f'Dataset folders must be exactly {sorted(VALID_CLASSES)}; found {source.classes}')

    indices_by_class: dict[int, list[int]] = defaultdict(list)
    for index, (_, label) in enumerate(source.samples):
        indices_by_class[label].append(index)
    for label, indices in indices_by_class.items():
        if len(indices) < args.min_per_class:
            raise SystemExit(f'{source.classes[label]} has only {len(indices)} images; provide at least {args.min_per_class} per category.')

    train_indices: list[int] = []
    validation_indices: list[int] = []
    for indices in indices_by_class.values():
        random.shuffle(indices)
        validation_count = max(1, round(len(indices) * args.val_split))
        validation_indices.extend(indices[:validation_count])
        train_indices.extend(indices[validation_count:])

    train_dataset = datasets.ImageFolder(args.data, transform=train_transform)
    validation_dataset = datasets.ImageFolder(args.data, transform=WEIGHTS.transforms())
    train_labels = [source.targets[index] for index in train_indices]
    class_counts = torch.bincount(torch.tensor(train_labels), minlength=len(source.classes)).float()
    sample_weights = [float(1.0 / class_counts[label]) for label in train_labels]
    sampler = WeightedRandomSampler(sample_weights, len(sample_weights), replacement=True)
    workers = 0 if not torch.cuda.is_available() else 2
    train_loader = DataLoader(Subset(train_dataset, train_indices), batch_size=args.batch_size, sampler=sampler, num_workers=workers)
    validation_loader = DataLoader(Subset(validation_dataset, validation_indices), batch_size=args.batch_size, shuffle=False, num_workers=workers)

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model = resnet50(weights=WEIGHTS)
    model.fc = nn.Linear(model.fc.in_features, len(source.classes))
    for parameter in model.parameters():
        parameter.requires_grad = False
    for parameter in model.fc.parameters():
        parameter.requires_grad = True
    model.to(device)
    # The sampler already balances classes. Weighting the loss as well would
    # over-correct minority categories and make calibration less reliable.
    loss_fn = nn.CrossEntropyLoss()
    optimizer = AdamW(model.fc.parameters(), lr=8e-4, weight_decay=1e-4)
    scheduler = ReduceLROnPlateau(optimizer, mode='max', factor=0.4, patience=1)
    best_state = None
    best_f1 = -1.0
    stale_epochs = 0

    print(f'Training on {device}: {len(train_indices)} train / {len(validation_indices)} validation images')
    for epoch in range(args.epochs):
        if epoch == args.freeze_epochs:
            for parameter in model.layer4.parameters():
                parameter.requires_grad = True
            optimizer = AdamW(filter(lambda parameter: parameter.requires_grad, model.parameters()), lr=1e-5, weight_decay=1e-4)
            scheduler = ReduceLROnPlateau(optimizer, mode='max', factor=0.4, patience=1)
            print('Unfroze ResNet layer4 for fine-tuning.')
        model.train()
        total_loss = total = 0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            loss = loss_fn(model(images), labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            total_loss += loss.item() * len(labels)
            total += len(labels)
        val_accuracy, val_f1 = evaluate(model, validation_loader, device, len(source.classes))
        scheduler.step(val_f1)
        print(f'epoch={epoch + 1} train_loss={total_loss / max(total, 1):.4f} val_accuracy={val_accuracy:.3f} val_macro_f1={val_f1:.3f}')
        if val_f1 > best_f1:
            best_f1, stale_epochs = val_f1, 0
            best_state = copy.deepcopy(model.state_dict())
        else:
            stale_epochs += 1
            if stale_epochs >= args.patience:
                print(f'Early stopping after {epoch + 1} epochs.')
                break

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    torch.save({'state_dict': best_state, 'class_names': source.classes, 'validation_macro_f1': best_f1, 'image_size': 224}, args.output)
    print(f'Saved best checkpoint to {args.output} (validation macro-F1={best_f1:.3f})')


if __name__ == '__main__':
    main()
