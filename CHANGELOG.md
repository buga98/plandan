# Changelog

## 1.3.0 — Final PWA performance/offline release

### Performance
- Switched offline-capable reads to IndexedDB/local-first responses.
- Writes now update the local snapshot optimistically and return immediately.
- Queue synchronization runs in the background instead of blocking UI actions.
- Added queue compaction for repeated item, habit, occurrence, reflection and settings updates.
- Added a single-flight sync lock to prevent duplicate queue processors.
- Throttled bootstrap refresh and private app-shell warming.
- Prefetched application routes while online and retained document-level offline fallback.
- Reduced bootstrap history payload for occurrence states, habits, reflections and focus sessions.

### Offline reliability
- Calendar, Habits, More, To-do, Notes, Focus, Insights, Settings and Days Off can reopen from the private cached shell after an online warm-up.
- Item/habit/day-off creation uses temporary local IDs that are mapped to server IDs after sync.
- Offline mutations survive reloads in IndexedDB and flush on reconnect/background sync.
- Private local cache is separated from the public shell and cleared on logout/account change.

### Timezone / DST
- Added validated IANA timezone helpers for client and server.
- Calendar boundaries, today keys, item editing and display use the configured PlanDan timezone.
- Recurrence preserves wall-clock time across CET/CEST transitions.
- Reminder worker validates stored timezone values and includes a small recovery look-back after restarts.
- Weekly statistics now group days in the configured timezone instead of UTC.
- Added automated Europe/Zagreb winter/summer/DST/reminder audit.

### Deployment
- App and worker now share one Docker image.
- Removed the expensive recursive runtime `chown` layer by using `COPY --chown`.
- Production dependencies are pruned after build.
- Added GitHub Actions build validation and GitHub-first VPS deployment documentation.
