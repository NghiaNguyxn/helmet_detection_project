from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection
from app.core.config import setting

class MongoDB:
    client: AsyncIOMotorClient = None

db = MongoDB()

async def get_db() -> AsyncIOMotorClient:
    """Initialize or return the existing MongoDB client."""

    if db.client is None:
        print("Initiating a new MongoDB connection...")
        db.client = AsyncIOMotorClient(setting.MONGO_URL, tls=True)
    
    return db.client

async def get_violation_collection(
        client: AsyncIOMotorClient = Depends(get_db)
) -> AsyncIOMotorCollection:
    """Dependency to provide the 'violations' collection."""

    return client[setting.DATABASE_NAME][setting.VIOLATION_COLLECTION]