from pydantic import BaseModel, Field, validator
from typing import Optional
from enum import Enum
from datetime import datetime
import uuid

class OrderStatus(str, Enum):
    """Order status enumeration"""
    PENDING = "pending"
    SCHEDULED = "scheduled"
    IN_FLIGHT = "in_flight"
    COMPLETED = "completed"
    FAILED = "failed"

class Priority(str, Enum):
    """Order priority enumeration"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class Coordinates(BaseModel):
    """Geographic coordinates model"""
    lat: float = Field(..., ge=-90, le=90, description="Latitude in degrees")
    lng: float = Field(..., ge=-180, le=180, description="Longitude in degrees")
    
    @validator('lat')
    def validate_latitude(cls, v):
        if not (-90 <= v <= 90):
            raise ValueError('Latitude must be between -90 and 90 degrees')
        return v
    
    @validator('lng')
    def validate_longitude(cls, v):
        if not (-180 <= v <= 180):
            raise ValueError('Longitude must be between -180 and 180 degrees')
        return v

    def to_dict(self) -> dict:
        """Convert to dictionary for database storage"""
        return {"lat": self.lat, "lng": self.lng}
    
    def distance_to(self, other: 'Coordinates') -> float:
        """Calculate distance to another coordinate using Haversine formula"""
        import math
        
        # Convert latitude and longitude from degrees to radians
        lat1, lon1, lat2, lon2 = map(math.radians, [self.lat, self.lng, other.lat, other.lng])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # Radius of earth in kilometers
        r = 6371
        return c * r

class OrderCreateRequest(BaseModel):
    """Request model for creating a new order"""
    customer_id: str = Field(..., pattern=r"^USR-\d{4}$", description="Customer ID format: USR-XXXX")
    pickup_coordinates: Coordinates = Field(..., description="Pickup location coordinates")
    dropoff_coordinates: Coordinates = Field(..., description="Dropoff location coordinates")
    priority: Priority = Field(Priority.MEDIUM, description="Order priority level")
    estimated_time: Optional[int] = Field(None, ge=1, le=1440, description="Estimated time in minutes")
    package_weight: Optional[float] = Field(None, ge=0.1, le=5.0, description="Package weight in kg")
    special_instructions: Optional[str] = Field(None, max_length=500, description="Special delivery instructions")
    
    @validator('customer_id')
    def validate_customer_id(cls, v):
        if not v.startswith('USR-') or len(v) != 8:
            raise ValueError('Customer ID must follow format USR-XXXX')
        return v.upper()
    
    @validator('pickup_coordinates', 'dropoff_coordinates')
    def validate_coordinates_within_service_area(cls, v):
        # Check if coordinates are within reasonable service area
        # This is a basic validation - can be enhanced with actual geofence checking
        return v
    
    def calculate_distance(self) -> float:
        """Calculate distance between pickup and dropoff"""
        return self.pickup_coordinates.distance_to(self.dropoff_coordinates)
    
    def estimate_flight_time(self, speed_mps: float = 15.0) -> int:
        """Estimate flight time in minutes based on distance and speed"""
        distance_km = self.calculate_distance()
        distance_m = distance_km * 1000
        time_seconds = distance_m / speed_mps
        # Add buffer time for takeoff, landing, and package handling
        buffer_time = 120  # 2 minutes buffer
        total_time_minutes = (time_seconds + buffer_time) / 60
        return max(1, int(total_time_minutes))

class OrderUpdateRequest(BaseModel):
    """Request model for updating an existing order"""
    status: Optional[OrderStatus] = Field(None, description="New order status")
    estimated_time: Optional[int] = Field(None, ge=1, le=1440, description="Updated estimated time in minutes")
    priority: Optional[Priority] = Field(None, description="Updated priority level")
    special_instructions: Optional[str] = Field(None, max_length=500, description="Updated special instructions")
    actual_completion_time: Optional[int] = Field(None, ge=1, description="Actual completion time in minutes")
    failure_reason: Optional[str] = Field(None, max_length=200, description="Reason for failure if status is failed")

class OrderResponse(BaseModel):
    """Response model for order data"""
    id: uuid.UUID = Field(..., description="Unique order identifier")
    customer_id: str = Field(..., description="Customer identifier")
    pickup_coordinates: Coordinates = Field(..., description="Pickup location")
    dropoff_coordinates: Coordinates = Field(..., description="Dropoff location")
    status: OrderStatus = Field(..., description="Current order status")
    priority: Priority = Field(..., description="Order priority level")
    estimated_time: Optional[int] = Field(None, description="Estimated delivery time in minutes")
    actual_completion_time: Optional[int] = Field(None, description="Actual completion time in minutes")
    package_weight: Optional[float] = Field(None, description="Package weight in kg")
    special_instructions: Optional[str] = Field(None, description="Special delivery instructions")
    failure_reason: Optional[str] = Field(None, description="Failure reason if applicable")
    created_at: datetime = Field(..., description="Order creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    scheduled_at: Optional[datetime] = Field(None, description="Mission scheduled timestamp")
    started_at: Optional[datetime] = Field(None, description="Mission start timestamp")
    completed_at: Optional[datetime] = Field(None, description="Mission completion timestamp")
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            uuid.UUID: lambda v: str(v)
        }
    
    def get_duration_minutes(self) -> Optional[int]:
        """Get order duration in minutes if completed"""
        if self.started_at and self.completed_at:
            duration = self.completed_at - self.started_at
            return int(duration.total_seconds() / 60)
        return None
    
    def is_overdue(self) -> bool:
        """Check if order is overdue based on estimated time"""
        if not (self.estimated_time and self.created_at):
            return False
        
        if self.status in [OrderStatus.COMPLETED, OrderStatus.FAILED]:
            return False
            
        expected_completion = self.created_at + datetime.timedelta(minutes=self.estimated_time)
        return datetime.utcnow() > expected_completion

class OrderListResponse(BaseModel):
    """Response model for order list with pagination"""
    orders: list[OrderResponse] = Field(..., description="List of orders")
    total: int = Field(..., description="Total number of orders")
    offset: int = Field(..., description="Current offset")
    limit: int = Field(..., description="Current limit")
    has_more: bool = Field(..., description="Whether more orders are available")

class OrderStatsResponse(BaseModel):
    """Response model for order statistics"""
    total_orders: int = Field(..., description="Total number of orders")
    pending_orders: int = Field(..., description="Number of pending orders")
    in_flight_orders: int = Field(..., description="Number of in-flight orders")
    completed_orders: int = Field(..., description="Number of completed orders")
    failed_orders: int = Field(..., description="Number of failed orders")
    average_completion_time: Optional[float] = Field(None, description="Average completion time in minutes")
    success_rate: float = Field(..., description="Success rate as percentage")
    
    @validator('success_rate')
    def validate_success_rate(cls, v):
        return max(0.0, min(100.0, v))  # Ensure between 0 and 100