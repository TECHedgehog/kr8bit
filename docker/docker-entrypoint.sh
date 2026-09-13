#!/bin/sh
set -e

mkdir -p "$(dirname "$DB_PATH")" "$CACHE_DIR"

# Keep normal and demo databases migrated independently.
export DATABASE_URL="file:${DB_PATH}"
export DEMO_DATABASE_URL="file:${DB_PATH}.demo"

node_modules/.bin/prisma migrate deploy
DATABASE_URL="$DEMO_DATABASE_URL" node_modules/.bin/prisma migrate deploy

# Post-deploy data migration for the video URL/hls split. Idempotent: it
# only rewrites games whose .m3u8 video url lacks an hlsUrl, so repeat
# runs (every container start) are no-ops.
DATABASE_URL="file:${DB_PATH}" node scripts/migrate-video-urls.js
DATABASE_URL="$DEMO_DATABASE_URL" node scripts/migrate-video-urls.js

exec node dist/main.js
