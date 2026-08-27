-- Instructor name on the certificate.
--
-- Hand-written, as with the other recent migrations: the generated diff still
-- proposes dropping the GIN indexes and the searchVector expression.
--
-- Defaults to empty rather than NULL so existing rows stay valid, and the
-- backfill below fills them from the current owning instructor. That is the
-- best available answer for certificates issued before this column existed.

ALTER TABLE "certificates"
  ADD COLUMN "instructorNameSnapshot" TEXT NOT NULL DEFAULT '';

UPDATE "certificates" c
SET "instructorNameSnapshot" = COALESCE(u."name", '')
FROM "course_instructors" ci
JOIN "users" u ON u."id" = ci."userId"
WHERE ci."courseId" = c."courseId"
  AND ci."role" = 'OWNER'
  AND c."instructorNameSnapshot" = '';
