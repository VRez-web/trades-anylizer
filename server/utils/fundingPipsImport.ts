import { parse as parseHtml } from 'node-html-parser'
import type { InferInsertModel } from 'drizzle-orm'
import { calcRr } from '#shared/tradeRr'
import { defaultChartMeta } from '#shared/chartMeta'
import { trades } from '../database/schema'

export type TradeInsert = InferInsertModel<typeof trades>

export type FundingPipsParsedRow = {
  symbol: string
  side: 'long' | 'short'
  entryAt: Date
  exitAt: Date
  entryPrice: number
  exitPrice: number
  stopPrice: number | null
  takeProfitPrice: number | null
  commission: number
  income: number
  externalKey: string
  rr: number | null
}

const HEADER_ALIASES: Record<string, string[]> = {
  symbol: ['symbol', 'pair', 'instrument'],
  type: ['type', 'side', 'direction'],
  openDate: ['open date', 'open time', 'entry date', 'entry time'],
  openPrice: ['open', 'open price', 'entry', 'entry price'],
  closedDate: ['closed date', 'close date', 'close time', 'exit date', 'exit time'],
  closedPrice: ['closed', 'close', 'close price', 'exit', 'exit price'],
  tp: ['tp', 'take profit', 'takeprofit'],
  sl: ['sl', 'stop loss', 'stoploss', 'stop'],
  lots: ['lots', 'lot', 'volume'],
  commission: ['commission', 'fee', 'fees'],
  profit: ['profit', 'pnl', 'net profit', 'net p&l', 'net pnl', 'result'],
}

function normHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

function mapHeaders(headers: string[]): Record<string, number> | null {
  const norm = headers.map(normHeader)
  const idx: Record<string, number> = {}
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const i = norm.findIndex((h) => aliases.includes(h))
    if (i >= 0) idx[key] = i
  }
  const required = ['symbol', 'type', 'openDate', 'openPrice', 'closedDate', 'closedPrice', 'profit']
  if (!required.every((k) => idx[k] != null)) return null
  return idx
}

/** FundingPips: `M/D/YYYY, H:MM` — wall-clock в часовом поясе пользователя (tzOffsetMinutes = Date.getTimezoneOffset()). */
export function parseFundingPipsDate(raw: string, tzOffsetMinutes = 0): Date | null {
  const s = raw.trim()
  if (!s || s === '-' || s === '—') return null
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const month = Number(m[1])
  const day = Number(m[2])
  const year = Number(m[3])
  const hour = Number(m[4])
  const min = Number(m[5])
  const sec = m[6] ? Number(m[6]) : 0
  if (![month, day, year, hour, min, sec].every(Number.isFinite)) return null
  const utcMs = Date.UTC(year, month - 1, day, hour, min, sec) + tzOffsetMinutes * 60 * 1000
  const d = new Date(utcMs)
  return Number.isNaN(+d) ? null : d
}

