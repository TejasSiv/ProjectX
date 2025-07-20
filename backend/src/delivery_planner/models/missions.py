from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime
import uuid
from .orders import Coordinates

class WaypointType(str, Enum):
    """Waypoint type enumeration"""
    TAKEOFF = "takeoff"
    WAYPOINT = "waypoint"
    LAND = "land"
    LOITER = "loiter"
    RETURN_TO_HOME = "return_to_home"

class MissionStatus(str, Enum):
    """Mission status enumeration"""
    CREATED = "created"
    UPLOADED = "uploaded" 
    EXECUTING = "executing"
    COMPLETED = "completed"
    ABORTED = "aborted"
    FAILED = "failed"

class Waypoint(BaseModel):
    """Mission waypoint model"""
    lat: float = Field(..., ge=-90, le=90, description="Waypoint latitude")
    lng: float = Field(..., ge=-180, le=180, description="Waypoint longitude")
    altitude: float = Field(..., ge=5.0, le=120.0, description="Waypoint altitude in meters")
    speed: Optional[float] = Field(None, ge=1.0, le=30.0, description="Speed at waypoint in m/s")
    waypoint_type: WaypointType = Field(WaypointType.WAYPOINT, description="Type of waypoint")
    loiter_time: Optional[float] = Field(None, ge=0, le=300, description="Loiter time in seconds")
    heading: Optional[float] = Field(None, ge=0, le=360, description="Heading in degrees")
    acceptance_radius: float = Field(5.0, ge=1.0, le=50.0, description="Acceptance radius in meters")
    
    @validator('heading')
    def validate_heading(cls, v):
        if v is not None and not (0 <= v <= 360):
            raise ValueError('Heading must be between 0 and 360 degrees')
        return v
    
    def to_coordinates(self) -> Coordinates:
        """Convert waypoint to coordinates"""
        return Coordinates(lat=self.lat, lng=self.lng)
    
    def distance_to(self, other: 'Waypoint') -> float:
        """Calculate distance to another waypoint"""
        return self.to_coordinates().distance_to(other.to_coordinates())

class MissionParameters(BaseModel):
    """Mission execution parameters"""
    max_altitude: float = Field(100.0, ge=10.0, le=120.0, description="Maximum mission altitude")
    cruise_speed: float = Field(15.0, ge=5.0, le=30.0, description="Cruise speed in m/s")
    takeoff_altitude: float = Field(20.0, ge=5.0, le=50.0, description="Takeoff altitude")
    return_to_home_altitude: float = Field(30.0, ge=10.0, le=120.0, description="RTH altitude")
    battery_failsafe_percentage: float = Field(20.0, ge=10.0, le=50.0, description="Battery failsafe percentage")
    mission_timeout_minutes: int = Field(30, ge=5, le=120, description="Mission timeout in minutes")
    enable_obstacle_avoidance: bool = Field(True, description="Enable obstacle avoidance")
    
class MissionCreateRequest(BaseModel):
    """Request model for creating a mission"""
    order_id: uuid.UUID = Field(..., description="Associated order ID")
    waypoints: List[Waypoint] = Field(..., min_items=2, description="Mission waypoints")
    parameters: Optional[MissionParameters] = Field(None, description="Mission parameters")
    description: Optional[str] = Field(None, max_length=200, description="Mission description")
    
    @validator('waypoints')
    def validate_waypoints(cls, v):
        if len(v) < 2:
            raise ValueError('Mission must have at least 2 waypoints')
        
        # Check for takeoff waypoint
        takeoff_waypoints = [wp for wp in v if wp.waypoint_type == WaypointType.TAKEOFF]
        if not takeoff_waypoints:
            raise ValueError('Mission must include a takeoff waypoint')
        
        # Check for landing waypoint
        landing_waypoints = [wp for wp in v if wp.waypoint_type == WaypointType.LAND]
        if not landing_waypoints:
            raise ValueError('Mission must include a landing waypoint')
            
        return v
    
    def calculate_total_distance(self) -> float:
        """Calculate total mission distance"""
        if len(self.waypoints) < 2:
            return 0.0
        
        total_distance = 0.0
        for i in range(len(self.waypoints) - 1):
            total_distance += self.waypoints[i].distance_to(self.waypoints[i + 1])
        
        return total_distance
    
    def estimate_mission_time(self) -> int:
        """Estimate mission time in minutes"""
        if not self.waypoints:
            return 0
        
        total_distance_km = self.calculate_total_distance()
        total_distance_m = total_distance_km * 1000
        
        # Use cruise speed from parameters or default
        cruise_speed = self.parameters.cruise_speed if self.parameters else 15.0
        
        # Calculate flight time
        flight_time_seconds = total_distance_m / cruise_speed
        
        # Add time for takeoff, landing, and loitering
        takeoff_time = 30  # seconds
        landing_time = 30  # seconds
        loiter_time = sum(wp.loiter_time or 0 for wp in self.waypoints)
        
        total_time_seconds = flight_time_seconds + takeoff_time + landing_time + loiter_time
        return max(1, int(total_time_seconds / 60))

