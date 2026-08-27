-- Move the human-quotable identifier prefix with the brand.
--
-- Certificate serials and order numbers are printed on credentials and
-- receipts, so they carry the product name. Renaming the product without
-- renaming them would leave every certificate stamped with the old one.
--
-- Both prefixes are the same length, so nothing about the format changes —
-- `LUM-XXXXX-XXXXX-XXXXX-XXXXX` becomes `CRS-XXXXX-XXXXX-XXXXX-XXXXX`, and the
-- 100 bits of entropy in the body are untouched.
--
-- Note for a real deployment: a certificate serial is a public verification
-- capability, so rewriting one invalidates any link already shared. That is
-- acceptable here because these rows are development seed data. Against real
-- issued credentials the correct move is to leave existing serials alone and
-- change only the generator, accepting a mixed-prefix table.
UPDATE "certificates"
SET "serial" = 'CRS-' || substring("serial" from 5)
WHERE "serial" LIKE 'LUM-%';

UPDATE "orders"
SET "orderNumber" = 'CRS-' || substring("orderNumber" from 5)
WHERE "orderNumber" LIKE 'LUM-%';
