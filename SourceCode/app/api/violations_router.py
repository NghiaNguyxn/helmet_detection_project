from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorCollection

from app.dependencies.database import get_violation_collection
from app.schemas.helmet_schema import ViolationHistoryResponse
from app.services import violation_services

router = APIRouter(prefix="/violations", tags=["Violations History"])

@router.get(
    "/",
    response_model=ViolationHistoryResponse,
    status_code=status.HTTP_200_OK,
    )
async def get_violation_history(
    page: int = Query(1, ge=1, description="Page number (starting from 1)"),
    limit: int = Query(10, ge=1, le=100, description="Number of records per page (max 100)"),
    db_collection: AsyncIOMotorCollection = Depends(get_violation_collection),
):
    """
    Get paginated violation history from MongoDB Atlas.
    
    - **page**: Page number (starting from 1)
    - **limit**: Number of records per page (max 100)
    
    Returns total count, current page, limit, and list of violation records.
    """

    return await violation_services.get_violation_history(
        db_collection=db_collection, 
        page=page, 
        limit=limit
    )
    