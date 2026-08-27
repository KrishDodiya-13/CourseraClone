-- ---------------------------------------------------------------------------
-- Full-text search and discovery facets.
--
-- The searchVector column is hand-written as GENERATED ALWAYS rather than left
-- as the plain tsvector column Prisma emits. That matters: a trigger or an
-- application-side update can be forgotten on some write path and silently
-- rot the index. A generated column cannot drift from its source columns,
-- because Postgres recomputes it on every insert and update.
--
-- Weighting: title (A) outranks subtitle (B), which outranks description (C),
-- so a course *about* a topic beats one that merely mentions it in prose.
-- ---------------------------------------------------------------------------

-- Trigram matching for instructor names and tag labels, where stemmed
-- full-text search is the wrong tool (proper nouns do not stem usefully).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("subtitle", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'C')
  ) STORED;

-- The index the search query actually rides on.
CREATE INDEX "courses_searchVector_idx" ON "courses" USING GIN ("searchVector");

-- Trigram indexes so the ILIKE fallbacks on names stay index-backed instead of
-- degrading to a sequential scan as the catalogue grows.
CREATE INDEX "courses_title_trgm_idx" ON "courses" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "users_name_trgm_idx" ON "users" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "tags_name_trgm_idx" ON "tags" USING GIN ("name" gin_trgm_ops);

-- CreateIndex — facet filters and sorts.
CREATE INDEX "courses_status_priceAmount_idx" ON "courses"("status", "priceAmount");

-- CreateIndex
CREATE INDEX "courses_status_durationMinutes_idx" ON "courses"("status", "durationMinutes");

-- CreateIndex
CREATE INDEX "courses_status_level_idx" ON "courses"("status", "level");

-- CreateIndex
CREATE INDEX "courses_status_language_idx" ON "courses"("status", "language");

-- CreateIndex
CREATE INDEX "courses_status_createdAt_idx" ON "courses"("status", "createdAt");
