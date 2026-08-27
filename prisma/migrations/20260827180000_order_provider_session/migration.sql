-- Provider correlation and checkout expiry.
--
-- Hand-written, as with the other recent migrations: the generated diff still
-- proposes dropping the GIN indexes and the searchVector expression.

ALTER TABLE "orders"
  ADD COLUMN "provider" "PaymentProvider",
  ADD COLUMN "providerSessionId" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Unique so a session id can only ever resolve to one order. This is what
-- makes webhook handling safe to retry: the same session always finds the
-- same order, never a second one.
CREATE UNIQUE INDEX "orders_providerSessionId_key"
  ON "orders"("providerSessionId");

-- Reaping abandoned checkouts scans on this.
CREATE INDEX "orders_status_expiresAt_idx" ON "orders"("status", "expiresAt");
