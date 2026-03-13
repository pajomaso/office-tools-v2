# The Office Engine

## Overview

A centralized office management application with Staff and Admin interfaces. Covers three pillars: Room Reservations, Inventory Requests, and Maintenance Ticketing.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/office-engine)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **UI**: shadcn/ui + Tailwind CSS v4
- **Routing**: Wouter
- **State/Data**: TanStack React Query + generated hooks

## Features

### Room Booking ("The Peacekeeper")
- Weekly calendar grid (8am-6pm, Mon-Sun)
- 3 rooms: The Boardroom (12), The Huddle Pod (6), The Innovation Lab (20)
- Anti-double-booking validation on server side
- Users can only cancel/edit their own bookings
- Admin: full booking management + edit room names/descriptions/photos

### Pantry & Supplies ("The Inventory Manager")
- Wishlist request cards with category and urgency badges
- Upvoting with localStorage deduplication per session
- Form to submit new requests (itemName, category, urgency)
- Admin: status management (Pending/Ordered/Stocked/Denied), delete requests

### Maintenance ("The Fix-It Hub")
- Public issue board with status badges
- Photo upload via file input (sent to /api/upload)
- Priority levels: Urgent (red) vs General (gray)
- Admin: status toggles (Reported → In Progress → Fixed)
- Admin vendor directory (Plumber, Electrician, IT, HVAC, Cleaning, General)
- Admin scheduled maintenance log with frequency and due dates

### Auth
- No login required — users enter their name on first visit (stored in localStorage)
- Admin mode toggled via header button (stored in localStorage)

## Structure

```text
artifacts/
├── api-server/           # Express 5 API (port 8080)
│   └── src/routes/
│       ├── rooms.ts
│       ├── bookings.ts
│       ├── inventory.ts
│       ├── maintenance.ts
│       ├── vendors.ts
│       ├── scheduled-maintenance.ts
│       └── upload.ts
└── office-engine/        # React + Vite frontend (port 24065, previewPath: /)
    └── src/
        ├── pages/
        │   ├── Rooms.tsx
        │   ├── Inventory.tsx
        │   ├── Maintenance.tsx
        │   ├── AdminRooms.tsx
        │   ├── AdminInventory.tsx
        │   ├── AdminMaintenance.tsx
        │   ├── AdminVendors.tsx
        │   └── AdminScheduled.tsx
        ├── components/
        │   ├── Layout.tsx
        │   └── IdentityModal.tsx
        └── hooks/
            └── use-app-state.ts
lib/
├── api-spec/openapi.yaml  # Full API contract
├── api-client-react/      # Generated React Query hooks
├── api-zod/               # Generated Zod schemas
└── db/src/schema/
    ├── rooms.ts
    ├── bookings.ts
    ├── inventory.ts
    ├── maintenance.ts
    ├── vendors.ts
    └── scheduled-maintenance.ts
```

## Database Tables

- `rooms` — Room definitions with name, description, photoUrl, capacity
- `bookings` — Room reservations with date/time conflict prevention
- `inventory_requests` — Pantry/supply wishlist items with upvotes and status
- `maintenance_tickets` — Repair tickets with photo, priority, status
- `vendors` — Admin-only vendor contact directory
- `scheduled_maintenance` — Recurring task log with frequency and due dates

## Seeded Data

- 3 default rooms (The Boardroom, The Huddle Pod, The Innovation Lab)
- 4 vendor contacts (FastFix Plumbing, Spark Electric, CoolAir HVAC, TechSupport Pro)
- 4 scheduled maintenance tasks (AC filters, fire extinguisher, elevator, pest control)

## Development

- API server: `pnpm --filter @workspace/api-server run dev`
- Frontend: `pnpm --filter @workspace/office-engine run dev`
- DB push: `pnpm --filter @workspace/db run push`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
