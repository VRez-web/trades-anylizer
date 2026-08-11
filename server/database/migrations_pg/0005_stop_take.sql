ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "stop_price" double precision;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "take_profit_price" double precision;
