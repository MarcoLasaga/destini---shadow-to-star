"""Train and evaluate the StyleSense five-class ResNet-50 CNN.

The preferred input is the validated unified CNN manifest. The original
ImageFolder mode remains available for small/local experiments.
"""
from __future__ import annotations

import argparse
import copy
import json
import platform
import random
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence

# Initialize the Windows DLL search path before torch/torchvision are loaded.
from cnn_dataset import CLASS_NAMES, CNNManifest, CNNRecord, VALID_SPLITS, validate_cnn_manifest

import torch
from PIL import Image
from torch import nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import ReduceLROnPlateau
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler
from torchvision import datasets, transforms
from torchvision.models import ResNet50_Weights, resnet50

FINAL_CLASSES = tuple(CLASS_NAMES)
DEEPFASHION_BASELINE_CLASSES = ('TOP', 'BOTTOM', 'OUTERWEAR')
WEIGHTS = ResNet50_Weights.IMAGENET1K_V2
EXPECTED_FINAL_SPLIT_COUNTS = {'train': 220482, 'val': 37061, 'test': 37061}
EXPECTED_FINAL_TOTAL = sum(EXPECTED_FINAL_SPLIT_COUNTS.values())


class RelabeledSubset(Dataset):
    """ImageFolder subset whose targets follow the authoritative taxonomy order."""

    def __init__(self, dataset: Dataset, indices: list[int], label_map: dict[int, int]) -> None:
        self.dataset = dataset
        self.indices = indices
        self.label_map = label_map

    def __len__(self) -> int:
        return len(self.indices)

    def __getitem__(self, index: int):
        image, label = self.dataset[self.indices[index]]
        return image, self.label_map[label]


class ManifestImageDataset(Dataset):
    """Read one manifest split without altering the authoritative records."""

    def __init__(self, records: Sequence[CNNRecord], transform: transforms.Compose) -> None:
        self.records = list(records)
        self.transform = transform

    def __len__(self) -> int:
        return len(self.records)

    def __getitem__(self, index: int):
        record = self.records[index]
        with Image.open(record.image_path) as image:
            image = image.convert('RGB')
        return self.transform(image), record.class_id


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--manifest', help='Validated CNNManifest JSON with train/val/test records')
    source.add_argument('--data', help='ImageFolder directory with one folder per wardrobe category')
    parser.add_argument('--output', default='models/stylesense-resnet50.pt')
    parser.add_argument('--results', help='Machine-readable experiment results JSON (manifest mode)')
    parser.add_argument('--epochs', type=int, default=15)
    parser.add_argument('--freeze-epochs', type=int, default=2)
    parser.add_argument('--batch-size', type=int, default=8)
    parser.add_argument('--workers', type=int, default=None)
    parser.add_argument('--val-split', type=float, default=0.2)
    parser.add_argument('--patience', type=int, default=4)
    parser.add_argument('--min-per-class', type=int, default=200, help='Minimum images required in every category')
    parser.add_argument('--class-set', choices=['stylesense-5', 'deepfashion-3'], default='stylesense-5',
                        help='Train the final five-class taxonomy or an explicitly labelled DeepFashion-only baseline.')
    parser.add_argument('--seed', type=int, default=42)
    return parser.parse_args()


def seed_everything(seed: int) -> None:
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def make_transforms() -> tuple[transforms.Compose, transforms.Compose]:
    normalization = transforms.Normalize(mean=WEIGHTS.transforms().mean, std=WEIGHTS.transforms().std)
    train_transform = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.65, 1.0), ratio=(0.8, 1.25)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(12),
        transforms.ColorJitter(brightness=0.18, contrast=0.16, saturation=0.14, hue=0.03),
        transforms.ToTensor(),
        normalization,
    ])
    evaluation_transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        normalization,
    ])
    return train_transform, evaluation_transform


def build_model(class_count: int, pretrained: bool = True) -> nn.Module:
    model = resnet50(weights=WEIGHTS if pretrained else None)
    model.fc = nn.Linear(model.fc.in_features, class_count)
    return model


