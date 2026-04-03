from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorCollection
import numpy as np

from app.services.upload_service import upload_image_to_cloudinary
from app.schemas.helmet_schema import Detection, ViolationHistoryResponse, ViolationRecord

async def get_violation_history(db_collection: AsyncIOMotorCollection, page: int, limit: int) -> ViolationHistoryResponse:
    """
    Get paginated violation history from MongoDB Atlas.
    """

    # 1. Tính toán số bản ghi cần bỏ qua
    skip = (page - 1) * limit

    # 2. Lấy tổng số bản ghi
    total_count = await db_collection.count_documents({})

    # 3. Truy vấn dữ liệu mới nhất
    cursor = db_collection.find().sort("timestamp", -1).skip(skip).limit(limit)

    violations: list[ViolationRecord] = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])  # Chuyển _id từ ObjectId sang string để Pydantic không báo lỗi
        violations.append(ViolationRecord(**doc))

    # 4. Tạo response
    return ViolationHistoryResponse(
        total=total_count,
        page=page,
        limit=limit,
        data=violations,
    )

async def save_violation_backtask(
        annotated_frame: np.ndarray, 
        violation_count: int, 
        all_detections: list[Detection], 
        db_collection: AsyncIOMotorCollection
    ):
    """Background task for saving violation record"""

    try:
        cloud_url = await upload_image_to_cloudinary(annotated_frame)
        print(f"Image uploaded to Cloudinary: {cloud_url}")

        timestamp_obj = datetime.now()

        violation_doc = ViolationRecord(
            timestamp=timestamp_obj,
            image_url=cloud_url,
            total_violations=violation_count,
            detections=[d for d in all_detections if d.class_id == 1]  # Chỉ lưu detections vi phạm (không đội mũ)
        )
        await db_collection.insert_one(violation_doc.model_dump())
        print(f"[Background] Saved violation to Cloud")
    except Exception as e:
        print(f"[Background] Failed to save history: {e}")