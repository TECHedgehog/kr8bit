#!/bin/sh
set -e

mkdir -p "$(dirname "$DB_PATH")" "$CACHE_DIR"

# Single DB source: derive the Prisma connection string from DB_PATH so
# containers never need a separate DATABASE_URL variable.
export DATABASE_URL="file:${DB_PATH}"

node_modules/.bin/prisma migrate deploy

# Post-deploy data migration for the video URL/hls split. Idempotent: it
# only rewrites games whose .m3u8 video url lacks an hlsUrl, so repeat
# runs (every container start) are no-ops.
node scripts/migrate-video-urls.js

exec node dist/main.js
