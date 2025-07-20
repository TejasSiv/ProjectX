import asyncio
import uuid
from typing import Dict, List, Optional, Set
from dataclasses import dataclass
from enum import Enum

try:
    from mavsdk import System
    MAVSDK_AVAILABLE = True
except ImportError:
    MAVSDK_AVAILABLE = False

from ..core.config import settings
from ..core.schemas import OrderResponse, TelemetryData, StatusUpdate
from ..core.logger import mission_logger


class DroneStatus(str, Enum):
    """Drone status enumeration."""
    IDLE = "idle"
    ARMED = "armed"
    IN_FLIGHT = "in_flight"
    MISSION_ACTIVE = "mission_active"
    RETURNING = "returning"
    LANDING = "landing"
    ERROR = "error"
    OFFLINE = "offline"


@dataclass
class DroneConfig:
    """Configuration for a single drone."""
    drone_id: str
    mavlink_port: int
    system_address: str
    home_lat: float
    home_lon: float
    home_alt: float
    name: Optional[str] = None


@dataclass
class DroneInfo:
    """Information about a drone instance."""
    config: DroneConfig
    status: DroneStatus
    current_order_id: Optional[str] = None
    battery_level: float = 1.0
    last_position: Optional[tuple] = None  # (lat, lon, alt)
    is_connected: bool = False
    system: Optional['System'] = None


class DroneFleetManager:
    """Manages a fleet of multiple drones for delivery missions."""
    
    def __init__(self):
        self.drones: Dict[str, DroneInfo] = {}
        self.order_assignments: Dict[str, str] = {}  # order_id -> drone_id
        self.is_initialized = False
        self._connection_tasks: Dict[str, asyncio.Task] = {}
        
    async def initialize_fleet(self, drone_configs: List[DroneConfig]):
        """Initialize the drone fleet with given configurations."""
        mission_logger.info(f"Initializing fleet with {len(drone_configs)} drones")
        
        for config in drone_configs:
            drone_info = DroneInfo(
                config=config,
                status=DroneStatus.OFFLINE
            )
            self.drones[config.drone_id] = drone_info
            
            # Start connection task for each drone
            self._connection_tasks[config.drone_id] = asyncio.create_task(
                self._connect_drone(config.drone_id)
            )
        
        self.is_initialized = True
        mission_logger.info("Fleet initialization started")
        
    async def _connect_drone(self, drone_id: str) -> bool:
        """Connect to a specific drone."""
        drone_info = self.drones[drone_id]
        config = drone_info.config
        
        if not MAVSDK_AVAILABLE:
            mission_logger.warning(f"MAVSDK not available for drone {drone_id}, running in simulation mode")
            drone_info.status = DroneStatus.IDLE
            drone_info.is_connected = True
            return True
            
        try:
            system = System()
            await system.connect(system_address=config.system_address)
            
            mission_logger.info(f"Waiting for drone {drone_id} to connect...")
            async for state in system.core.connection_state():
                if state.is_connected:
                    mission_logger.info(f"Drone {drone_id} connected!")
                    drone_info.system = system
                    drone_info.is_connected = True
                    drone_info.status = DroneStatus.IDLE
                    
                    # Start telemetry monitoring
                    asyncio.create_task(self._monitor_drone_telemetry(drone_id))
                    return True
                    
        except Exception as e:
            mission_logger.error(f"Failed to connect to drone {drone_id}: {str(e)}")
            drone_info.status = DroneStatus.ERROR
            return False
            
    async def _monitor_drone_telemetry(self, drone_id: str):
        """Monitor telemetry for a specific drone."""
        drone_info = self.drones[drone_id]
        
        while drone_info.is_connected:
            try:
                if MAVSDK_AVAILABLE and drone_info.system:
                    # Get real telemetry data
                    async for position in drone_info.system.telemetry.position():
                        async for battery in drone_info.system.telemetry.battery():
                            drone_info.last_position = (
                                position.latitude_deg,
                                position.longitude_deg,
                                position.absolute_altitude_m
                            )
                            drone_info.battery_level = battery.remaining_percent
                            break
                        break
                else:
                    # Simulate telemetry data
                    config = drone_info.config
                    drone_info.last_position = (config.home_lat, config.home_lon, config.home_alt)
                    drone_info.battery_level = max(0.1, drone_info.battery_level - 0.001)
                
                await asyncio.sleep(1.0)
                
            except Exception as e:
                mission_logger.error(f"Error monitoring telemetry for drone {drone_id}: {str(e)}")
                await asyncio.sleep(5.0)
                
    def get_available_drone(self) -> Optional[str]:
        """Get the ID of an available drone for mission assignment."""
        for drone_id, drone_info in self.drones.items():
            if (drone_info.status == DroneStatus.IDLE and 
                drone_info.is_connected and 
                drone_info.battery_level > 0.2):  # At least 20% battery
                return drone_id
        return None
        
    def assign_order_to_drone(self, order_id: str, drone_id: str) -> bool:
        """Assign an order to a specific drone."""
        if drone_id not in self.drones:
            mission_logger.error(f"Drone {drone_id} not found")
            return False
            
        drone_info = self.drones[drone_id]
        if drone_info.status != DroneStatus.IDLE:
            mission_logger.error(f"Drone {drone_id} is not available (status: {drone_info.status})")
            return False
            
        self.order_assignments[order_id] = drone_id
        drone_info.current_order_id = order_id
        drone_info.status = DroneStatus.ARMED
        
        mission_logger.info(f"Assigned order {order_id} to drone {drone_id}")
        return True
        
    def get_drone_for_order(self, order_id: str) -> Optional[str]:
        """Get the drone ID assigned to an order."""
        return self.order_assignments.get(order_id)
        
    def release_drone_from_order(self, order_id: str):
        """Release a drone from an order assignment."""
        if order_id in self.order_assignments:
            drone_id = self.order_assignments[order_id]
            drone_info = self.drones[drone_id]
            
            drone_info.current_order_id = None
            drone_info.status = DroneStatus.IDLE
            
            del self.order_assignments[order_id]
            mission_logger.info(f"Released drone {drone_id} from order {order_id}")
            
    def get_drone_status(self, drone_id: str) -> Optional[DroneStatus]:
        """Get the status of a specific drone."""
        drone_info = self.drones.get(drone_id)
        return drone_info.status if drone_info else None
        
    def update_drone_status(self, drone_id: str, status: DroneStatus):
        """Update the status of a specific drone."""
        if drone_id in self.drones:
            self.drones[drone_id].status = status
            mission_logger.info(f"Updated drone {drone_id} status to {status}")
            
    def get_all_drones_status(self) -> Dict[str, Dict]:
        """Get status information for all drones."""
        status_info = {}
        for drone_id, drone_info in self.drones.items():
            status_info[drone_id] = {
                "status": drone_info.status.value,
                "is_connected": drone_info.is_connected,
                "battery_level": drone_info.battery_level,
                "current_order_id": drone_info.current_order_id,
                "last_position": drone_info.last_position,
                "name": drone_info.config.name or drone_id,
                "mavlink_port": drone_info.config.mavlink_port
            }
        return status_info
        
    def get_fleet_statistics(self) -> Dict:
        """Get fleet-wide statistics."""
        total_drones = len(self.drones)
        online_drones = sum(1 for d in self.drones.values() if d.is_connected)
        active_missions = sum(1 for d in self.drones.values() if d.current_order_id is not None)
        avg_battery = sum(d.battery_level for d in self.drones.values()) / total_drones if total_drones > 0 else 0
        
        return {
            "total_drones": total_drones,
            "online_drones": online_drones,
            "offline_drones": total_drones - online_drones,
            "active_missions": active_missions,
            "available_drones": sum(1 for d in self.drones.values() 
                                  if d.status == DroneStatus.IDLE and d.is_connected),
            "average_battery_level": avg_battery
        }
        
    async def shutdown_fleet(self):
        """Shutdown all drones and cleanup connections."""
        mission_logger.info("Shutting down drone fleet")
        
        # Cancel all connection tasks
        for task in self._connection_tasks.values():
            if not task.done():
                task.cancel()
                
        # Disconnect all drones
        for drone_info in self.drones.values():
            drone_info.is_connected = False
            drone_info.status = DroneStatus.OFFLINE
            
        mission_logger.info("Fleet shutdown complete")


def create_default_fleet_config() -> List[DroneConfig]:
    """Create a default fleet configuration with multiple drones."""
    base_port = 14540
    base_lat = settings.px4_home_lat
    base_lon = settings.px4_home_lon
    
    configs = []
    
    # Create 4 drones with different MAVLink ports and slight position offsets
    drone_configs = [
        {"name": "Alpha", "port_offset": 0, "lat_offset": 0.0, "lon_offset": 0.0},
        {"name": "Bravo", "port_offset": 1, "lat_offset": 0.001, "lon_offset": 0.001},
        {"name": "Charlie", "port_offset": 2, "lat_offset": -0.001, "lon_offset": 0.001},
        {"name": "Delta", "port_offset": 3, "lat_offset": 0.001, "lon_offset": -0.001},
    ]
    
    for i, drone_config in enumerate(drone_configs):
        drone_id = f"drone_{i+1}"
        mavlink_port = base_port + drone_config["port_offset"]
        
        config = DroneConfig(
            drone_id=drone_id,
            mavlink_port=mavlink_port,
            system_address=f"udp://:{mavlink_port}",
            home_lat=base_lat + drone_config["lat_offset"],
            home_lon=base_lon + drone_config["lon_offset"],
            home_alt=settings.px4_home_alt,
            name=drone_config["name"]
        )
        configs.append(config)
        
    return configs


# Global fleet manager instance
fleet_manager = DroneFleetManager()