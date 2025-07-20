# Drone Fleet Navigator - Frontend

A React-based web application for managing and monitoring autonomous drone delivery missions. This frontend provides real-time order tracking, mission planning, and fleet management capabilities.

## =� Overview

The Drone Fleet Navigator frontend is a modern React application built with TypeScript, Vite, and Tailwind CSS. It serves as the primary interface for operators to manage drone delivery orders, monitor missions in real-time, and visualize fleet operations on an interactive map.

### Key Features

- **Real-time Order Management** - Create, track, and manage delivery orders with live status updates
- **Interactive Mission Mapping** - Leaflet-based maps showing drone locations, routes, and delivery zones
- **Fleet Monitoring Dashboard** - Real-time telemetry data and system health monitoring
- **Mission Planning Interface** - Plan and schedule autonomous drone missions
- **Responsive Design** - Mobile-friendly interface with modern UI components

## =� Tech Stack

### Core Technologies
- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework

### UI Components & Libraries
- **shadcn/ui** - Modern, accessible component library built on Radix UI
- **Radix UI Primitives** - Low-level UI primitives for accessibility
- **Lucide React** - Beautiful icon library
- **Framer Motion** - Animation library for smooth interactions

### Data Management
- **TanStack Query (React Query)** - Server state management and caching
- **Supabase** - Real-time database and authentication
- **React Hook Form** - Form management with validation
- **Zod** - Schema validation

### Mapping & Visualization
- **Leaflet** - Interactive maps
- **React Leaflet** - React bindings for Leaflet
- **Recharts** - Charts and data visualization

### Routing & Navigation
- **React Router DOM** - Client-side routing

## =� Quick Start

### Prerequisites
- Node.js 18+ (recommended: use [nvm](https://github.com/nvm-sh/nvm))
- npm or yarn package manager

### Installation

1. **Clone and navigate to the frontend directory**
   ```bash
   cd front/drone-fleet-navigator-main/
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:8080`

### Available Scripts

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Build for development (with dev optimizations)
npm run build:dev

# Lint code
npm run lint

# Preview production build
npm run preview
```

## =� Project Structure

```
src/
 components/           # Reusable UI components
 delivery/        # Order and delivery components
 health/          # System health monitoring
 layout/          # Layout and navigation
 map/             # Map components (Leaflet)
 mission/         # Mission planning and control
 monitoring/      # Status monitoring
 orders/          # Order management
 telemetry/       # Telemetry dashboard
 ui/              # Base UI components (shadcn/ui)
hooks/               # Custom React hooks
 useBackendAPI.ts # Backend API integration
 useOrders.ts     # Order data management
 use-mobile.tsx   # Mobile responsiveness
integrations/        # External service integrations
 supabase/        # Supabase client and types
lib/                 # Utility functions
pages/               # Page components (routes)
 Index.tsx        # Dashboard/home page
 Orders.tsx       # Order management page
 Map.tsx          # Map view page
 Logs.tsx         # System logs page
main.tsx             # Application entry point
```

## =' Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Backend API
VITE_API_BASE_URL=http://localhost:8000

# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Backend Integration

The frontend integrates with:
- **FastAPI Backend** (`http://localhost:8000`) - Mission control and order processing
- **Supabase Database** - Real-time data synchronization and authentication

The application gracefully falls back to database-only mode if the backend is unavailable.

## =� Key Components

### Order Management
- `useOrders.ts` - Central hook for order data with 5-second polling
- `OrderManagementPanel.tsx` - CRUD operations for orders
- `OrderCard.tsx` - Individual order display component

### Map Integration
- `LeafletMap.tsx` - Main map component with drone tracking
- `SimpleLeafletMap.tsx` - Lightweight map for specific use cases
- `MapComponent.tsx` - Map wrapper with mission visualization

### Real-time Features
- Supabase real-time subscriptions for instant updates
- React Query for efficient data caching and synchronization
- WebSocket integration for live telemetry data

## = Data Flow

1. **Order Creation** � Frontend � Backend API � Database � Real-time UI update
2. **Mission Execution** � MAVSDK � Backend � Database � Real-time UI update
3. **Status Updates** � Backend Scheduler � Database � Real-time UI update
4. **Telemetry Data** � PX4 SITL � Backend � WebSocket � Frontend Dashboard

## <� Design System

### Component Architecture
- **Atomic Design** principles with reusable components
- **Compound Components** for complex UI patterns
- **Consistent Naming** - PascalCase for components, camelCase for hooks

### Styling
- **Tailwind CSS** for all styling (no inline styles)
- **CSS Custom Properties** for theme customization
- **Responsive Design** with mobile-first approach
- **Dark Mode Support** via next-themes

### UI Guidelines
- shadcn/ui components for consistency
- Lucide icons for visual elements
- Framer Motion for smooth animations
- Accessible design following WCAG guidelines

## >� Testing & Quality

### Code Quality
- **ESLint** for code linting
- **TypeScript** for type checking
- **Prettier** (configured via ESLint)

### Performance
- **Vite** for fast development and builds
- **Code Splitting** for optimized bundle sizes
- **React Query** for efficient data caching

## = Integration Points

### Backend API
- Base URL: `http://localhost:8000`
- CRUD endpoints: `/api/v1/orders`
- WebSocket: Real-time telemetry updates

### Database
- **Supabase PostgreSQL** for data persistence
- **Real-time subscriptions** for live updates
- **Row Level Security** for data protection

### External Services
- **PX4 SITL** integration via backend
- **MAVSDK** telemetry data
- **Leaflet Maps** for geospatial visualization

## =� Deployment

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```

### Environment Setup
- Configure environment variables for production
- Set up CORS in backend for production domain
- Configure Supabase for production database

## =� Documentation

- [Project Architecture](../../docs/startupguide.md)
- [Product Requirements](../../docs/drone_delivery_mission_planner_prd.md)
- [API Documentation](../../backend/README.md)

## >Contributing

1. Follow the existing code style and conventions
2. Use TypeScript for all new code
3. Include proper error handling
4. Test components in isolation
5. Update documentation for new features

## =� License

This project is part of the Drone Fleet Navigator system. See the main project documentation for licensing information.