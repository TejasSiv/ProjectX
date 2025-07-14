import asyncio
from typing import Dict, Optional, Callable
from datetime import datetime, timezone
import json

from .mission_runner import mission_runner, DronePosition
from ..core.schemas import TelemetryData, StatusUpdate
from ..core.logger import mission_logger


class TelemetryListener:
    """Listens to drone telemetry and broadcasts updates."""
    
    def __init__(self):
        self.is_listening = False
        self.order_missions: Dict[str, bool] = {}  # order_id -> is_active
        self.telemetry_callbacks: list[Callable[[TelemetryData], None]] = []
        self.status_callbacks: list[Callable[[StatusUpdate], None]] = []
        
    def add_telemetry_callback(self, callback: Callable[[TelemetryData], None]):
        """Add a callback for telemetry data."""
        self.telemetry_callbacks.append(callback)
        
    def add_status_callback(self, callback: Callable[[StatusUpdate], None]):
        """Add a callback for status updates."""
        self.status_callbacks.append(callback)
        
    def remove_callback(self, callback):
        """Remove a callback."""
        if callback in self.telemetry_callbacks:
            self.telemetry_callbacks.remove(callback)
        if callback in self.status_callbacks:
            self.status_callbacks.remove(callback)
            
    async def start_listening(self):
        """Start listening to telemetry data."""
        if self.is_listening:
            return
            
        self.is_listening = True
        mission_logger.info("Starting telemetry listener")
        
        # Start telemetry monitoring task
        asyncio.create_task(self._telemetry_loop())
        
    async def stop_listening(self):
        """Stop listening to telemetry data."""
        self.is_listening = False
        mission_logger.info("Stopping telemetry listener")
        
    def start_mission_monitoring(self, order_id: str):
        """Start monitoring a specific mission."""
        self.order_missions[order_id] = True
        mission_logger.info(f"Started monitoring mission for order {order_id}")
        
        # Send initial status update
        self._broadcast_status_update(StatusUpdate(
            order_id=order_id,
            status="in_flight",
            message="Mission started"
        ))
        
    def stop_mission_monitoring(self, order_id: str):
        """Stop monitoring a specific mission."""
        if order_id in self.order_missions:
            del self.order_missions[order_id]
            mission_logger.info(f"Stopped monitoring mission for order {order_id}")
            
    async def _telemetry_loop(self):
        """Main telemetry monitoring loop."""
        while self.is_listening:
            try:
                # Get current drone position
                position = await mission_runner.get_position()
                
                if position and self.order_missions:
                    # Create telemetry data for active missions
                    for order_id in list(self.order_missions.keys()):
                        telemetry = TelemetryData(
                            order_id=order_id,
                            latitude=position.latitude,
                            longitude=position.longitude,
                            altitude=position.altitude,
                            ground_speed=position.ground_speed,
                            heading=position.heading,
                            battery_remaining=position.battery_remaining,
                            mission_progress=await self._calculate_mission_progress(order_id),
                            timestamp=datetime.now(timezone.utc)
                        )
                        
                        # Broadcast telemetry data
                        self._broadcast_telemetry(telemetry)
                        
                        # Check if mission is complete
                        if await mission_runner.is_mission_complete():
                            self._broadcast_status_update(StatusUpdate(
                                order_id=order_id,
                                status="completed",
                                message="Mission completed successfully"
                            ))
                            self.stop_mission_monitoring(order_id)
                            
                # Sleep before next update
                await asyncio.sleep(1.0)
                
            except Exception as e:
                mission_logger.error(f"Error in telemetry loop: {str(e)}")
                await asyncio.sleep(1.0)
                
    async def _calculate_mission_progress(self, order_id: str) -> float:
        """Calculate mission progress (0.0 to 1.0)."""
        try:
            # In a real implementation, this would calculate based on 
            # current position vs mission waypoints
            # For now, return a simple simulation
            import time
            if not hasattr(self, '_mission_start_times'):
                self._mission_start_times = {}
                
            if order_id not in self._mission_start_times:
                self._mission_start_times[order_id] = time.time()
                
            elapsed = time.time() - self._mission_start_times[order_id]
            # Assume 5 minute missions for simulation
            progress = min(elapsed / 300.0, 1.0)
            
            return progress
            
        except Exception as e:
            mission_logger.error(f"Error calculating mission progress: {str(e)}")
            return 0.0
            
    def _broadcast_telemetry(self, telemetry: TelemetryData):
        """Broadcast telemetry data to all callbacks."""
        for callback in self.telemetry_callbacks:
            try:
                callback(telemetry)
            except Exception as e:
                mission_logger.error(f"Error in telemetry callback: {str(e)}")
                
    def _broadcast_status_update(self, status: StatusUpdate):
        """Broadcast status update to all callbacks."""
        mission_logger.info(f"Status update for order {status.order_id}: {status.status}")
        
        for callback in self.status_callbacks:
            try:
                callback(status)
            except Exception as e:
                mission_logger.error(f"Error in status callback: {str(e)}")


class WebSocketBroadcaster:
    """WebSocket broadcaster for real-time updates."""
    
    def __init__(self):
        self.connections: set = set()
        
    def add_connection(self, websocket):
        """Add a WebSocket connection."""
        self.connections.add(websocket)
        mission_logger.info(f"Added WebSocket connection. Total: {len(self.connections)}")
        
    def remove_connection(self, websocket):
        """Remove a WebSocket connection."""
        self.connections.discard(websocket)
        mission_logger.info(f"Removed WebSocket connection. Total: {len(self.connections)}")
        
    async def broadcast_telemetry(self, telemetry: TelemetryData):
        """Broadcast telemetry data to all connected clients."""
        if not self.connections:
            return
            
        message = {
            "type": "telemetry",
            "data": telemetry.dict()
        }
        
        await self._broadcast_message(message)
        
    async def broadcast_status(self, status: StatusUpdate):
        """Broadcast status update to all connected clients."""
        if not self.connections:
            return
            
        message = {
            "type": "status_update",
            "data": status.dict()
        }
        
        await self._broadcast_message(message)
        
    async def _broadcast_message(self, message: dict):
        """Broadcast a message to all connections."""
        if not self.connections:
            return
            
        message_str = json.dumps(message, default=str)
        disconnected = set()
        
        for websocket in self.connections.copy():
            try:
                await websocket.send_text(message_str)
            except Exception as e:
                mission_logger.warning(f"Failed to send to WebSocket: {str(e)}")
                disconnected.add(websocket)
                
        # Remove disconnected websockets
        for websocket in disconnected:
            self.connections.discard(websocket)


# Global instances
telemetry_listener = TelemetryListener()
websocket_broadcaster = WebSocketBroadcaster()

# Connect telemetry listener to WebSocket broadcaster
telemetry_listener.add_telemetry_callback(
    lambda data: asyncio.create_task(websocket_broadcaster.broadcast_telemetry(data))
)
telemetry_listener.add_status_callback(
    lambda status: asyncio.create_task(websocket_broadcaster.broadcast_status(status))
)