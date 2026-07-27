import { chartProviderEnum, type ChartProvider } from '../database/schema'

export { chartProviderEnum, type ChartProvider }

export function parseChartProvider(v: unknown): ChartProvider {
  if (v === 'yahoo') return 'yahoo'
  return 'bybit'
}

export function parseMarketCategory(v: unknown): 'linear' | 'spot' | 'inverse' {
  const s = String(v ?? 'linear').toLowerCase()
  if (s === 'spot' || s === 'inverse') return s
  return 'linear'
}

/** 6 букв без USDT — типичный FX-тикер (GBPUSD, EURUSD). */
export function looksLikeForexSymbol(symbol: string) {
  const s = symbol.trim().toUpperCase()
  return /^[A-Z]{6}$/.test(s) && !s.endsWith('USDT')
}

export function yahooTicker(symbol: string) {
  const s = symbol.trim().toUpperCase()
  if (s.endsWith('=X')) return s
  if (looksLikeForexSymbol(s)) return `${s}=X`
  return s
}

export type ChartMeta = {
  chartSymbol: string
  chartProvider: ChartProvider
  marketCategory: string
}

/** Метаданные графика по тикеру, если в БД ещё не сохранены. */
export function defaultChartMeta(symbol: string): ChartMeta {
  const chartSymbol = symbol.trim().toUpperCase()
  if (looksLikeForexSymbol(chartSymbol)) {
    return { chartSymbol, chartProvider: 'yahoo', marketCategory: 'forex' }
  }
  return { chartSymbol, chartProvider: 'bybit', marketCategory: 'linear' }
}

export function resolveChartMeta(
  symbol: string,
  stored?: {
    chartSymbol?: string | null
    chartProvider?: string | null
    marketCategory?: string | null
  },
): ChartMeta {
  const fallback = defaultChartMeta(symbol)
  const hasStoredChart =
    Boolean((stored?.chartSymbol ?? '').trim()) ||
    stored?.chartProvider === 'yahoo' ||
    Boolean((stored?.marketCategory ?? '').trim())
  if (!hasStoredChart) return fallback

  const chartSymbol = (stored?.chartSymbol ?? '').trim().toUpperCase() || fallback.chartSymbol
  const chartProvider =
    stored?.chartProvider === 'yahoo' || stored?.chartProvider === 'bybit'
      ? stored.chartProvider
      : fallback.chartProvider
  const marketCategory =
    (stored?.marketCategory ?? '').trim() ||
    (chartProvider === 'yahoo' ? 'forex' : fallback.marketCategory)
  return { chartSymbol, chartProvider, marketCategory }
}

export function parseChartMetaBody(body: Record<string, unknown>, symbol: string): ChartMeta {
  const base = defaultChartMeta(symbol)
  const chartSymbol =
    body.chartSymbol != null && String(body.chartSymbol).trim()
      ? String(body.chartSymbol).trim().toUpperCase()
      : base.chartSymbol
  const chartProvider =
    body.chartProvider != null ? parseChartProvider(body.chartProvider) : base.chartProvider
  let marketCategory =
    body.marketCategory != null && String(body.marketCategory).trim()
      ? String(body.marketCategory).trim().toLowerCase()
      : chartProvider === 'yahoo'
        ? 'forex'
        : base.marketCategory
  if (chartProvider === 'yahoo') marketCategory = 'forex'
  else if (marketCategory === 'forex') marketCategory = 'linear'
  return { chartSymbol, chartProvider, marketCategory }
}
