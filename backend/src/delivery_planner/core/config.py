from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List, Optional
import os

class Settings(BaseSettings):
    """Application configuration settings"""
    
    # Database Configuration
    supabase_url: str = Field(
        default="https://liswqdeiydvouikhuuwf.supabase.co",
        env="SUPABASE_URL"
    )
    supabase_anon_key: str = Field(
        default="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3dxZGVpeWR2b3Vpa2h1dXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNzUzODAsImV4cCI6MjA2NTc1MTM4MH0.KMmylVYiwY2F55I0iYscvVAoU1vTXYLtIz5RHDjIUdw",
        env="SUPABASE_ANON_KEY"
    )
    supabase_service_key: Optional[str] = Field(None, env="SUPABASE_SERVICE_KEY")
    
    # Local database configuration (for caching/temporary data)
    db_url: str = "sqlite:///./delivery.db"
    
    # PX4 SITL Configuration
    px4_connection_string: str = Field("udp://:14540", env="PX4_CONNECTION_STRING")
    px4_system_id: int = Field(1, env="PX4_SYSTEM_ID")
    px4_component_id: int = Field(1, env="PX4_COMPONENT_ID")
    px4_home_lat: float = 37.7749
    px4_home_lon: float = -122.4194
    px4_home_alt: float = 10.0
    
    # Multi-drone fleet configuration
    fleet_size: int = 4
    mavlink_base_port: int = 14540
    fleet_auto_initialize: bool = True
    
    # API Configuration
    api_v1_prefix: str = "/api/v1"
    app_title: str = "Drone Fleet Navigator Backend"
    app_description: str = "Backend API for drone delivery mission control"
    app_version: str = "1.0.0"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    # CORS Configuration
    allowed_origins: List[str] = Field(
        default=["http://localhost:8080", "http://localhost:3000", "*"],
        env="ALLOWED_ORIGINS"
    )
    allowed_methods: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allowed_headers: List[str] = ["*"]
    
    # Mission Parameters
    default_altitude: float = Field(20.0, ge=5.0, le=100.0)
    default_speed: float = Field(15.0, ge=5.0, le=30.0)
    max_altitude: float = Field(100.0, ge=10.0, le=120.0)
    min_altitude: float = Field(5.0, ge=1.0, le=20.0)
    cruise_speed: float = Field(15.0, ge=5.0, le=30.0)
    takeoff_altitude: float = Field(20.0, ge=5.0, le=50.0)
    mission_altitude: float = 20.0
    mission_speed: float = 15.0
    
    # Service Area (geofence)
    service_area_center_lat: float = Field(40.7128, ge=-90.0, le=90.0)
    service_area_center_lng: float = Field(-74.0060, ge=-180.0, le=180.0)
    service_area_radius_km: float = Field(50.0, ge=1.0, le=500.0)
    
    # Scheduling Configuration
    order_processing_interval: int = Field(5, ge=1, le=60)
    mission_timeout_seconds: int = Field(300, ge=60, le=1800)
    max_concurrent_missions: int = Field(5, ge=1, le=20)
    mission_retry_attempts: int = Field(3, ge=1, le=10)
    scheduler_interval: int = 5  # seconds
    
    # Telemetry Configuration
    telemetry_update_interval: float = Field(1.0, ge=0.1, le=10.0)
    telemetry_buffer_size: int = Field(100, ge=10, le=1000)
    websocket_heartbeat_interval: int = Field(30, ge=10, le=120)
    
    # Security Configuration
    jwt_secret_key: str = Field("your-secret-key-change-in-production", env="JWT_SECRET_KEY")
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = Field(30, ge=5, le=1440)
    
    # Logging Configuration
    log_level: str = Field("INFO", env="LOG_LEVEL")
    log_format: str = "json"
    enable_request_logging: bool = True
    enable_telemetry_logging: bool = False
    
    # Development Configuration
    debug_mode: bool = Field(False, env="DEBUG")
    reload_on_change: bool = Field(False, env="RELOAD")
    
    # Chaos testing
    chaos_mode: bool = False
    chaos_failure_rate: float = 0.1
    
    # Performance Configuration
    database_pool_size: int = Field(5, ge=1, le=20)
    cache_ttl_seconds: int = Field(300, ge=60, le=3600)
    rate_limit_requests_per_minute: int = Field(100, ge=10, le=1000)
    
    # Health Check Configuration
    health_check_interval: int = Field(30, ge=10, le=300)
    px4_connection_timeout: int = 10
    database_connection_timeout: int = Field(5, ge=1, le=30)
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


    def get_database_url(self) -> str:
        """Get database connection URL"""
        return f"postgresql://{self.supabase_url}"
    
    def is_production(self) -> bool:
        """Check if running in production mode"""
        return not self.debug_mode
    
    def get_px4_config(self) -> dict:
        """Get PX4 SITL configuration"""
        return {
            "connection_string": self.px4_connection_string,
            "system_id": self.px4_system_id,
            "component_id": self.px4_component_id,
            "timeout": self.px4_connection_timeout
        }
    
    def get_mission_defaults(self) -> dict:
        """Get default mission parameters"""
        return {
            "altitude": self.default_altitude,
            "speed": self.default_speed,
            "max_altitude": self.max_altitude,
            "min_altitude": self.min_altitude,
            "takeoff_altitude": self.takeoff_altitude
        }

# Global settings instance
settings = Settings()