import { defineConfig } from 'drizzle-kit'

/**
 * `drizzle-kit` не подгружает `.env` — в `package.json` для `db:push` используется
 * `node --env-file=.env`.
 *
 * **IPv4 / вечный «Pulling schema…»:** хост `db.*.supabase.co` (Direct) часто резолвится
 * только в **IPv6**. Если сеть до IPv6 не дотягивается, бери в Supabase
 * **Settings → Database → Connect → Connection string** вариант **Connection pooling**,
 * режим **Session** (порт **5432**, хост `aws-0-….pooler.supabase.com` — у пулer есть IPv4).
 * `DATABASE_URL` / `DIRECT_DATABASE_URL` подставь из этой строки (с паролем). Либо
 * **IPv4 add-on** в проекте Supabase. Transaction pooler (6543) при проблемах с push
 * можно заменить на Session 5432.
 */
function migrationDatabaseUrl(): string {
  const raw =
    process.env.DIRECT_DATABASE_URL?.trim() ||
    process.env.DRIZZLE_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.NUXT_DATABASE_URL?.trim() ||
    ''
  if (!raw) {
    return ''
  }
  let urlStr = raw
  try {
    const u = new URL(raw)
    if (u.hostname.includes('supabase') && !u.searchParams.get('sslmode')) {
      u.searchParams.set('sslmode', 'require')
    }
    urlStr = u.toString()
  } catch {
    /* оставляем raw */
  }
  const isPooler =
    /pooler|\.pooler\./.test(urlStr) && (urlStr.includes(':6543') || /[:/]6543(?=[/?]|$)/.test(urlStr))
  if (isPooler) {
    console.warn(
      '[drizzle] Соединение идёт через пулer (часто :6543). Если push «висит», задай DIRECT_DATABASE_URL из Supabase → Direct connection (порт 5432).',
    )
  }
  return urlStr
}

/** Для `drizzle-kit generate` к БД не ходит — `DATABASE_URL` не обязателен. Для `db:push` нужен реальный URL. */
const url = migrationDatabaseUrl() || 'postgresql://127.0.0.1:5432/drizzle_placeholder'

export default defineConfig({
  schema: './server/database/schema.ts',
  out: './server/database/migrations_pg',
  dialect: 'postgresql',
  dbCredentials: {
    url,
    // как в `server/utils/db.ts`: к Supabase без SSL часто не подключается
    ...(/supabase\./.test(url) && { ssl: 'require' as const }),
  },
  strict: true,
})
