from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import uvicorn

from .core.config import settings
from .core.database import create_tables
from .core.logger import main_logger
from .scheduler import order_scheduler
from .api.v1.orders import router as orders_router
from .mission.telemetry_listener import websocket_broadcaster

app = FastAPI(
    title="Drone Delivery Mission Planner",
    description="FastAPI backend for autonomous drone delivery simulation",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(orders_router, prefix="/api/v1")

@app.on_event("startup")
async def startup_event():
    """Initialize application on startup."""
    main_logger.info("Starting Drone Delivery Mission Planner")
    
    # Create database tables
    create_tables()
    main_logger.info("Database tables created")
    
    # Start the order scheduler
    await order_scheduler.start()
    main_logger.info("Order scheduler started")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    main_logger.info("Shutting down Drone Delivery Mission Planner")
    
    # Stop the order scheduler
    await order_scheduler.stop()
    main_logger.info("Order scheduler stopped")

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Drone Delivery Mission Planner API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    scheduler_status = order_scheduler.get_status()
    
    return {
        "status": "healthy",
        "timestamp": "2025-01-01T00:00:00Z",
        "scheduler": scheduler_status
    }

@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time telemetry updates."""
    await websocket.accept()
    websocket_broadcaster.add_connection(websocket)
    
    try:
        # Keep connection alive
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_broadcaster.remove_connection(websocket)
    except Exception as e:
        main_logger.error(f"WebSocket error: {str(e)}")
        websocket_broadcaster.remove_connection(websocket)

if __name__ == "__main__":
    uvicorn.run(
        "delivery_planner.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
        log_level=settings.log_level.lower()
    ) 