## 🚀 {{Project Name}} – Integrated Full-Stack Systems Architecture and Execution Guide

This document delineates the comprehensive architectural, technical, and operational foundation necessary to conceptualize, construct, and scale the Drone Delivery Mission Autonomy Simulator. It encompasses both backend and frontend service layers, encapsulates design conventions, outlines interface contracts, and introduces systemic development workflows that enable synchronous collaboration between human developers and AI agents. The guide also formalizes principles for ensuring code maintainability, resilience, and extensibility across the full software lifecycle.

---

### 🧩 1. System Overview and Objectives

> **Synopsis:**
> This platform is a highly modularized, extensible simulation system designed for managing and visualizing autonomous drone-based delivery logistics. It enables end-to-end mission simulation from order ingestion to PX4-based flight execution and telemetry feedback.
>
> **Architectural Objectives:**
>
> * Engineer a highly fault-resilient backend stack based on FastAPI and MAVSDK to emulate autonomous drone flight control in software-in-the-loop (SITL) conditions.
> * Architect a reactive and composable frontend using React, Tailwind CSS, and Framer Motion that facilitates intuitive, real-time monitoring and management of mission data.
> * Codify operational consistency through schema-aligned modularity, declarative UI state paradigms, and standardized AI-guided code scaffolding pipelines.
> * Enable test-driven infrastructure by integrating component-level testing with simulation-aware workflows.
> * Maintain API cohesion and telemetry synchronization through strict WebSocket integration protocols.

---

### 🏛 2. Repository Structure (Monorepo Reference)

````bash
/apps/drone_delivery_mission_autonomy/backend/
├── .env/  
│   ├── development.env       # Dev secrets & config  
│   ├── staging.env           # Staging config  
│   └── production.env        # Production config  
├── Dockerfile                # Containerize the FastAPI service  
├── docker-compose.yml        # Bring up backend, simulator, DB together  
├── requirements.txt          # Pinned Python deps  
├── openapi.yaml              # (Optional) API specification  
│
├── src/  
│   └── delivery_planner/  
│       ├── main.py                # FastAPI app entrypoint  
│       │  
│       ├── api/  
│       │   └── v1/  
│       │       └── orders.py      # CRUD & filter endpoints  
│       │  
│       ├── core/                   # “Plumbing” & shared utilities  
│       │   ├── config.py          # Pydantic settings loader  
│       │   ├── database.py        # SQLAlchemy engine & session dep  
│       │   ├── logger.py          # Structured logging setup  
│       │   ├── models.py          # SQLAlchemy DeliveryOrder model  
│       │   ├── schemas.py         # Pydantic request/response schemas  
│       │   └── chaos.py           # Fault‑injection helpers  
│       │  
│       ├── mission/                # Mission execution subsystems  
│       │   ├── mission_runner.py  # Build & upload MAVSDK missions  
│       │   ├── telemetry_listener.py  
│       │   │   └── listen_telemetry()  
│       │   └── swarm_coordinator.py  
│       │       └── SwarmCoordinator class  
│       │  
│       ├── scheduler.py           # Polls pending orders & dispatches  
│       ├── ws.py                  # WebSocket broadcaster (`/ws/telemetry`)  
│       └── utils.py               # Shared helpers (e.g. ETA calc)  
│  
└── tests/  
    ├── conftest.py               # Fixtures: test DB, MAVSDK mocks  
    ├── test_api_orders.py        # API endpoint tests  
    ├── test_mission_runner.py    # Mission build & error‑handling tests  
    ├── test_telemetry_listener.py  
    ├── test_swarm_coordinator.py  
    └── test_scheduler.py         # Scheduler and retry logic  
