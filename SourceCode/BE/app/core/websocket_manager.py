from fastapi import WebSocket

import logging

logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self):
        # Lưu trữ kết nối đang hoạt động
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Accept a new WebSocket connection and add it to the active list"""

        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection from the active list"""
        
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Client disconnected. Total clients: {len(self.active_connections)}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send a message to a specific client"""

        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)

    async def broadcast(self, message: dict):
        """Send a message to all active clients"""

        for connection in self.active_connections[:]: # Sử dụng slice để tránh lỗi mutation list
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to a client: {e}")
                self.disconnect(connection)

manager = WebSocketManager()