#!/bin/sh
# Nightly database backup (cron, see deploy/crontab): a compressed dump in
# /opt/obh/backups, last 14 kept. Copy it off the server as part of the
# backup policy — the dump contains financial data.
set -eu
cd /opt/obh
mkdir -p backups
chmod 700 backups
file="obh-$(date -u +%Y%m%d-%H%M).sql.gz"
docker compose exec -T db pg_dump -U obh -d obh --no-owner | gzip > "backups/$file.tmp"
mv "backups/$file.tmp" "backups/$file"
chmod 600 "backups/$file"
ls -1t backups/obh-*.sql.gz | tail -n +15 | xargs -r rm --
