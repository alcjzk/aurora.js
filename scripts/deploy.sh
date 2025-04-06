#!/bin/bash

set -e

APP_DIR="${APP_DIR%/}"
DATA_PATH="${DATA_PATH%/}"

mkdir -p "$APP_DIR"
cd "$APP_DIR"

docker compose down --remove-orphans --rmi all || true

cp -Rf "$APP_DIR" "$APP_DIR.backup"
cp -Rf "$DATA_PATH" "$DATA_PATH.backup"

rm -rf ./*
cp -R ./* "$APP_DIR/"

cat <<EOF > .env
TOKEN="$TOKEN"
GUILD_ID="$GUILD_ID"
EOF

docker compose up --build --wait
