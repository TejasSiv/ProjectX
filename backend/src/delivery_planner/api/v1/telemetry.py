from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
import logging
import json

from ...models.telemetry import TelemetryResponse, SystemHealthResponse
from ...services.drone_service import DroneService
from ...utils.websocket import websocket_manager, TelemetryStreamer

logger = logging.getLogger(__name__)
router = APIRouter()

def get_drone_service() -> DroneService:
    """Dependency to get drone service from app state"""
    from ...main import app
    return app.state.drone_service

# Global telemetry streamer
telemetry_streamer = None

@router.get("/current", response_model=TelemetryResponse)
async def get_current_telemetry(
    drone_service: DroneService = Depends(get_drone_service)
):
    """Get current drone telemetry data"""
    try:
        if not drone_service.is_connected:
            raise HTTPException(status_code=503, detail="Drone not connected")
        
        telemetry = await drone_service.get_telemetry()
        return telemetry
    except Exception as e:
        logger.error(f"Failed to get telemetry: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve telemetry")

@router.get("/health", response_model=SystemHealthResponse)
async def get_system_health(
    drone_service: DroneService = Depends(get_drone_service)
):
    """Get drone system health"""
    try:
        if not drone_service.is_connected:
            raise HTTPException(status_code=503, detail="Drone not connected")
        
        health = await drone_service.get_system_health()
        return health
    except Exception as e:
        logger.error(f"Failed to get system health: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve system health")

@router.websocket("/ws")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time telemetry streaming"""
    global telemetry_streamer
    
    await websocket_manager.connect(websocket)
    
    try:
        # Start telemetry streaming if not already started
        if telemetry_streamer is None:
            from ...main import app
            drone_service = app.state.drone_service
            telemetry_streamer = TelemetryStreamer(websocket_manager, drone_service)
            await telemetry_streamer.start_streaming()
        
        while True:
            # Receive messages from client
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle client messages
                await handle_websocket_message(websocket, message)
                
            except json.JSONDecodeError:
                await websocket_manager.send_personal_message(
                    {"type": "error", "message": "Invalid JSON"}, 
                    websocket
                )
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}")
                
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        websocket_manager.disconnect(websocket)

async def handle_websocket_message(websocket: WebSocket, message: dict):
    """Handle incoming WebSocket messages from clients"""
    message_type = message.get("type")
    
    if message_type == "subscribe":
        # Subscribe to specific topics
        topics = message.get("topics", [])
        for topic in topics:
            websocket_manager.subscribe(websocket, topic)
        
        await websocket_manager.send_personal_message(
            {"type": "subscribed", "topics": topics},
            websocket
        )
        
    elif message_type == "unsubscribe":
        # Unsubscribe from topics
        topics = message.get("topics", [])
        for topic in topics:
            websocket_manager.unsubscribe(websocket, topic)
        
        await websocket_manager.send_personal_message(
            {"type": "unsubscribed", "topics": topics},
            websocket
        )
        
    elif message_type == "ping":
        # Heartbeat/ping message
        await websocket_manager.send_personal_message(
            {"type": "pong", "timestamp": message.get("timestamp")},
            websocket
        )
        
    elif message_type == "get_telemetry":
        # Request current telemetry
        try:
            from ...main import app
            drone_service = app.state.drone_service
            
            if drone_service.is_connected:
                telemetry = await drone_service.get_telemetry()
                await websocket_manager.send_personal_message(
                    {"type": "telemetry", "data": telemetry.dict()},
                    websocket
                )
            else:
                await websocket_manager.send_personal_message(
                    {"type": "error", "message": "Drone not connected"},
                    websocket
                )
        except Exception as e:
            await websocket_manager.send_personal_message(
                {"type": "error", "message": f"Failed to get telemetry: {str(e)}"},
                websocket
            )
    
    else:
        await websocket_manager.send_personal_message(
            {"type": "error", "message": f"Unknown message type: {message_type}"},
            websocket
        )

@router.get("/connections/stats")
async def get_connection_stats():
    """Get WebSocket connection statistics"""
    try:
        return websocket_manager.get_connection_stats()
    except Exception as e:
        logger.error(f"Failed to get connection stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve connection stats")

@router.post("/broadcast")
async def broadcast_message(message: dict):
    """Broadcast message to all connected WebSocket clients (admin endpoint)"""
    try:
        await websocket_manager.broadcast(message)
        return {"status": "Message broadcast successfully"}
    except Exception as e:
        logger.error(f"Failed to broadcast message: {e}")
        raise HTTPException(status_code=500, detail="Failed to broadcast message")