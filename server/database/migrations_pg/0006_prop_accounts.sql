CREATE TABLE IF NOT EXISTS "prop_accounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "prop_accounts_name_unique" ON "prop_accounts" ("name");

INSERT INTO "prop_accounts" ("name", "status", "created_at", "updated_at")
SELECT DISTINCT trim("account_name"), 'active', NOW(), NOW()
FROM "prop_events"
WHERE trim("account_name") <> ''
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "prop_accounts" ("name", "status", "created_at", "updated_at")
SELECT DISTINCT trim("account_name"), 'active', NOW(), NOW()
FROM "trades"
WHERE "trade_source" = 'prop' AND trim(coalesce("account_name", '')) <> ''
ON CONFLICT ("name") DO NOTHING;
