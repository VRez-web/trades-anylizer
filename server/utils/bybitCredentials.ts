import { createHmac } from 'node:crypto'
import { fetch as undiciFetch, ProxyAgent } from 'undici'

const MAINNET = 'https://api.bybit.com'
const TESTNET = 'https://api-testnet.bybit.com'

/** Исходящий IP (хостинг) в регионе, который Bybit/CloudFront режет — не исправляется ключами API. */
export class BybitGeoBlockedError extends Error {
  readonly code = 'BYBIT_GEO_BLOCKED' as const
  constructor() {
    super(
      'Bybit недоступен с IP этого сервера: геоблокировка CloudFront (часто регион датацентра хостинга, например Render). Варианты: VPS/хостинг в разрешённой стране, корпоративный прокси с выходом туда, где Bybit пускает API, или импорт сделок только с локальной машины (где API открыт).',
    )
    this.name = 'BybitGeoBlockedError'
  }
}

function isBybitCloudFrontGeoBlock(status: number, body: string): boolean {
  const t = body.toLowerCase()
  return (
    (status === 403 || status === 451) &&
    t.includes('cloudfront') &&
    (t.includes('country') || t.includes('blocked') || t.includes('geo'))
  )
}

/** Прокси для исходящих к Bybit (иначе с многих DC, в т.ч. Render, CloudFront отдаёт 403 по стране IP). */
export function resolveBybitHttpProxy(config: { bybitHttpProxy?: string }) {
  const pick = (...vals: (string | undefined)[]) => {
    for (const v of vals) {
      const s = v != null ? String(v).trim() : ''
      if (s) return s
    }
    return ''
  }
  const raw = pick(
    config.bybitHttpProxy,
    process.env.NUXT_BYBIT_HTTP_PROXY,
    process.env.NUXT_BYBIT_PROXY,
    process.env.HTTPS_PROXY,
    process.env.HTTP_PROXY,
  )
  return raw || undefined
}

function buildSortedQuery(params: Record<string, string | number | undefined>) {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => [k, String(v)] as [string, string])
    .sort((a, b) => a[0].localeCompare(b[0]))
  return new URLSearchParams(entries).toString()
}

export async function bybitSignedGet(
  path: string,
  params: Record<string, string | number | undefined>,
  apiKey: string,
  apiSecret: string,
  baseUrl: string,
  proxyUrl?: string,
) {
  const recvWindow = 8000
  const timestamp = Date.now()
  const qs = buildSortedQuery(params)
  const preSign = `${timestamp}${apiKey}${recvWindow}${qs}`
  const sign = createHmac('sha256', apiSecret).update(preSign).digest('hex')
  const url = `${baseUrl}${path}?${qs}`
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined
  const res = await undiciFetch(url, {
    dispatcher,
    headers: {
      'X-BAPI-API-KEY': apiKey,
      'X-BAPI-TIMESTAMP': String(timestamp),
      'X-BAPI-SIGN': sign,
      'X-BAPI-RECV-WINDOW': String(recvWindow),
    },
  })
  const text = await res.text()
  const preview = text.replace(/\s+/g, ' ').slice(0, 280)
  if (!text.trim()) {
    throw new Error(`Пустой ответ Bybit (${path}, HTTP ${res.status}). Проверьте сеть и URL.`)
  }
  if (isBybitCloudFrontGeoBlock(res.status, text)) {
    throw new BybitGeoBlockedError()
  }
  let data: { retCode: number; retMsg?: string; result?: { list?: unknown[]; nextPageCursor?: string } }
  try {
    data = JSON.parse(text) as typeof data
  } catch {
    if (isBybitCloudFrontGeoBlock(res.status, text)) {
      throw new BybitGeoBlockedError()
    }
    const looksHtml = /^\s*</.test(text)
    throw new Error(
      looksHtml
        ? `Bybit вернул HTML вместо JSON (${path}, HTTP ${res.status}). Часто это блокировка/прокси или неверный URL. Фрагмент: ${preview}`
        : `Ответ Bybit не JSON (${path}, HTTP ${res.status}): ${preview}`,
    )
  }
  return data
}

export async function fetchAllClosedPnl(
  apiKey: string,
  apiSecret: string,
  opts: { baseUrl: string; category: string; startTime: number; endTime: number; proxyUrl?: string },
) {
  const rows: Record<string, unknown>[] = []
  const chunkMs = 7 * 24 * 60 * 60 * 1000
  let windowStart = opts.startTime
  while (windowStart < opts.endTime) {
    const windowEnd = Math.min(windowStart + chunkMs - 1, opts.endTime)
    let cursor: string | undefined
    do {
      const params: Record<string, string | number | undefined> = {
        category: opts.category,
        startTime: windowStart,
        endTime: windowEnd,
        limit: 100,
      }
      if (cursor) params.cursor = cursor
      const data = await bybitSignedGet(
        '/v5/position/closed-pnl',
        params,
        apiKey,
        apiSecret,
        opts.baseUrl,
        opts.proxyUrl,
      )
      if (data.retCode !== 0) {
        throw new Error(data.retMsg || `Bybit retCode ${data.retCode}`)
      }
      const list = (data.result?.list ?? []) as Record<string, unknown>[]
      rows.push(...list)
      const next = data.result?.nextPageCursor
      cursor = next && String(next).length > 0 ? String(next) : undefined
    } while (cursor)
    windowStart = windowEnd + 1
  }
  return rows
}

export function bybitBaseUrl(testnet: boolean) {
  return testnet ? TESTNET : MAINNET
}

export function closedPnlToExternalKey(row: { orderId: string; updatedTime: string }, category: string) {
  return `bybit:${category}:${row.orderId}:${row.updatedTime}`
}

export function positionSideFromCloseOrder(side: string) {
  const s = side.trim().toLowerCase()
  return s === 'sell' ? ('long' as const) : ('short' as const)
}

export async function probeBybitApiKey(apiKey: string, apiSecret: string, baseUrl: string, proxyUrl?: string) {
  return bybitSignedGet('/v5/user/query-api', {}, apiKey, apiSecret, baseUrl, proxyUrl)
}

export function resolveBybitCredentials(config: {
  bybitApiKey?: string
  bybitApiSecret?: string
  bybitHttpProxy?: string
  bybitTestnet?: boolean | string
}) {
  const pick = (...vals: (string | undefined)[]) => {
    for (const v of vals) {
      const s = v != null ? String(v).trim() : ''
      if (s) return s
    }
    return ''
  }
  const apiKey = pick(
    config.bybitApiKey,
    process.env.NUXT_BYBIT_API_KEY,
    process.env.BYBIT_API_KEY,
    process.env.BYBIT_KEY,
  )
  const apiSecret = pick(
    config.bybitApiSecret,
    process.env.NUXT_BYBIT_API_SECRET,
    process.env.BYBIT_API_SECRET,
    process.env.BYBIT_SECRET,
    process.env.BYBIT_SECRET_KEY,
  )
  const testnetRaw = config.bybitTestnet ?? process.env.NUXT_BYBIT_TESTNET ?? process.env.BYBIT_TESTNET
  const testnet = testnetRaw === true || String(testnetRaw ?? '').toLowerCase().trim() === 'true'
  return { apiKey, apiSecret, testnet }
}
