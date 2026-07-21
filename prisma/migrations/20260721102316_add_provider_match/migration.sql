-- CreateTable
CREATE TABLE "ProviderMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "remoteId" TEXT NOT NULL,
    "matchScore" REAL,
    "matchedAt" DATETIME NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ProviderMatch_providerName_remoteId_idx" ON "ProviderMatch"("providerName", "remoteId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderMatch_gameId_providerName_key" ON "ProviderMatch"("gameId", "providerName");
