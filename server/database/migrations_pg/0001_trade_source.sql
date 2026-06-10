ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "trade_source" text NOT NULL DEFAULT 'live';
