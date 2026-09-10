# PlanDan architecture

## Runtime

`browser/PWA -> Nginx -> Next.js app -> Prisma -> MariaDB`

A separate Node worker reads reminders from MariaDB and sends Web Push notifications through each browser subscription.

## Local-first data path

The service worker owns the local-first boundary. IndexedDB stores four logical areas:

- `meta`: bootstrap snapshot and cache metadata
- `queue`: ordered durable mutations
- `idMap`: temporary-local-ID to server-ID mapping
- `apiCache`: fallback JSON responses

The synchronized bootstrap contains the user's settings, planner items, reminders, recent occurrence states, active habits and recent check-ins, recent reflections, focus sessions and custom days off.

The client continues to call normal `/api/...` URLs. When controlled by the service worker, offline-capable requests are answered locally. This avoids duplicating a second application data API throughout the React components.

## Sync behavior

Mutations are applied locally before being enqueued. A background sync starts when online. Queue entries that target a temporary local ID are rewritten after the create request returns a real server ID. Server 5xx/network failures stop processing and preserve the remaining queue. Authentication failures stop processing and expose an auth-required state. Invalid 4xx mutations are dropped so one bad entry cannot block the queue forever.

After the queue is empty, PlanDan refreshes the authoritative bootstrap snapshot.

## Time model

Database timestamps represent absolute instants in UTC. Calendar-only concepts such as a habit check-in date are stored as semantic UTC-midnight date keys. The user's configured IANA timezone determines:

- what calendar day an instant belongs to
- day boundaries for queries
- item editor date/time values
- recurring wall-clock times
- reminder delivery calculations
- daily/weekly insight grouping

This separation avoids coupling behavior to the VPS timezone or the device's current travel timezone.