/front/drone-fleet-navigator-main/
├── public/                        # Static assets (favicon, robots.txt, etc.)
├── src/
│   ├── components/
│   │   ├── ui/                    # Atomic, reusable UI elements (Button, Card, Dialog, etc.)
│   │   ├── layout/                # Layout components (Navbar, Navigation)
│   │   └── delivery/              # Domain-specific UI (OrderList, OrderCard)
│   ├── hooks/                     # Custom React hooks (useOrders, use-toast, use-mobile)
│   ├── integrations/
│   │   └── supabase/              # Supabase client and types for DB integration
│   ├── lib/                       # Shared utilities (utils.ts)
│   ├── pages/                     # Top-level route components (Orders, Map, Logs, NotFound)
│   ├── App.tsx                    # Main app component (routing, providers)
│   ├── main.tsx                   # React entry point
│   ├── index.css                  # Global styles (Tailwind)
│   ├── App.css                    # App-specific styles
│   └── vite-env.d.ts              # TypeScript environment definitions
├── package.json                   # Project metadata, dependencies, scripts
├── tailwind.config.ts             # Tailwind theme and plugin config
├── vite.config.ts                 # Vite build and dev server config
├── tsconfig.json                  # TypeScript config
├── tsconfig.app.json              # App-specific TypeScript config
├── tsconfig.node.json             # Node-specific TypeScript config
├── postcss.config.js              # PostCSS config for Tailwind
├── eslint.config.js               # ESLint config
├── components.json                # Component registry/config (if used)
├── bun.lockb                      # Bun package manager lockfile (if used)
├── package-lock.json              # npm lockfile
├── README.md                      # Project overview and instructions
└── .gitignore                     # Git ignore rules
```                     # Exclude compiled, env, and node modules                      # Exclude compiled, env, and node modules
````

---

### 🛠 3. Technology Stack & Dependency Ecosystem

| Tier       | Toolchain / Library     | Functional Role                                         |
| ---------- | ----------------------- | ------------------------------------------------------- |
| Backend    | FastAPI (Python)        | HTTP/REST API endpoints, WebSocket streaming            |
|            | MAVSDK, PX4 SITL        | Autonomous mission execution via simulation interface   |
|            | SQLAlchemy + SQLite     | ORM layer for data persistence                          |
|            | TimescaleDB (Optional)  | Time-series optimized telemetry storage                 |
|            | AsyncIO                 | Concurrency and coroutine scheduling                    |
| Frontend   | React (Vite)            | Client-side rendering and interface abstraction         |
|            | Tailwind CSS            | Design utility framework for styling                    |
|            | Framer Motion           | Declarative UI animations and transition state modeling |
|            | Supabase                | Real-time DB synchronization layer                      |
|            | Mapbox GL JS            | Map rendering and geospatial overlays                   |
| Realtime   | WebSocket (FastAPI)     | Low-latency duplex communication channel                |
| AI Tooling | Lovable, Cursor, Claude | Prompt-based module generation and code orchestration   |

---

### 🔑 4. Environment Bootstrapping

#### Backend Configuration (dotenv)

```ini
DB_URL=sqlite:///./delivery.db
PX4_HOME_LAT=37.7749
PX4_HOME_LON=-122.4194
PX4_HOME_ALT=10
CHAOS_MODE=true
```

#### Frontend Runtime Configuration (Vite)

```ini
VITE_SUPABASE_URL=https://<PROJECT>.supabase.co
VITE_SUPABASE_KEY=<ANON_KEY>
VITE_FASTAPI_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws/telemetry
```

These configurations encapsulate runtime variability and isolate secrets, ensuring portability and secure deployment.

---

### 🧬 5. Schema Definition & Relational Data Model

The following schema underpins the real-time order tracking system via Supabase:

| Column        | Data Type | Description                                                 |
| ------------- | --------- | ----------------------------------------------------------- |
| `id`          | UUID      | Primary key for order, ensuring immutability and uniqueness |
| `pickup_lat`  | FLOAT     | Latitude of order origin                                    |
| `pickup_lon`  | FLOAT     | Longitude of order origin                                   |
| `dropoff_lat` | FLOAT     | Latitude of delivery target                                 |
| `dropoff_lon` | FLOAT     | Longitude of delivery target                                |
| `status`      | TEXT      | Current state: 'pending', 'scheduled', 'in\_flight', etc.   |
| `created_at`  | TIMESTAMP | System-generated order creation timestamp                   |

**Implementation Note:**
SQLAlchemy ORM ensures 1:1 schema congruence in backend service layer.

---

### 🧩 6. Modular Decomposition and Responsibility Matrix

| Subsystem Module        | File Path                       | Defined Responsibility                               |
| ----------------------- | ------------------------------- | ---------------------------------------------------- |
| API Layer               | `api/v1/orders.py`              | CRUD endpoints for order lifecycle                   |
| Configuration Engine    | `core/config.py`                | Loads environment variables with Pydantic validation |
| Data Layer              | `core/database.py`              | ORM initialization and DB connection context         |
| Chaos Test Harness      | `core/chaos.py`                 | Injects controlled simulation failures               |
| Mission Orchestrator    | `mission/mission_runner.py`     | Handles mission compilation and MAVSDK communication |
| Telemetry Subscriber    | `mission/telemetry_listener.py` | Real-time listener for mission updates               |
| Multi-Drone Controller  | `mission/swarm_coordinator.py`  | Assigns and schedules concurrent UAV tasks           |
| Order Dispatcher        | `scheduler.py`                  | Periodically processes unscheduled orders            |
| Interface Shell         | `App.jsx`, `main.jsx`           | Top-level React app entry and routing                |
| Supabase Polling Hook   | `services/useOrders.js`         | Real-time order fetching and state sync              |
| WebSocket Bridge        | `services/StatusSocket.js`      | Client listener for backend push updates             |
| UI Components           | `components/`                   | Reusable display and control elements                |
| Theming and Utility CSS | `styles/`                       | Custom Tailwind themes and overrides                 |

---

### 📐 7. Developer Conventions & Consistency Constraints

#### Naming Protocol

* React Components: `PascalCase`
* React Hooks: `useCamelCase`
* Utility Files: `kebab-case.js`
* Functions/Vars: `camelCase`

#### UI and Logic Guidelines

* Tailwind classes only (no inline style attr)
* Centralized theme logic in `/styles/`
* Props destructured and typed at entry
* All async functions wrapped in `try/catch`
* Mission-specific constants separated into `config.ts`

#### Documentation and Prompt Indexing

* All AI-generated code must include the prompt reference and generation context
* Major modules should be traceable in `docs/` and `/prompts/`
* Each subsystem update should register in changelog metadata

---

### 🧠 8. AI-Driven Development Pipeline

1. **Initialize Prompt Context** — Load guide and `.env` vars into memory.
2. **Modular Prompt Execution** — Scaffold atomic components/modules.
3. **Standard Verification** — Ensure style, schema, and behavior conformity.
4. **Document & Register** — Create entries in docs/prompts with metadata.
5. **Version Sync** — Tag all prompts with version numbers and origin hash.

Example prompt:

```markdown
Scaffold the FastAPI `POST /orders` endpoint:
- Input validation via Pydantic
- Persist to SQLite via SQLAlchemy
- Return response in JSON schema
```

---

### 🧪 9. Test Harnesses & Validation Framework

| Layer           | Tooling Suite                 | Testing Focus                                                  |
| --------------- | ----------------------------- | -------------------------------------------------------------- |
| Backend API     | `pytest`, `httpx`, `unittest` | Request/response contract validation and async task evaluation |
| Frontend View   | `React Testing Library`       | UI state rendering and interactive behavior                    |
| WebSocket Relay | Custom Test Harness           | Message decoding, order state changes                          |
| PX4 SITL E2E    | MAVSDK + `pytest`             | End-to-end simulation of autonomous delivery loop              |
| Visual Regress  | Storybook, Chromatic          | Diff-based component regression tracking                       |

Sample command suite:

```bash
# Execute backend tests
pytest backend/src/tests

