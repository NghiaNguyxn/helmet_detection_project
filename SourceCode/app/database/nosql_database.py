from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import setting
from app.exceptions.base import AppError

async def connect_to_mongodb(app) -> AsyncIOMotorClient:
    """Initialize MongoDB client and store it in app state."""
    
    print("Connecting to MongoDB Atlas...")
    client = AsyncIOMotorClient(setting.MONGO_URL, tls=True)

    try:
        await client.admin.command('ping')
        app.state.nosql_client = client
        print("MongoDB Atlas connected!")
    except AppError as e:
        print(f"MongoDB connection failed: {e}")
        raise e
    
async def close_mongodb_connection(app):
    """Close MongoDB client connection."""

    if hasattr(app.state, "nosql_client"):
        app.state.nosql_client.close()
        print("MongoDB connection closed.")