def _metric_summary(confusion: list[list[int]], class_names: Sequence[str] = FINAL_CLASSES) -> dict[str, Any]:
    class_count = len(confusion)
    supports = [sum(row) for row in confusion]
    per_class: dict[str, dict[str, float | int]] = {}
    precisions: list[float] = []
    recalls: list[float] = []
    f1_scores: list[float] = []
    correct = sum(confusion[i][i] for i in range(class_count))
    total = sum(supports)
    for index, name in enumerate(class_names[:class_count]):
        true_positive = confusion[index][index]
        predicted = sum(confusion[row][index] for row in range(class_count))
        support = supports[index]
        precision = true_positive / predicted if predicted else 0.0
        recall = true_positive / support if support else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if precision + recall else 0.0
        precisions.append(precision)
        recalls.append(recall)
        f1_scores.append(f1)
        per_class[name] = {'precision': precision, 'recall': recall, 'f1': f1, 'support': support}
    return {
        'accuracy': correct / total if total else 0.0,
        'macro_precision': sum(precisions) / class_count if class_count else 0.0,
        'macro_recall': sum(recalls) / class_count if class_count else 0.0,
        'macro_f1': sum(f1_scores) / class_count if class_count else 0.0,
        'per_class': per_class,
        'confusion_matrix': confusion,
        'support': supports,
        'total': total,
    }


def evaluate(model: nn.Module, loader: DataLoader, device: str, class_count: int,
             loss_fn: nn.Module | None = None) -> dict[str, Any]:
    """Evaluate a split and return metrics calculated from every prediction."""
    model.eval()
    confusion = [[0 for _ in range(class_count)] for _ in range(class_count)]
    started = time.perf_counter()
    loss_total = 0.0
    with torch.inference_mode():
        for images, labels in loader:
            logits = model(images.to(device, non_blocking=True))
            if loss_fn is not None:
                loss_total += float(loss_fn(logits, labels.to(device, non_blocking=True)).item()) * len(labels)
            predictions = logits.argmax(1).cpu()
            for prediction, label in zip(predictions.tolist(), labels.tolist()):
                confusion[label][prediction] += 1
    elapsed = time.perf_counter() - started
    metrics = _metric_summary(confusion)
    metrics['inference_seconds'] = elapsed
    metrics['inference_seconds_per_image'] = elapsed / metrics['total'] if metrics['total'] else 0.0
    if loss_fn is not None:
        metrics['loss'] = loss_total / metrics['total'] if metrics['total'] else 0.0
    return metrics


def _loader(dataset: Dataset, batch_size: int, workers: int, *, shuffle: bool = False,
            sampler: WeightedRandomSampler | None = None) -> DataLoader:
    kwargs: dict[str, Any] = {
        'batch_size': batch_size,
        'shuffle': shuffle if sampler is None else False,
        'sampler': sampler,
        'num_workers': workers,
        'pin_memory': torch.cuda.is_available(),
    }
    if workers:
        kwargs['persistent_workers'] = True
    return DataLoader(dataset, **kwargs)


def _manifest_records(manifest_path: str) -> tuple[CNNManifest, dict[str, list[CNNRecord]]]:
    path = Path(manifest_path).resolve()
    if not path.is_file():
        raise SystemExit(f'Manifest does not exist: {path}')
    manifest = CNNManifest.from_json(path)
    errors = validate_cnn_manifest(manifest, require_files=True, require_all_five_classes=True)
    if errors:
        raise SystemExit('Manifest validation failed:\n' + '\n'.join(errors[:20]))
    split_records = {split: [record for record in manifest.records if record.split == split] for split in VALID_SPLITS}
    counts = {split: len(records) for split, records in split_records.items()}
    if counts != EXPECTED_FINAL_SPLIT_COUNTS:
        raise SystemExit(f'Final manifest counts differ from the verified dataset: {counts}')
    if sum(counts.values()) != EXPECTED_FINAL_TOTAL:
        raise SystemExit(f'Final manifest total differs from {EXPECTED_FINAL_TOTAL}: {sum(counts.values())}')
    if {record.class_id for record in manifest.records} != set(range(len(FINAL_CLASSES))):
        raise SystemExit('Final manifest class IDs are not exactly 0, 1, 2, 3, 4.')
    return manifest, split_records