function parseMoney(raw: string): number | null {
  const s = raw.trim()
  if (!s || s === '-' || s === '—') return null
  const cleaned = s.replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1')
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function parsePrice(raw: string): number | null {
  const s = raw.trim()
  if (!s || s === '-' || s === '—') return null
  const n = Number.parseFloat(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseSide(raw: string): 'long' | 'short' | null {
  const s = raw.trim().toLowerCase()
  if (s === 'buy' || s === 'long') return 'long'
  if (s === 'sell' || s === 'short') return 'short'
  return null
}

function buildExternalKey(accountName: string, row: Omit<FundingPipsParsedRow, 'externalKey' | 'rr'>) {
  const openIso = row.entryAt.toISOString()
  return `fundingpips:${accountName}:${openIso}:${row.symbol}:${row.entryPrice}`
}

function rowFromCells(
  cells: string[],
  idx: Record<string, number>,
  accountName: string,
  tzOffsetMinutes: number,
): FundingPipsParsedRow | null {
  const get = (k: string) => cells[idx[k] ?? -1]?.trim() ?? ''
  const symbol = get('symbol').toUpperCase()
  const side = parseSide(get('type'))
  const entryAt = parseFundingPipsDate(get('openDate'), tzOffsetMinutes)
  const exitAt = parseFundingPipsDate(get('closedDate'), tzOffsetMinutes)
  const entryPrice = parsePrice(get('openPrice'))
  const exitPrice = parsePrice(get('closedPrice'))
  const profit = parseMoney(get('profit'))
  if (!symbol || !side || !entryAt || !exitAt || entryPrice == null || exitPrice == null || profit == null) {
    return null
  }
  const commissionRaw = idx.commission != null ? get('commission') : ''
  const commission = Math.abs(parseMoney(commissionRaw) ?? 0)
  const stopPrice = idx.sl != null ? parsePrice(get('sl')) : null
  const takeProfitPrice = idx.tp != null ? parsePrice(get('tp')) : null
  const income = profit + commission
  const base = {
    symbol,
    side,
    entryAt,
    exitAt,
    entryPrice,
    exitPrice,
    stopPrice,
    takeProfitPrice,
    commission,
    income,
  }
  const rr =
    stopPrice != null && takeProfitPrice != null
      ? calcRr(side, entryPrice, stopPrice, takeProfitPrice)
      : null
  return {
    ...base,
    externalKey: buildExternalKey(accountName, base),
    rr,
  }
}

function splitTableLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim())
  if (line.includes('|')) {
    return line
      .split('|')
      .map((c) => c.trim())
      .filter((_, i, arr) => !(i === 0 && arr[0] === '') && !(i === arr.length - 1 && arr[arr.length - 1] === ''))
  }
  return line.split(/\s{2,}/).map((c) => c.trim())
}

function isShareTradeNoise(s: string) {
  return /^share\s*trade$/i.test(s.trim())
}

function looksLikeSymbolCell(s: string) {
  const t = s.trim().toUpperCase()
  if (!t || isShareTradeNoise(t)) return false
  if (parseSide(t)) return false
  return /^[A-Z0-9]{3,12}$/.test(t)
}

/** FundingPips: Symbol часто на строке выше, Type (Buy/Sell) — на следующей. */
function prepareFundingPipsCells(
  cells: string[],
  pendingSymbol: string,
): { cells: string[]; pendingSymbol: string } {
  const cleaned = cells.map((c) => c.trim()).filter((c) => c && !isShareTradeNoise(c))
  if (!cleaned.length) return { cells: [], pendingSymbol }

  if (cleaned.length === 1 && looksLikeSymbolCell(cleaned[0]!)) {
    return { cells: [], pendingSymbol: cleaned[0]!.toUpperCase() }
  }

  const first = cleaned[0] ?? ''
  if (parseSide(first)) {
    if (pendingSymbol) return { cells: [pendingSymbol, ...cleaned], pendingSymbol }
    return { cells: cleaned, pendingSymbol }
  }

  if (looksLikeSymbolCell(first) && cleaned.length > 1 && parseSide(cleaned[1] ?? '')) {
    return { cells: cleaned, pendingSymbol: first.toUpperCase() }
  }

  return { cells: cleaned, pendingSymbol }
}

function rowsFromCellLines(
  lines: string[],
  colMap: Record<string, number>,
  accountName: string,
  headerLineNo: number,
  tzOffsetMinutes: number,
): { rows: FundingPipsParsedRow[]; errors: string[] } {
  const errors: string[] = []
  const rows: FundingPipsParsedRow[] = []
  let pendingSymbol = ''

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!
    const cells = splitTableLine(rawLine)
    const prep = prepareFundingPipsCells(cells, pendingSymbol)
    pendingSymbol = prep.pendingSymbol
    if (!prep.cells.length) continue

    const row = rowFromCells(prep.cells, colMap, accountName, tzOffsetMinutes)
    if (row) {
      rows.push(row)
    } else if (prep.cells.length >= 3) {
      errors.push(`Строка ${headerLineNo + i + 2}: не удалось распознать`)
    }
  }

  return { rows, errors }
}

export function parseFundingPipsText(
  text: string,
  accountName: string,
  tzOffsetMinutes = 0,
): { rows: FundingPipsParsedRow[]; errors: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return { rows: [], errors: ['Пустой текст'] }

  let headerIdx = -1
  let colMap: Record<string, number> | null = null
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const cells = splitTableLine(lines[i]!)
    const map = mapHeaders(cells)
    if (map) {
      headerIdx = i
      colMap = map
      break
    }
  }
  if (!colMap) {
    return { rows: [], errors: ['Не найдены заголовки таблицы (Symbol, Type, Open Date, …)'] }
  }

  return rowsFromCellLines(lines.slice(headerIdx + 1), colMap, accountName, headerIdx, tzOffsetMinutes)
}

