import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { strategyDoc, schema as appSchema } from '../database/schema'
import type { AppDatabase } from '../types/app-database'

let _sql: ReturnType<typeof postgres> | null = null
let _db: AppDatabase | null = null
let _seed: Promise<void> | null = null

function getConnectionString(): string {
  const u = process.env.DATABASE_URL?.trim() ?? process.env.NUXT_DATABASE_URL?.trim() ?? ''
  if (!u) {
    throw new Error(
      'Задайте DATABASE_URL (строка подключения PostgreSQL, например Supabase: Project Settings → Database → URI).',
    )
  }
  return u
}

function createClient() {
  const url = getConnectionString()
  const isLocal = /localhost|127\.0\.0\.1/.test(url) && !url.includes('supabase')
  return postgres(url, {
    prepare: false,
    ssl: isLocal ? false : 'require',
    max: 10,
  })
}

/**
 * Клиент Drizzle (PostgreSQL). Требуется `DATABASE_URL` в окружении.
 * Локально — в `.env`, на Render — в Environment Variables.
 */
export function useDb(): AppDatabase {
  if (_db) return _db
  _sql = createClient()
  _db = drizzle(_sql, { schema: appSchema })
  if (!_seed) {
    _seed = ensureStrategyRow(_db).catch((e) => {
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

async function ensureStrategyRow(db: AppDatabase) {
  const rows = await db.select().from(strategyDoc).where(eq(strategyDoc.id, 1)).limit(1)
  if (rows.length === 0) {
    await db.insert(strategyDoc).values({ id: 1, markdown: '', updatedAt: new Date() })
  }
}

export { appSchema as schema }
export type { AppDatabase } from '../types/app-database'
