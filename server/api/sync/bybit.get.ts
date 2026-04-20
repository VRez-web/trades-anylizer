import { sql } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { trades } from '../../database/schema'
import { resolveBybitCredentials, probeBybitApiKey, bybitBaseUrl } from '../../utils/bybitCredentials'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const { apiKey, apiSecret, testnet } = resolveBybitCredentials(config)
  const baseUrl = bybitBaseUrl(testnet)
  const keysPresent = Boolean(apiKey && apiSecret)
  const db = useDb()
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(trades)
  const tradeCount = Number(n)
  let probe:
    | { ok: boolean; retMsg?: string; retCode?: number; note?: string }
    | { ok: boolean; retMsg?: string }
  if (!keysPresent) {
    probe = {
      ok: false,
      retMsg:
        'В .env нет ключей. Нужны NUXT_BYBIT_API_KEY и NUXT_BYBIT_API_SECRET (или BYBIT_API_KEY / BYBIT_API_SECRET). Перезапустите npm run dev после правок .env',
    }
  } else {
    try {
      const data = await probeBybitApiKey(apiKey, apiSecret, baseUrl)
      probe = {
        ok: data.retCode === 0,
        retCode: data.retCode,
        retMsg: data.retMsg,
        note: data.retCode === 0 ? 'Ключи приняты биржей' : undefined,
      }
    } catch (e) {
      probe = {
        ok: false,
        retMsg: e instanceof Error ? e.message : 'Ошибка запроса к Bybit',
      }
    }
  }
  return {
    keysPresent,
    testnet,
    baseUrl,
    tradeCount,
    probe,
  }
})
