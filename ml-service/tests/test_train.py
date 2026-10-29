"""Focused tests for the manifest-backed ResNet-50 experiment helpers."""

from types import SimpleNamespace

import torch

from train import _metric_summary, _save_checkpoint, build_model


def test_resnet50_final_head_has_five_outputs():
    model = build_model(5, pretrained=False)
    with torch.no_grad():
        output = model(torch.zeros(1, 3, 224, 224))
    assert tuple(output.shape) == (1, 5)
    assert model.fc.out_features == 5


def test_metric_calculation_is_deterministic_and_per_class():
    confusion = [[8, 2, 0], [1, 7, 2], [0, 1, 9]]
    first = _metric_summary(confusion, ('TOP', 'BOTTOM', 'SHOES'))
    second = _metric_summary(confusion, ('TOP', 'BOTTOM', 'SHOES'))
    assert first == second
    assert first['total'] == 30
    assert first['accuracy'] == 24 / 30
    assert set(first['per_class']) == {'TOP', 'BOTTOM', 'SHOES'}
    assert first['confusion_matrix'] == confusion


def test_checkpoint_contains_fastapi_compatible_metadata(tmp_path):
    model = build_model(5, pretrained=False)
    checkpoint_path = tmp_path / 'stylesense-resnet50.pt'
    _save_checkpoint(
        checkpoint_path,
        model,
        args=SimpleNamespace(seed=42, batch_size=8),
        manifest_path='manifest.json',
        best_epoch=3,
        best_metric=0.7,
        class_count=5,
        split_counts={'train': 10, 'val': 5, 'test': 5},
        history=[{'epoch': 3, 'validation_macro_f1': 0.7}],
        device='cpu',
    )
    checkpoint = torch.load(checkpoint_path, map_location='cpu', weights_only=False)
    assert checkpoint['architecture'] == 'resnet50'
    assert checkpoint['num_classes'] == 5
    assert checkpoint['class_names'] == ['TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'ACCESSORIES']
    assert checkpoint['class_to_id']['ACCESSORIES'] == 4
    assert checkpoint['best_epoch'] == 3
    assert checkpoint['dataset']['split_counts']['test'] == 5


def test_result_metric_schema_contains_required_evaluation_fields():
    metrics = _metric_summary([[1, 0], [1, 2]], ('TOP', 'BOTTOM'))
    assert {'accuracy', 'macro_precision', 'macro_recall', 'macro_f1',
            'per_class', 'confusion_matrix', 'support', 'total'} <= set(metrics)
    assert set(metrics['per_class']['TOP']) == {'precision', 'recall', 'f1', 'support'}
    assert len(metrics['confusion_matrix']) == 2
    assert all(len(row) == 2 for row in metrics['confusion_matrix'])
