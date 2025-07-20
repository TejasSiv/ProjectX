from fastapi import APIRouter, Depends
import logging
from datetime import datetime

from ...models.telemetry import SystemHealthResponse, HealthStatus
from ...services.drone_service import DroneService
from ...core.database import DatabaseService

logger = logging.getLogger(__name__)
router = APIRouter()

def get_drone_service() -> DroneService:
    """Dependency to get drone service from app state"""
    from ...main import app
    return app.state.drone_service

def get_db_service() -> DatabaseService:
    """Dependency to get database service from app state"""
    from ...main import app
    return app.state.db_service

@router.get("/health", response_model=SystemHealthResponse)
async def health_check(
    drone_service: DroneService = Depends(get_drone_service),
    db_service: DatabaseService = Depends(get_db_service)
):
    """System health check endpoint"""
    try:
        components = []
        overall_status = HealthStatus.OK
        
        # Check database health
        db_healthy = await db_service.health_check()
        db_status = HealthStatus.OK if db_healthy else HealthStatus.CRITICAL
        components.append({
            "component": "Database",
            "status": db_status,
            "message": "Connected" if db_healthy else "Connection failed"
        })
        
        if not db_healthy:
            overall_status = HealthStatus.CRITICAL
        
        # Check drone connection
        drone_connected = drone_service.is_connected
        drone_status = HealthStatus.OK if drone_connected else HealthStatus.WARNING
        components.append({
            "component": "Drone",
            "status": drone_status,
            "message": "Connected" if drone_connected else "Not connected"
        })
        
        if not drone_connected and overall_status == HealthStatus.OK:
            overall_status = HealthStatus.WARNING
        
        # Add API status
        components.append({
            "component": "API",
            "status": HealthStatus.OK,
            "message": "Operational"
        })
        
        return SystemHealthResponse(
            overall_status=overall_status,
            components=components,
            timestamp=datetime.utcnow(),
            uptime_seconds=3600,  # Placeholder
            cpu_usage=25.0,       # Placeholder
            memory_usage=40.0,    # Placeholder
            disk_usage=15.0,      # Placeholder
            network_latency_ms=10.0,
            active_connections=1
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return SystemHealthResponse(
            overall_status=HealthStatus.CRITICAL,
            components=[{
                "component": "System",
                "status": HealthStatus.CRITICAL,
                "message": f"Health check failed: {str(e)}"
            }],
            timestamp=datetime.utcnow(),
            uptime_seconds=0,
            cpu_usage=0.0,
            memory_usage=0.0,
            disk_usage=0.0,
            active_connections=0
        )

@router.get("/ping")
async def ping():
    """Simple ping endpoint"""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

@router.get("/processor/status")
async def get_processor_status():
    """Get order processor status"""
    try:
        from ...main import app
        processor = app.state.order_processor
        
        if processor:
            return processor.get_status()
        else:
            return {"status": "not_initialized"}
            
    except Exception as e:
        logger.error(f"Failed to get processor status: {e}")
        return {"status": "error", "message": str(e)}