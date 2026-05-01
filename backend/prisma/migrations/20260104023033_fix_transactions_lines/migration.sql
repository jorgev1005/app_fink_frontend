-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "lines" TEXT;

-- CreateTable
CREATE TABLE "transaction_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "contactPersonId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amount" REAL,
    "debitAccountId" TEXT,
    "creditAccountId" TEXT,
    "paymentMethod" TEXT,
    "lines" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "transaction_templates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transaction_templates_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "transaction_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transaction_templates_contactPersonId_fkey" FOREIGN KEY ("contactPersonId") REFERENCES "contact_persons" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
