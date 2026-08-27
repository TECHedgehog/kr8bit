-- Normalize stale "4X (explore, expand, exploit, and exterminate)" genre entries.
--
-- IGDB returns the full theme name as "4X (explore, expand, exploit, and exterminate)".
-- The IGDB_THEME_MAP previously keyed on the short "4X", so the lookup missed and the
-- long name was stored raw in the genres JSON array. This broke genre filtering because
-- parseGenres() splits the genre query param on commas, shattering the long name.
--
-- genres is a TEXT column storing JSON.stringify(string[]), so each element is
-- double-quoted. We replace the quoted long name with the quoted canonical "Strategy".
--
-- Caveat: rows that already contained "Strategy" will now hold a duplicate
-- "Strategy" entry (e.g. ["Strategy","Strategy"]). This is harmless:
--   - findDistinctGenres() dedupes via a Set, so the chip list stays clean.
--   - The contains-based filter still matches "Strategy".
-- No dedup is performed at the SQL level.

UPDATE "Game"
SET "genres" = REPLACE(
  "genres",
  '"4X (explore, expand, exploit, and exterminate)"',
  '"Strategy"'
)
WHERE "genres" LIKE '%4X (explore, expand, exploit, and exterminate)%';
