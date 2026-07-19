#!/bin/sh
set -e

mkdir -p "$(dirname "$DB_PATH")" "$CACHE_DIR"

node node_modules/prisma/build/index.js migrate deploy

exec node dist/main.js