#!/usr/bin/env bash
# Database dump, run ON THE SERVER (daily by cron, see server-setup.sh).
# Keeps 14 days in ~/backups. Restore: deploy/README.md.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$HOME/backups"
mkdir -p "$BACKUP_DIR"

set -a; source "$DEPLOY_DIR/.env"; set +a

FILE="$BACKUP_DIR/db-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose -f "$DEPLOY_DIR/docker-compose.prod.yml" exec -T db \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner | gzip > "$FILE"

find "$BACKUP_DIR" -name 'db-*.sql.gz' -mtime +14 -delete
echo "$(date -Is) backup written: $FILE"
