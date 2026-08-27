-- Move the development seed accounts onto the new brand's fixture domain.
--
-- Renamed in place rather than re-seeded. Re-running the seed with new
-- addresses would create a second set of users and leave every enrolment,
-- certificate and order attached to the old ones; an UPDATE keeps every
-- relationship intact and simply changes what the accounts are called.
--
-- `.test` is a reserved TLD that can never resolve, which is what makes these
-- obviously fixtures rather than addresses anyone could mistake for real.
UPDATE "users"
SET "email" = replace("email", '@lumen.test', '@coursera.test')
WHERE "email" LIKE '%@lumen.test';
