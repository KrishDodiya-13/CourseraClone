-- Index the two foreign keys that carry a real query path.
--
-- Hand-written, like every migration in this project since Prisma proposed
-- dropping the GIN indexes and the generated tsvector expression as "drift".
-- CREATE INDEX IF NOT EXISTS keeps it safe to re-run.
--
-- enrollments.orderId: refund reversal reads and updates every enrolment for
-- one order, inside an open transaction. A sequential scan there is the worst
-- place to have one.
CREATE INDEX IF NOT EXISTS "enrollments_orderId_idx" ON "enrollments" ("orderId");

-- courses.categoryId: the catalogue always filters status first, so the
-- (status, categoryId, publishedAt) composite serves it. Admin moderation
-- filters by category across every status, which that composite cannot serve.
CREATE INDEX IF NOT EXISTS "courses_categoryId_idx" ON "courses" ("categoryId");
