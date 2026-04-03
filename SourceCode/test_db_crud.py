# test_db_crud.py

import asyncio
from app.dependencies import database

async def test_crud():
    client = await database.get_db()
    db = client["helmet_db"]
    collection = db["test"]

    result = await collection.insert_one({
        "name": "test_user",
        "status": "ok"
    })
    print("Inserted ID:", result.inserted_id)

    doc = await collection.find_one({"name": "test_user"})
    print("Found:", doc)

asyncio.run(test_crud())