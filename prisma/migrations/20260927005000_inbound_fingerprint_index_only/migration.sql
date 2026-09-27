-- Allow several Message-IDs (re-forwards) to share the same transaction fingerprint.
DROP INDEX IF EXISTS "ProcessedInboundEmail_userId_fingerprint_key";
CREATE INDEX "ProcessedInboundEmail_userId_fingerprint_idx" ON "ProcessedInboundEmail"("userId", "fingerprint");
