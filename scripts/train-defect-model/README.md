# Wafer Defect Pattern Classifier — Training

One-time, offline training pipeline for the CNN behind
`src/services/quality/defectInferenceService.ts`. This is **not** part of
the Electron app or its build — only the exported `.onnx` file it produces
ships with the app. See [`spec/done/ai-defect-detection.md`](../../spec/done/ai-defect-detection.md)
for the full design rationale.

## Dataset

**WM-811K** (aka MIR-WM811K / LSWMD) — ~811K real wafer maps from an actual
fab, ~173K of them labeled with one of 8 canonical failure patterns
(`Center`, `Donut`, `Edge-Loc`, `Edge-Ring`, `Loc`, `Random`, `Scratch`,
`Near-full`) or `none` (normal).

Downloaded from the original research lab's public, no-login mirror:
`http://mirlab.org/dataSet/public/MIR-WM811K.zip` — **not** the Kaggle
mirror, which requires an account. Place the extracted
`MIR-WM811K/Python/WM811K.pkl` at `data/WM811K.pkl` (gitignored — this
directory is never committed, it's ~2GB).

Citation (required for redistribution/use per the dataset's license):

> Ming-Ju Wu, Jyh-Shing Roger Jang, and Jui-Long Chen, "Wafer Map Failure
> Pattern Recognition and Similarity Ranking for Large-Scale Data Sets,"
> IEEE Transactions on Semiconductor Manufacturing, vol. 28, no. 1,
> pp. 1-12, Feb. 2015.

## Setup

```bash
cd scripts/train-defect-model
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
python3 train.py
```

Trains the CNN, evaluates on the dataset's own train/test split (reported
**per-class**, not just overall accuracy — the classes are heavily
imbalanced), verifies the ONNX export matches the PyTorch model's
predictions, and writes the final model to
`../../public/models/wafer-defect-classifier.onnx` (or wherever this
project's static-asset convention puts it — see `train.py`'s `OUTPUT_PATH`).

## Honesty note

This model is trained on a **public academic dataset from a real fab**,
not any specific customer's proprietary data. See
`spec/done/ai-defect-detection.md` §5 for the exact public-facing framing
this is meant to support.
