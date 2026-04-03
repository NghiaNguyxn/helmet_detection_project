import asyncio
from app.dependencies import database

async def test_connection():
    client = await database.get_db()
    
    try:
        await client.admin.command('ping')
        print("Kết nối MongoDB Atlas thành công!")
        
    except Exception as e:
        print(f"Lỗi kết nối: {e}")
        
    finally:
        client.close()
        print("Đã đóng kết nối test.")

if __name__ == "__main__":
    asyncio.run(test_connection())