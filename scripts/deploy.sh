#!/bin/bash

set -e

APP_DIR="${APP_DIR%/}"
DATA_DIR="${DATA_DIR%/}"
BACKUP_DIR="${BACKUP_DIR%/}"

rm -rf "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

docker compose -f "$APP_DIR/docker-compose.yml" down --remove-orphans --rmi all || true

mv -f "$APP_DIR" "$BACKUP_DIR/" || true
mv -f "$DATA_DIR" "$BACKUP_DIR/" || true

mkdir -p "$DATA_DIR"
mkdir -p "$APP_DIR"
cp -R * "$APP_DIR/"

cd "$APP_DIR"

cat <<EOF > .env
TOKEN="$TOKEN"
GUILD_ID="$GUILD_ID"
EOF

docker compose up --build --wait
