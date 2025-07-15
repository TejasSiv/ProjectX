# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a drone delivery mission planner and simulator consisting of:
- **Backend**: FastAPI-based service for order management and MAVSDK integration
- **Frontend**: React/TypeScript SPA for real-time order tracking and mission monitoring
- **Simulation**: PX4 SITL integration for autonomous drone mission execution

## Common Development Commands

### Frontend (React/Vite)
```bash
# Navigate to frontend directory
cd front/drone-fleet-navigator-main/

# Install dependencies
npm install

# Start development server (runs on port 8080)
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

### Database (Supabase)
```bash
# Navigate to frontend directory (where supabase/ folder is located)
cd front/drone-fleet-navigator-main/

# Install Supabase CLI if needed
npm install -g supabase

# Start local Supabase (if using local development)
supabase start

# Apply migrations to local or remote database
supabase db push

# Generate TypeScript types from database
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### Backend (FastAPI)
```bash
# Navigate to backend directory
cd backend/

# Set up Python virtual environment (if needed)
python -m venv vevn
source vevn/bin/activate  # On Windows: vevn\Scripts\activate

# Install dependencies (when requirements.txt is available)
pip install -r requirements.txt

# Run FastAPI development server
cd src/
python -m delivery_planner.main
# OR
uvicorn delivery_planner.main:app --reload
```

## Architecture Overview

### Backend Structure
- **FastAPI Application**: `backend/src/delivery_planner/main.py` - Entry point with CORS middleware
- **API Layer**: `backend/src/delivery_planner/api/v1/orders.py` - CRUD endpoints for orders
- **Core Services**: `backend/src/delivery_planner/core/` - Configuration, database, logging
- **Mission Logic**: `backend/src/delivery_planner/mission/` - MAVSDK integration and telemetry
- **Scheduler**: `backend/src/delivery_planner/scheduler.py` - Order processing automation

### Frontend Structure
- **React App**: Built with Vite, TypeScript, Tailwind CSS, and shadcn-ui components
- **State Management**: React Query for server state, React hooks for local state
- **Data Integration**: Supabase client for real-time database synchronization
- **Routing**: React Router with pages for Orders, Map, and Logs
- **UI Components**: Atomic design with reusable components in `components/ui/`

### Backend-Frontend Integration
- **Primary Data Flow**: Supabase PostgreSQL with real-time subscriptions for instant UI updates
- **Secondary API**: FastAPI backend provides mission control and advanced order processing
- **Dual Architecture**: System works with database-only mode (frontend + Supabase) or full-stack mode (frontend + backend + Supabase)
- **Real-time Updates**: Frontend polls orders every 5 seconds via `useOrders` hook + Supabase real-time subscriptions
- **Mission Execution**: Backend interfaces with PX4 SITL via MAVSDK for drone simulation
- **Error Handling**: Frontend gracefully falls back to database-only mode if backend is unavailable

#### API Endpoints Integration
- **Base URL**: `http://localhost:8000` (FastAPI development server)
- **Orders API**: `/api/v1/orders` - CRUD operations for order management
- **CORS Configuration**: Backend allows requests from frontend port 8080
- **Request Format**: JSON with proper Content-Type headers
- **Authentication**: Currently using Supabase auth (backend integration pending)

#### Data Synchronization Strategy
1. **Create Operations**: Frontend → Backend API → Database → Real-time sync to UI
2. **Read Operations**: Frontend → Supabase direct query + 5-second polling
3. **Update Operations**: Backend scheduler → Database → Real-time sync to UI  
4. **Mission Updates**: MAVSDK → Backend → Database → Real-time sync to UI

#### Integration Files
- `front/drone-fleet-navigator-main/src/hooks/useBackendAPI.ts` - Backend API communication hook
- `front/drone-fleet-navigator-main/src/hooks/useOrders.ts` - Primary data fetching with fallback logic
- `backend/src/delivery_planner/main.py` - CORS and API endpoint configuration
- `backend/src/delivery_planner/api/v1/orders.py` - Order management endpoints

## Development Patterns

### Frontend Conventions
- Components use PascalCase (`OrderCard.tsx`)
- Hooks use camelCase with 'use' prefix (`useOrders.ts`)
- TypeScript interfaces defined alongside components
- Tailwind CSS for all styling (no inline styles)
- Framer Motion for animations

### Backend Conventions
- Python modules in snake_case
- FastAPI routers with `/api/v1/` prefix
- Async/await patterns for all I/O operations
- Error handling with try/catch blocks
- Environment-based configuration

### Data Flow
1. Orders stored in Supabase `orders` table
2. Frontend fetches via `useOrders` hook with 5-second polling
3. Backend scheduler processes pending orders
4. MAVSDK integration executes missions in PX4 SITL
5. Telemetry updates flow back to update order status

## Key Files to Understand
- `front/drone-fleet-navigator-main/src/App.tsx` - Main React application setup
- `front/drone-fleet-navigator-main/src/hooks/useOrders.ts` - Order data fetching logic
- `front/drone-fleet-navigator-main/src/integrations/supabase/client.ts` - Database connection
- `backend/src/delivery_planner/main.py` - FastAPI application entry point
- `docs/drone_delivery_mission_planner_prd.md` - Product requirements document
- `docs/startupguide.md` - Detailed architectural documentation

## Environment Setup

### Frontend Environment Variables (Vite)
```bash
# Frontend: front/drone-fleet-navigator-main/.env
VITE_API_BASE_URL=http://localhost:8000    # FastAPI backend URL
VITE_SUPABASE_URL=your_supabase_url        # Supabase project URL
VITE_SUPABASE_ANON_KEY=your_anon_key       # Supabase anonymous key
```

### Backend Environment Configuration
```bash
# Backend: backend/.env (when available)
DATABASE_URL=postgresql://username:password@localhost:5432/dbname
CORS_ORIGINS=["http://localhost:8080"]     # Frontend development server
API_PREFIX=/api/v1                         # API route prefix
DEBUG=true                                 # Development mode
```

### Integration Notes
- Supabase credentials are currently hardcoded in `client.ts` (should be moved to env vars for production)
- Backend CORS is configured to allow frontend development server (port 8080)
- Frontend gracefully handles backend unavailability by falling back to Supabase-only mode
- PX4 SITL configuration for home coordinates and simulation parameters

## Testing Strategy
- Frontend: React Testing Library (configured but tests not visible)
- Backend: pytest for API and mission logic testing
- Integration: End-to-end simulation testing with PX4 SITL
- Manual testing via development servers and UI interaction