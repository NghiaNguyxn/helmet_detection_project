from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection
from fastapi import FastAPI
from datetime import timezone
import logging

from SourceCode.BE.app.core.config import setting

logger = logging.getLogger(__name__)

async def connect_to_mongodb(app: FastAPI):
    """Initialize MongoDB client and store it in app state."""

    logger.info("Connecting to MongoDB Atlas...")
    try:
        app.state.mongodb_client = AsyncIOMotorClient(
            setting.MONGO_URL,
            tz_aware=True,
            tzinfo=timezone.utc,
        )
        app.state.db = app.state.mongodb_client[setting.DATABASE_NAME]
        # Verify connection
        await app.state.mongodb_client.admin.command('ping')
        logger.info("MongoDB Atlas connected!")
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        raise e

async def close_mongodb_connection(app: FastAPI):
    """Close MongoDB connection."""

    if hasattr(app.state, 'mongodb_client'):
        app.state.mongodb_client.close()
        logger.info("MongoDB connection closed.")
