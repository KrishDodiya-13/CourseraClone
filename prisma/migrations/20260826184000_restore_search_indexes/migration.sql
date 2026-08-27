-- Restore the search indexes.
--
-- A previously generated migration proposed dropping these (Prisma did not
-- know they existed, because the schema had no operator-class declarations for
-- them). It failed partway through — after the DROP INDEX statements ran but
-- before the ALTER TABLE — leaving the indexes gone while search still worked,
-- silently, on a sequential scan.
--
-- The schema now declares all four with their operator classes, so Prisma will
-- not propose dropping them again.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "courses_searchVector_idx"
  ON "courses" USING GIN ("searchVector");

CREATE INDEX IF NOT EXISTS "courses_title_trgm_idx"
  ON "courses" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "users_name_trgm_idx"
  ON "users" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "tags_name_trgm_idx"
  ON "tags" USING GIN ("name" gin_trgm_ops);
