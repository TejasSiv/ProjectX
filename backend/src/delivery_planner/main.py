from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio

# Import scheduler and router (use placeholders if not implemented yet)
try:
    from delivery_planner.scheduler import scheduler
except ImportError:
    scheduler = None  # Placeholder
try:
    from delivery_planner.api.v1.orders import router as orders_router
except ImportError:
    from fastapi import APIRouter
    orders_router = APIRouter()  # Placeholder

app = FastAPI()

# Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the orders router under /api/v1/orders
app.include_router(orders_router, prefix="/api/v1/orders")

# Background task for scheduler
@app.on_event("startup")
async def startup_event():
    if scheduler and hasattr(scheduler, "start"):
        loop = asyncio.get_event_loop()
        loop.create_task(scheduler.start())

# Graceful shutdown for running missions
@app.on_event("shutdown")
async def shutdown_event():
    # Implement mission cleanup logic here
    if scheduler and hasattr(scheduler, "stop"):
        await scheduler.stop() 