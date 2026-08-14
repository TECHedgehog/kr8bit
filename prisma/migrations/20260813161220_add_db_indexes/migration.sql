-- CreateIndex
CREATE INDEX "ProviderMatch_gameId_idx" ON "ProviderMatch"("gameId");

-- CreateIndex
CREATE INDEX "ScanRun_status_idx" ON "ScanRun"("status");

-- CreateIndex
CREATE INDEX "ScanRun_startedAt_idx" ON "ScanRun"("startedAt");
