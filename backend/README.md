# Drone Fleet Navigator - Backend

A comprehensive FastAPI-based backend for autonomous drone delivery mission control and planning. This backend integrates with PX4 SITL drone simulation, provides real-time telemetry streaming, and manages the complete order-to-mission lifecycle.

## 🚁 Overview

The Drone Fleet Navigator backend serves as the mission control center for autonomous drone delivery operations. It provides:

- **Order Management** - Complete CRUD operations for delivery orders
- **Mission Planning** - Automatic conversion of orders to executable flight missions  
- **Drone Integration** - MAVSDK integration with PX4 SITL simulation
- **Real-time Telemetry** - WebSocket streaming of live drone data
- **Background Processing** - Automated order scheduling and mission execution
- **Database Integration** - Supabase PostgreSQL with real-time synchronization

## 🏗️ Architecture

### Core Components

```
backend/
├── src/delivery_planner/
│   ├── main.py                 # FastAPI application entry point
│   ├── core/                   # Core infrastructure
│   │   ├── config.py          # Configuration management
│   │   ├── database.py        # Supabase integration
│   │   ├── exceptions.py      # Custom exception handling
│   │   └── security.py        # Authentication & authorization
│   ├── models/                 # Pydantic data models
│   │   ├── orders.py          # Order lifecycle models
│   │   ├── missions.py        # Mission planning models
│   │   └── telemetry.py       # Real-time data models
│   ├── services/               # Business logic layer
│   │   ├── order_service.py   # Order management logic
│   │   ├── mission_service.py # Mission planning logic
│   │   └── drone_service.py   # Drone control interface
│   ├── api/v1/                 # REST API endpoints
│   │   ├── orders.py          # Order CRUD endpoints
│   │   ├── missions.py        # Mission management
│   │   ├── telemetry.py       # Real-time data & WebSocket
│   │   └── health.py          # Health checks & monitoring
│   ├── scheduler/              # Background task processing
│   │   ├── order_processor.py # Automated order processing
│   │   └── mission_scheduler.py # Mission scheduling & optimization
│   └── utils/                  # Utility functions
│       ├── websocket.py       # WebSocket connection management
│       └── calculations.py    # Distance/time calculations
├── requirements.txt            # Python dependencies
├── test_backend.py            # Backend testing script
└── README.md                  # This file
```

## 🚀 Quick Start

### Prerequisites

- **Python 3.8+** (recommended: Python 3.11)
- **PostgreSQL** (via Supabase)
- **PX4 SITL** (optional, for real drone simulation)

### Installation

1. **Set up Python environment**
   ```bash
   cd backend/
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Test the backend**
   ```bash
   python test_backend.py
   ```

5. **Start the development server**
   ```bash
   cd src/
   uvicorn delivery_planner.main:app --reload --port 8000
   ```

The API will be available at `http://localhost:8000` with interactive docs at `http://localhost:8000/docs`

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```bash
# Database Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key  # Optional

# PX4 SITL Configuration  
PX4_CONNECTION_STRING=udp://:14540
PX4_SYSTEM_ID=1
PX4_COMPONENT_ID=1

# API Configuration
DEBUG=true
LOG_LEVEL=INFO
ALLOWED_ORIGINS=["http://localhost:8080"]

# Security
JWT_SECRET_KEY=your-secret-key-change-in-production

# Mission Parameters
DEFAULT_ALTITUDE=20.0
DEFAULT_SPEED=15.0
MAX_ALTITUDE=100.0
SERVICE_AREA_RADIUS_KM=50.0

# Performance
ORDER_PROCESSING_INTERVAL=5
MISSION_TIMEOUT_SECONDS=300
MAX_CONCURRENT_MISSIONS=5
```

### Database Schema

The backend requires the following Supabase tables:

```sql
-- Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    pickup_coordinates JSONB NOT NULL,
    dropoff_coordinates JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT NOT NULL DEFAULT 'medium',
    estimated_time INTEGER,
    actual_completion_time INTEGER,
    package_weight FLOAT,
    special_instructions TEXT,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Missions table
CREATE TABLE missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    waypoints JSONB NOT NULL,
    parameters JSONB,
    status TEXT NOT NULL DEFAULT 'created',
    progress FLOAT DEFAULT 0.0,
    current_waypoint_index INTEGER DEFAULT 0,
    description TEXT,
    failure_reason TEXT,
    total_distance FLOAT,
    estimated_time INTEGER,
    actual_duration INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
```

