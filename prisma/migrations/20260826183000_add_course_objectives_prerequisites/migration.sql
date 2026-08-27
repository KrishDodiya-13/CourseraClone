-- Learning objectives and prerequisites for the course detail page.
--
-- Both default to an empty array rather than NULL: "this course has no
-- prerequisites" is a real statement a learner needs to see, and it should not
-- be indistinguishable from "nobody filled this in".
ALTER TABLE "courses"
  ADD COLUMN "learningObjectives" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "prerequisites" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
