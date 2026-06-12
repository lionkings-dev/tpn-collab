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
