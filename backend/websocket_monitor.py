#!/usr/bin/env python3
"""
Real-time WebSocket monitor for multi-drone telemetry.
Shows live updates from all drones.
"""

import asyncio
import websockets
import json
from datetime import datetime

class TelemetryMonitor:
    def __init__(self, websocket_url="ws://localhost:8000/ws/telemetry"):
        self.websocket_url = websocket_url
        self.drone_data = {}
        
    async def connect_and_monitor(self):
        """Connect to WebSocket and monitor telemetry."""
        print("🔌 Connecting to telemetry WebSocket...")
        print(f"URL: {self.websocket_url}")
        print("=" * 60)
        
        try:
            async with websockets.connect(self.websocket_url) as websocket:
                print("✅ Connected! Monitoring telemetry data...\n")
                
                async for message in websocket:
                    try:
                        data = json.loads(message)
                        await self.process_message(data)
                    except json.JSONDecodeError:
                        print(f"❌ Failed to decode message: {message}")
                    except Exception as e:
                        print(f"❌ Error processing message: {e}")
                        
        except Exception as e:
            print(f"❌ WebSocket connection failed: {e}")
            print("\nMake sure the backend server is running on http://localhost:8000")
            
    async def process_message(self, data):
        """Process incoming telemetry message."""
        message_type = data.get("type")
        
        if message_type == "telemetry":
            await self.handle_telemetry(data.get("data", {}))
        elif message_type == "status_update":
            await self.handle_status_update(data.get("data", {}))
        else:
            print(f"📨 Unknown message type: {message_type}")
            
    async def handle_telemetry(self, telemetry_data):
        """Handle telemetry data updates."""
        order_id = telemetry_data.get("order_id", "unknown")
        timestamp = telemetry_data.get("timestamp", "")
        
        # Extract drone info from order_id or use order_id as drone identifier
        if order_id.startswith("standby_"):
            drone_id = order_id.replace("standby_", "")
            mission_status = "🟡 STANDBY"
        else:
            # Try to find which drone is handling this order
            drone_id = f"order_{order_id[:8]}"
            mission_status = "🟢 ACTIVE"
            
        # Update drone data
        self.drone_data[drone_id] = {
            "order_id": order_id,
            "latitude": telemetry_data.get("latitude", 0),
            "longitude": telemetry_data.get("longitude", 0),
            "altitude": telemetry_data.get("altitude", 0),
            "ground_speed": telemetry_data.get("ground_speed", 0),
            "battery": telemetry_data.get("battery_remaining", 0),
            "progress": telemetry_data.get("mission_progress", 0),
            "status": mission_status,
            "last_update": datetime.now().strftime("%H:%M:%S")
        }
        
        # Display live telemetry
        self.display_telemetry()
        
    async def handle_status_update(self, status_data):
        """Handle status update messages."""
        order_id = status_data.get("order_id", "unknown")
        status = status_data.get("status", "unknown")
        message = status_data.get("message", "")
        
        print(f"📢 Status Update: Order {order_id[:8]}... → {status}")
        if message:
            print(f"   Message: {message}")
        print()
        
    def display_telemetry(self):
        """Display current telemetry in a nice format."""
        # Clear screen (works on most terminals)
        print("\033[2J\033[H", end="")
        
        print("🚁 MULTI-DRONE TELEMETRY MONITOR")
        print("=" * 80)
        print(f"📡 Live Updates - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)
        
        if not self.drone_data:
            print("⏳ Waiting for telemetry data...")
            return
            
        # Header
        print(f"{'DRONE':<15} {'STATUS':<12} {'POSITION':<25} {'ALT':<8} {'SPEED':<8} {'BAT':<6} {'PROG':<6} {'TIME':<8}")
        print("-" * 80)
        
        # Sort drones for consistent display
        for drone_id in sorted(self.drone_data.keys()):
            data = self.drone_data[drone_id]
            
            # Format position
            lat = data['latitude']
            lon = data['longitude']
            position = f"{lat:.6f}, {lon:.6f}"
            
            # Format other fields
            altitude = f"{data['altitude']:.1f}m"
            speed = f"{data['ground_speed']:.1f}m/s"
            battery = f"{data['battery']:.0%}"
            progress = f"{data['progress']:.0%}"
            
            print(f"{drone_id:<15} {data['status']:<12} {position:<25} {altitude:<8} {speed:<8} {battery:<6} {progress:<6} {data['last_update']:<8}")
            
        print("-" * 80)
        print(f"Active Drones: {len(self.drone_data)} | Press Ctrl+C to exit")


async def main():
    """Main monitor function."""
    print("🚁 Multi-Drone Telemetry Monitor")
    print("Real-time monitoring of all drone telemetry data")
    print()
    
    monitor = TelemetryMonitor()
    
    try:
        await monitor.connect_and_monitor()
    except KeyboardInterrupt:
        print("\n👋 Monitor stopped by user")
    except Exception as e:
        print(f"\n❌ Monitor error: {e}")


if __name__ == "__main__":
    # Install websockets if not available
    try:
        import websockets
    except ImportError:
        print("❌ websockets library not found. Install it with:")
        print("pip install websockets")
        exit(1)
        
    asyncio.run(main())