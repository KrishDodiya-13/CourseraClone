-- Progression controls for the learning experience.
--
-- Hand-written rather than generated: the generated diff for this schema also
-- proposes dropping the GIN indexes and the searchVector expression, which is
-- what broke in the previous phase. Two additive columns with defaults need no
-- more than this.

-- Sequential unlocking, opt-in per course.
ALTER TABLE "courses"
  ADD COLUMN "sequentialProgress" BOOLEAN NOT NULL DEFAULT false;

-- Whether a lesson counts toward completion.
ALTER TABLE "lessons"
  ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT true;