## 📡 API Endpoints

### Orders API (`/api/v1/orders`)

```bash
# Create new order
POST /api/v1/orders
Content-Type: application/json

{
  "customer_id": "USR-1001",
  "pickup_coordinates": {"lat": 40.7128, "lng": -74.0060},
  "dropoff_coordinates": {"lat": 40.7589, "lng": -73.9851},
  "priority": "medium",
  "package_weight": 1.5,
  "special_instructions": "Handle with care"
}

# Get all orders
GET /api/v1/orders?status=pending&limit=50&offset=0

# Get specific order
GET /api/v1/orders/{order_id}

# Update order
PUT /api/v1/orders/{order_id}

# Delete order
DELETE /api/v1/orders/{order_id}

# Start order execution
POST /api/v1/orders/{order_id}/start

# Abort order
POST /api/v1/orders/{order_id}/abort?reason=Emergency

# Get order statistics
GET /api/v1/orders/stats/summary

# Get performance metrics
GET /api/v1/orders/stats/performance
```

### Missions API (`/api/v1/missions`)

```bash
# Get all missions
GET /api/v1/missions

# Get specific mission
GET /api/v1/missions/{mission_id}

# Execute mission
POST /api/v1/missions/{mission_id}/execute

# Abort mission
POST /api/v1/missions/{mission_id}/abort

# Get mission status
GET /api/v1/missions/{mission_id}/status
```

### Telemetry API (`/api/v1/telemetry`)

```bash
# Get current telemetry
GET /api/v1/telemetry/current

# Get system health
GET /api/v1/telemetry/health

# WebSocket connection for real-time data
WS /api/v1/telemetry/ws
```

### Health API

```bash
# System health check
GET /health

# Simple ping
GET /ping

# Order processor status
GET /processor/status
```

## 🔌 WebSocket Integration

### Real-time Telemetry Streaming

Connect to `ws://localhost:8000/api/v1/telemetry/ws` for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:8000/api/v1/telemetry/ws');

// Subscribe to telemetry updates
ws.send(JSON.stringify({
    type: 'subscribe',
    topics: ['telemetry', 'orders', 'missions']
}));

// Handle incoming messages
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log('Received:', message);
};
```

### Message Types

- `telemetry` - Real-time drone position, battery, status
- `order_update` - Order status changes
- `mission_update` - Mission progress updates
- `alert` - System alerts and notifications
- `scheduler_status` - Background processor status

## 🤖 Drone Integration

### PX4 SITL Setup

1. **Install PX4 Development Environment**
   ```bash
   git clone https://github.com/PX4/PX4-Autopilot.git
   cd PX4-Autopilot
   make px4_sitl gazebo
   ```

2. **Start SITL Simulation**
   ```bash
   make px4_sitl_default gazebo
   ```

3. **Configure Backend Connection**
   ```bash
   # In .env file
   PX4_CONNECTION_STRING=udp://:14540
   DEBUG=true  # Enables simulation mode
   ```

### MAVSDK Integration

The backend uses MAVSDK-Python for drone communication:

```python
# Connect to drone
await drone_service.connect_to_drone()

# Get telemetry
telemetry = await drone_service.get_telemetry()

# Execute mission
success = await drone_service.start_mission(waypoints, parameters)

# Get system health
health = await drone_service.get_system_health()
```

## 🔄 Background Processing

### Order Processor

Automatically processes orders through the following pipeline:

1. **Pending Orders** → Validate and create missions
2. **Scheduled Orders** → Execute when drone is available  
3. **Active Missions** → Monitor progress and handle completion
4. **Overdue Orders** → Send alerts and notifications

### Mission Scheduler

Advanced mission scheduling with:

- **Priority Queues** - High, medium, low priority missions
- **Resource Management** - Battery, weather, maintenance checks
- **Optimization** - Route planning and efficiency improvements
- **Conflict Resolution** - Handle overlapping missions

## 📊 Monitoring & Logging

### Structured Logging

All logs are JSON-formatted for easy parsing:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "logger": "delivery_planner.services.order_service",
  "message": "Created order 123e4567-e89b-12d3-a456-426614174000",
  "order_id": "123e4567-e89b-12d3-a456-426614174000",
  "customer_id": "USR-1001"
}
```

### Health Monitoring

- **Database Health** - Connection status and query performance
- **Drone Health** - Connection, battery, GPS signal
- **System Health** - CPU, memory, disk usage
- **Mission Health** - Active missions and completion rates

### Performance Metrics

