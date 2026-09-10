# VPS deployment from GitHub

These commands update the application source from `buga98/plandan` while preserving the existing production `.env` and Docker MariaDB volume.

## First GitHub-backed deployment on the existing VPS directory

```bash
cd /opt/plandan

# Safety backup of configuration and database
cp .env /home/luka/plandan.env.backup-$(date +%Y%m%d-%H%M%S)
./scripts/backup.sh

# Connect the existing directory to GitHub
if [ ! -d .git ]; then
  git init
  git remote add origin https://github.com/buga98/plandan.git
else
  git remote set-url origin https://github.com/buga98/plandan.git
fi

git fetch origin main
git reset --hard origin/main

# The ignored production .env remains in place.
# Never run docker compose down -v during a normal application update.

docker compose build app
docker compose up -d --force-recreate app worker

# Verify
docker compose ps
curl -fsS http://127.0.0.1:3600/api/health && echo
curl -fsS https://plandan.lineaplusdev.com/api/health && echo
```

## Later updates

```bash
cd /opt/plandan
./scripts/backup.sh
git fetch origin main
git reset --hard origin/main
docker compose build app
docker compose up -d --force-recreate app worker
docker compose ps
curl -fsS http://127.0.0.1:3600/api/health && echo
```

## After a service-worker release

Open PlanDan once while online, keep it open for a few seconds, then fully close and reopen the installed PWA. The new service worker claims the app and warms the private application shell. After that, test Calendar, Habits and More with Wi-Fi/mobile data disabled.

## Rollback

Before deployment, note the current commit:

```bash
git rev-parse HEAD
```

To roll back application code without touching the database volume:

```bash
git reset --hard <previous-commit-sha>
docker compose build app
docker compose up -d --force-recreate app worker
```
