import { tradeSourceEnum, type TradeSource } from '../database/schema'

export function parseTradeSource(v: unknown): TradeSource {
  if (typeof v === 'string' && (tradeSourceEnum as readonly string[]).includes(v)) {
    return v as TradeSource
  }
  return 'live'
}

export function tradeSourceLabel(source: TradeSource): string {
  if (source === 'test') return 'тест'
  if (source === 'prop') return 'проп'
  return 'live'
}
