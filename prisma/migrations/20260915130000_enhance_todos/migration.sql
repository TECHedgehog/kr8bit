ALTER TABLE "Todo" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Todo" ADD COLUMN "priority" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Todo" ADD COLUMN "color" TEXT;

CREATE INDEX "Todo_parentId_completed_sortOrder_idx" ON "Todo"("parentId", "completed", "sortOrder");
