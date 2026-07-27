export type ChartProvider = 'bybit' | 'yahoo'

export type ChartMeta = {
  chartSymbol: string
  chartProvider: ChartProvider
  marketCategory: string
}

export function looksLikeForexSymbol(symbol: string) {
  const s = symbol.trim().toUpperCase()
  return /^[A-Z]{6}$/.test(s) && !s.endsWith('USDT')
}

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

export function chartProviderLabel(provider: ChartProvider, category: string) {
  if (provider === 'yahoo') return 'Yahoo Finance'
  return `Bybit (${category})`
}
