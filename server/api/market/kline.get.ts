const MAINNET = 'https://api.bybit.com'
const TESTNET = 'https://api-testnet.bybit.com'

function klineIntervalToMs(interval: string) {
  if (/^\d+$/.test(interval)) {
    return Number(interval) * 60 * 1000
  }
  switch (interval) {
    case 'D':
      return 86400000
    case 'W':
      return 7 * 86400000
    case 'M':
      return 30 * 86400000
    default:
      return 60000
  }
}

function bybitMarketBaseUrl(testnet: boolean) {
  return testnet ? TESTNET : MAINNET
}

async function fetchBybitKlinesRange(opts: {
  baseUrl: string
  category: string
  symbol: string
  interval: string
  startMs: number
  endMs: number
}) {
  const ivMs = klineIntervalToMs(opts.interval)
  if (ivMs <= 0) throw new Error('invalid interval')
  const maxChunkMs = 1000 * ivMs
  const merged = new Map<
    number,
    { time: number; open: number; high: number; low: number; close: number }
  >()
  for (let chunkStart = opts.startMs; chunkStart < opts.endMs; ) {
    const chunkEnd = Math.min(chunkStart + maxChunkMs, opts.endMs)
    const url = new URL(`${opts.baseUrl}/v5/market/kline`)
    url.searchParams.set('category', opts.category)
    url.searchParams.set('symbol', opts.symbol)
    url.searchParams.set('interval', opts.interval)
    url.searchParams.set('start', String(Math.floor(chunkStart)))
    url.searchParams.set('end', String(Math.floor(chunkEnd)))
    url.searchParams.set('limit', '1000')
    const res = await fetch(url.toString())
    if (!res.ok) {
      throw new Error(`Bybit HTTP ${res.status}`)
    }
    const data = (await res.json()) as {
      retCode: number
      retMsg?: string
      result?: { list?: [string, string, string, string, string][] }
    }
    if (data.retCode !== 0) {
      throw new Error(data.retMsg || `Bybit ${data.retCode}`)
    }
    const list = data.result?.list ?? []
    for (const row of list) {
      const t = Number(row[0])
      if (t < opts.startMs || t > opts.endMs) continue
      merged.set(t, {
        time: Math.floor(t / 1000),
        open: parseFloat(row[1]),
        high: parseFloat(row[2]),
        low: parseFloat(row[3]),
        close: parseFloat(row[4]),
      })
    }
    if (chunkEnd <= chunkStart) break
    chunkStart = chunkEnd
  }
  return [...merged.values()].sort((a, b) => a.time - b.time)
}

const MAX_RANGE_MS = 86400000 * 400

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const symbol = String(q.symbol ?? '')
    .trim()
    .toUpperCase()
  const interval = String(q.interval ?? '15').trim()
  const startMs = Number(q.start)
  const endMs = Number(q.end)
  const categoryRaw = String(q.category ?? 'linear').toLowerCase()
  const category = categoryRaw === 'inverse' || categoryRaw === 'spot' ? categoryRaw : 'linear'
  if (!symbol) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите symbol' })
  }
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw createError({ statusCode: 400, statusMessage: 'Нужны start и end (мс), end > start' })
  }
  if (endMs - startMs > MAX_RANGE_MS) {
    throw createError({ statusCode: 400, statusMessage: 'Слишком большой диапазон дат' })
  }
  const config = useRuntimeConfig(event)
  const testnet =
    config.bybitTestnet === true || String(config.bybitTestnet ?? '').toLowerCase().trim() === 'true'
  const baseUrl = bybitMarketBaseUrl(testnet)
  try {
    const bars = await fetchBybitKlinesRange({
      baseUrl,
      category,
      symbol,
      interval,
      startMs,
      endMs,
    })
    return { bars }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ошибка загрузки свечей'
    throw createError({ statusCode: 502, statusMessage: msg })
  }
})
