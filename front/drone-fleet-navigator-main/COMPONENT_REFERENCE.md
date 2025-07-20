# Frontend Component Reference

This document provides detailed descriptions of all components, functions, hooks, and utilities in the Drone Fleet Navigator frontend application.

## Table of Contents

1. [Core Application Architecture](#core-application-architecture)
2. [Integration Layer](#integration-layer)
3. [Custom Hooks](#custom-hooks)
4. [Page Components](#page-components)
5. [Layout Components](#layout-components)
6. [Delivery/Order Components](#deliveryorder-components)
7. [Map Components](#map-components)
8. [Order Management Components](#order-management-components)
9. [Mission Control Components](#mission-control-components)
10. [System Monitoring Components](#system-monitoring-components)
11. [UI Design System](#ui-design-system)
12. [Architectural Patterns](#architectural-patterns)

---

## Core Application Architecture

### `/src/main.tsx`
**Purpose**: Application entry point and React 18 initialization

**Functionality**:
- Creates React root using `createRoot` API
- Renders the main App component
- Applies global CSS styles

**Dependencies**: `react`, `react-dom/client`

**Code Pattern**:
```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
```

---

### `/src/App.tsx`
**Purpose**: Main application wrapper with routing and global providers

**Key Features**:
- **React Query Client**: Server state management with 5-minute stale time
- **React Router**: Client-side routing for SPA navigation
- **Toast System**: Dual notification system (shadcn-ui + Sonner)
- **Global Providers**: Tooltip provider for enhanced UX

**Routes**:
- `/` - Orders dashboard (default)
- `/map` - Live map visualization  
- `/logs` - System logs and monitoring

**Provider Hierarchy**:
```typescript
QueryClientProvider → BrowserRouter → TooltipProvider → [Routes] → Toaster + Sonner
```

**Dependencies**: `@tanstack/react-query`, `react-router-dom`, `framer-motion`

---

### `/src/lib/utils.ts`
**Purpose**: Utility functions for styling and class management

**Main Function**: `cn(...classes)`
- Combines `clsx` and `tailwind-merge` for conditional CSS classes
- Handles class conflicts and deduplication
- Type-safe class combination

**Usage Example**:
```typescript
cn("bg-primary", isActive && "bg-primary-dark", className)
```

---

## Integration Layer

### `/src/integrations/supabase/client.ts`
**Purpose**: Supabase database client configuration

**Features**:
- Real-time database connection
- Authentication with local storage persistence
- Auto-refresh token management

**Configuration**:
```typescript
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true
  }
})
```

**Security Note**: Credentials are hardcoded (should use environment variables)

---

### `/src/integrations/supabase/types.ts`
**Purpose**: TypeScript type definitions for database schema

**Key Types**:
- `Database`: Complete database schema
- `Tables`: Table definitions with Row/Insert/Update types
- `OrderStatus`: Enum type (pending, scheduled, in_flight, completed, failed)

**Generated**: Auto-generated from Supabase CLI using `supabase gen types`

---

## Custom Hooks

### `/src/hooks/useOrders.ts`
**Purpose**: Primary data fetching hook for orders from Supabase

**Features**:
- **Real-time Polling**: Automatic refresh every 5 seconds
- **Background Refetch**: Continues fetching when window is not focused
- **Data Transformation**: Converts database format to component format
- **Error Handling**: React Query error states

**Return Values**:
```typescript
{
  data: DeliveryOrder[] | undefined,
  isLoading: boolean,
  error: Error | null
}
```

**Configuration**:
- Query key: `['orders']`
- Stale time: 0 (always fresh)
- Refetch interval: 5000ms

---

### `/src/hooks/useBackendAPI.ts`
**Purpose**: Comprehensive backend API integration with React Query

**Architecture**: Class-based API client with hook wrappers

**Core Class**: `BackendAPIClient`
- Base URL from environment variables
- Fetch wrapper with error handling
- WebSocket connection management

**Available Hooks**:
- `useOrders()` - Fetch all orders
- `useCreateOrder()` - Create new order mutation
- `useUpdateOrder()` - Update order mutation  
- `useDeleteOrder()` - Delete order mutation
- `useHealth()` - Backend health check
- `useTelemetry()` - WebSocket telemetry data

**API Endpoints**:
- `GET /api/v1/orders` - List orders
- `POST /api/v1/orders` - Create order
- `PUT /api/v1/orders/{id}` - Update order
- `DELETE /api/v1/orders/{id}` - Delete order
- `GET /health` - Health check
- `WebSocket /ws/telemetry` - Live telemetry

**Cache Invalidation**: Automatically invalidates both React Query and Supabase cache

---

### `/src/hooks/use-mobile.tsx`
**Purpose**: Responsive design utility hook

**Functionality**:
- Detects mobile viewport (< 768px)
- Uses `matchMedia` API with event listeners
- Returns boolean for mobile state

**Usage**:
```typescript
const isMobile = useMobile();
```

---

### `/src/hooks/use-toast.ts`
**Purpose**: Toast notification system with queue management

**Features**:
- **State Management**: Memory-based state outside React tree
- **Auto-dismiss**: Configurable timeout per toast
- **Custom Actions**: Support for action buttons
- **Queue System**: Multiple toasts with stacking

**API**:
```typescript
const { toast, dismiss, toasts } = useToast();

toast({
  title: "Success",
  description: "Order created successfully",
  variant: "default" | "destructive"
});
```

**State Management**: Reducer pattern with actions (ADD_TOAST, UPDATE_TOAST, DISMISS_TOAST, REMOVE_TOAST)

---

## Page Components

### `/src/pages/Orders.tsx`
**Purpose**: Main dashboard for order management and filtering

**Features**:
- **Status Filtering**: Filter orders by status with count badges
- **Real-time Updates**: Uses `useOrders` hook with auto-refresh
- **Animated Grid**: Framer Motion stagger animations for order cards
- **Search**: Placeholder for future search functionality

**State Management**:
```typescript
const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'all'>('all');
```

**Filter Logic**:
- Counts orders by status for badge display
- Filters displayed orders based on selected status
- Shows all orders when 'all' is selected

**Animation**: Staggered entrance animations with `motion.div` and `AnimatePresence`

---

### `/src/pages/Map.tsx`
**Purpose**: Live map visualization for drone tracking

**Features**:
- **Map Component**: Uses `SimpleLeafletMap` for real-time visualization
- **Page Animations**: Framer Motion page transitions
- **Real-time Tracking**: Shows active drone positions and routes

**Simple Implementation**: Currently renders map component directly without additional controls

---

### `/src/pages/Logs.tsx`
**Purpose**: System logs and monitoring display (placeholder)

**Current State**: Placeholder implementation with planned features
**Future Features**:
- Real-time log streaming
- Log level filtering
- Search and date range filtering
- Export functionality

---

### `/src/pages/NotFound.tsx`
**Purpose**: 404 error page with navigation

**Features**:
- **Route Logging**: Logs attempted route to console for debugging
- **Navigation**: Home button to return to dashboard
- **Location Tracking**: Uses `useLocation` hook to track invalid routes

---

## Layout Components

### `/src/components/layout/Navbar.tsx`
**Purpose**: Main navigation header with system status

**Props**:
```typescript
interface NavbarProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}
```

**Features**:
- **Animated Logo**: Hover effects with transform animations
- **System Status**: Online/offline indicator with color coding
- **Refresh Button**: Optional refresh functionality with loading state
- **Responsive Design**: Mobile-optimized layout

**Styling**:
- Gradient logo text effect
- Backdrop blur background
- Status indicator with animated dot

---

### `/src/components/layout/Navigation.tsx`
**Purpose**: Secondary navigation tabs with icons

**Features**:
- **Icon Navigation**: Package, Map, FileText icons from Lucide
- **Active State**: Animated underline for current route
- **Framer Motion**: Layout animations for smooth transitions
- **NavLink Integration**: React Router active state detection

**Navigation Items**:
```typescript
const navItems = [
  { to: "/", icon: Package, label: "Orders" },
  { to: "/map", icon: Map, label: "Map" },
  { to: "/logs", icon: FileText, label: "Logs" }
];
```

**Animation**: `layoutId="underline"` for shared element transitions

---

## Delivery/Order Components

### `/src/components/delivery/OrderCard.tsx`
**Purpose**: Individual order display card with status and details

**Props**:
```typescript
interface DeliveryOrder {
  id: string;
  customerId: string;
  pickupCoordinates: { lat: number; lng: number };
  dropoffCoordinates: { lat: number; lng: number };
  status: OrderStatus;
  estimatedTime?: string;
  priority: 'low' | 'medium' | 'high';
}
```

**Features**:
- **Coordinate Formatting**: Displays latitude/longitude with proper precision
- **Status Badge**: Dynamic color coding based on order status
- **Customer Info**: Customer ID and priority display
- **Time Estimation**: Shows estimated delivery time when available
- **Hover Effects**: Smooth scaling and shadow animations

**Styling**:
- Gradient background with opacity
- Hover animations with transform scale
- Status-specific badge variants

---

### `/src/components/delivery/OrderList.tsx`
**Purpose**: Grid container for order cards with states

**Props**:
```typescript
interface OrderListProps {
  orders: DeliveryOrder[];
  isLoading?: boolean;
  error?: Error | null;
}
```

**Features**:
- **Loading State**: Skeleton cards during data fetch
- **Empty State**: Friendly message with drone emoji when no orders
- **Error State**: Error message display with retry option
- **Staggered Animation**: AnimatePresence for smooth list updates
- **Responsive Grid**: CSS Grid with responsive columns

**Animation Configuration**:
```typescript
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};
```

---

## Map Components

### `/src/components/map/SimpleLeafletMap.tsx`
**Purpose**: Production-ready Leaflet map with comprehensive drone tracking

**Features**:
- **Dynamic Import**: Loads Leaflet asynchronously for SSR compatibility
- **Real-time Simulation**: Animated drone position updates
- **Route Visualization**: Status-based route styling (planned, active, completed)
- **Interactive Markers**: Pickup (green) and dropoff (red) markers with popups
- **Sidebar Info**: Order details and mission status
- **Debug Panel**: Map status and performance monitoring

**State Management**:
```typescript
const [mapReady, setMapReady] = useState(false);
const [dronePosition, setDronePosition] = useState({ lat: 40.7128, lng: -74.0060 });
const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
```

**Performance Optimizations**:
- Cached Leaflet module loading
- Debounced position updates
- Marker cleanup on unmount

---

### `/src/components/map/MapComponent.tsx`
**Purpose**: React-Leaflet wrapper with advanced features (incomplete)

**Features**:
- **Dynamic Import**: Conditional Leaflet loading
- **Icon Caching**: Optimized marker icons with createIcon utility
- **Drone Simulation**: Position updates with realistic movement
- **Responsive Sidebar**: Order information display

**Missing Implementation**: `useDronePositions` hook not found

---

### `/src/components/map/SimpleMap.tsx`
**Purpose**: Non-map fallback component for development/testing

**Features**:
- **Order Sidebar**: List of orders without actual map
- **Status Dashboard**: Summary statistics and drone status
- **Position Tracking**: Simulated drone coordinates display
- **Legend**: Status indicators and map controls

**Use Case**: Fallback when map libraries are unavailable

---

### `/src/components/map/LeafletMap.tsx`
**Purpose**: Advanced Leaflet implementation with error handling

**Features**:
- **Comprehensive Error Handling**: Try-catch blocks for all map operations
- **Marker Management**: Cleanup and memory management
- **Auto-fitting Bounds**: Automatically adjusts view to show all markers
- **Status-based Styling**: Different route colors based on mission status

**Performance**: Direct DOM manipulation with React refs

---

### `/src/components/map/FastLeafletMap.tsx`
**Purpose**: Performance-optimized Leaflet map for large datasets

**Optimizations**:
- **Module Caching**: Prevents repeated Leaflet imports
- **Debounced Updates**: Reduces re-render frequency
- **Canvas Rendering**: Prefers canvas over SVG for better performance
- **Batch Operations**: Groups marker updates for efficiency
- **Memory Management**: Proper cleanup of map instances

**Configuration**:
```typescript
const tileLayerOptions = {
  attribution: '© OpenStreetMap contributors',
  preferCanvas: true,
  updateWhenIdle: true,
  updateWhenZooming: false
};
```

---

### `/src/components/map/TestMap.tsx`
**Purpose**: Debug and testing utility for Leaflet integration

**Features**:
- **Comprehensive Logging**: Step-by-step initialization tracking
- **Error Diagnosis**: Detailed error reporting and stack traces
- **Debug Controls**: Manual testing of map functions
- **Status Display**: Real-time map state monitoring

**Use Case**: Development troubleshooting and integration testing

---

## Order Management Components

### `/src/components/orders/CreateOrderDialog.tsx`
**Purpose**: Modal form for creating new delivery orders

**Features**:
- **Form Validation**: React Hook Form with Zod schema validation
- **Real-time Calculations**: Distance and flight time estimation
- **Coordinate Validation**: Ensures valid latitude/longitude ranges
- **Mission Preview**: Shows estimated distance, time, and cost
- **Backend Integration**: Creates orders via API with fallback to Supabase

**Validation Schema**:
```typescript
const orderSchema = z.object({
  customerId: z.string().regex(/^USR-\d{4}$/, "Format: USR-XXXX"),
  pickupLat: z.coerce.number().min(-90).max(90),
  pickupLng: z.coerce.number().min(-180).max(180),
  dropoffLat: z.coerce.number().min(-90).max(90),
  dropoffLng: z.coerce.number().min(-180).max(180),
  priority: z.enum(["low", "medium", "high"])
});
```

**Calculations**:
- **Haversine Formula**: Accurate distance calculation between coordinates
- **Flight Time**: Based on 15 m/s average drone speed
- **Dynamic Updates**: Real-time recalculation as user types

---

### `/src/components/orders/OrderManagementPanel.tsx`
**Purpose**: Advanced order management interface with bulk operations

**Features**:
- **Search and Filtering**: Real-time search across multiple fields
- **Bulk Actions**: Start, pause, abort, delete operations
- **Action Menus**: Dropdown menus for individual order actions  
- **Confirmation Dialogs**: Safety prompts for destructive actions
- **Status Management**: Context-aware action availability

**State Management**:
```typescript
const [searchTerm, setSearchTerm] = useState("");
const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
```

**Bulk Operations**:
- Multi-select with checkboxes
- Batch API calls with progress tracking
- Optimistic updates with rollback on error

---

## Mission Control Components

### `/src/components/mission/MissionControlPanel.tsx`
**Purpose**: Real-time mission monitoring and control interface

**Features**:
- **Live Telemetry**: WebSocket integration for real-time data
- **Mission Progress**: Visual progress tracking with status updates
- **System Health**: Component status monitoring (GPS, battery, communications)
- **Control Actions**: Start, abort, reset mission capabilities
- **Emergency Controls**: Quick access to critical functions

**State Management**:
```typescript
const [missionData, setMissionData] = useState<MissionData>({
  status: 'idle',
  progress: 0,
  altitude: 0,
  speed: 0,
  battery: 100,
  gpsSignal: 100
});
```

**WebSocket Integration**:
- Automatic reconnection on disconnect
- Real-time telemetry updates
- Command acknowledgment system

---

### `/src/components/mission/MissionPlanningInterface.tsx`
**Purpose**: Advanced mission planning with waypoint management

**Features**:
- **Interactive Waypoint Editor**: Add, remove, reorder waypoints
- **Mission Validation**: Multi-criteria validation with error reporting
- **Real-time Calculations**: Distance, time, and battery estimation
- **Parameter Control**: Altitude, speed, and behavior settings
- **Tabbed Interface**: Organized sections for waypoints, settings, validation

**Validation Criteria**:
```typescript
const validateMission = (waypoints: Waypoint[], settings: MissionSettings) => {
  const errors: string[] = [];
  
  if (waypoints.length < 2) errors.push("Minimum 2 waypoints required");
  if (settings.maxAltitude > 400) errors.push("Altitude exceeds FAA limit");
  if (totalDistance > settings.maxRange) errors.push("Mission exceeds drone range");
  
  return errors;
};
```

**Calculations**:
- **Haversine Distance**: Between all waypoints
- **Battery Estimation**: Based on distance and weather conditions
- **Time Estimation**: Considering altitude changes and speed variations

---

## System Monitoring Components

### `/src/components/health/SystemHealthDashboard.tsx`
**Purpose**: Comprehensive system health monitoring with metrics

**Features**:
- **Real-time Metrics**: CPU, memory, response time monitoring
- **Service Status**: Backend, database, external service monitoring
- **Historical Charts**: Performance trends with Recharts
- **Threshold Alerts**: Configurable warning and critical thresholds
- **Uptime Tracking**: Service availability statistics

**Metrics Configuration**:
```typescript
const healthMetrics = {
  cpu: { current: 45, threshold: 80, unit: '%' },
  memory: { current: 62, threshold: 85, unit: '%' },
  responseTime: { current: 120, threshold: 500, unit: 'ms' },
  uptime: { current: 99.8, threshold: 99.0, unit: '%' }
};
```

**Data Visualization**:
- Line charts for performance trends
- Status indicators with color coding
- Alert badges for threshold violations

---

### `/src/components/telemetry/TelemetryDashboard.tsx`
**Purpose**: Live drone telemetry monitoring with alerts

**Features**:
- **Real-time Stream**: Simulated telemetry data with realistic patterns
- **Metric Cards**: Altitude, speed, battery, signal strength
- **Performance Charts**: Historical data visualization
- **Alert System**: Critical condition warnings (low battery, signal loss)
- **Connection Status**: WebSocket connection monitoring

**Simulation Logic**:
```typescript
const generateTelemetry = () => ({
  altitude: 50 + Math.sin(Date.now() / 2000) * 20,
  speed: 15 + Math.random() * 5,
  battery: Math.max(0, 100 - (Date.now() - startTime) / 60000),
  signalStrength: 80 + Math.random() * 20
});
```

**Alert Conditions**:
- Battery < 20%: Warning alert
- Battery < 10%: Critical alert
- Signal < 50%: Connection warning
- Altitude > 100m: Height warning

---

## UI Design System

### Base Components (shadcn-ui)

#### `/src/components/ui/button.tsx`
**Purpose**: Primary interactive element with comprehensive variants

**Props**:
```typescript
interface ButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}
```

**Features**:
- **Class Variance Authority**: Type-safe variant management
- **Radix Slot**: Composition support for flexible usage
- **Forward Ref**: Proper ref forwarding for accessibility
- **Loading States**: Built-in disabled and loading state handling

---

#### `/src/components/ui/card.tsx`
**Purpose**: Content container system with flexible composition

**Components**:
- `Card`: Base container with border and shadow
- `CardHeader`: Header section with padding
- `CardTitle`: Heading with proper typography
- `CardDescription`: Subtitle with muted styling  
- `CardContent`: Main content area
- `CardFooter`: Footer section with actions

**Pattern**: Compound component design for flexible layouts

---

#### `/src/components/ui/badge.tsx`
**Purpose**: Status indicators with domain-specific variants

**Standard Variants**:
- `default`: Primary brand color
- `secondary`: Muted background
- `destructive`: Error/danger state
- `outline`: Border-only style

**Drone-Specific Variants**:
```typescript
const droneStatusVariants = {
  pending: "bg-yellow-100 text-yellow-800",
  scheduled: "bg-blue-100 text-blue-800", 
  in_flight: "bg-green-100 text-green-800",
  completed: "bg-purple-100 text-purple-800",
  failed: "bg-red-100 text-red-800"
};
```

---

### Additional UI Components

The codebase includes a complete shadcn-ui component library with 40+ components:

**Form Components**:
- `Input`: Text input with validation states
- `Label`: Form labels with proper associations
- `Form`: React Hook Form integration
- `Select`: Dropdown selection with search
- `Checkbox`: Boolean input with indeterminate state
- `RadioGroup`: Single selection from options
- `Switch`: Toggle switch for boolean values
- `Textarea`: Multi-line text input
- `Slider`: Range input for numeric values

**Navigation Components**:
- `Tabs`: Tabbed interface with keyboard navigation
- `DropdownMenu`: Context menus with nested submenus
- `NavigationMenu`: Main navigation with hover states
- `Menubar`: Application menu bar
- `Breadcrumb`: Hierarchical navigation

**Feedback Components**:
- `Dialog`: Modal dialogs with focus management
- `AlertDialog`: Confirmation dialogs
- `Sheet`: Side panels and drawers
- `Alert`: Inline notifications
- `Toast`: Temporary notifications
- `Progress`: Loading and progress indicators
- `Skeleton`: Loading placeholders

**Data Display**:
- `Table`: Data tables with sorting and selection
- `Tooltip`: Contextual information overlays
- `HoverCard`: Rich hover content
- `Popover`: Floating content containers
- `Avatar`: User profile images with fallbacks
- `Calendar`: Date selection component
- `Chart`: Data visualization wrapper for Recharts

**Advanced Components**:
- `Command`: Command palette with search
- `Collapsible`: Expandable content sections
- `Accordion`: Expandable list sections
- `Carousel`: Image and content carousels
- `ResizablePanel`: Adjustable layout panels
- `ScrollArea`: Custom scrollbars and overflow

---

## Architectural Patterns

### State Management Strategy

**React Query for Server State**:
- 5-minute stale time for cached data
- Background refetch when stale
- Automatic cache invalidation
- Optimistic updates for mutations

**Local State with useState**:
- Component-specific UI state
- Form state (with React Hook Form)
- Toggle states and modal visibility

**Real-time Integration**:
- WebSocket for live telemetry
- Supabase real-time subscriptions
- Automatic cache updates on data changes

### Data Flow Architecture

**1. Order Creation Flow**:
```
Frontend Form → Backend API → Database → Real-time Sync → UI Update
```

**2. Order Reading Flow**:
```
Frontend → Supabase Direct Query → 5-second Polling → UI Update
```

**3. Mission Updates Flow**:
```
MAVSDK → Backend Scheduler → Database → Real-time Sync → UI Update
```

**4. Telemetry Flow**:
```
PX4 SITL → Backend → WebSocket → Frontend State → UI Update
```

### Performance Optimization Patterns

**Code Splitting**:
- Dynamic imports for Leaflet maps
- Route-based code splitting with React.lazy
- Component-level lazy loading

**Caching Strategy**:
- React Query with background refetch
- Memoized calculations (useMemo)
- Optimized re-renders (React.memo)

**Map Performance**:
- Canvas rendering over SVG
- Debounced marker updates
- Batch marker operations
- Module caching for repeated imports

### Error Handling Patterns

**Graceful Degradation**:
- Map fallbacks when Leaflet fails to load
- Database-only mode when backend unavailable
- Skeleton states during loading

**User Feedback**:
- Toast notifications for all actions
- Loading states for async operations
- Error boundaries for component failures

**Development Tools**:
- Comprehensive console logging
- Debug panels for map components
- Error diagnosis and reporting

### Type Safety Patterns

**Comprehensive TypeScript**:
- All components with proper interfaces
- Generic components with type parameters
- Strict null checks and type guards

**Database Integration**:
- Auto-generated types from Supabase
- Type-safe database queries
- Compile-time validation of API calls

**Runtime Validation**:
- Zod schemas for form validation
- API response validation
- Type-safe environment variables

---

This comprehensive reference documents all components, functions, and patterns in the Drone Fleet Navigator frontend, providing developers with the detailed information needed to understand, maintain, and extend the application.