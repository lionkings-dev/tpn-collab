# TPN Collab — Web-Based Collaborative Time Petri Net Editor

A real-time collaborative editor for Time Petri Net diagrams. Multiple users can
create and edit diagrams simultaneously in the browser, with conflict-free
synchronization powered by Yjs (CRDT).

**🔗 Live demo:** [tpn-collab.vercel.app](https://tpn-collab.vercel.app)

> Built solo as my Computer Science graduation project at Thammasat University (2026).

## Features

- ⚡ Real-time collaborative editing with Yjs CRDT — no conflicts, no locking
- 📄 PNML (Petri Net Markup Language) import/export
- 🔐 Google Sign-In via Firebase Authentication
- 🚪 Room system — share a room code to invite collaborators
- 🎨 Interactive canvas for places, transitions, arcs, tokens, and time intervals

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Flow |
| Backend | Node.js, Express, Yjs WebSocket provider (y-websocket) |
| Database | MongoDB (persists Yjs updates) |
| Auth | Firebase Authentication (Google Sign-In) |
| Shared | `@tpn/contracts` workspace package |
| Deploy | Vercel (frontend) · Railway (backend) |

## Architecture

repo root/
├── tpn/                  # Frontend — React + TypeScript + Vite
│   └── src/
│       ├── auth/         # Firebase auth hooks and context
│       ├── components/   # Shared UI components
│       ├── features/     # Feature modules (editor, rooms, …)
│       ├── hooks/        # Custom React hooks
│       └── pages/        # Route-level components
├── tpn-server/           # Backend — Node.js + Express + Yjs
│   ├── auth/             # Firebase Admin token verification
│   ├── collab/           # Yjs WebSocket handling
│   ├── db/               # MongoDB connection and queries
│   ├── rooms/            # Room lifecycle management
│   └── routes/           # REST API route handlers
├── packages/contracts/   # Shared room-ID contract (frontend + backend)
├── vercel.json           # Frontend deploy config
└── railway.json          # Backend deploy config

**How real-time sync works:** clients apply edits locally and broadcast Yjs
updates through y-websocket. CRDT operations are commutative, so updates merge
to the same state on every client regardless of arrival order — the server
relays and persists updates to MongoDB but never arbitrates conflicts.

## Getting Started

### Prerequisites

- Node.js v18+ (npm v9+)
- MongoDB v6+ (local, or free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster)
- A Firebase project with Google Sign-In enabled

### Install

```bash
git clone https://github.com/lionkings-dev/tpn-collab.git
cd tpn-collab
npm install
```

### Configure

```bash
cp tpn/.env.example tpn/.env.local      # frontend env
cp tpn-server/.env.example tpn-server/.env  # backend env
```

**Frontend (`tpn/.env.local`):** set `VITE_ROOM_API_URL`, `VITE_WS_URL`, and
your `VITE_FIREBASE_*` web app config.

**Backend (`tpn-server/.env`):** set `MONGODB_URI` and your Firebase Admin SDK
credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
`FIREBASE_PRIVATE_KEY` — single line, `\n` for line breaks).

See `.env.example` in each folder for the full variable reference.

### Run

```bash
npm run dev          # frontend (5173) + backend (1234) together
```

Or separately: `npm run dev:frontend` / `npm run dev:backend`

## Usage

1. Open `http://localhost:5173` and sign in with Google
2. Create a new room, or join one with a room code
3. Build your diagram — add places (circles), transitions (rectangles),
   draw arcs, set initial tokens and time intervals
4. Share the room code; edits appear for all collaborators instantly
5. Export/import diagrams as `.pnml` files

## Testing

```bash
npm run test         # all suites
npm run typecheck    # TypeScript across workspaces
npm run lint         # ESLint
```

## Deployment

| App | Platform | Config |
|---|---|---|
| Frontend | Vercel | `vercel.json` → output `tpn/dist` |
| Backend | Railway | `railway.json` → `npm run start:backend` |

After deploying: point `CORS_ORIGIN` (backend) at the Vercel URL, point
`VITE_ROOM_API_URL`/`VITE_WS_URL` (frontend) at the Railway URL, and add the
frontend domain to Firebase **Authorized domains**.
