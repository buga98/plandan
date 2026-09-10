#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
set -a; source .env; set +a
STAMP=$(date +%Y%m%d-%H%M%S)
docker compose exec -T db mariadb-dump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" | gzip > "backups/plandan-$STAMP.sql.gz"
find backups -type f -name 'plandan-*.sql.gz' -mtime +14 -delete
printf 'Backup: %s\n' "backups/plandan-$STAMP.sql.gz"
