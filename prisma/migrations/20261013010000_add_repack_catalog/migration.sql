-- CreateTable
CREATE TABLE "RepackGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "providerName" TEXT,
    "providerRemoteId" TEXT,
    "matchStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "matchScore" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RepackPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "publishedAt" DATETIME,
    "contentText" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '{}',
    "downloadOptions" TEXT NOT NULL DEFAULT '[]',
    "postKind" TEXT NOT NULL DEFAULT 'GAME',
    "contentHash" TEXT NOT NULL,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gameId" TEXT,
    CONSTRAINT "RepackPost_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "RepackGame" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RepackGame_normalizedTitle_key" ON "RepackGame"("normalizedTitle");
CREATE INDEX "RepackGame_matchStatus_idx" ON "RepackGame"("matchStatus");
CREATE UNIQUE INDEX "RepackPost_source_sourceUrl_key" ON "RepackPost"("source", "sourceUrl");
CREATE INDEX "RepackPost_source_lastSeenAt_idx" ON "RepackPost"("source", "lastSeenAt");
CREATE INDEX "RepackPost_gameId_idx" ON "RepackPost"("gameId");
