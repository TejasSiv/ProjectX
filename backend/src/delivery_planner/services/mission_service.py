from typing import Optional, List, Dict, Any
import uuid
import logging
from datetime import datetime
import math

from ..core.database import DatabaseService
from ..core.config import settings
from ..core.exceptions import (
    MissionNotFoundError,
    MissionExecutionError,
    ValidationError
)
from ..models.orders import OrderResponse, Coordinates
from ..models.missions import (
    MissionCreateRequest,
    MissionUpdateRequest, 
    MissionResponse,
    MissionStatus,
    Waypoint,
    WaypointType,
    MissionParameters
)

logger = logging.getLogger(__name__)

class MissionService:
    """Mission planning and execution management service"""
    
    def __init__(self, db_service: DatabaseService):
        self.db = db_service
    
    async def create_mission_from_order(self, order: OrderResponse) -> Dict[str, Any]:
        """Convert order to executable mission with waypoints"""
        try:
            # Generate mission waypoints
            waypoints = self._generate_waypoints_from_order(order)
            
            # Create mission parameters
            parameters = MissionParameters(
                max_altitude=settings.max_altitude,
                cruise_speed=settings.cruise_speed,
                takeoff_altitude=settings.takeoff_altitude
            )
            
            # Calculate mission metrics
            total_distance = self._calculate_total_distance(waypoints)
            estimated_time = self._estimate_mission_time(waypoints, parameters)
            
            # Prepare mission data
            mission_data = {
                "order_id": order.id,
                "waypoints": [wp.dict() for wp in waypoints],
                "parameters": parameters.dict(),
                "description": f"Delivery mission for order {order.customer_id}",
                "total_distance": total_distance,
                "estimated_time": estimated_time
            }
            
            # Create mission in database
            mission = await self.db.create_mission(mission_data)
            if not mission:
                raise MissionExecutionError("Failed to create mission in database")
            
            logger.info(f"Created mission {mission['id']} for order {order.id}")
            return mission
            
        except Exception as e:
            logger.error(f"Failed to create mission from order {order.id}: {e}")
            raise MissionExecutionError(f"Mission creation failed: {str(e)}")
    
    async def get_mission(self, mission_id: uuid.UUID) -> Dict[str, Any]:
        """Retrieve mission by ID"""
        mission = await self.db.get_mission(mission_id)
        if not mission:
            raise MissionNotFoundError(str(mission_id))
        return mission
    
    async def update_mission_status(
        self, 
        mission_id: uuid.UUID, 
        status: MissionStatus,
        progress: Optional[float] = None
    ) -> Dict[str, Any]:
        """Update mission status and progress"""
        update_data = {"status": status.value}
        
        if progress is not None:
            update_data["progress"] = max(0.0, min(100.0, progress))
        
        mission = await self.db.update_mission(mission_id, update_data)
        if not mission:
            raise MissionExecutionError("Failed to update mission status")
        
        logger.info(f"Updated mission {mission_id} status to {status}")
        return mission
    
    async def update_mission_progress(
        self, 
        mission_id: uuid.UUID, 
        current_waypoint_index: int,
        progress: float
    ) -> Dict[str, Any]:
        """Update mission progress and current waypoint"""
        update_data = {
            "current_waypoint_index": current_waypoint_index,
            "progress": max(0.0, min(100.0, progress))
        }
        
        mission = await self.db.update_mission(mission_id, update_data)
        if not mission:
            raise MissionExecutionError("Failed to update mission progress")
        
        return mission
    
    async def execute_mission(self, mission_id: uuid.UUID) -> bool:
        """Execute mission via drone service"""
        try:
            mission = await self.get_mission(mission_id)
            
            # Validate mission is ready for execution
            if mission["status"] != MissionStatus.CREATED.value:
                raise MissionExecutionError(f"Mission status must be 'created', got '{mission['status']}'")
            
            # Convert waypoints to execution format
            waypoints = [Waypoint(**wp) for wp in mission["waypoints"]]
            
            # Update status to executing
            await self.update_mission_status(mission_id, MissionStatus.EXECUTING)
            
            # Here you would integrate with drone service to start mission
            # For now, we'll simulate mission execution
            success = await self._simulate_mission_execution(mission_id, waypoints)
            
            if success:
                await self.update_mission_status(mission_id, MissionStatus.COMPLETED, 100.0)
                logger.info(f"Mission {mission_id} completed successfully")
            else:
                await self.update_mission_status(mission_id, MissionStatus.FAILED)
                logger.error(f"Mission {mission_id} failed during execution")
            
            return success
            
        except Exception as e:
            logger.error(f"Mission execution failed for {mission_id}: {e}")
            await self.update_mission_status(mission_id, MissionStatus.FAILED)
            raise MissionExecutionError(f"Mission execution failed: {str(e)}")
    
    async def abort_mission(self, mission_id: uuid.UUID, reason: str = "Aborted by user") -> Dict[str, Any]:
        """Abort active mission"""
        mission = await self.get_mission(mission_id)
        
        if mission["status"] not in [MissionStatus.EXECUTING.value, MissionStatus.UPLOADED.value]:
            raise MissionExecutionError("Can only abort executing or uploaded missions")
        
        # Update mission status
        update_data = {
            "status": MissionStatus.ABORTED.value,
            "failure_reason": reason
        }
        
        mission = await self.db.update_mission(mission_id, update_data)
        logger.info(f"Aborted mission {mission_id}: {reason}")
        
        return mission
    
    async def get_missions_by_order(self, order_id: uuid.UUID) -> List[Dict[str, Any]]:
        """Get all missions for a specific order"""
        return await self.db.get_missions_by_order(order_id)
    
    async def get_active_missions(self) -> List[Dict[str, Any]]:
        """Get all currently active missions"""
        # This would need a proper query in the database service
        # For now, return empty list as placeholder
        return []
    
    def _generate_waypoints_from_order(self, order: OrderResponse) -> List[Waypoint]:
        """Generate mission waypoints from order coordinates"""
        waypoints = []
        
        # Takeoff waypoint at pickup location
        takeoff_wp = Waypoint(
            lat=order.pickup_coordinates["lat"],
            lng=order.pickup_coordinates["lng"],
            altitude=settings.takeoff_altitude,
            speed=settings.cruise_speed,
            waypoint_type=WaypointType.TAKEOFF,
            loiter_time=10.0,  # Hover for package pickup
            acceptance_radius=5.0
        )
        waypoints.append(takeoff_wp)
        
        # Transit waypoint to dropoff location
        transit_wp = Waypoint(
            lat=order.dropoff_coordinates["lat"],
            lng=order.dropoff_coordinates["lng"],
            altitude=settings.default_altitude,
            speed=settings.cruise_speed,
            waypoint_type=WaypointType.WAYPOINT,
            loiter_time=10.0,  # Hover for package delivery
            acceptance_radius=5.0
        )
        waypoints.append(transit_wp)
        
        # Landing waypoint at dropoff location
        landing_wp = Waypoint(
            lat=order.dropoff_coordinates["lat"],
            lng=order.dropoff_coordinates["lng"],
            altitude=5.0,  # Land altitude
            speed=5.0,  # Slow descent
            waypoint_type=WaypointType.LAND,
            acceptance_radius=2.0
        )
        waypoints.append(landing_wp)
        
        return waypoints
    
    def _calculate_total_distance(self, waypoints: List[Waypoint]) -> float:
        """Calculate total mission distance"""
        if len(waypoints) < 2:
            return 0.0
        
        total_distance = 0.0
        for i in range(len(waypoints) - 1):
            current = waypoints[i]
            next_wp = waypoints[i + 1]
            distance = current.distance_to(next_wp)
            total_distance += distance
        
        return total_distance
    
    def _estimate_mission_time(self, waypoints: List[Waypoint], parameters: MissionParameters) -> int:
        """Estimate total mission time in minutes"""
        total_distance_km = self._calculate_total_distance(waypoints)
        total_distance_m = total_distance_km * 1000
        
        # Calculate flight time
        cruise_speed = parameters.cruise_speed
        flight_time_seconds = total_distance_m / cruise_speed
        
        # Add time for takeoff, landing, and loitering
        takeoff_time = 30  # seconds
        landing_time = 30  # seconds
        loiter_time = sum(wp.loiter_time or 0 for wp in waypoints)
        
        # Add buffer for altitude changes
        altitude_changes = sum(
            abs((waypoints[i+1].altitude - waypoints[i].altitude) / 5.0)  # 5 m/s climb/descent rate
            for i in range(len(waypoints) - 1)
        )
        
        total_time_seconds = (
            flight_time_seconds + 
            takeoff_time + 
            landing_time + 
            loiter_time + 
            altitude_changes
        )
        
        return max(1, int(total_time_seconds / 60))
    
    async def _simulate_mission_execution(self, mission_id: uuid.UUID, waypoints: List[Waypoint]) -> bool:
        """Simulate mission execution for testing (replace with real drone integration)"""
        import asyncio
        
        try:
            total_waypoints = len(waypoints)
            
            for i, waypoint in enumerate(waypoints):
                # Simulate waypoint execution time
                await asyncio.sleep(2)  # Simulate execution delay
                
                # Update progress
                progress = ((i + 1) / total_waypoints) * 100
                await self.update_mission_progress(mission_id, i, progress)
                
                logger.info(f"Mission {mission_id} reached waypoint {i+1}/{total_waypoints}")
            
            return True
            
        except Exception as e:
            logger.error(f"Mission simulation failed: {e}")
            return False
    
    def validate_mission_plan(self, waypoints: List[Waypoint], parameters: MissionParameters) -> List[str]:
        """Validate mission plan and return list of errors"""
        errors = []
        
        # Check minimum waypoints
        if len(waypoints) < 2:
            errors.append("Mission must have at least 2 waypoints")
        
        # Check for required waypoint types
        has_takeoff = any(wp.waypoint_type == WaypointType.TAKEOFF for wp in waypoints)
        has_landing = any(wp.waypoint_type == WaypointType.LAND for wp in waypoints)
        
        if not has_takeoff:
            errors.append("Mission must include a takeoff waypoint")
        
        if not has_landing:
            errors.append("Mission must include a landing waypoint")
        
        # Check altitude constraints
        for i, wp in enumerate(waypoints):
            if wp.altitude > parameters.max_altitude:
                errors.append(f"Waypoint {i+1} altitude ({wp.altitude}m) exceeds maximum ({parameters.max_altitude}m)")
            
            if wp.altitude < 0:
                errors.append(f"Waypoint {i+1} altitude cannot be negative")
        
        # Check speed constraints
        for i, wp in enumerate(waypoints):
            if wp.speed and wp.speed > 30.0:  # Maximum speed limit
                errors.append(f"Waypoint {i+1} speed ({wp.speed} m/s) exceeds maximum (30 m/s)")
        
        # Check total distance
        total_distance = self._calculate_total_distance(waypoints)
        if total_distance > settings.service_area_radius_km * 2:  # Round trip constraint
            errors.append(f"Total mission distance ({total_distance:.2f}km) exceeds maximum range")
        
        # Check mission duration
        estimated_time = self._estimate_mission_time(waypoints, parameters)
        if estimated_time > parameters.mission_timeout_minutes:
            errors.append(f"Estimated mission time ({estimated_time}min) exceeds timeout")
        
        return errors
    
    async def get_mission_statistics(self) -> Dict[str, Any]:
        """Get mission execution statistics"""
        # This would require additional database queries
        # Placeholder implementation
        return {
            "total_missions": 0,
            "completed_missions": 0,
            "failed_missions": 0,
            "active_missions": 0,
            "success_rate": 0.0,
            "average_mission_time": 0.0,
            "total_distance_flown": 0.0
        }