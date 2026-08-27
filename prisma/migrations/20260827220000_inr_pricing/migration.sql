-- Move the catalogue to Indian Rupees.
--
-- Amounts stay integer minor units — paise now rather than cents — so nothing
-- about the monetary architecture changes. What changes is the unit and the
-- ISO code that travels with it.
--
-- Prices are re-pointed to Indian price points rather than divided by an
-- exchange rate. A converted price lands on figures like ₹4,116, which reads
-- as an import rather than a product priced for the market. The mapping below
-- is deliberate, and the old USD figure is kept in the comment so the
-- reasoning survives.
--
-- Historical orders, order items and payments are NOT touched. Those rows are
-- snapshots of what was actually agreed and charged; rewriting them would make
-- every past receipt a lie. They keep their USD code, and the per-row currency
-- on each table is what lets them keep rendering correctly.

-- Defaults for anything created from here on.
ALTER TABLE "courses"     ALTER COLUMN "currency" SET DEFAULT 'INR';
ALTER TABLE "orders"      ALTER COLUMN "currency" SET DEFAULT 'INR';
ALTER TABLE "order_items" ALTER COLUMN "currency" SET DEFAULT 'INR';
ALTER TABLE "payments"    ALTER COLUMN "currency" SET DEFAULT 'INR';

ALTER TABLE "instructor_payouts"     ALTER COLUMN "currency" SET DEFAULT 'INR';
ALTER TABLE "instructor_payout_lines" ALTER COLUMN "currency" SET DEFAULT 'INR';

-- Catalogue prices, in paise.
UPDATE "courses" SET "priceAmount" = 149900, "compareAtAmount" = NULL,   "currency" = 'INR' WHERE "slug" = 'writing-for-engineers';        -- was $49
UPDATE "courses" SET "priceAmount" = 199900, "compareAtAmount" = 299900, "currency" = 'INR' WHERE "slug" = 'positioning-before-tactics';   -- was $59 / $89
UPDATE "courses" SET "priceAmount" = 249900, "compareAtAmount" = 399900, "currency" = 'INR' WHERE "slug" = 'design-systems-that-survive';  -- was $74 / $99
UPDATE "courses" SET "priceAmount" = 299900, "compareAtAmount" = 499900, "currency" = 'INR' WHERE "slug" = 'systems-design-foundations';   -- was $89 / $149
UPDATE "courses" SET "priceAmount" = 499900, "compareAtAmount" = 799900, "currency" = 'INR' WHERE "slug" = 'evaluating-language-models';   -- was $119

-- Free stays free, but still needs the code corrected.
UPDATE "courses" SET "currency" = 'INR' WHERE "priceAmount" = 0;

-- Anything not named above (a course added since this migration was written).
UPDATE "courses" SET "currency" = 'INR' WHERE "currency" = 'USD';

-- Fixed-amount coupons are denominated; percentage ones are not.
UPDATE "coupons" SET "currency" = 'INR' WHERE "currency" = 'USD';
