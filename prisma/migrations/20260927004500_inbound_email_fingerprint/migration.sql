-- Deduplicate inbound emails by transaction fingerprint (re-forwards share one expense).
ALTER TABLE "ProcessedInboundEmail" ADD COLUMN "fingerprint" TEXT;

UPDATE "ProcessedInboundEmail"
SET "fingerprint" = 'legacy:' || "messageId"
WHERE "fingerprint" IS NULL;

ALTER TABLE "ProcessedInboundEmail" ALTER COLUMN "fingerprint" SET NOT NULL;

CREATE UNIQUE INDEX "ProcessedInboundEmail_userId_fingerprint_key" ON "ProcessedInboundEmail"("userId", "fingerprint");
