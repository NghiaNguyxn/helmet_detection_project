import argparse
from pathlib import Path

from ultralytics import YOLO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export a YOLO model to ONNX.")
    parser.add_argument("--model", required=True, help="Path to the source .pt model.")
    parser.add_argument("--imgsz", type=int, default=416, help="Input image size used for export.")
    parser.add_argument("--opset", type=int, default=12, help="ONNX opset version.")
    parser.add_argument("--dynamic", action="store_true", help="Export with dynamic input shapes.")
    parser.add_argument("--simplify", action="store_true", help="Simplify the exported ONNX graph.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model_path = Path(args.model).expanduser().resolve()

    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")

    print(f"Loading model from {model_path}...")
    model = YOLO(str(model_path))

    print("Exporting to ONNX...")
    output_path = model.export(
        format="onnx",
        imgsz=args.imgsz,
        dynamic=args.dynamic,
        simplify=args.simplify,
        opset=args.opset,
    )

    print(f"Export completed: {output_path}")


if __name__ == "__main__":
    main()
