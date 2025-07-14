from pydantic import BaseModel, Field, validator
from typing import Optional, List, Tuple
from datetime import datetime
from enum import Enum


class OrderStatus(str, Enum):
    """Order status enumeration matching Supabase schema."""
    PENDING = "pending"
    SCHEDULED = "scheduled"
    IN_FLIGHT = "in_flight"
    COMPLETED = "completed"
    FAILED = "failed"


class OrderBase(BaseModel):
    """Base schema for order data matching Supabase schema."""
    customer_id: str = Field(..., description="Customer identifier")
    pickup_coords: List[float] = Field(..., description="Pickup coordinates [lat, lon]")
    dropoff_coords: List[float] = Field(..., description="Dropoff coordinates [lat, lon]")
    
    @validator('pickup_coords', 'dropoff_coords')
    def validate_coords(cls, v):
        if len(v) != 2:
            raise ValueError('Coordinates must be [latitude, longitude]')
        lat, lon = v
        if not (-90 <= lat <= 90):
            raise ValueError('Latitude must be between -90 and 90')
        if not (-180 <= lon <= 180):
            raise ValueError('Longitude must be between -180 and 180')
        return v


class OrderCreate(OrderBase):
    """Schema for creating a new order."""
    pass


class OrderUpdate(BaseModel):
    """Schema for updating an order."""
    customer_id: Optional[str] = None
    pickup_coords: Optional[List[float]] = Field(None, description="Pickup coordinates [lat, lon]")
    dropoff_coords: Optional[List[float]] = Field(None, description="Dropoff coordinates [lat, lon]")
    status: Optional[OrderStatus] = None
    estimated_time: Optional[int] = Field(None, ge=0, description="Estimated delivery time in minutes")
    
    @validator('pickup_coords', 'dropoff_coords')
    def validate_coords(cls, v):
        if v is not None:
            if len(v) != 2:
                raise ValueError('Coordinates must be [latitude, longitude]')
            lat, lon = v
            if not (-90 <= lat <= 90):
                raise ValueError('Latitude must be between -90 and 90')
            if not (-180 <= lon <= 180):
                raise ValueError('Longitude must be between -180 and 180')
        return v


class OrderResponse(OrderBase):
    """Schema for order response matching Supabase schema."""
    id: str
    status: OrderStatus
    created_at: str  # ISO string from Supabase
    updated_at: str  # ISO string from Supabase
    estimated_time: Optional[int] = None
    
    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    """Schema for order list response."""
    orders: list[OrderResponse]
    total: int
    page: int
    size: int


class StatusUpdate(BaseModel):
    """Schema for status updates."""
    order_id: str
    status: OrderStatus
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.utcnow())


class TelemetryData(BaseModel):
    """Schema for telemetry data."""
    order_id: str
    latitude: float
    longitude: float
    altitude: float
    ground_speed: float
    heading: float
    battery_remaining: float
    mission_progress: float  # 0.0 to 1.0
    timestamp: datetime = Field(default_factory=lambda: datetime.utcnow())


class MissionWaypoint(BaseModel):
    """Schema for mission waypoints."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    altitude: float = Field(..., ge=0)
    speed: Optional[float] = Field(None, ge=0)
    action: str = "waypoint"  # waypoint, takeoff, land, etc.


class MissionPlan(BaseModel):
    """Schema for mission plans."""
    order_id: str
    waypoints: list[MissionWaypoint]
    estimated_duration: Optional[int] = None  # seconds
    
    @validator('waypoints')
    def validate_waypoints(cls, v):
        if len(v) < 2:
            raise ValueError('Mission must have at least 2 waypoints')
        return v


class ErrorResponse(BaseModel):
    """Schema for error responses."""
    error: str
    detail: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.utcnow())