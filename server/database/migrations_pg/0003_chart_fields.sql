ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "chart_symbol" text;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "market_category" text;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "chart_provider" text NOT NULL DEFAULT 'bybit';