def _smoke_test(dataset: Dataset) -> None:
    for index in range(min(10, len(dataset))):
        image, label = dataset[index]
        if tuple(image.shape) != (3, 224, 224) or not 0 <= int(label) < len(FINAL_CLASSES):
            raise SystemExit(f'Image smoke test failed at index {index}: shape={tuple(image.shape)}, label={label}')


def _environment(device: str) -> dict[str, Any]:
    import torchvision
    return {
        'python': platform.python_version(),
        'pytorch': torch.__version__,
        'torchvision': torchvision.__version__,
        'device': device,
        'cuda_available': torch.cuda.is_available(),
        'cuda_version': torch.version.cuda,
        'gpu_name': torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
    }


def _save_checkpoint(path: Path, model: nn.Module, *, args: argparse.Namespace, manifest_path: str,
                     best_epoch: int, best_metric: float, class_count: int, split_counts: dict[str, int],
                     history: list[dict[str, Any]], device: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({
        'state_dict': copy.deepcopy(model.state_dict()),
        'class_names': list(FINAL_CLASSES[:class_count]),
        'class_to_id': {name: index for index, name in enumerate(FINAL_CLASSES[:class_count])},
        'num_classes': class_count,
        'architecture': 'resnet50',
        'validation_macro_f1': best_metric,
        'best_epoch': best_epoch,
        'image_size': 224,
        'preprocessing': {
            'weights': 'IMAGENET1K_V2',
            'mean': list(WEIGHTS.transforms().mean),
            'std': list(WEIGHTS.transforms().std),
            'evaluation_resize': 256,
            'evaluation_crop': 224,
        },
        'training': vars(args),
        'dataset': {'manifest': str(Path(manifest_path).resolve()), 'split_counts': split_counts},
        'environment': _environment(device),
        'history': history,
    }, path)


def _train(model: nn.Module, train_loader: DataLoader, validation_loader: DataLoader, args: argparse.Namespace,
           device: str, class_count: int, manifest_path: str, split_counts: dict[str, int]) -> tuple[list[dict[str, Any]], int, float]:
    for parameter in model.parameters():
        parameter.requires_grad = False
    for parameter in model.fc.parameters():
        parameter.requires_grad = True
    model.to(device)
    loss_fn = nn.CrossEntropyLoss()
    optimizer = AdamW(model.fc.parameters(), lr=8e-4, weight_decay=1e-4)
    scheduler = ReduceLROnPlateau(optimizer, mode='max', factor=0.4, patience=1)
    scaler = torch.cuda.amp.GradScaler(enabled=device == 'cuda')
    best_state = copy.deepcopy(model.state_dict())
    best_f1 = -1.0
    best_epoch = 0
    stale_epochs = 0
    history: list[dict[str, Any]] = []
    print(f'Training on {device}: {split_counts["train"]} train / {split_counts["val"]} validation images')
    for epoch in range(args.epochs):
        if epoch == args.freeze_epochs:
            for parameter in model.layer4.parameters():
                parameter.requires_grad = True
            optimizer = AdamW(filter(lambda parameter: parameter.requires_grad, model.parameters()), lr=1e-5, weight_decay=1e-4)
            scheduler = ReduceLROnPlateau(optimizer, mode='max', factor=0.4, patience=1)
            print('Unfroze ResNet layer4 for fine-tuning.')
        epoch_started = time.perf_counter()
        model.train()
        total_loss = total = correct = 0
        for images, labels in train_loader:
            images, labels = images.to(device, non_blocking=True), labels.to(device, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)
            with torch.autocast(device_type='cuda', dtype=torch.float16, enabled=device == 'cuda'):
                logits = model(images)
                loss = loss_fn(logits, labels)
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            scaler.step(optimizer)
            scaler.update()
            total_loss += loss.item() * len(labels)
            total += len(labels)
            correct += int(logits.argmax(1).eq(labels).sum().item())
        validation = evaluate(model, validation_loader, device, class_count, loss_fn)
        scheduler.step(validation['macro_f1'])
        epoch_record = {
            'epoch': epoch + 1,
            'train_loss': total_loss / max(total, 1),
            'train_accuracy': correct / max(total, 1),
            'validation_loss': validation['loss'],
            'validation_accuracy': validation['accuracy'],
            'validation_macro_f1': validation['macro_f1'],
            'learning_rate': optimizer.param_groups[0]['lr'],
            'epoch_seconds': time.perf_counter() - epoch_started,
        }
        history.append(epoch_record)
        print(f"epoch={epoch + 1} train_loss={epoch_record['train_loss']:.4f} train_accuracy={epoch_record['train_accuracy']:.3f} "
              f"val_accuracy={validation['accuracy']:.3f} val_macro_f1={validation['macro_f1']:.3f}")
        if validation['macro_f1'] > best_f1:
            best_f1 = validation['macro_f1']
            best_epoch = epoch + 1
            best_state = copy.deepcopy(model.state_dict())
            stale_epochs = 0
        else:
            stale_epochs += 1
            if stale_epochs >= args.patience:
                print(f'Early stopping after {epoch + 1} epochs.')
                break
    model.load_state_dict(best_state)
    return history, best_epoch, best_f1


def _manifest_training(args: argparse.Namespace) -> None:
    _, split_records = _manifest_records(args.manifest)
    train_transform, evaluation_transform = make_transforms()
    train_dataset = ManifestImageDataset(split_records['train'], train_transform)
    validation_dataset = ManifestImageDataset(split_records['val'], evaluation_transform)
    test_dataset = ManifestImageDataset(split_records['test'], evaluation_transform)
    _smoke_test(test_dataset)
    train_labels = [record.class_id for record in split_records['train']]
    class_counts = torch.bincount(torch.tensor(train_labels), minlength=len(FINAL_CLASSES)).float()
    sample_weights = torch.tensor([float(1.0 / class_counts[label]) for label in train_labels], dtype=torch.double)
    sampler = WeightedRandomSampler(sample_weights, len(sample_weights), replacement=True,
                                    generator=torch.Generator().manual_seed(args.seed))
    workers = args.workers if args.workers is not None else (2 if torch.cuda.is_available() else 0)
    train_loader = _loader(train_dataset, args.batch_size, workers, sampler=sampler)
    validation_loader = _loader(validation_dataset, args.batch_size, workers)
    test_loader = _loader(test_dataset, args.batch_size, workers)
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model = build_model(len(FINAL_CLASSES), pretrained=True)
    split_counts = {split: len(records) for split, records in split_records.items()}
    history, best_epoch, best_f1 = _train(model, train_loader, validation_loader, args, device,
                                          len(FINAL_CLASSES), args.manifest, split_counts)
    checkpoint_path = Path(args.output).resolve()
    _save_checkpoint(checkpoint_path, model, args=args, manifest_path=args.manifest,
                     best_epoch=best_epoch, best_metric=best_f1, class_count=len(FINAL_CLASSES),
                     split_counts=split_counts, history=history, device=device)
    test_metrics = evaluate(model, test_loader, device, len(FINAL_CLASSES))
    results_path = Path(args.results or checkpoint_path.with_suffix('.results.json')).resolve()
    results = {
        'experiment_id': checkpoint_path.stem,
        'timestamp_utc': datetime.now(timezone.utc).isoformat(),
        'architecture': 'resnet50',
        'dataset_manifest': str(Path(args.manifest).resolve()),
        'dataset': {
            'total': sum(split_counts.values()),
            'split_counts': split_counts,
            'class_mapping': {name: index for index, name in enumerate(FINAL_CLASSES)},
            'class_counts': {split: dict(Counter(record.label for record in records)) for split, records in split_records.items()},
        },
        'training_configuration': {
            **vars(args),
            'image_size': 224,
            'normalization': {'mean': list(WEIGHTS.transforms().mean), 'std': list(WEIGHTS.transforms().std)},
            'augmentation': 'RandomResizedCrop(224, scale=(0.65, 1.0), ratio=(0.8, 1.25)); RandomHorizontalFlip; RandomRotation(12); ColorJitter',
            'optimizer': 'AdamW',
            'weight_decay': 1e-4,
            'scheduler': 'ReduceLROnPlateau(mode=max, factor=0.4, patience=1)',
            'sampling': 'WeightedRandomSampler(replacement=True)',
            'pretrained_initialization': 'ResNet50_Weights.IMAGENET1K_V2',
            'test_used_for_selection': False,
        },
        'environment': _environment(device),
        'best_epoch': best_epoch,
        'best_validation_macro_f1': best_f1,
        'epochs_completed': len(history),
        'history': history,
        'test_metrics': test_metrics,
        'model_size_bytes': checkpoint_path.stat().st_size,
        'checkpoint_path': str(checkpoint_path),
        'limitations': ['Near-duplicate visual leakage was not evaluated.',
                        'The lightweight CNN comparison remains pending because no existing lightweight baseline was found.'],
    }
    results_path.parent.mkdir(parents=True, exist_ok=True)
    results_path.write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(f'Saved best checkpoint to {checkpoint_path}')
    print(f'Saved results to {results_path}')
    print(json.dumps(test_metrics, indent=2))


def _imagefolder_training(args: argparse.Namespace) -> None:
    if not 0.05 <= args.val_split < 0.5:
        raise SystemExit('--val-split must be between 0.05 and 0.49.')
    expected_classes = FINAL_CLASSES if args.class_set == 'stylesense-5' else DEEPFASHION_BASELINE_CLASSES
    train_transform, evaluation_transform = make_transforms()
    source = datasets.ImageFolder(args.data)
    if tuple(source.classes) != tuple(sorted(expected_classes)):
        raise SystemExit(f'Dataset folders must be exactly {list(sorted(expected_classes))}; found {source.classes}')
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
    validation_dataset = datasets.ImageFolder(args.data, transform=evaluation_transform)
    taxonomy_index = {name: index for index, name in enumerate(expected_classes)}
    source_to_taxonomy = {source.class_to_idx[name]: taxonomy_index[name] for name in expected_classes}
    train_labels = [source_to_taxonomy[source.targets[index]] for index in train_indices]
    class_counts = torch.bincount(torch.tensor(train_labels), minlength=len(source.classes)).float()
    sample_weights = [float(1.0 / class_counts[label]) for label in train_labels]
    sampler = WeightedRandomSampler(sample_weights, len(sample_weights), replacement=True)
    workers = args.workers if args.workers is not None else (2 if torch.cuda.is_available() else 0)
    train_loader = _loader(RelabeledSubset(train_dataset, train_indices, source_to_taxonomy), args.batch_size, workers, sampler=sampler)
    validation_loader = _loader(RelabeledSubset(validation_dataset, validation_indices, source_to_taxonomy), args.batch_size, workers)
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model = build_model(len(source.classes), pretrained=True)
    split_counts = {'train': len(train_indices), 'val': len(validation_indices)}
    history, best_epoch, best_f1 = _train(model, train_loader, validation_loader, args, device,
                                          len(source.classes), str(Path(args.data).resolve()), split_counts)
    _save_checkpoint(Path(args.output).resolve(), model, args=args, manifest_path=args.data,
                     best_epoch=best_epoch, best_metric=best_f1, class_count=len(source.classes),
                     split_counts=split_counts, history=history, device=device)


def main() -> None:
    args = parse_args()
    if args.epochs < 1 or args.batch_size < 1 or args.freeze_epochs < 0:
        raise SystemExit('--epochs and --batch-size must be positive; --freeze-epochs must be non-negative.')
    seed_everything(args.seed)
    if args.manifest:
        if args.class_set != 'stylesense-5':
            raise SystemExit('--manifest supports only the final stylesense-5 taxonomy.')
        _manifest_training(args)
    else:
        _imagefolder_training(args)


if __name__ == '__main__':
    main()
