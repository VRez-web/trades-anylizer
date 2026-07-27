import { looksLikeForexSymbol } from '../../utils/chartProvider'

const MAINNET = 'https://api.bybit.com'
const TESTNET = 'https://api-testnet.bybit.com'

const FOREX_PAIRS = [
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'USDCHF',
  'AUDUSD',
  'USDCAD',
  'NZDUSD',
  'EURGBP',
  'EURJPY',
  'GBPJPY',
  'XAUUSD',
  'XAGUSD',
]

type Item = {
  symbol: string
  category: string
  chartProvider: 'bybit' | 'yahoo'
  label: string
}

let bybitCache: { at: number; items: Item[] } | null = null
const CACHE_MS = 1000 * 60 * 60

async function loadBybitInstruments(testnet: boolean): Promise<Item[]> {
  const now = Date.now()
  if (bybitCache && now - bybitCache.at < CACHE_MS) return bybitCache.items
  const base = testnet ? TESTNET : MAINNET
  const categories = ['linear', 'spot', 'inverse'] as const
  const out: Item[] = []
  for (const category of categories) {
    let cursor = ''
    for (let page = 0; page < 20; page++) {
      const url = new URL(`${base}/v5/market/instruments-info`)
      url.searchParams.set('category', category)
      url.searchParams.set('limit', '1000')
      if (cursor) url.searchParams.set('cursor', cursor)
      const res = await fetch(url.toString())
      if (!res.ok) break
      const data = (await res.json()) as {
        retCode: number
        result?: { list?: Array<{ symbol: string; status?: string }>; nextPageCursor?: string }
      }
      if (data.retCode !== 0) break
      for (const row of data.result?.list ?? []) {
        if (row.status && row.status !== 'Trading') continue
        out.push({
          symbol: row.symbol,
          category,
          chartProvider: 'bybit',
          label: `${row.symbol} · Bybit ${category}`,
        })
      }
      cursor = data.result?.nextPageCursor ?? ''
      if (!cursor) break
    }
  }
  bybitCache = { at: now, items: out }
  return out
}

function forexItems(q: string): Item[] {
  const items: Item[] = []
  for (const sym of FOREX_PAIRS) {
    if (!q || sym.includes(q)) {
      items.push({
        symbol: sym,
        category: 'forex',
        chartProvider: 'yahoo',
        label: `${sym} · Forex (Yahoo)`,
      })
    }
  }
  return items
}

export default defineEventHandler(async (event) => {
  const q = String(getQuery(event).q ?? '')
    .trim()
    .toUpperCase()
  const limit = Math.min(50, Math.max(5, Number(getQuery(event).limit) || 25))
  const config = useRuntimeConfig(event)
  const testnet =
    config.bybitTestnet === true || String(config.bybitTestnet ?? '').toLowerCase().trim() === 'true'

  const bybit = await loadBybitInstruments(testnet)
  let items: Item[] = []
  if (q) {
    items = bybit.filter((x) => x.symbol.includes(q))
    if (looksLikeForexSymbol(q) || q.length >= 3) {
      const fx = forexItems(q)
      for (const f of fx) {
        if (!items.some((x) => x.symbol === f.symbol && x.chartProvider === 'yahoo')) items.push(f)
      }
    }
  } else {
    items = [...forexItems(''), ...bybit.filter((x) => /USDT$/.test(x.symbol)).slice(0, 40)]
  }
  return { items: items.slice(0, limit) }
})
