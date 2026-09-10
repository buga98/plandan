#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo '[PlanDan] Building shared app/worker runtime image...'
docker compose build app

echo '[PlanDan] Recreating app and worker...'
docker compose up -d --force-recreate app worker

sleep 5
docker compose ps
curl -fsS http://127.0.0.1:3600/api/health && echo