function tableToRows(
  tableEl: ReturnType<typeof parseHtml>,
  accountName: string,
  tzOffsetMinutes: number,
): { rows: FundingPipsParsedRow[]; errors: string[] } {
  const trs = tableEl.querySelectorAll('tr')
  if (!trs.length) return { rows: [], errors: ['Таблица пуста'] }

  let colMap: Record<string, number> | null = null
  let dataStart = 0
  for (let i = 0; i < Math.min(trs.length, 3); i++) {
    const cells = trs[i]!.querySelectorAll('th, td').map((el) => el.text.trim())
    const map = mapHeaders(cells)
    if (map) {
      colMap = map
      dataStart = i + 1
      break
    }
  }
  if (!colMap) return { rows: [], errors: ['Не найдены заголовки в HTML-таблице'] }

  const dataLines: string[] = []
  for (let i = dataStart; i < trs.length; i++) {
    const cells = trs[i]!.querySelectorAll('td, th').map((el) => el.text.trim())
    if (!cells.length) continue
    dataLines.push(cells.join('\t'))
  }
  return rowsFromCellLines(dataLines, colMap, accountName, 0, tzOffsetMinutes)
}

export function parseFundingPipsHtml(
  html: string,
  accountName: string,
  tzOffsetMinutes = 0,
): { rows: FundingPipsParsedRow[]; errors: string[] } {
  const root = parseHtml(html)
  const tables = root.querySelectorAll('table')
  if (!tables.length) return { rows: [], errors: ['HTML не содержит таблиц'] }

  let best: { rows: FundingPipsParsedRow[]; errors: string[] } = { rows: [], errors: [] }
  for (const table of tables) {
    const parsed = tableToRows(table, accountName, tzOffsetMinutes)
    if (parsed.rows.length > best.rows.length) best = parsed
  }
  if (!best.rows.length && !best.errors.length) {
    return { rows: [], errors: ['Не удалось извлечь строки из таблиц'] }
  }
  return best
}

export function looksLikeFundingPipsHtml(text: string): boolean {
  const sample = text.trim().slice(0, 8000).toLowerCase()
  return sample.includes('<table') || sample.includes('<tbody') || sample.includes('<html')
}

/** TSV из буфера или HTML страницы / фрагмента после Ctrl+C. */
export function parseFundingPipsContent(
  text: string,
  accountName: string,
  tzOffsetMinutes = 0,
): { rows: FundingPipsParsedRow[]; errors: string[] } {
  const trimmed = text.trim()
  if (!trimmed) return { rows: [], errors: ['Пустой текст'] }
  if (looksLikeFundingPipsHtml(trimmed)) return parseFundingPipsHtml(trimmed, accountName, tzOffsetMinutes)
  return parseFundingPipsText(trimmed, accountName, tzOffsetMinutes)
}

export function toTradeInsert(row: FundingPipsParsedRow, accountName: string, now: Date): TradeInsert {
  const chart = defaultChartMeta(row.symbol)
  return {
    externalKey: row.externalKey,
    symbol: row.symbol,
    side: row.side,
    entryReasonId: null,
    exitReasonId: null,
    entryAt: row.entryAt,
    exitAt: row.exitAt,
    leverage: 1,
    entryPrice: row.entryPrice,
    exitPrice: row.exitPrice,
    income: row.income,
    commission: row.commission,
    funding: 0,
    entryNotionalUsdt: null,
    rr: row.rr,
    stopPrice: row.stopPrice,
    takeProfitPrice: row.takeProfitPrice,
    noteSystem: null,
    noteTechnique: null,
    noteAnalysis: null,
    noteSystemTs: null,
    noteTechniqueTs: null,
    noteAnalysisTs: null,
    tradeSource: 'prop',
    accountName,
    chartSymbol: chart.chartSymbol,
    marketCategory: chart.marketCategory,
    chartProvider: chart.chartProvider,
    createdAt: now,
    updatedAt: now,
  }
}

export type FundingPipsPreviewRow = FundingPipsParsedRow & {
  duplicate: boolean
}
