from pydantic import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application configuration settings."""
    
    # Supabase configuration (Primary Database)
    supabase_url: str = "https://liswqdeiydvouikhuuwf.supabase.co"
    supabase_service_key: Optional[str] = None
    supabase_anon_key: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3dxZGVpeWR2b3Vpa2h1dXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNzUzODAsImV4cCI6MjA2NTc1MTM4MH0.KMmylVYiwY2F55I0iYscvVAoU1vTXYLtIz5RHDjIUdw"
    
    # Local database configuration (for caching/temporary data)
    db_url: str = "sqlite:///./delivery.db"
    
    # PX4 SITL configuration
    px4_home_lat: float = 37.7749
    px4_home_lon: float = -122.4194
    px4_home_alt: float = 10.0
    
    # MAVSDK configuration
    mavsdk_system_address: str = "udp://:14540"
    mavsdk_connection_timeout: int = 10
    
    # Mission configuration
    mission_altitude: float = 20.0
    mission_speed: float = 5.0
    
    # Scheduler configuration
    scheduler_interval: int = 5  # seconds
    
    # Telemetry configuration
    telemetry_update_interval: float = 1.0  # seconds
    
    # Chaos testing
    chaos_mode: bool = False
    chaos_failure_rate: float = 0.1
    
    # API configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: list = ["*"]
    
    # Logging configuration
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Global settings instance
settings = Settings()