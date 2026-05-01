-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "subType" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BS',
    "projectId" TEXT,
    "parentId" TEXT,
    "balanceBs" REAL NOT NULL DEFAULT 0,
    "balanceUsd" REAL NOT NULL DEFAULT 0,
    "balanceEur" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "accounts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_accounts" ("balanceBs", "balanceEur", "balanceUsd", "code", "createdAt", "description", "id", "isActive", "name", "parentId", "projectId", "subType", "type", "updatedAt") SELECT "balanceBs", "balanceEur", "balanceUsd", "code", "createdAt", "description", "id", "isActive", "name", "parentId", "projectId", "subType", "type", "updatedAt" FROM "accounts";
DROP TABLE "accounts";
ALTER TABLE "new_accounts" RENAME TO "accounts";
CREATE UNIQUE INDEX "accounts_projectId_code_key" ON "accounts"("projectId", "code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
