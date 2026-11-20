ALTER TABLE "contacts" ADD COLUMN "phone_normalized" text;--> statement-breakpoint
UPDATE "contacts"
SET "phone_normalized" = NULLIF(regexp_replace("phone", '[^0-9]', '', 'g'), '')
WHERE "phone" IS NOT NULL;--> statement-breakpoint
-- Keep the earliest record's number and clear later duplicates before enforcing uniqueness.
WITH ranked_phones AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "phone_normalized"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS duplicate_rank
  FROM "contacts"
  WHERE "phone_normalized" IS NOT NULL
)
UPDATE "contacts" AS contact
SET "phone" = NULL, "phone_normalized" = NULL
FROM ranked_phones
WHERE contact."id" = ranked_phones."id"
  AND ranked_phones.duplicate_rank > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_phone_normalized_unique" ON "contacts" USING btree ("phone_normalized");