# Run frontend tests
npm run test

# Validate telemetry through SITL
pytest tests/integration/test_mission_loop.py
```

### 🛠 Tech Stack
- **Framework:** React (with Vite for fast dev/build)
- **Language:** TypeScript (strict typing, interfaces, enums)
- **Styling:** Tailwind CSS (utility-first, custom themes, dark mode)
- **UI Library:** shadcn-ui, Radix UI (accessible, composable components)
- **Animation:** Framer Motion (smooth UI transitions)
- **State/Data:** React Query (@tanstack/react-query) for async data and caching
- **Backend Integration:** Supabase (Postgres, real-time, auth)
- **Routing:** React Router DOM (SPA navigation)
- **Icons:** Lucide React
- **Testing:** (not explicitly shown, but likely React Testing Library/Jest)

### 🔑 Environment & Setup
1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Start the development server:**
   ```sh
   npm run dev
   ```
   - Runs on port 8080 by default (see vite.config.ts).
3. **Environment variables:**
   - Supabase URL and key are hardcoded in `src/integrations/supabase/client.ts` for now.
   - For production, move these to environment variables.

### 🗄 Data Model & Flow
- **Orders Table (Supabase):**
  - Fields: id, customer_id, pickup_coords, dropoff_coords, status, created_at, estimated_time, updated_at
  - Status enum: pending, scheduled, in_flight, completed, failed
- **TypeScript Types:**
  - Defined in `src/integrations/supabase/types.ts` and `OrderCard.tsx` for type safety.
- **Fetching Orders:**
  - `useOrders` hook (src/hooks/useOrders.ts) uses React Query to poll Supabase every 5 seconds.
  - Data is mapped and transformed for UI use.
- **Display:**
  - `Orders` page (src/pages/Orders.tsx) shows a filterable, refreshable list of orders.
  - `OrderList` and `OrderCard` components handle list rendering, empty/loading/error states, and individual order display.
  - Animations via Framer Motion for smooth UI.

### 🧩 Module Breakdown
| Module/Folder         | Responsibility/Pattern                                      |
|---------------------- |------------------------------------------------------------|
| components/ui/        | Atomic, reusable UI (Button, Card, Dialog, etc.)           |
| components/layout/    | App-wide layout (Navbar, Navigation)                       |
| components/delivery/  | Domain UI (OrderList, OrderCard)                           |
| hooks/                | Custom hooks (useOrders for data, use-toast for notifications) |
| integrations/supabase/| Supabase client setup and DB types                         |
| lib/                  | Shared utilities                                           |
| pages/                | Route-level components (Orders, Map, Logs, NotFound)       |
| App.tsx               | Providers, routing, layout                                 |
| main.tsx              | React root, hydration                                      |

### 📐 Coding Standards & Best Practices
- **Naming:**
  - Components: PascalCase (OrderCard)
  - Hooks: useCamelCase (useOrders)
  - Files: kebab-case or PascalCase for components
  - Variables: camelCase
- **Structure:**
  - Atomic design for UI (small, composable components)
  - Clear separation of domain, layout, and utility code
  - TypeScript everywhere for type safety
- **Styling:**
  - Tailwind CSS for all layout and design
  - Custom theme in tailwind.config.ts (status, sidebar, gradients, etc.)
  - Animations via Framer Motion and Tailwind Animate plugin
- **Integration:**
  - Supabase for backend (client in integrations/supabase/client.ts)
  - React Query for async data and caching
  - All API/data logic in hooks or integrations, not in UI components
- **Error Handling:**
  - Loading, error, and empty states handled in OrderList
  - Toast notifications via use-toast and Toaster components
- **Routing:**
  - SPA navigation with React Router
  - All routes defined in App.tsx
- **Reusability:**
  - UI and logic are modular and composable
  - Types and interfaces are shared and imported where needed

### 🧠 Extending the Frontend
- **Add a new page:** Create a new file in src/pages/, add a route in App.tsx.
- **Add a new UI component:** Place in components/ui/ or components/delivery/ as appropriate.
- **Fetch new data:** Create a new hook in hooks/, use React Query for async logic.
- **Integrate with backend:** Add logic to integrations/supabase/ or create a new integration folder.
- **Update styles/theme:** Edit tailwind.config.ts for global changes, or use Tailwind classes in components.

### 🧪 Testing & Validation
- **Unit/Component Tests:** (Not shown, but recommended: React Testing Library, Jest)
- **Manual Testing:** Use npm run dev and interact with the UI.
- **Type Safety:** TypeScript and strict types for all data and props.

### 📝 Example: Adding a New Order Status
1. Update the status enum in `src/integrations/supabase/types.ts`.
2. Add a new filter in `statusFilters` in Orders.tsx.
3. Update the Badge and OrderCard to handle the new status.
4. Update Tailwind theme if you want a new color for the status.


---