class MissionUpdateRequest(BaseModel):
    """Request model for updating a mission"""
    status: Optional[MissionStatus] = Field(None, description="New mission status")
    progress: Optional[float] = Field(None, ge=0.0, le=100.0, description="Mission progress percentage")
    current_waypoint_index: Optional[int] = Field(None, ge=0, description="Current waypoint index")
    failure_reason: Optional[str] = Field(None, max_length=200, description="Failure reason if applicable")

class MissionResponse(BaseModel):
    """Response model for mission data"""
    id: uuid.UUID = Field(..., description="Mission unique identifier")
    order_id: uuid.UUID = Field(..., description="Associated order ID")
    waypoints: List[Waypoint] = Field(..., description="Mission waypoints")
    parameters: MissionParameters = Field(..., description="Mission parameters")
    status: MissionStatus = Field(..., description="Current mission status")
    progress: float = Field(0.0, ge=0.0, le=100.0, description="Mission progress percentage")
    current_waypoint_index: int = Field(0, ge=0, description="Current waypoint being executed")
    description: Optional[str] = Field(None, description="Mission description")
    failure_reason: Optional[str] = Field(None, description="Failure reason if applicable")
    total_distance: float = Field(..., description="Total mission distance in km")
    estimated_time: int = Field(..., description="Estimated mission time in minutes")
    actual_duration: Optional[int] = Field(None, description="Actual mission duration in minutes")
    created_at: datetime = Field(..., description="Mission creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    started_at: Optional[datetime] = Field(None, description="Mission start timestamp")
    completed_at: Optional[datetime] = Field(None, description="Mission completion timestamp")
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            uuid.UUID: lambda v: str(v)
        }
    
    def get_current_waypoint(self) -> Optional[Waypoint]:
        """Get the current waypoint being executed"""
        if 0 <= self.current_waypoint_index < len(self.waypoints):
            return self.waypoints[self.current_waypoint_index]
        return None
    
    def get_next_waypoint(self) -> Optional[Waypoint]:
        """Get the next waypoint to be executed"""
        next_index = self.current_waypoint_index + 1
        if next_index < len(self.waypoints):
            return self.waypoints[next_index]
        return None
    
    def is_completed(self) -> bool:
        """Check if mission is completed"""
        return self.status in [MissionStatus.COMPLETED, MissionStatus.ABORTED, MissionStatus.FAILED]
    
    def get_remaining_distance(self) -> float:
        """Calculate remaining mission distance"""
        if self.current_waypoint_index >= len(self.waypoints) - 1:
            return 0.0
        
        remaining_distance = 0.0
        for i in range(self.current_waypoint_index, len(self.waypoints) - 1):
            remaining_distance += self.waypoints[i].distance_to(self.waypoints[i + 1])
        
        return remaining_distance

class MissionListResponse(BaseModel):
    """Response model for mission list"""
    missions: List[MissionResponse] = Field(..., description="List of missions")
    total: int = Field(..., description="Total number of missions")
    offset: int = Field(..., description="Current offset")
    limit: int = Field(..., description="Current limit")
    has_more: bool = Field(..., description="Whether more missions are available")

class MissionStatsResponse(BaseModel):
    """Response model for mission statistics"""
    total_missions: int = Field(..., description="Total number of missions")
    active_missions: int = Field(..., description="Number of active missions")
    completed_missions: int = Field(..., description="Number of completed missions")
    failed_missions: int = Field(..., description="Number of failed missions")
    average_mission_time: Optional[float] = Field(None, description="Average mission time in minutes")
    total_distance_flown: float = Field(..., description="Total distance flown in km")
    success_rate: float = Field(..., description="Mission success rate as percentage")
    
    @validator('success_rate')
    def validate_success_rate(cls, v):
        return max(0.0, min(100.0, v))

class FlightPath(BaseModel):
    """Flight path model for mission visualization"""
    coordinates: List[Coordinates] = Field(..., description="Path coordinates")
    altitudes: List[float] = Field(..., description="Altitude at each point")
    timestamps: List[datetime] = Field(..., description="Timestamp at each point")
    speeds: List[float] = Field(..., description="Speed at each point")
    
    def get_total_distance(self) -> float:
        """Calculate total path distance"""
        if len(self.coordinates) < 2:
            return 0.0
        
        total_distance = 0.0
        for i in range(len(self.coordinates) - 1):
            total_distance += self.coordinates[i].distance_to(self.coordinates[i + 1])
        
        return total_distance
    
    def get_max_altitude(self) -> float:
        """Get maximum altitude in path"""
        return max(self.altitudes) if self.altitudes else 0.0
    
    def get_average_speed(self) -> float:
        """Get average speed in path"""
        return sum(self.speeds) / len(self.speeds) if self.speeds else 0.0