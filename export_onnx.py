from ultralytics import YOLO
import os

# Đường dẫn file mô hình gốc .pt
pt_model_path = r"D:\Python\helmet_detection_project\SourceCode\BE\app\weights\best_s.pt"

# Khởi tạo mô hình
print(f"Loading model from {pt_model_path}...")
model = YOLO(pt_model_path)

print("Exporting to ONNX format with Premium Options...")

# THỰC HIỆN XUẤT MÔ HÌNH
# format='onnx': Định dạng chuẩn
# imgsz=416: Kích thước tối ưu khi huấn luyện
# dynamic=True: CHO PHÉP LINH HOẠT KÍCH THƯỚC ĐẦU VÀO (Giữ tỉ lệ ảnh tốt hơn)
# simplify=True: Tối ưu model
# opset=12: Đảm bảo tương thích tốt nhất
success_path = model.export(
    format='onnx', 
    imgsz=416, 
    dynamic=True, 
    simplify=True, 
    opset=12
)

if success_path:
    print(f"\nEXPORT THÀNH CÔNG!")
    print(f"File ONNX mới nằm tại: {success_path}")
else:
    print("\nEXPORT THẤT BẠI. Vui lòng kiểm tra log lỗi.")
