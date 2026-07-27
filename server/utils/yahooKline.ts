type Bar = { time: number; open: number; high: number; low: number; close: number }

const YAHOO_INTERVAL: Record<string, string> = {
  '1': '1m',
  '3': '3m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '60m',
  D: '1d',
  '240': '60m',
  W: '1wk',
  M: '1mo',
}

function yahooInterval(interval: string) {
  return YAHOO_INTERVAL[interval] ?? '15m'
}

export async function fetchYahooKlinesRange(opts: {
  ticker: string
  interval: string
  startMs: number
  endMs: number
}) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(opts.ticker)}`)
  url.searchParams.set('interval', yahooInterval(opts.interval))
  url.searchParams.set('period1', String(Math.floor(opts.startMs / 1000)))
  url.searchParams.set('period2', String(Math.ceil(opts.endMs / 1000)))
  url.searchParams.set('includePrePost', 'false')
  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; TradesAnalyzer/1.0)',
    },
  })
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`)
  const data = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[]
        indicators?: { quote?: Array<{ open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }> }
      }>
      error?: { description?: string }
    }
  }
  const err = data.chart?.error?.description
  if (err) throw new Error(err)
  const block = data.chart?.result?.[0]
  const ts = block?.timestamp ?? []
  const q = block?.indicators?.quote?.[0]
  if (!q || !ts.length) return [] as Bar[]
  const bars: Bar[] = []
  for (let i = 0; i < ts.length; i++) {
    const open = q.open?.[i]
    const high = q.high?.[i]
    const low = q.low?.[i]
    const close = q.close?.[i]
    if (open == null || high == null || low == null || close == null) continue
    const tMs = ts[i]! * 1000
    if (tMs < opts.startMs || tMs > opts.endMs) continue
    bars.push({
      time: ts[i]!,
      open,
      high,
      low,
      close,
    })
  }
  return bars.sort((a, b) => a.time - b.time)
}
