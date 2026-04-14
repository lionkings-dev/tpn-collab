# TPN Frontend (`tpn`)

React + TypeScript + Vite client for the TPN collaborative editor.

## Commands

- `npm run dev` - start Vite dev server
- `npm run typecheck` - run TypeScript project checks
- `npm run build` - typecheck + production build
- `npm run lint` - run ESLint
- `npm run test:unit` - run unit tests (Vitest)
- `npm run pnml:format -- <file>` - pretty-format PNML files for docs/demo

From workspace root, use:

- `npm run dev:frontend`
- `npm run build:frontend`
- `npm run test:frontend`

## Environment

Create `tpn/.env.local` from `tpn/.env.example`.

Primary variables:

- `VITE_ROOM_API_URL`
- `VITE_WS_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID` (optional)

See root `ENVIRONMENT.md` for full cross-app wiring.

## Monorepo Notes

- Frontend consumes shared contracts from `@tpn/contracts`.
- Vite config excludes `@tpn/contracts` from optimize-deps to keep workspace source changes visible during local development.
