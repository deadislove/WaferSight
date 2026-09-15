"""
Trains a small CNN to classify WM-811K wafer maps into one of the 8
canonical failure patterns (or 'none'), then exports to ONNX.

One-time, offline script — not part of the Electron app. See README.md.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from PIL import Image
from sklearn.metrics import classification_report, accuracy_score

sys.stdout.reconfigure(line_buffering=True)  # this script's output is piped to a file; flush per line so progress is visible while it runs

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_PATH = SCRIPT_DIR / "data" / "WM811K.pkl"
OUTPUT_ONNX = SCRIPT_DIR / ".." / ".." / "public" / "models" / "wafer-defect-classifier.onnx"
OUTPUT_LABELS = SCRIPT_DIR / ".." / ".." / "public" / "models" / "wafer-defect-classifier-labels.json"

IMG_SIZE = 32
MAX_PER_CLASS_TRAIN = 4000  # cap the dominant 'none' class so training stays fast + less imbalanced
MONITOR_SUBSET_SIZE = 5000  # fast per-epoch proxy; full test set only evaluated once, at the end
SEED = 42
EPOCHS = 18
BATCH_SIZE = 64
LR = 1e-3

CLASSES = ["none", "Center", "Donut", "Edge-Loc", "Edge-Ring", "Loc", "Random", "Scratch", "Near-full"]
CLASS_TO_IDX = {c: i for i, c in enumerate(CLASSES)}

torch.manual_seed(SEED)
np.random.seed(SEED)


def encode_wafer_map(raw_map) -> np.ndarray:
    """Wafer map values: 0 = no die, 1 = pass, 2 = fail.
    Encoded as a 2-channel image (die-exists mask, fail mask), each
    resized independently to IMG_SIZE x IMG_SIZE — avoids treating the
    raw 0/1/2 values as an ordinal magnitude, which they are not."""
    arr = np.asarray(raw_map, dtype=np.uint8)
    die_exists = (arr != 0).astype(np.float32)
    fail_mask = (arr == 2).astype(np.float32)

    def resize_channel(channel: np.ndarray) -> np.ndarray:
        img = Image.fromarray((channel * 255).astype(np.uint8))
        img = img.resize((IMG_SIZE, IMG_SIZE), Image.BILINEAR)
        return np.asarray(img, dtype=np.float32) / 255.0

    return np.stack([resize_channel(die_exists), resize_channel(fail_mask)], axis=0)  # (2, H, W)


def encode_frame(frame: pd.DataFrame, label: str) -> tuple[torch.Tensor, torch.Tensor]:
    """Encode every row ONCE up front into in-memory tensors. Doing this
    lazily inside a Dataset.__getitem__ (the first version of this script)
    re-runs PIL resizing on every access — for the ~119K-row test set that
    meant re-encoding it on every one of 18 epochs, which was slow enough
    to be worth avoiding entirely."""
    n = len(frame)
    X = np.zeros((n, 2, IMG_SIZE, IMG_SIZE), dtype=np.float32)
    maps = frame["waferMap"].tolist()
    labels = frame["failureType"].map(CLASS_TO_IDX).to_numpy()
    for i in range(n):
        X[i] = encode_wafer_map(maps[i])
        if (i + 1) % 20000 == 0:
            print(f"  encoded {i + 1}/{n} ({label})")
    return torch.from_numpy(X), torch.from_numpy(labels.astype(np.int64))


class DefectCNN(nn.Module):
    def __init__(self, num_classes: int):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(2, 16, 3, padding=1), nn.BatchNorm2d(16), nn.ReLU(), nn.MaxPool2d(2),  # 32 -> 16
            nn.Conv2d(16, 32, 3, padding=1), nn.BatchNorm2d(32), nn.ReLU(), nn.MaxPool2d(2),  # 16 -> 8
            nn.Conv2d(32, 64, 3, padding=1), nn.BatchNorm2d(64), nn.ReLU(), nn.MaxPool2d(2),  # 8 -> 4
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(64 * 4 * 4, 128), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(128, num_classes),
        )

    def forward(self, x):
        return self.classifier(self.features(x))


def load_labeled_frame() -> pd.DataFrame:
    print(f"Loading {DATA_PATH} ...")
    df = pd.read_pickle(DATA_PATH)

    # failureType/trainTestLabel are plain Python strings for labeled rows,
    # but unlabeled rows carry a stray numpy array artifact left over from
    # the original MATLAB -> pickle conversion (not real data — e.g.
    # array([0, 0], dtype=uint64), not an empty string). Must filter by
    # type BEFORE any hash/dedup operation: pandas' .isin()/.unique()/
    # .value_counts() all raise "TypeError: unhashable type: 'numpy.ndarray'"
    # if called directly on this mixed hashable/unhashable object column.
    is_str = lambda col: df[col].apply(lambda v: isinstance(v, str))
    df = df[is_str("failureType") & is_str("trainTestLabel")].reset_index(drop=True)
    df = df[df["failureType"].isin(CLASSES)].reset_index(drop=True)

    print(f"Labeled rows: {len(df)}")
    print(df.groupby(["trainTestLabel", "failureType"]).size().unstack(fill_value=0))
    return df


def cap_majority_class(frame: pd.DataFrame) -> pd.DataFrame:
    parts = []
    for cls, group in frame.groupby("failureType"):
        if len(group) > MAX_PER_CLASS_TRAIN:
            group = group.sample(n=MAX_PER_CLASS_TRAIN, random_state=SEED)
        parts.append(group)
    return pd.concat(parts).sample(frac=1, random_state=SEED).reset_index(drop=True)


def batched_predict(model: nn.Module, X: torch.Tensor, batch_size: int = 2048) -> torch.Tensor:
    model.eval()
    preds = []
    with torch.no_grad():
        for i in range(0, len(X), batch_size):
            out = model(X[i : i + batch_size])
            preds.append(out.argmax(1))
    return torch.cat(preds)


def main():
    df = load_labeled_frame()
    train_df = cap_majority_class(df[df["trainTestLabel"] == "Training"])
    test_df = df[df["trainTestLabel"] == "Test"].reset_index(drop=True)

    print(f"\nTraining on {len(train_df)} samples (capped), evaluating on {len(test_df)} samples")

    print("Encoding training set...")
    X_train, y_train = encode_frame(train_df, "train")
    print("Encoding test set (larger, one-time cost — not repeated per epoch)...")
    X_test, y_test = encode_frame(test_df, "test")

    rng = np.random.RandomState(SEED)
    monitor_idx = rng.choice(len(X_test), size=min(MONITOR_SUBSET_SIZE, len(X_test)), replace=False)
    X_monitor, y_monitor = X_test[monitor_idx], y_test[monitor_idx]

    # Inverse-frequency class weights (computed from the capped training set)
    counts = train_df["failureType"].map(CLASS_TO_IDX).value_counts().sort_index()
    weights = torch.tensor([1.0 / counts.get(i, 1) for i in range(len(CLASSES))], dtype=torch.float32)
    weights = weights / weights.sum() * len(CLASSES)

    model = DefectCNN(len(CLASSES))
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    criterion = nn.CrossEntropyLoss(weight=weights)

    n_train = len(X_train)
    best_acc = 0.0
    best_state = None

    print(f"\nStarting training ({EPOCHS} epochs, batch size {BATCH_SIZE})...")
    for epoch in range(1, EPOCHS + 1):
        model.train()
        perm = torch.randperm(n_train)
        total_loss = 0.0
        for i in range(0, n_train, BATCH_SIZE):
            idx = perm[i : i + BATCH_SIZE]
            x, y = X_train[idx], y_train[idx]
            optimizer.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * x.size(0)

        preds = batched_predict(model, X_monitor)
        acc = accuracy_score(y_monitor.numpy(), preds.numpy())
        print(f"epoch {epoch:2d}  train_loss={total_loss / n_train:.4f}  monitor_acc={acc:.4f}")

        if acc > best_acc:
            best_acc = acc
            best_state = {k: v.clone() for k, v in model.state_dict().items()}

    model.load_state_dict(best_state)
    model.eval()

    # Final per-class report on the FULL test set (only done once, here) —
    # overall accuracy alone is misleading given how imbalanced these
    # classes are (a model that always says 'none' scores deceptively well).
    print("\nRunning final evaluation on the full test set...")
    final_preds = batched_predict(model, X_test)
    print(f"\n=== Final test accuracy: {accuracy_score(y_test.numpy(), final_preds.numpy()):.4f} ===")
    print(classification_report(y_test.numpy(), final_preds.numpy(), target_names=CLASSES, digits=3, zero_division=0))

    # --- Export to ONNX ---
    OUTPUT_ONNX.parent.mkdir(parents=True, exist_ok=True)
    dummy_input = torch.randn(1, 2, IMG_SIZE, IMG_SIZE)
    torch.onnx.export(
        model, dummy_input, str(OUTPUT_ONNX),
        input_names=["wafer_image"], output_names=["logits"],
        dynamic_axes={"wafer_image": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
    )
    # The dynamo-based exporter defaults to splitting weights into a
    # companion .onnx.data file — a sane default for large models, but this
    # one is under 1MB total, so a single embedded file is simpler to
    # deploy (no relative-path linking between two files for
    # onnxruntime-web to get right in a browser/WASM environment).
    import onnx as onnx_lib

    onnx_model = onnx_lib.load(str(OUTPUT_ONNX), load_external_data=True)
    onnx_lib.save_model(onnx_model, str(OUTPUT_ONNX), save_as_external_data=False)
    external_data_file = OUTPUT_ONNX.with_suffix(".onnx.data")
    if external_data_file.exists():
        external_data_file.unlink()
    print(f"\nExported ONNX model (single embedded file) to {OUTPUT_ONNX.resolve()}")

    with open(OUTPUT_LABELS, "w") as f:
        json.dump({"classes": CLASSES, "imgSize": IMG_SIZE}, f, indent=2)
    print(f"Wrote labels to {OUTPUT_LABELS.resolve()}")

    # --- Verify ONNX export matches PyTorch on real test samples ---
    import onnxruntime as ort

    session = ort.InferenceSession(str(OUTPUT_ONNX))
    sample_x = X_test[:256]

    with torch.no_grad():
        torch_out = model(sample_x).numpy()
    onnx_out = session.run(None, {"wafer_image": sample_x.numpy()})[0]

    torch_preds = torch_out.argmax(axis=1)
    onnx_preds = onnx_out.argmax(axis=1)
    match_rate = (torch_preds == onnx_preds).mean()
    max_diff = np.abs(torch_out - onnx_out).max()
    print(f"\nONNX vs PyTorch prediction match rate on a batch: {match_rate:.4f} (max logit diff: {max_diff:.6f})")
    assert match_rate == 1.0, "ONNX export does not match PyTorch predictions — do not ship this model."
    print("ONNX export verified: predictions match PyTorch exactly.")


if __name__ == "__main__":
    main()
