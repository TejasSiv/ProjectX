# Drone Delivery Mission Planner

A comprehensive simulation platform for autonomous drone delivery missions, featuring real-time order management, PX4 SITL integration, and mission tracking capabilities.

## 🎯 Overview

This project provides an end-to-end simulation system for drone delivery logistics, combining a robust FastAPI backend with a modern React frontend. The system enables users to create delivery orders, automatically generate flight missions, and monitor autonomous drone operations in real-time using PX4 SITL simulation.

## 🏗️ Architecture

### Backend (FastAPI)
- **API Layer**: RESTful endpoints for order management (CRUD operations)
- **Mission Planner**: Translates orders into MAVSDK mission waypoints
- **Telemetry System**: Real-time flight status tracking and updates
- **Scheduler**: Automated order processing and mission dispatch
- **PX4 SITL Integration**: Simulated drone flight execution

### Frontend (React/TypeScript)
- **Real-time Dashboard**: Live order tracking and mission monitoring
- **Interactive UI**: Built with shadcn-ui components and Tailwind CSS
- **Data Synchronization**: Supabase integration for real-time updates
- **Responsive Design**: Mobile-friendly interface with smooth animations

## 🛠️ Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Backend** | FastAPI, Python | REST API and mission control |
| **Frontend** | React, TypeScript, Vite | User interface and real-time monitoring |
| **Database** | Supabase (PostgreSQL) | Order storage and real-time sync |
| **Styling** | Tailwind CSS, shadcn-ui | Modern, responsive design |
| **Simulation** | PX4 SITL, MAVSDK | Autonomous drone flight simulation |
| **Animation** | Framer Motion | Smooth UI transitions |
| **State Management** | React Query | Server state and caching |

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+
- npm or yarn

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend/
   ```

2. **Create and activate virtual environment**:
   ```bash
   python -m venv vevn
   source vevn/bin/activate  # On Windows: vevn\Scripts\activate
   ```

3. **Install dependencies** (when requirements.txt is available):
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the FastAPI server**:
   ```bash
   cd src/
   python -m delivery_planner.main
   ```

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd front/drone-fleet-navigator-main/
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```
   Server runs on port 8080 by default.

### Database Setup (Supabase)

1. **Install Supabase CLI** (if needed):
   ```bash
   npm install -g supabase
   ```

2. **Start local Supabase** (for local development):
   ```bash
   supabase start
   ```

3. **Apply migrations**:
   ```bash
   supabase db push
   ```

4. **Generate TypeScript types**:
   ```bash
   supabase gen types typescript --local > src/integrations/supabase/types.ts
   ```

## 📊 Data Model

### Orders Table Schema
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `customer_id` | UUID | Customer identifier |
| `pickup_lat` | FLOAT | Pickup location latitude |
| `pickup_lon` | FLOAT | Pickup location longitude |
| `dropoff_lat` | FLOAT | Delivery location latitude |
| `dropoff_lon` | FLOAT | Delivery location longitude |
| `status` | ENUM | Order status (pending, scheduled, in_flight, completed, failed) |
| `created_at` | TIMESTAMP | Order creation time |
| `estimated_time` | INTEGER | Estimated delivery time (minutes) |
| `updated_at` | TIMESTAMP | Last update timestamp |

## 🧩 Key Features

### Core Functionality
- ✅ **Order Management**: Create, read, update, and delete delivery orders
- ✅ **Mission Planning**: Automatic waypoint generation from coordinates
- ✅ **Real-time Tracking**: Live order status updates and telemetry
- ✅ **PX4 SITL Integration**: Simulated autonomous drone flights
- ✅ **Responsive UI**: Modern, mobile-friendly interface

### Advanced Features
- 🔄 **Real-time Updates**: 5-second polling for order status changes
- 🎨 **Smooth Animations**: Framer Motion for enhanced user experience
- 📱 **Mobile Responsive**: Optimized for all device sizes
- 🎯 **Status Filtering**: Filter orders by status (pending, in-flight, etc.)
- 🔍 **Search Functionality**: Find orders quickly
- 🌙 **Modern Design**: Clean, intuitive interface with Tailwind CSS

## 📁 Project Structure

```
├── backend/
│   └── src/
│       └── delivery_planner/
│           ├── main.py              # FastAPI application entry point
│           ├── api/v1/orders.py     # Order management endpoints
│           ├── core/                # Configuration and database
│           ├── mission/             # MAVSDK integration and telemetry
│           └── scheduler.py         # Order processing automation
├── front/drone-fleet-navigator-main/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                  # Reusable UI components
│   │   │   ├── layout/              # Navigation and layout
│   │   │   └── delivery/            # Order-specific components
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── integrations/supabase/   # Database integration
│   │   ├── pages/                   # Route components
│   │   └── lib/                     # Shared utilities
│   ├── package.json
│   └── vite.config.ts
├── docs/                            # Documentation
│   ├── drone_delivery_mission_planner_prd.md
│   └── startupguide.md
└── CLAUDE.md                        # AI assistant instructions
```

## 🔧 Development Commands

### Frontend Commands
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Preview production build
npm run preview
```

### Backend Commands
```bash
# Run FastAPI development server
uvicorn delivery_planner.main:app --reload

# Run with Python module
python -m delivery_planner.main
```

## 🎨 UI Components

The frontend uses a component-based architecture with:
- **Atomic Design**: Small, reusable components in `components/ui/`
- **Domain Components**: Order-specific UI in `components/delivery/`
- **Layout Components**: Navigation and structure in `components/layout/`
- **TypeScript**: Full type safety across all components
- **Tailwind CSS**: Utility-first styling approach

## 🔄 Data Flow

1. **Order Creation**: Users create orders through the React frontend
2. **Database Storage**: Orders stored in Supabase with real-time sync
3. **Backend Processing**: FastAPI scheduler processes pending orders
4. **Mission Generation**: MAVSDK converts orders to flight waypoints
5. **Simulation Execution**: PX4 SITL executes autonomous drone missions
6. **Real-time Updates**: Telemetry flows back to update order status
7. **Frontend Updates**: React frontend displays live status changes

## 🧪 Testing

The project includes comprehensive testing strategies:
- **Backend**: pytest for API endpoints and mission logic
- **Frontend**: React Testing Library for component testing
- **Integration**: End-to-end testing with PX4 SITL simulation
- **Manual Testing**: Development server testing and UI validation

## 🌟 Key Integrations

### Supabase Integration
- Real-time database synchronization
- Automatic type generation
- Row-level security policies
- Real-time subscriptions

### PX4 SITL Integration
- Simulated drone flight execution
- MAVSDK mission planning
- Telemetry data collection
- Autonomous navigation

### React Query Integration
- Server state management
- Automatic caching
- Background refetching
- Error handling

## 📝 Contributing

1. Follow the established code conventions
2. Use TypeScript for all new frontend code
3. Maintain consistent styling with Tailwind CSS
4. Write tests for new features
5. Update documentation as needed

## 🔮 Future Enhancements

- Advanced routing algorithms
- Multi-drone swarm coordination
- Machine learning-based ETA prediction
- Advanced visualization and analytics
- Mobile app development

## 📄 License

This project is part of a drone delivery simulation system for educational and research purposes.

---

For detailed technical documentation, see:
- [`docs/drone_delivery_mission_planner_prd.md`](docs/drone_delivery_mission_planner_prd.md) - Product requirements
- [`docs/startupguide.md`](docs/startupguide.md) - Detailed architecture guide
- [`CLAUDE.md`](CLAUDE.md) - AI assistant development instructions