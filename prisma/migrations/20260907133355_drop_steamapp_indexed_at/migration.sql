/*
  Warnings:

  - You are about to drop the column `indexedAt` on the `SteamAppIndex` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SteamAppIndex" (
    "appId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);
INSERT INTO "new_SteamAppIndex" ("appId", "name") SELECT "appId", "name" FROM "SteamAppIndex";
DROP TABLE "SteamAppIndex";
ALTER TABLE "new_SteamAppIndex" RENAME TO "SteamAppIndex";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
