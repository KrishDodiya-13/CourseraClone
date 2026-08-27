-- Submission modes for assignments.
--
-- Hand-written: the generated diff for this schema still proposes dropping the
-- GIN indexes and the searchVector expression, which Prisma cannot see.
-- Additive columns with defaults need nothing more than this.

ALTER TABLE "assignments"
  ADD COLUMN "allowUrlSubmission" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "allowFileUpload" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "assignment_submissions"
  ADD COLUMN "submissionUrl" TEXT;
