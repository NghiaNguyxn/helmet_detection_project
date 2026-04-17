from fastapi import Depends, Request
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection
from SourceCode.BE.app.core.config import setting

async def get_violation_collection(request: Request) -> AsyncIOMotorCollection:
    """Dependency to provide the 'violations' collection."""

    client = request.app.state.nosql_client

    return client[setting.DATABASE_NAME][setting.VIOLATION_COLLECTION]