-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryPath" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "entryName" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "steamAppId" INTEGER,
    "title" TEXT,
    "releaseYear" INTEGER,
    "description" TEXT,
    "developers" TEXT NOT NULL,
    "publishers" TEXT NOT NULL,
    "genres" TEXT NOT NULL,
    "coverUrl" TEXT,
    "headerUrl" TEXT,
    "heroUrl" TEXT,
    "logoUrl" TEXT,
    "screenshots" TEXT NOT NULL DEFAULT '[]',
    "videos" TEXT NOT NULL DEFAULT '[]',
    "steamDeckCategory" INTEGER,
    "steamDeckItems" TEXT NOT NULL DEFAULT '[]',
    "matchStatus" TEXT NOT NULL,
    "matchScore" REAL,
    "matchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Game" ("coverUrl", "createdAt", "description", "developers", "entryName", "entryPath", "entryType", "genres", "headerUrl", "heroUrl", "id", "logoUrl", "matchScore", "matchStatus", "matchedAt", "publishers", "releaseYear", "screenshots", "sizeBytes", "steamAppId", "title", "updatedAt", "videos") SELECT "coverUrl", "createdAt", "description", "developers", "entryName", "entryPath", "entryType", "genres", "headerUrl", "heroUrl", "id", "logoUrl", "matchScore", "matchStatus", "matchedAt", "publishers", "releaseYear", "screenshots", "sizeBytes", "steamAppId", "title", "updatedAt", "videos" FROM "Game";
DROP TABLE "Game";
ALTER TABLE "new_Game" RENAME TO "Game";
CREATE UNIQUE INDEX "Game_entryPath_key" ON "Game"("entryPath");
CREATE INDEX "Game_matchStatus_idx" ON "Game"("matchStatus");
CREATE INDEX "Game_steamAppId_idx" ON "Game"("steamAppId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
