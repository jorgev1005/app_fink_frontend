-- CreateTable
CREATE TABLE IF NOT EXISTS "certified_deliveries" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "docCategory" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "recipientTaxId" TEXT,
    "title" TEXT,
    "totalAmount" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'USD',
    "fileUrl" TEXT NOT NULL,
    "fileHashSha256" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstViewedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "clientNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certified_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "certified_audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certified_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "certified_deliveries_token_key" ON "certified_deliveries"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "certified_deliveries_token_idx" ON "certified_deliveries"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "certified_deliveries_documentNumber_idx" ON "certified_deliveries"("documentNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "certified_deliveries_recipientPhone_idx" ON "certified_deliveries"("recipientPhone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "certified_audit_logs_deliveryId_eventType_idx" ON "certified_audit_logs"("deliveryId", "eventType");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'certified_audit_logs_deliveryId_fkey'
    ) THEN
        ALTER TABLE "certified_audit_logs" ADD CONSTRAINT "certified_audit_logs_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "certified_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
