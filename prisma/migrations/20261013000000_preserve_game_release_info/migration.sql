ALTER TABLE "Game" ADD COLUMN "originalEntryName" TEXT;
ALTER TABLE "Game" ADD COLUMN "releaseVersion" TEXT;
ALTER TABLE "Game" ADD COLUMN "releaseDlcs" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Game" ADD COLUMN "releaseGroup" TEXT;
