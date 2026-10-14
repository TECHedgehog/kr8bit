ALTER TABLE "RepackGame" ADD COLUMN "genres" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "RepackGame" ADD COLUMN "steamDeckCategory" INTEGER;
ALTER TABLE "RepackGame" ADD COLUMN "latestPostAt" DATETIME;

UPDATE "RepackGame"
SET "genres" = CASE
  WHEN json_valid("metadataSnapshot") AND json_type("metadataSnapshot", '$.genres') = 'array'
  THEN json_extract("metadataSnapshot", '$.genres')
  ELSE '[]'
END,
"steamDeckCategory" = CASE
  WHEN json_valid("metadataSnapshot") THEN json_extract("metadataSnapshot", '$.steamDeckCompat.category')
  ELSE NULL
END,
"latestPostAt" = (
  SELECT MAX("publishedAt")
  FROM "RepackPost"
  WHERE "RepackPost"."gameId" = "RepackGame"."id"
);

CREATE INDEX "RepackGame_steamDeckCategory_idx" ON "RepackGame"("steamDeckCategory");
CREATE INDEX "RepackGame_latestPostAt_idx" ON "RepackGame"("latestPostAt");
