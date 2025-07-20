from fastapi import WebSocket, WebSocketDisconnect
from typing import List, Dict, Any, Set
import json
import asyncio
import logging
from datetime import datetime
import uuid

logger = logging.getLogger(__name__)

class WebSocketManager:
    """Manage WebSocket connections for real-time updates"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connection_info: Dict[WebSocket, Dict[str, Any]] = {}
        self.subscriptions: Dict[str, Set[WebSocket]] = {}
        
    async def connect(self, websocket: WebSocket, client_id: str = None):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        
        # Store connection info
        self.connection_info[websocket] = {
            "client_id": client_id or str(uuid.uuid4()),
            "connected_at": datetime.utcnow(),
            "subscriptions": set()
        }
        
        logger.info(f"WebSocket client connected: {self.connection_info[websocket]['client_id']}")
        
    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            
            # Remove from subscriptions
            if websocket in self.connection_info:
                client_info = self.connection_info[websocket]
                for topic in client_info.get("subscriptions", set()):
                    if topic in self.subscriptions:
                        self.subscriptions[topic].discard(websocket)
                
                logger.info(f"WebSocket client disconnected: {client_info['client_id']}")
                del self.connection_info[websocket]
    
    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        """Send message to specific client"""
        try:
            message_str = json.dumps(message, default=str)
            await websocket.send_text(message_str)
        except Exception as e:
            logger.error(f"Failed to send personal message: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: Dict[str, Any], topic: str = "general"):
        """Broadcast message to all connected clients or specific topic subscribers"""
        message_str = json.dumps(message, default=str)
        disconnected = []
        
        # Determine target connections
        if topic == "general":
            target_connections = self.active_connections
        else:
            target_connections = self.subscriptions.get(topic, set())
        
        for connection in target_connections:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                logger.warning(f"Failed to send message to client: {e}")
                disconnected.append(connection)
        
        # Remove disconnected clients
        for connection in disconnected:
            self.disconnect(connection)
    
    def subscribe(self, websocket: WebSocket, topic: str):
        """Subscribe client to specific topic"""
        if topic not in self.subscriptions:
            self.subscriptions[topic] = set()
        
        self.subscriptions[topic].add(websocket)
        
        if websocket in self.connection_info:
            self.connection_info[websocket]["subscriptions"].add(topic)
        
        logger.info(f"Client subscribed to topic: {topic}")
    
    def unsubscribe(self, websocket: WebSocket, topic: str):
        """Unsubscribe client from specific topic"""
        if topic in self.subscriptions:
            self.subscriptions[topic].discard(websocket)
        
        if websocket in self.connection_info:
            self.connection_info[websocket]["subscriptions"].discard(topic)
        
        logger.info(f"Client unsubscribed from topic: {topic}")
    
    async def send_telemetry_update(self, telemetry_data: Dict[str, Any]):
        """Send telemetry update to all telemetry subscribers"""
        message = {
            "type": "telemetry",
            "data": telemetry_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast(message, topic="telemetry")
    
    async def send_order_update(self, order_data: Dict[str, Any]):
        """Send order update to all order subscribers"""
        message = {
            "type": "order_update",
            "data": order_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast(message, topic="orders")
    
    async def send_mission_update(self, mission_data: Dict[str, Any]):
        """Send mission update to all mission subscribers"""
        message = {
            "type": "mission_update", 
            "data": mission_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast(message, topic="missions")
    
    async def send_alert(self, alert_data: Dict[str, Any], severity: str = "info"):
        """Send alert to all connected clients"""
        message = {
            "type": "alert",
            "severity": severity,
            "data": alert_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast(message, topic="alerts")
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection statistics"""
        topic_counts = {topic: len(connections) for topic, connections in self.subscriptions.items()}
        
        return {
            "total_connections": len(self.active_connections),
            "topic_subscriptions": topic_counts,
            "connection_details": [
                {
                    "client_id": info["client_id"],
                    "connected_at": info["connected_at"].isoformat(),
                    "subscriptions": list(info["subscriptions"])
                }
                for info in self.connection_info.values()
            ]
        }

# Global WebSocket manager instance
websocket_manager = WebSocketManager()

class TelemetryStreamer:
    """Handle real-time telemetry streaming"""
    
    def __init__(self, websocket_manager: WebSocketManager, drone_service):
        self.websocket_manager = websocket_manager
        self.drone_service = drone_service
        self.is_streaming = False
        self.stream_task = None
        
    async def start_streaming(self):
        """Start telemetry streaming"""
        if self.is_streaming:
            return
        
        self.is_streaming = True
        self.stream_task = asyncio.create_task(self._stream_telemetry())
        logger.info("Telemetry streaming started")
    
    async def stop_streaming(self):
        """Stop telemetry streaming"""
        self.is_streaming = False
        if self.stream_task:
            self.stream_task.cancel()
            try:
                await self.stream_task
            except asyncio.CancelledError:
                pass
        logger.info("Telemetry streaming stopped")
    
    async def _stream_telemetry(self):
        """Internal telemetry streaming loop"""
        while self.is_streaming:
            try:
                if self.drone_service.is_connected:
                    # Get current telemetry
                    telemetry = await self.drone_service.get_telemetry()
                    
                    # Send to WebSocket subscribers
                    await self.websocket_manager.send_telemetry_update(telemetry.dict())
                
                # Stream at configured interval
                from ..core.config import settings
                await asyncio.sleep(settings.telemetry_update_interval)
                
            except Exception as e:
                logger.error(f"Error in telemetry streaming: {e}")
                await asyncio.sleep(5)  # Wait before retrying