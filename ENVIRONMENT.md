# Environment Variables

This file is the central reference for environment variables across both apps.

## Frontend (`tpn`)

Set these in `tpn/.env.local` (use `tpn/.env.example` as baseline).

| Variable | Required | Default/Example | Purpose |
|---|---|---|---|
| `VITE_ROOM_API_URL` | Yes | `http://localhost:1234` | Base URL for REST API calls (`/api/*`, `/api/rooms/*`) |
| `VITE_WS_URL` | Yes | `ws://localhost:1234` | Base URL for Yjs WebSocket provider |
| `VITE_FIREBASE_API_KEY` | Yes for Google sign-in | (no default) | Firebase web app config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes for Google sign-in | (no default) | Firebase web app config |
| `VITE_FIREBASE_PROJECT_ID` | Yes for Google sign-in | (no default) | Firebase web app config |
| `VITE_FIREBASE_APP_ID` | Yes for Google sign-in | (no default) | Firebase web app config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Optional | (no default) | Firebase web app config |

## Backend (`tpn-server`)

Set these in `tpn-server/.env` (use `tpn-server/.env.example` as baseline).

| Variable | Required | Default/Example | Purpose |
|---|---|---|---|
| `PORT` | No | `1234` | Backend HTTP/WebSocket server port |
| `CORS_ORIGIN` | No (required in production) | `http://localhost:5173` | Allowed frontend origins (comma-separated) |
| `MONGODB_URI` | Yes | (no default) | MongoDB connection string |
| `MONGODB_DB_NAME` | No | `tpn_collab` | MongoDB database name |
| `YJS_UPDATES_COLLECTION` | No | `yjs_updates` | Mongo collection for persisted Yjs updates |
| `FIREBASE_PROJECT_ID` | Required for authenticated routes | (no default) | Firebase Admin credential |
| `FIREBASE_CLIENT_EMAIL` | Required for authenticated routes | (no default) | Firebase Admin credential |
| `FIREBASE_PRIVATE_KEY` | Required for authenticated routes | (no default) | Firebase Admin credential (use escaped `\n`) |

## Cross-App Wiring Rules

1. `VITE_ROOM_API_URL` must point to the same backend instance serving `tpn-server/server.js`.
2. `VITE_WS_URL` must point to that backend's WebSocket endpoint.
3. `CORS_ORIGIN` must include the frontend origin (local + deployed).
4. Firebase web config (`VITE_FIREBASE_*`) and Firebase Admin config (`FIREBASE_*`) should come from the same Firebase project.

## Local Example

- Frontend (`tpn/.env.local`):
  - `VITE_ROOM_API_URL=http://localhost:1234`
  - `VITE_WS_URL=ws://localhost:1234`
- Backend (`tpn-server/.env`):
  - `PORT=1234`
  - `CORS_ORIGIN=http://localhost:5173`

## Deployment Notes

- Frontend deploy config: `vercel.json` at repo root
- Frontend Vercel build output: `tpn/dist`
- Backend deploy config: `railway.json`

Railway workspace deployment settings:

- Root directory: repository root
- Build command: `npm install`
- Start command: `npm run start:backend`
- Watch paths:
  - `tpn-server/**`
  - `packages/contracts/**`
  - `package.json`
  - `package-lock.json`

Set production variables so the frontend points to deployed backend HTTP/WS URLs, and the backend allows frontend origin via `CORS_ORIGIN`.
