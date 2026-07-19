-- CreateTable
CREATE TABLE "Game" (
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
    "matchStatus" TEXT NOT NULL,
    "matchScore" REAL,
    "matchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScanRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rootPath" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "found" INTEGER NOT NULL DEFAULT 0,
    "added" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "errors" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_entryPath_key" ON "Game"("entryPath");

-- CreateIndex
CREATE INDEX "Game_matchStatus_idx" ON "Game"("matchStatus");

-- CreateIndex
CREATE INDEX "Game_steamAppId_idx" ON "Game"("steamAppId");

