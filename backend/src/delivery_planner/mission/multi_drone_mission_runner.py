import asyncio
import math
from typing import List, Optional, Dict
from dataclasses import dataclass

try:
    from mavsdk import System
    from mavsdk.mission import MissionItem, MissionPlan
    from mavsdk.offboard import VelocityBodyYawspeed
    MAVSDK_AVAILABLE = True
except ImportError:
    MAVSDK_AVAILABLE = False

from ..core.config import settings
from ..core.schemas import MissionWaypoint, OrderResponse, TelemetryData
from ..core.logger import mission_logger
from .drone_fleet_manager import fleet_manager, DroneStatus


@dataclass
class DronePosition:
    """Current drone position and status."""
    drone_id: str
    latitude: float
    longitude: float
    altitude: float
    heading: float
    ground_speed: float
    battery_remaining: float


class MultiDroneMissionRunner:
    """Handles mission execution for multiple drones simultaneously."""
    
    def __init__(self):
        self.active_missions: Dict[str, str] = {}  # order_id -> drone_id
        self.mission_tasks: Dict[str, asyncio.Task] = {}  # order_id -> task
        
    async def execute_order_mission(self, order: OrderResponse) -> bool:
        """Execute a mission for an order using an available drone."""
        # Get an available drone
        drone_id = fleet_manager.get_available_drone()
        if not drone_id:
            mission_logger.warning(f"No available drones for order {order.id}")
            return False
            
        # Assign the order to the drone
        if not fleet_manager.assign_order_to_drone(order.id, drone_id):
            mission_logger.error(f"Failed to assign order {order.id} to drone {drone_id}")
            return False
            
        # Start mission execution task
        mission_task = asyncio.create_task(self._execute_mission_for_drone(order, drone_id))
        self.mission_tasks[order.id] = mission_task
        self.active_missions[order.id] = drone_id
        
        mission_logger.info(f"Started mission execution for order {order.id} on drone {drone_id}")
        return True
        
    async def _execute_mission_for_drone(self, order: OrderResponse, drone_id: str):
        """Execute a mission on a specific drone."""
        try:
            drone_info = fleet_manager.drones[drone_id]
            
            # Update drone status
            fleet_manager.update_drone_status(drone_id, DroneStatus.ARMED)
            
            # Create mission waypoints
            waypoints = self.create_mission_waypoints(order)
            
            # Upload and start mission
            if await self._upload_mission_to_drone(drone_id, order, waypoints):
                fleet_manager.update_drone_status(drone_id, DroneStatus.IN_FLIGHT)
                
                if await self._start_mission_on_drone(drone_id):
                    fleet_manager.update_drone_status(drone_id, DroneStatus.MISSION_ACTIVE)
                    
                    # Monitor mission progress
                    await self._monitor_mission_progress(order.id, drone_id)
                else:
                    mission_logger.error(f"Failed to start mission on drone {drone_id}")
                    fleet_manager.update_drone_status(drone_id, DroneStatus.ERROR)
            else:
                mission_logger.error(f"Failed to upload mission to drone {drone_id}")
                fleet_manager.update_drone_status(drone_id, DroneStatus.ERROR)
                
        except Exception as e:
            mission_logger.error(f"Mission execution failed for order {order.id} on drone {drone_id}: {str(e)}")
            fleet_manager.update_drone_status(drone_id, DroneStatus.ERROR)
        finally:
            # Clean up mission
            self._cleanup_mission(order.id, drone_id)
            
    def create_mission_waypoints(self, order: OrderResponse) -> List[MissionWaypoint]:
        """Create mission waypoints from order coordinates."""
        waypoints = []
        
        # Extract coordinates from order
        pickup_lat, pickup_lon = order.pickup_coords
        dropoff_lat, dropoff_lon = order.dropoff_coords
        
        # Takeoff waypoint at pickup location
        waypoints.append(MissionWaypoint(
            latitude=pickup_lat,
            longitude=pickup_lon,
            altitude=settings.mission_altitude,
            action="takeoff"
        ))
        
        # Navigate to pickup location
        waypoints.append(MissionWaypoint(
            latitude=pickup_lat,
            longitude=pickup_lon,
            altitude=settings.mission_altitude,
            speed=settings.mission_speed,
            action="waypoint"
        ))
        
        # Navigate to dropoff location
        waypoints.append(MissionWaypoint(
            latitude=dropoff_lat,
            longitude=dropoff_lon,
            altitude=settings.mission_altitude,
            speed=settings.mission_speed,
            action="waypoint"
        ))
        
        # Land at dropoff location
        waypoints.append(MissionWaypoint(
            latitude=dropoff_lat,
            longitude=dropoff_lon,
            altitude=0,
            action="land"
        ))
        
        return waypoints
        
    async def _upload_mission_to_drone(self, drone_id: str, order: OrderResponse, waypoints: List[MissionWaypoint]) -> bool:
        """Upload mission to a specific drone."""
        if not MAVSDK_AVAILABLE:
            mission_logger.info(f"Simulating mission upload for order {order.id} on drone {drone_id}")
            return True
            
        drone_info = fleet_manager.drones[drone_id]
        if not drone_info.is_connected or not drone_info.system:
            mission_logger.error(f"Drone {drone_id} not connected")
            return False
            
        try:
            mission_items = []
            
            for i, waypoint in enumerate(waypoints):
                mission_item = self._waypoint_to_mission_item(waypoint, i)
                if mission_item:
                    mission_items.append(mission_item)
            
            mission_plan = MissionPlan(mission_items)
            
            mission_logger.info(f"Uploading mission for order {order.id} to drone {drone_id}")
            await drone_info.system.mission.upload_mission(mission_plan)
            
            mission_logger.info(f"Mission uploaded successfully for order {order.id} to drone {drone_id}")
            return True
            
        except Exception as e:
            mission_logger.error(f"Failed to upload mission for order {order.id} to drone {drone_id}: {str(e)}")
            return False
            
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
                15.0, 0, 0, float('nan'),
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
            
    async def _start_mission_on_drone(self, drone_id: str) -> bool:
        """Start the uploaded mission on a specific drone."""
        if not MAVSDK_AVAILABLE:
            mission_logger.info(f"Simulating mission start on drone {drone_id}")
            return True
            
        drone_info = fleet_manager.drones[drone_id]
        if not drone_info.is_connected or not drone_info.system:
            mission_logger.error(f"Drone {drone_id} not connected")
            return False
            
        try:
            mission_logger.info(f"Arming drone {drone_id}...")
            await drone_info.system.action.arm()
            
            mission_logger.info(f"Starting mission on drone {drone_id}...")
            await drone_info.system.mission.start_mission()
            
            mission_logger.info(f"Mission started on drone {drone_id}")
            return True
            
        except Exception as e:
            mission_logger.error(f"Failed to start mission on drone {drone_id}: {str(e)}")
            return False
            
    async def _monitor_mission_progress(self, order_id: str, drone_id: str):
        """Monitor mission progress for a specific order and drone."""
        mission_start_time = asyncio.get_event_loop().time()
        
        while order_id in self.active_missions:
            try:
                # Check if mission is complete
                if await self._is_mission_complete_on_drone(drone_id):
                    mission_logger.info(f"Mission completed for order {order_id} on drone {drone_id}")
                    fleet_manager.update_drone_status(drone_id, DroneStatus.RETURNING)
                    
                    # Wait a bit for landing/RTL
                    await asyncio.sleep(5.0)
                    break
                    
                # Update telemetry
                position = await self.get_drone_position(drone_id)
                if position:
                    # Calculate mission progress (simplified)
                    elapsed_time = asyncio.get_event_loop().time() - mission_start_time
                    progress = min(elapsed_time / 300.0, 1.0)  # 5 min estimated mission
                    
                    # You could emit telemetry events here for real-time updates
                    pass
                    
                await asyncio.sleep(1.0)
                
            except Exception as e:
                mission_logger.error(f"Error monitoring mission for order {order_id}: {str(e)}")
                await asyncio.sleep(1.0)
                
    async def _is_mission_complete_on_drone(self, drone_id: str) -> bool:
        """Check if mission is complete on a specific drone."""
        if not MAVSDK_AVAILABLE:
            # Simulate mission completion after some time
            await asyncio.sleep(1)
            return False
            
        drone_info = fleet_manager.drones[drone_id]
        if not drone_info.is_connected or not drone_info.system:
            return True
            
        try:
            async for mission_progress in drone_info.system.mission.mission_progress():
                return mission_progress.current == mission_progress.total and mission_progress.total > 0
                
        except Exception as e:
            mission_logger.error(f"Failed to check mission progress on drone {drone_id}: {str(e)}")
            return True
            
    async def get_drone_position(self, drone_id: str) -> Optional[DronePosition]:
        """Get current position of a specific drone."""
        drone_info = fleet_manager.drones.get(drone_id)
        if not drone_info:
            return None
            
        if not MAVSDK_AVAILABLE:
            # Return simulated position
            config = drone_info.config
            return DronePosition(
                drone_id=drone_id,
                latitude=config.home_lat,
                longitude=config.home_lon,
                altitude=settings.mission_altitude,
                heading=0.0,
                ground_speed=settings.mission_speed,
                battery_remaining=drone_info.battery_level
            )
            
        if not drone_info.is_connected or not drone_info.system:
            return None
            
        try:
            async for position in drone_info.system.telemetry.position():
                async for battery in drone_info.system.telemetry.battery():
                    async for velocity in drone_info.system.telemetry.velocity_ned():
                        ground_speed = math.sqrt(velocity.north_m_s**2 + velocity.east_m_s**2)
                        
                        return DronePosition(
                            drone_id=drone_id,
                            latitude=position.latitude_deg,
                            longitude=position.longitude_deg,
                            altitude=position.absolute_altitude_m,
                            heading=0.0,
                            ground_speed=ground_speed,
                            battery_remaining=battery.remaining_percent
                        )
                        
        except Exception as e:
            mission_logger.error(f"Failed to get position for drone {drone_id}: {str(e)}")
            return None
            
    def _cleanup_mission(self, order_id: str, drone_id: str):
        """Clean up mission data and reset drone status."""
        # Remove from active missions
        if order_id in self.active_missions:
            del self.active_missions[order_id]
            
        # Cancel and remove mission task
        if order_id in self.mission_tasks:
            task = self.mission_tasks[order_id]
            if not task.done():
                task.cancel()
            del self.mission_tasks[order_id]
            
        # Release drone from order
        fleet_manager.release_drone_from_order(order_id)
        
        mission_logger.info(f"Cleaned up mission for order {order_id} on drone {drone_id}")
        
    async def abort_mission(self, order_id: str) -> bool:
        """Abort a specific mission."""
        if order_id not in self.active_missions:
            mission_logger.warning(f"No active mission found for order {order_id}")
            return False
            
        drone_id = self.active_missions[order_id]
        mission_logger.info(f"Aborting mission for order {order_id} on drone {drone_id}")
        
        try:
            drone_info = fleet_manager.drones[drone_id]
            
            if MAVSDK_AVAILABLE and drone_info.is_connected and drone_info.system:
                await drone_info.system.action.return_to_launch()
            
            fleet_manager.update_drone_status(drone_id, DroneStatus.RETURNING)
            self._cleanup_mission(order_id, drone_id)
            
            return True
            
        except Exception as e:
            mission_logger.error(f"Failed to abort mission for order {order_id}: {str(e)}")
            return False
            
    def get_active_missions(self) -> Dict[str, str]:
        """Get all currently active missions."""
        return self.active_missions.copy()
        
    async def shutdown(self):
        """Shutdown the mission runner and cancel all active missions."""
        mission_logger.info("Shutting down multi-drone mission runner")
        
        # Cancel all active mission tasks
        for order_id, task in self.mission_tasks.items():
            if not task.done():
                task.cancel()
                mission_logger.info(f"Cancelled mission task for order {order_id}")
                
        # Clear all data
        self.active_missions.clear()
        self.mission_tasks.clear()
        
        mission_logger.info("Multi-drone mission runner shutdown complete")


# Global multi-drone mission runner instance
multi_drone_mission_runner = MultiDroneMissionRunner()