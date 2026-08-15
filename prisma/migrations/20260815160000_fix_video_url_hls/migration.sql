-- For each Game, parse the videos JSON array.
-- Where a video's url ends with .m3u8 and hlsUrl is missing/null:
--   move url -> hlsUrl, set url to '' (no mp4 fallback available).
-- SQLite 3.38+ supports json_type and json_insert.

-- Step 1: Create a temp table with migrated video data.
-- We iterate over each row and rewrite the videos column.

-- Unfortunately SQLite doesn't have a loop construct in pure SQL
-- that can iterate over rows and apply JSON transformations per-row
-- in a single statement. We use a multi-step approach:

-- For each game row where videos contains at least one .m3u8 url,
-- we need to rewrite the JSON. Since this is complex in raw SQL,
-- we'll use a simpler approach: update all rows where videos
-- contains '.m3u8' by running a JS migration script instead.

-- This migration is a no-op placeholder. The actual data fix
-- runs via the scripts/migrate-video-urls.js script.
-- Run: node scripts/migrate-video-urls.js after deploying.

SELECT 1;
