CREATE TABLE IF NOT EXISTS "prop_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "account_name" text NOT NULL,
  "amount_usdt" double precision NOT NULL,
  "event_at" timestamp with time zone NOT NULL,
  "note" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);
