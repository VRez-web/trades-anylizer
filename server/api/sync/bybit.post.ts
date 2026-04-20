import { eq } from 'drizzle-orm'
import type { InferInsertModel } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { trades } from '../../database/schema'
import {
  resolveBybitCredentials,
  resolveBybitHttpProxy,
  probeBybitApiKey,
  fetchAllClosedPnl,
  positionSideFromCloseOrder,
  closedPnlToExternalKey,
  bybitBaseUrl,
  BybitGeoBlockedError,
} from '../../utils/bybitCredentials'

type TradeInsert = InferInsertModel<typeof trades>

function mapRow(row: Record<string, string>, category: string, now: Date): TradeInsert | null {
  const openFee = Math.abs(parseFloat(row.openFee ?? '0'))
  const closeFee = Math.abs(parseFloat(row.closeFee ?? '0'))
  const entryPrice = parseFloat(row.avgEntryPrice)
  const exitPrice = parseFloat(row.avgExitPrice)
  const income = parseFloat(row.closedPnl)
  const cumEntry = parseFloat(row.cumEntryValue ?? '')
  const entryNotionalUsdt = Number.isFinite(cumEntry) && cumEntry > 0 ? cumEntry : null
  if (!Number.isFinite(entryPrice) || !Number.isFinite(exitPrice) || !Number.isFinite(income)) {
    return null
  }
  return {
    externalKey: closedPnlToExternalKey(
      { orderId: row.orderId, updatedTime: row.updatedTime },
      category,
    ),
    symbol: row.symbol,
    side: positionSideFromCloseOrder(row.side),
    entryReasonId: null,
    exitReasonId: null,
    entryAt: new Date(Number(row.createdTime)),
    exitAt: new Date(Number(row.updatedTime)),
    leverage: Math.max(0.01, parseFloat(row.leverage || '1') || 1),
    entryPrice,
    exitPrice,
    income,
    commission: openFee + closeFee,
    funding: 0,
    entryNotionalUsdt,
    rr: null,
    noteSystem: null,
    noteTechnique: null,
    noteAnalysis: null,
    createdAt: now,
    updatedAt: now,
  }
}

function syncErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig(event)
    const { apiKey, apiSecret, testnet } = resolveBybitCredentials(config)
    const proxyUrl = resolveBybitHttpProxy(config)
    if (!apiKey || !apiSecret) {
      throw createError({
        statusCode: 503,
        statusMessage:
          'Нет API ключей: задайте NUXT_BYBIT_API_KEY и NUXT_BYBIT_API_SECRET в .env (или BYBIT_API_KEY / BYBIT_API_SECRET) и перезапустите dev-сервер',
      })
    }
    const baseUrl = bybitBaseUrl(testnet)
    const keyCheck = await probeBybitApiKey(apiKey, apiSecret, baseUrl, proxyUrl)
    if (keyCheck.retCode !== 0) {
      throw createError({
        statusCode: 502,
        statusMessage: `Bybit отклонил ключи: ${keyCheck.retMsg || keyCheck.retCode} (проверьте mainnet/testnet и права ключа)`,
      })
    }
    const body = (await readBody(event).catch(() => ({}))) as { days?: number; category?: string }
    const days = Math.min(365 * 2, Math.max(1, Number(body.days ?? 365)))
    const category = body.category === 'inverse' ? 'inverse' : 'linear'
    const endTime = Date.now()
    const startTime = endTime - days * 86400000
    const list = (await fetchAllClosedPnl(apiKey, apiSecret, {
      baseUrl,
      category,
      startTime,
      endTime,
      proxyUrl,
    })) as Record<string, string>[]
    const db = useDb()
    const now = new Date()
    let inserted = 0
    let updated = 0
    for (const row of list) {
      const m = mapRow(row, category, now)
      if (!m) continue
      const [existing] = await db.select({ id: trades.id }).from(trades).where(eq(trades.externalKey, m.externalKey!))
      if (existing) {
        await db
          .update(trades)
          .set({
            symbol: m.symbol,
            side: m.side,
            entryAt: m.entryAt,
            exitAt: m.exitAt,
            leverage: m.leverage,
            entryPrice: m.entryPrice,
            exitPrice: m.exitPrice,
            income: m.income,
            commission: m.commission,
            funding: m.funding,
            entryNotionalUsdt: m.entryNotionalUsdt,
            updatedAt: now,
          })
          .where(eq(trades.id, existing.id))
        updated++
      } else {
        await db.insert(trades).values(m)
        inserted++
      }
    }
    const hint =
      list.length === 0
        ? 'За выбранный период закрытый PnL по linear/inverse пустой. Частые причины: торгуете только спотом (этот импорт — деривативы), нет закрытых позиций за период, неверный mainnet/testnet. Попробуйте увеличить days (например 365) или category=inverse.'
        : undefined
    return {
      ok: true,
      category,
      testnet,
      days,
      fetched: list.length,
      inserted,
      updated,
      hint,
    }
  } catch (e) {
    if (e && typeof e === 'object' && 'statusCode' in e) throw e
    if (e instanceof BybitGeoBlockedError) {
      throw createError({
        statusCode: 502,
        statusMessage: e.message,
        data: { detail: e.message, code: e.code },
      })
    }
    const msg = syncErrorMessage(e)
    console.error('[api/sync/bybit]', e)
    throw createError({
      statusCode: 500,
      statusMessage: msg.length > 400 ? `${msg.slice(0, 400)}…` : msg,
      data: { detail: msg },
    })
  }
})
