import torch
import cv2
import sys

print("KIỂM TRA MÔI TRƯỜNG CUDA")

# Kiểm tra Python
print(f"Python version: {sys.version}")

# Kiểm tra PyTorch và CUDA
print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")

if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"CUDA version: {torch.version.cuda}")
    print(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
    
    # Test tensor trên GPU
    x = torch.randn(1000, 1000).cuda()
    y = torch.randn(1000, 1000).cuda()
    z = x @ y
    print("Phép tính trên GPU hoạt động")
else:
    print("CUDA không khả dụng")

# Kiểm tra OpenCV
print(f"OpenCV version: {cv2.__version__}")

# Kiểm tra ultralytics
try:
    from ultralytics import YOLO
    print("Ultralytics YOLO import thành công")
except ImportError as e:
    print(f"Lỗi import ultralytics: {e}")

print("KIỂM TRA HOÀN TẤT")