- **Order Statistics** - Success rate, average completion time
- **Mission Metrics** - Flight distance, battery usage
- **System Performance** - API response times, WebSocket connections

## 🧪 Testing

### Run Backend Tests

```bash
# Quick backend test
python test_backend.py

# Run with pytest (when test suite is expanded)
pytest tests/ -v

# Test specific components
python -c "
import asyncio
from src.delivery_planner.services.drone_service import DroneService

async def test():
    drone = DroneService()
    await drone.connect_to_drone()
    telemetry = await drone.get_telemetry()
    print(f'Drone ID: {telemetry.drone_id}')
    print(f'Battery: {telemetry.status.battery_remaining}%')

asyncio.run(test())
"
```

### API Testing

```bash
# Test order creation
curl -X POST http://localhost:8000/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "USR-1001",
    "pickup_coordinates": {"lat": 40.7128, "lng": -74.0060},
    "dropoff_coordinates": {"lat": 40.7589, "lng": -73.9851},
    "priority": "medium"
  }'

# Test health endpoint
curl http://localhost:8000/health

# Test telemetry
curl http://localhost:8000/api/v1/telemetry/current
```

## 🔒 Security

### Authentication

- **JWT Tokens** - Secure API access
- **Role-based Access** - Admin, operator, viewer roles
- **API Key Auth** - Service-to-service communication

### Rate Limiting

- **Per-endpoint Limits** - Prevent API abuse
- **Connection Limits** - WebSocket connection management
- **Resource Protection** - Mission execution rate limiting

### Data Validation

- **Input Validation** - Pydantic models with constraints
- **Coordinate Validation** - Service area geofencing
- **Mission Validation** - Safety checks and constraints

## 🚀 Deployment

### Development

```bash
# Start with auto-reload
uvicorn delivery_planner.main:app --reload --port 8000 --host 0.0.0.0
```

### Production

```bash
# Install production dependencies
pip install gunicorn

# Run with Gunicorn
gunicorn delivery_planner.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY src/ ./src/
CMD ["gunicorn", "delivery_planner.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

### Environment Setup

1. **Database Migration** - Set up Supabase tables
2. **Environment Variables** - Configure production settings
3. **SSL/TLS** - Enable HTTPS for production
4. **Monitoring** - Set up logging and metrics collection

## 🤝 Integration with Frontend

The backend is designed to integrate seamlessly with the React frontend:

### CORS Configuration
- Allows requests from `http://localhost:8080` (frontend dev server)
- Configurable origins for production deployment

### Data Synchronization
- **Real-time Updates** - WebSocket for live data
- **Polling Fallback** - REST API with caching
- **Consistent Format** - Matching data models between frontend/backend

### Error Handling
- **HTTP Status Codes** - Standard REST API responses
- **Error Messages** - User-friendly error descriptions
- **Validation Errors** - Detailed field-level validation feedback

## 📚 Documentation

- **API Documentation** - Auto-generated OpenAPI docs at `/docs`
- **Code Documentation** - Comprehensive docstrings and type hints
- **Architecture Guide** - This README and additional documentation

## 🛠️ Development

### Code Style

- **Python Standards** - PEP 8 compliance with Black formatting
- **Type Hints** - Full type annotations throughout
- **Async/Await** - Consistent async patterns
- **Error Handling** - Comprehensive exception handling

### Contributing

1. Follow existing code style and patterns
2. Add type hints to all new code
3. Include proper error handling
4. Test changes with `test_backend.py`
5. Update documentation for new features

## 📄 License

This project is part of the Drone Fleet Navigator system. See the main project documentation for licensing information.

---

## 🎯 What's Implemented

✅ **Complete FastAPI Application** - Production-ready async API
✅ **Order Management** - Full CRUD with validation and business logic  
✅ **Mission Planning** - Automatic waypoint generation from orders
✅ **Drone Integration** - MAVSDK interface with simulation mode
✅ **Real-time Telemetry** - WebSocket streaming with connection management
✅ **Background Processing** - Automated order scheduling and mission execution
✅ **Database Integration** - Complete Supabase integration with error handling
✅ **Security & Auth** - JWT authentication with role-based access
✅ **Monitoring & Health** - Comprehensive health checks and performance metrics
✅ **Error Handling** - Custom exceptions with proper HTTP responses
✅ **Configuration** - Environment-based settings with validation

The backend provides a solid foundation for autonomous drone delivery operations with real-time monitoring, automated processing, and comprehensive integration capabilities.