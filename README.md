# PlanDan

**PlanDan** is a mobile-first, local-first PWA for planning everyday life: calendar, tasks, events, notes, habits, focus sessions, reflections and reminders in one installable web app.

Production: **https://plandan.lineaplusdev.com**

## What makes it different

PlanDan is designed to keep working when the network is slow or completely unavailable. After the first online load, the authenticated app shell and synchronized user data are stored locally. Reads are served from IndexedDB first, mutations are applied optimistically, and a durable queue synchronizes changes with the VPS when connectivity returns.

The v1.3 release focuses on responsiveness, offline reliability and timezone correctness. Calendar interactions no longer wait on the server for every action, navigation is prefetched while online and backed by cached document routes offline, and reminder calculations preserve the user's wall-clock time across daylight-saving changes.

## Features

- Monthly calendar as the primary home screen
- Day hub with timeline, To-do and Notes tabs
- Tasks, events and notes with priorities, categories, colors and recurrence
- Multiple reminder offsets per item
- Web Push notifications while the PWA is closed
- Habits with daily targets, streaks and fixed/interval reminders
- Global To-do and Notes libraries
- Focus timer and weekly insights
- Daily mood, energy, gratitude and reflection check-in
- Public holidays and custom days off
- Croatian, English and German UI
- Light, dark and system themes
- PWA install flow for iPhone/iPad and Android
- JSON account export
- Per-user session and data isolation

## Local-first / offline model

PlanDan uses a service worker plus IndexedDB as an application data layer:

1. A synchronized bootstrap snapshot is stored locally after authentication.
2. Offline-capable API GET requests are derived from that snapshot immediately.
3. Writes update the local snapshot first and return to the UI immediately.
4. Writes are stored in an IndexedDB mutation queue.
5. When the connection is available, the queue is flushed to the server in order.
6. Temporary local IDs are mapped to server IDs after successful creation.
7. Repeated updates such as checkbox toggles and settings changes are compacted before sync.
8. After sync, the authoritative server snapshot refreshes the local store.

Private app routes are cached separately from public pages and are cleared on logout/account change.

## Timezone and reminder correctness

The configured IANA timezone (default `Europe/Zagreb`) is the source of truth for calendar dates, recurrence and reminders. Date/time values are converted to UTC only for storage and transport. Recurring items are advanced in local wall-clock time and then converted back to UTC, preventing the common one-hour drift after DST changes.

The repository includes an automated audit covering:

- CET winter offset (`UTC+1`)
- CEST summer offset (`UTC+2`)
- DST start and DST end
- reminder offsets such as 10 minutes before an occurrence
- habit reminder slots in winter and summer

Run it with:

```bash
npm run test:timezone
```

## Stack

- Next.js 15 / React 19 / TypeScript
- Prisma ORM
- MariaDB 11.4
- Web Push + VAPID
- Service Worker + IndexedDB
- Docker / Docker Compose
- Nginx reverse proxy in production

## Local development

Requirements: Node.js 22.13+ and MySQL/MariaDB.

```bash
cp .env.example .env
npm install
npx prisma migrate deploy
npm run dev
```

Generate VAPID keys if needed:

```bash
npm run vapid
```

Never commit the real `.env` file. `.env.example` contains placeholders only.

## Docker

```bash
docker compose build app
docker compose up -d
```

The app and reminder worker intentionally share the same `plandan-runtime:1.3.0` image, so Docker does not build/export the same application image twice. The runtime image is copied with ownership already set and production pruning removes build-only dependencies.

Health check:

```bash
curl http://127.0.0.1:3600/api/health
```

## VPS deployment from GitHub

The production deployment keeps the existing `.env` and MariaDB volume while replacing application source from `main`. See [docs/VPS-DEPLOY-GITHUB.md](docs/VPS-DEPLOY-GITHUB.md).

## CI

GitHub Actions validates JavaScript syntax, runs the timezone/DST audit and performs a full Next.js production build on every push to `main` and every pull request.

## Privacy and security

Passwords are hashed, sessions use secure HttpOnly cookies in production, origin checks protect state-changing routes, and application data is scoped by authenticated user IDs. Local private data belongs to the signed-in account and is cleared when the app detects an account change or logout.

## Version

**PlanDan v1.3.0 — Final PWA performance/offline release**
