import { inArray } from 'drizzle-orm'
import { useDb } from '../../../utils/db'
import { trades } from '../../../database/schema'
import {
  parseFundingPipsContent,
  toTradeInsert,
  type FundingPipsPreviewRow,
} from '../../../utils/fundingPipsImport'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  const accountName = String(body.accountName ?? '').trim()
  if (!accountName) {
    throw createError({ statusCode: 400, statusMessage: 'accountName required' })
  }
  const pasted = String(body.text ?? '').trim()
  if (!pasted) {
    throw createError({ statusCode: 400, statusMessage: 'text required' })
  }
  const dryRun = Boolean(body.dryRun)
  const tzRaw = Number(body.tzOffsetMinutes)
  const tzOffsetMinutes = Number.isFinite(tzRaw) ? tzRaw : 0

  const parsed = parseFundingPipsContent(pasted, accountName, tzOffsetMinutes)
  const errors = [...parsed.errors]

  const totalParsed = parsed.rows.length

  const db = useDb()
  const keys = parsed.rows.map((r) => r.externalKey)
  const existingKeys = new Set<string>()
  if (keys.length) {
    const chunks: string[][] = []
    for (let i = 0; i < keys.length; i += 200) chunks.push(keys.slice(i, i + 200))
    for (const chunk of chunks) {
      const found = await db
        .select({ externalKey: trades.externalKey })
        .from(trades)
        .where(inArray(trades.externalKey, chunk))
      for (const f of found) {
        if (f.externalKey) existingKeys.add(f.externalKey)
      }
    }
  }

  const preview: FundingPipsPreviewRow[] = parsed.rows.map((r) => ({
    ...r,
    duplicate: existingKeys.has(r.externalKey),
  }))

  const toImport = preview.filter((r) => !r.duplicate)
  let imported = 0
  let skipped = preview.filter((r) => r.duplicate).length

  if (!dryRun && toImport.length) {
    const now = new Date()
    try {
      await db.transaction(async (tx) => {
        for (const row of toImport) {
          try {
            await tx.insert(trades).values(toTradeInsert(row, accountName, now))
            imported++
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e)
            if (msg.includes('unique') || msg.includes('duplicate')) {
              skipped++
            } else {
              errors.push(`Insert ${row.symbol}: ${msg}`)
            }
          }
        }
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      throw createError({ statusCode: 500, statusMessage: msg })
    }
  }

  return {
    preview: preview.map((r) => ({
      symbol: r.symbol,
      side: r.side,
      entryAt: r.entryAt.toISOString(),
      exitAt: r.exitAt.toISOString(),
      entryPrice: r.entryPrice,
      exitPrice: r.exitPrice,
      stopPrice: r.stopPrice,
      takeProfitPrice: r.takeProfitPrice,
      commission: r.commission,
      income: r.income,
      net: r.income - r.commission,
      rr: r.rr,
      externalKey: r.externalKey,
      duplicate: r.duplicate,
    })),
    totalParsed,
    imported: dryRun ? 0 : imported,
    skipped,
    errors,
  }
})
