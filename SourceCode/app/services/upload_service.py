import cloudinary
from cloudinary.uploader import upload
from app.core.config import setting
import cv2
import numpy as np

# Cấu hình Cloudinary ngay khi module được import
cloudinary.config(
    cloud_name=setting.CLOUDINARY_CLOUD_NAME,
    api_key=setting.CLOUDINARY_API_KEY,
    api_secret=setting.CLOUDINARY_API_SECRET,
    secure=True,
)

async def upload_image_to_cloudinary(image: np.ndarray) -> str:
    """
        Upload image (NumPy array) to Cloudinary and return the secure URL.
    """
    
     # 1. Chuyển ma trận ảnh OpenCV sang định dạng bytes (để Cloudinary có thể đọc được)
    _, buffer = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    image_bytes = buffer.tobytes()

    # 2. Thực hiện upload
    # folder="ptit_helmet" giúp gom nhóm ảnh trên Cloudinary cho gọn
    upload_result = upload(
        file=image_bytes,
        folder="ptit_helmet",
        resource_type="image"
    )

    # 3. Trả về URL của ảnh đã upload
    return upload_result.get("secure_url")