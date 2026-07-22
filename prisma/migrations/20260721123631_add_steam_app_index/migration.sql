-- CreateTable
CREATE TABLE "SteamAppIndex" (
    "appId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "indexedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SteamAppIndex_name_idx" ON "SteamAppIndex"("name");
