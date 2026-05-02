# TPN Collaboration Workspace Monorepo

This repository contains the full TPN collaboration stack:

- `tpn/`: React + TypeScript + Vite frontend
- `tpn-server/`: Node.js + Express + MongoDB + Yjs backend
- `packages/`: shared workspace packages (contracts/utilities)

## Repository Layout

- `tpn/`
  - User-facing editor UI, room flows, PNML import/export, auth client integration
- `tpn-server/`
  - Room APIs, auth verification, room lifecycle, WebSocket admission, Yjs persistence

## Quick Start

1. Install all dependencies:

```bash
npm install
```

Optional compatibility command:

```bash
npm run install:all
```

2. Configure environment variables:

- Frontend: copy `tpn/.env.example` to `tpn/.env.local`
- Backend: copy `tpn-server/.env.example` to `tpn-server/.env`
- See `ENVIRONMENT.md` for full variable reference and deployment mapping

3. Run both apps in development:

```bash
npm run dev
```

If you prefer separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

## Root Scripts

- `npm install` or `npm run install:all`: install workspace dependencies
- `npm run dev`: run backend + frontend together (Linux/macOS shell)
- `npm run dev:backend`: run backend only
- `npm run dev:frontend`: run frontend only
- `npm run start:backend`: start backend in production mode
- `npm run build`: build workspace apps (currently frontend)
- `npm run build:frontend`: build frontend app
- `npm run typecheck`: run workspace type checks
- `npm run lint`: run workspace lint checks (frontend + optional package scripts)
- `npm run test:frontend`: run frontend unit tests
- `npm run test:backend`: run backend day1/day2/day3 smoke scripts
- `npm run test`: run frontend + backend test suites

## Workspace Rules

- Use the root `package-lock.json` as the single lockfile.
- Run installs from repo root (`npm install`).
- Backend dev watcher includes `packages/contracts/src` changes via `tpn-server/nodemon.json`.

## Architecture Notes

- Frontend talks to backend REST at `VITE_ROOM_API_URL`.
- Frontend connects to Yjs WebSocket at `VITE_WS_URL`.
- Backend validates room admission before WebSocket upgrade.
- Backend persists collaborative Yjs updates to MongoDB.
- Room metadata exposure policy:
  - public room endpoint: name-only
  - private room endpoint: owner-only metadata

## Deployment

- Frontend deploy config: `vercel.json` at repo root
- Frontend Vercel build output: `tpn/dist`
- Backend deploy config: `railway.json`
- Keep frontend API/WS URLs aligned with backend deployment URL.
- Set backend `CORS_ORIGIN` to the deployed frontend origin.

### Railway (root workspace scope)

- Root directory: repository root
- Build command: `npm install`
- Start command: `npm run start:backend`
- Watch paths:
  - `tpn-server/**`
  - `packages/contracts/**`
  - `package.json`
  - `package-lock.json`

## App-Level Docs

- Frontend app docs: `tpn/README.md`
- Frontend room flow notes: `tpn/QA_TODAY_ROOM_FLOW.md`
