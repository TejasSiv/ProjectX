from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from enum import Enum
from datetime import datetime
import uuid

class FlightMode(str, Enum):
    """Flight mode enumeration"""
    MANUAL = "manual"
    STABILIZED = "stabilized"
    ALTITUDE = "altitude"
    POSITION = "position"
    MISSION = "mission"
    RETURN_TO_HOME = "return_to_home"
    LAND = "land"
    TAKEOFF = "takeoff"
    HOLD = "hold"
    OFFBOARD = "offboard"

class HealthStatus(str, Enum):
    """Component health status"""
    OK = "ok"
    WARNING = "warning"
    CRITICAL = "critical"
    UNKNOWN = "unknown"

class DronePosition(BaseModel):
    """Drone position model"""
    lat: float = Field(..., ge=-90, le=90, description="Latitude in degrees")
    lng: float = Field(..., ge=-180, le=180, description="Longitude in degrees") 
    altitude: float = Field(..., ge=0, le=10000, description="Altitude in meters above ground")
    relative_altitude: float = Field(..., description="Altitude relative to home position")
    heading: float = Field(..., ge=0, le=360, description="Heading in degrees")
    
    @validator('heading')
    def validate_heading(cls, v):
        return v % 360  # Normalize to 0-360 range

class DroneVelocity(BaseModel):
    """Drone velocity model"""
    north: float = Field(..., description="North velocity in m/s")
    east: float = Field(..., description="East velocity in m/s")
    down: float = Field(..., description="Down velocity in m/s")
    
    @property
    def ground_speed(self) -> float:
        """Calculate ground speed"""
        return (self.north ** 2 + self.east ** 2) ** 0.5
    
    @property
    def total_speed(self) -> float:
        """Calculate total 3D speed"""
        return (self.north ** 2 + self.east ** 2 + self.down ** 2) ** 0.5

class DroneAttitude(BaseModel):
    """Drone attitude model"""
    roll: float = Field(..., ge=-180, le=180, description="Roll angle in degrees")
    pitch: float = Field(..., ge=-180, le=180, description="Pitch angle in degrees") 
    yaw: float = Field(..., ge=-180, le=180, description="Yaw angle in degrees")

class DroneStatus(BaseModel):
    """Drone status model"""
    is_armed: bool = Field(..., description="Whether drone is armed")
    is_flying: bool = Field(..., description="Whether drone is flying")
    is_connected: bool = Field(..., description="Whether drone is connected")
    flight_mode: FlightMode = Field(..., description="Current flight mode")
    battery_remaining: float = Field(..., ge=0.0, le=100.0, description="Battery percentage remaining")
    battery_voltage: Optional[float] = Field(None, ge=0, description="Battery voltage in volts")
    gps_signal_strength: float = Field(..., ge=0.0, le=100.0, description="GPS signal strength percentage")
    gps_satellite_count: int = Field(..., ge=0, le=50, description="Number of GPS satellites")
    home_position_set: bool = Field(..., description="Whether home position is set")
    
    def is_healthy(self) -> bool:
        """Check if drone status is healthy"""
        return (
            self.is_connected and
            self.battery_remaining > 20.0 and
            self.gps_signal_strength > 50.0 and
            self.gps_satellite_count >= 6
        )

class SystemHealth(BaseModel):
    """System health component model"""
    component: str = Field(..., description="Component name")
    status: HealthStatus = Field(..., description="Component health status")
    message: Optional[str] = Field(None, description="Health status message")
    
class TelemetryResponse(BaseModel):
    """Main telemetry response model"""
    drone_id: str = Field("drone_001", description="Drone identifier")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Telemetry timestamp")
    position: DronePosition = Field(..., description="Drone position data")
    velocity: DroneVelocity = Field(..., description="Drone velocity data")
    attitude: DroneAttitude = Field(..., description="Drone attitude data")
    status: DroneStatus = Field(..., description="Drone status data")
    mission_id: Optional[uuid.UUID] = Field(None, description="Current mission ID")
    current_waypoint: Optional[int] = Field(None, description="Current waypoint index")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            uuid.UUID: lambda v: str(v)
        }

