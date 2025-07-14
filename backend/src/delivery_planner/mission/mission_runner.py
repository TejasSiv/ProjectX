import asyncio
import math
from typing import List, Optional, Tuple
from dataclasses import dataclass

try:
    from mavsdk import System
    from mavsdk.mission import MissionItem, MissionPlan
    from mavsdk.offboard import VelocityBodyYawspeed
    MAVSDK_AVAILABLE = True
except ImportError:
    MAVSDK_AVAILABLE = False

from ..core.config import settings
from ..core.schemas import MissionWaypoint, OrderResponse
from ..core.logger import mission_logger


@dataclass
class DronePosition:
    """Current drone position and status."""
    latitude: float
    longitude: float
    altitude: float
    heading: float
    ground_speed: float
    battery_remaining: float


class MissionRunner:
    """Handles drone mission creation and execution via MAVSDK."""
    
    def __init__(self):
        self.drone_system: Optional[System] = None
        self.is_connected = False
        self.current_mission: Optional[str] = None
        
    async def connect(self) -> bool:
        """Connect to the drone system."""
        if not MAVSDK_AVAILABLE:
            mission_logger.warning("MAVSDK not available, running in simulation mode")
            return True
            
        try:
            self.drone_system = System()
            await self.drone_system.connect(system_address=settings.mavsdk_system_address)
            
            mission_logger.info("Waiting for drone to connect...")
            async for state in self.drone_system.core.connection_state():
                if state.is_connected:
                    mission_logger.info("Drone connected!")
                    self.is_connected = True
                    return True
                    
        except Exception as e:
            mission_logger.error(f"Failed to connect to drone: {str(e)}")
            return False
            
    async def disconnect(self):
        """Disconnect from the drone system."""
        if self.drone_system and self.is_connected:
            self.is_connected = False
            mission_logger.info("Disconnected from drone")
            
    def create_mission_waypoints(self, order: OrderResponse) -> List[MissionWaypoint]:
        """Create mission waypoints from order coordinates."""
        waypoints = []
        
        # Takeoff waypoint at pickup location
        waypoints.append(MissionWaypoint(
            latitude=order.pickup_lat,
            longitude=order.pickup_lon,
            altitude=settings.mission_altitude,
            action="takeoff"
        ))
        
        # Navigate to pickup location
        waypoints.append(MissionWaypoint(
            latitude=order.pickup_lat,
            longitude=order.pickup_lon,
            altitude=settings.mission_altitude,
            speed=settings.mission_speed,
            action="waypoint"
        ))
        
        # Navigate to dropoff location
        waypoints.append(MissionWaypoint(
            latitude=order.dropoff_lat,
            longitude=order.dropoff_lon,
            altitude=settings.mission_altitude,
            speed=settings.mission_speed,
            action="waypoint"
        ))
        
        # Land at dropoff location
        waypoints.append(MissionWaypoint(
            latitude=order.dropoff_lat,
            longitude=order.dropoff_lon,
            altitude=0,
            action="land"
        ))
        
        return waypoints
        
    def _waypoint_to_mission_item(self, waypoint: MissionWaypoint, sequence: int) -> 'MissionItem':
        """Convert waypoint to MAVSDK MissionItem."""
        if not MAVSDK_AVAILABLE:
            return None
            
        if waypoint.action == "takeoff":
            return MissionItem(
                sequence,
                6,  # MAV_FRAME_GLOBAL_RELATIVE_ALT
                22,  # MAV_CMD_NAV_TAKEOFF
                True, False,
                15.0, 0, 0, float('nan'),  # pitch, yaw, lat, lon
                waypoint.latitude,
                waypoint.longitude,
                waypoint.altitude
            )
        elif waypoint.action == "land":
            return MissionItem(
                sequence,
                6,  # MAV_FRAME_GLOBAL_RELATIVE_ALT
                21,  # MAV_CMD_NAV_LAND
                True, False,
                0, 0, 0, float('nan'),
                waypoint.latitude,
                waypoint.longitude,
                0
            )
        else:  # waypoint
            return MissionItem(
                sequence,
                6,  # MAV_FRAME_GLOBAL_RELATIVE_ALT
                16,  # MAV_CMD_NAV_WAYPOINT
                True, False,
                0, 0, 0, float('nan'),
                waypoint.latitude,
                waypoint.longitude,
                waypoint.altitude
            )
            
    async def upload_mission(self, order: OrderResponse) -> bool:
        """Upload mission to the drone."""
        if not MAVSDK_AVAILABLE:
            mission_logger.info(f"Simulating mission upload for order {order.id}")
            self.current_mission = order.id
            return True
            
        if not self.is_connected:
            mission_logger.error("Drone not connected")
            return False
            
        try:
            waypoints = self.create_mission_waypoints(order)
            mission_items = []
            
            for i, waypoint in enumerate(waypoints):
                mission_item = self._waypoint_to_mission_item(waypoint, i)
                if mission_item:
                    mission_items.append(mission_item)
            
            mission_plan = MissionPlan(mission_items)
            
            mission_logger.info(f"Uploading mission for order {order.id}")
            await self.drone_system.mission.upload_mission(mission_plan)
            
            self.current_mission = order.id
            mission_logger.info(f"Mission uploaded successfully for order {order.id}")
            return True
            
        except Exception as e:
            mission_logger.error(f"Failed to upload mission for order {order.id}: {str(e)}")
            return False
            
    async def start_mission(self) -> bool:
        """Start the uploaded mission."""
        if not MAVSDK_AVAILABLE:
            mission_logger.info(f"Simulating mission start for order {self.current_mission}")
            return True
            
        if not self.is_connected or not self.current_mission:
            mission_logger.error("No mission to start or drone not connected")
            return False
            
        try:
            mission_logger.info("Arming drone...")
            await self.drone_system.action.arm()
            
            mission_logger.info("Starting mission...")
            await self.drone_system.mission.start_mission()
            
            mission_logger.info(f"Mission started for order {self.current_mission}")
            return True
            
        except Exception as e:
            mission_logger.error(f"Failed to start mission: {str(e)}")
            return False
            
    async def get_position(self) -> Optional[DronePosition]:
        """Get current drone position and status."""
        if not MAVSDK_AVAILABLE:
            # Return simulated position
            return DronePosition(
                latitude=settings.px4_home_lat,
                longitude=settings.px4_home_lon,
                altitude=settings.mission_altitude,
                heading=0.0,
                ground_speed=settings.mission_speed,
                battery_remaining=0.8
            )
            
        if not self.is_connected:
            return None
            
        try:
            async for position in self.drone_system.telemetry.position():
                async for battery in self.drone_system.telemetry.battery():
                    async for velocity in self.drone_system.telemetry.velocity_ned():
                        ground_speed = math.sqrt(velocity.north_m_s**2 + velocity.east_m_s**2)
                        
                        return DronePosition(
                            latitude=position.latitude_deg,
                            longitude=position.longitude_deg,
                            altitude=position.absolute_altitude_m,
                            heading=0.0,  # Would need attitude telemetry
                            ground_speed=ground_speed,
                            battery_remaining=battery.remaining_percent
                        )
                        
        except Exception as e:
            mission_logger.error(f"Failed to get drone position: {str(e)}")
            return None
            
    async def is_mission_complete(self) -> bool:
        """Check if the current mission is complete."""
        if not MAVSDK_AVAILABLE:
            # Simulate mission completion after some time
            await asyncio.sleep(1)
            return False
            
        if not self.is_connected:
            return True
            
        try:
            async for mission_progress in self.drone_system.mission.mission_progress():
                return mission_progress.current == mission_progress.total and mission_progress.total > 0
                
        except Exception as e:
            mission_logger.error(f"Failed to check mission progress: {str(e)}")
            return True
            
    async def abort_mission(self) -> bool:
        """Abort the current mission and return to launch."""
        if not MAVSDK_AVAILABLE:
            mission_logger.info("Simulating mission abort")
            self.current_mission = None
            return True
            
        if not self.is_connected:
            return False
            
        try:
            mission_logger.info("Aborting mission...")
            await self.drone_system.action.return_to_launch()
            self.current_mission = None
            return True
            
        except Exception as e:
            mission_logger.error(f"Failed to abort mission: {str(e)}")
            return False


# Global mission runner instance
mission_runner = MissionRunner()