# PlanDan v2 — instant local-first SPA

PlanDan v2 is a second frontend served at `/v2/index.html`. It intentionally keeps the existing Next.js/Prisma backend and MariaDB data model, but removes Next.js routing and server reads from the day-to-day mobile interaction loop.

## Runtime flow

1. The React + Vite shell starts immediately.
2. Existing PlanDan bootstrap data is read directly from IndexedDB (`plandan-local-first-v1`).
3. Calendar, habits, tasks, notes, focus, insights, check-in and settings render from local state.
4. Primary navigation is an in-memory state switch — no route request and no RSC navigation.
5. Mutations update local state/IndexedDB first and are queued by `/v2/sw-v2.js`.
6. The service worker synchronizes the queue to the existing `/api/*` endpoints in the background.
7. After synchronization the authoritative bootstrap snapshot is refreshed from the server.

## Why this is faster

The VPS is not on the critical path for taps. Switching Calendar → Habits → More is only a React state update. Task completion and habit counters update optimistically before network synchronization.

## Deployment

The root `npm run build` first runs `npm run build:spa`. Vite writes the production shell and hashed assets into `public/v2`, then the normal Next production build runs. The existing Docker image therefore serves both clients from the same origin and both clients use the same authentication cookie and API.

The original `/app` client remains available during the v2 speed test. After v2 is accepted, `/app` can be redirected to the SPA and the old frontend can be retained only as a fallback or removed.

## PWA

The v2 manifest has `start_url=/v2/index.html` and `scope=/v2/`. A dedicated service worker controls only the v2 client, caches the SPA shell/assets and handles the offline mutation queue. The existing root service worker is left untouched for the current production PWA.