class TelemetryStream(BaseModel):
    """Telemetry stream configuration"""
    drone_id: str = Field(..., description="Drone identifier")
    update_rate_hz: float = Field(1.0, ge=0.1, le=10.0, description="Update rate in Hz")
    include_raw_data: bool = Field(False, description="Include raw sensor data")
    compression_enabled: bool = Field(True, description="Enable data compression")

class SystemHealthResponse(BaseModel):
    """System health response model"""
    overall_status: HealthStatus = Field(..., description="Overall system health")
    components: List[SystemHealth] = Field(..., description="Individual component health")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Health check timestamp")
    uptime_seconds: int = Field(..., ge=0, description="System uptime in seconds")
    cpu_usage: float = Field(..., ge=0, le=100, description="CPU usage percentage")
    memory_usage: float = Field(..., ge=0, le=100, description="Memory usage percentage") 
    disk_usage: float = Field(..., ge=0, le=100, description="Disk usage percentage")
    network_latency_ms: Optional[float] = Field(None, ge=0, description="Network latency in ms")
    active_connections: int = Field(..., ge=0, description="Number of active connections")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    def is_healthy(self) -> bool:
        """Check if overall system is healthy"""
        return (
            self.overall_status in [HealthStatus.OK, HealthStatus.WARNING] and
            self.cpu_usage < 90 and
            self.memory_usage < 90 and
            self.disk_usage < 95
        )

class TelemetryAlert(BaseModel):
    """Telemetry alert model"""
    id: uuid.UUID = Field(default_factory=uuid.uuid4, description="Alert ID")
    drone_id: str = Field(..., description="Drone identifier")
    alert_type: str = Field(..., description="Type of alert")
    severity: HealthStatus = Field(..., description="Alert severity")
    message: str = Field(..., description="Alert message")
    value: Optional[float] = Field(None, description="Alert trigger value")
    threshold: Optional[float] = Field(None, description="Alert threshold")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Alert timestamp")
    acknowledged: bool = Field(False, description="Whether alert is acknowledged")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            uuid.UUID: lambda v: str(v)
        }

class TelemetryHistory(BaseModel):
    """Historical telemetry data model"""
    drone_id: str = Field(..., description="Drone identifier")
    start_time: datetime = Field(..., description="History start time")
    end_time: datetime = Field(..., description="History end time")
    data_points: List[TelemetryResponse] = Field(..., description="Telemetry data points")
    summary: Dict[str, Any] = Field(..., description="Summary statistics")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    def get_duration_minutes(self) -> float:
        """Get duration of history in minutes"""
        duration = self.end_time - self.start_time
        return duration.total_seconds() / 60
    
    def get_average_battery(self) -> float:
        """Get average battery level"""
        if not self.data_points:
            return 0.0
        return sum(dp.status.battery_remaining for dp in self.data_points) / len(self.data_points)
    
    def get_max_altitude(self) -> float:
        """Get maximum altitude reached"""
        if not self.data_points:
            return 0.0
        return max(dp.position.altitude for dp in self.data_points)
    
    def get_total_distance(self) -> float:
        """Calculate total distance traveled"""
        if len(self.data_points) < 2:
            return 0.0
        
        total_distance = 0.0
        for i in range(len(self.data_points) - 1):
            current = self.data_points[i].position
            next_pos = self.data_points[i + 1].position
            
            # Simple distance calculation (could be enhanced with proper geodesic calculation)
            lat_diff = next_pos.lat - current.lat
            lng_diff = next_pos.lng - current.lng
            distance = (lat_diff ** 2 + lng_diff ** 2) ** 0.5 * 111320  # Rough conversion to meters
            total_distance += distance
        
        return total_distance / 1000  # Convert to kilometers

class WebSocketMessage(BaseModel):
    """WebSocket message model"""
    type: str = Field(..., description="Message type")
    data: Dict[str, Any] = Field(..., description="Message data")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Message timestamp")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }