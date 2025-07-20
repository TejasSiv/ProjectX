from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncio
import logging
import structlog

# Import core components
from delivery_planner.core.config import settings
from delivery_planner.core.database import DatabaseService
from delivery_planner.core.exceptions import (
    DroneException, 
    MissionExecutionError, 
    ConnectionError as DroneConnectionError
)
from delivery_planner.services.order_service import OrderService
from delivery_planner.services.mission_service import MissionService
from delivery_planner.services.drone_service import DroneService
from delivery_planner.scheduler.order_processor import OrderProcessor

# Import API routes
from delivery_planner.api.v1.orders import router as orders_router
from delivery_planner.api.v1.missions import router as missions_router
from delivery_planner.api.v1.telemetry import router as telemetry_router
from delivery_planner.api.v1.health import router as health_router

# Configure logging
logging.basicConfig(level=getattr(logging, settings.log_level))
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Global service instances
db_service = None
order_service = None
mission_service = None
drone_service = None
order_processor = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global db_service, order_service, mission_service, drone_service, order_processor
    
    # Startup
    logger.info("Starting Drone Fleet Navigator Backend")
    
    try:
        # Initialize services
        db_service = DatabaseService()
        order_service = OrderService(db_service)
        mission_service = MissionService(db_service)
        drone_service = DroneService()
        
        # Health check database
        await db_service.health_check()
        
        # Connect to drone (simulation mode for development)
        if settings.debug_mode:
            await drone_service.connect_to_drone()
        
        # Initialize order processor
        order_processor = OrderProcessor(order_service, mission_service, drone_service)
        await order_processor.start()
        
        # Store services in app state
        app.state.db_service = db_service
        app.state.order_service = order_service
        app.state.mission_service = mission_service
        app.state.drone_service = drone_service
        app.state.order_processor = order_processor
        
        logger.info("All services initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Drone Fleet Navigator Backend")
    
    try:
        if order_processor:
            await order_processor.stop()
        if drone_service:
            await drone_service.disconnect()
        logger.info("Services shut down successfully")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

# Create FastAPI application
app = FastAPI(
    title=settings.app_title,
    description=settings.app_description,
    version=settings.app_version,
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=settings.allowed_methods,
    allow_headers=settings.allowed_headers,
)

# Exception handlers
@app.exception_handler(DroneException)
async def drone_exception_handler(request, exc):
    logger.error(f"Drone operation failed: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Drone operation failed: {str(exc)}"}
    )

@app.exception_handler(MissionExecutionError)
async def mission_execution_error_handler(request, exc):
    logger.error(f"Mission execution failed: {exc}")
    return JSONResponse(
        status_code=422,
        content={"detail": f"Mission execution failed: {str(exc)}"}
    )

@app.exception_handler(DroneConnectionError)
async def connection_error_handler(request, exc):
    logger.error(f"Drone connection error: {exc}")
    return JSONResponse(
        status_code=503,
        content={"detail": f"Drone connection error: {str(exc)}"}
    )

# Include API routers
app.include_router(
    orders_router, 
    prefix=f"{settings.api_v1_prefix}/orders",
    tags=["orders"]
)

app.include_router(
    missions_router,
    prefix=f"{settings.api_v1_prefix}/missions", 
    tags=["missions"]
)

app.include_router(
    telemetry_router,
    prefix=f"{settings.api_v1_prefix}/telemetry",
    tags=["telemetry"]
)

app.include_router(
    health_router,
    prefix="",
    tags=["health"]
)

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Drone Fleet Navigator Backend API",
        "version": settings.app_version,
        "docs_url": "/docs",
        "health_url": "/health"
    } 