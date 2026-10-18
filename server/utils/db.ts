import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { strategyDoc, schema as appSchema } from '../database/schema'
import type { AppDatabase } from '../types/app-database'

let _sql: ReturnType<typeof postgres> | null = null
let _db: AppDatabase | null = null
let _seed: Promise<void> | null = null

function logConnectionHintOnFailure(e: unknown) {
  const code =
    (e as NodeJS.ErrnoException)?.code ||
    (e as { cause?: NodeJS.ErrnoException })?.cause?.code
  if (code === 'ENETUNREACH' || String(e).includes('ENETUNREACH')) {
    console.error(
      '[db] Нет маршрута до хоста БД (часто Supabase Direct = только IPv6). В .env поставь DATABASE_URL ' +
        'из Supabase → Database → Connect → **Connection pooling**, режим **Session**, порт **5432** ' +
        '(хост `…pooler.supabase.com`, IPv4), не Direct `db.*.supabase.co`.',
    )
  }
}

function getConnectionString(): string {
  let u = process.env.DATABASE_URL?.trim() ?? process.env.NUXT_DATABASE_URL?.trim() ?? ''
  if (!u) {
    try {
      u = String(useRuntimeConfig().databaseUrl ?? '').trim()
    } catch {
      /* вне контекста Nuxt (редко) */
    }
  }
  if (!u) {
    throw new Error(
      'Задайте DATABASE_URL (строка подключения PostgreSQL, например Supabase: Project Settings → Database → URI).',
    )
  }
  return u
}

function createClient(url: string) {
  const isLocal = /localhost|127\.0\.0\.1/.test(url) && !url.includes('supabase')
  return postgres(url, {
    prepare: false,
    ssl: isLocal ? false : 'require',
    // Supabase session pooler: pool_size 15 на все инстансы (Render + локальный dev).
    // Transaction pooler (:6543) не подходит — postgres-js пайплайнит запросы, и ответы зависают.
    max: 4,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    connect_timeout: 25,
    onnotice: () => {},
  })
}

const globalDb = globalThis as typeof globalThis & {
  __tradesSql?: { url: string; sql: ReturnType<typeof postgres> }
}

function sharedClient() {
  const url = getConnectionString()
  const cached = globalDb.__tradesSql
  if (cached?.url === url) return cached.sql
  cached?.sql?.end({ timeout: 5 }).catch(() => {})
  const sql = createClient(url)
  globalDb.__tradesSql = { url, sql }
  return sql
}

/**
 * Клиент Drizzle (PostgreSQL). Требуется `DATABASE_URL` в окружении.
 * Локально — в `.env`, на Render — в Environment Variables.
 */
export function useDb(): AppDatabase {
  if (_db) return _db
  // HMR в dev перезагружает модуль — без кэша на globalThis старые соединения висят до лимита пула.
  _sql = sharedClient()
  _db = drizzle(_sql, { schema: appSchema })
  if (!_seed) {
    _seed = ensureSchemaExtras(_sql).then(() => ensureStrategyRow(_db!)).catch((e) => {
      logConnectionHintOnFailure(e)
      console.error('[db] ensureStrategyRow', e)
    })
  }
  return _db
}

export async function ensureDbSeeded() {
  useDb()
  if (_seed) {
    await _seed
  }
}

async function ensureSchemaExtras(sql: ReturnType<typeof postgres>) {
  await sql`
    CREATE TABLE IF NOT EXISTS quick_notes (
      id serial PRIMARY KEY,
      title text NOT NULL DEFAULT '',
      body text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS trades_exit_at_idx ON trades (exit_at)`
  await sql`CREATE INDEX IF NOT EXISTS trade_label_links_label_idx ON trade_label_links (label_id)`
}

async function ensureStrategyRow(db: AppDatabase) {
  const rows = await db.select().from(strategyDoc).where(eq(strategyDoc.id, 1)).limit(1)
  if (rows.length === 0) {
    await db.insert(strategyDoc).values({ id: 1, markdown: '', updatedAt: new Date() })
  }
}

export { appSchema as schema }
export type { AppDatabase } from '../types/app-database'
