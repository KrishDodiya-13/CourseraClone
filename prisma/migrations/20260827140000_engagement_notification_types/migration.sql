-- Notification types for the engagement system.
--
-- Hand-written, like the other recent migrations: the generated diff still
-- proposes dropping the GIN indexes and the searchVector expression, which
-- Prisma cannot see.
--
-- `ADD VALUE ... IF NOT EXISTS` is safe inside a transaction on PostgreSQL 12+
-- so long as the new value is not *used* in the same transaction. Nothing
-- below writes a row, so it is not.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'STREAK_MILESTONE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BADGE_EARNED';
