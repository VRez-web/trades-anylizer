import { asc, eq } from 'drizzle-orm'
import { nextMarkedPropName } from '#shared/propAccountName'
import { propAccounts, propEvents, trades, type PropAccountStatus } from '../database/schema'
import type { AppDatabase } from '../types/app-database'

type Db = AppDatabase

export function parsePropAccountStatus(v: unknown): PropAccountStatus {
  if (v === 'passed' || v === 'failed') return v
  return 'active'
}

export function propAccountStatusLabel(status: PropAccountStatus) {
  if (status === 'passed') return 'Прошёл'
  if (status === 'failed') return 'Не прошёл'
  return 'В процессе'
}

export async function syncPropAccountNames(db: Db) {
  const names = new Set<string>()
  const eventRows = await db.select({ name: propEvents.accountName }).from(propEvents)
  for (const r of eventRows) {
    const n = r.name.trim()
    if (n) names.add(n)
  }
  const tradeRows = await db
    .select({ name: trades.accountName })
    .from(trades)
    .where(eq(trades.tradeSource, 'prop'))
  for (const r of tradeRows) {
    const n = (r.name ?? '').trim()
    if (n) names.add(n)
  }
  const now = new Date()
  for (const name of names) {
    await db
      .insert(propAccounts)
      .values({ name, status: 'active', createdAt: now, updatedAt: now })
      .onConflictDoNothing({ target: propAccounts.name })
  }
}

export async function ensurePropAccount(db: Db, rawName: string) {
  const name = rawName.trim()
  if (!name) return
  await syncPropAccountNames(db)
  const now = new Date()
  await db
    .insert(propAccounts)
    .values({ name, status: 'active', createdAt: now, updatedAt: now })
    .onConflictDoNothing({ target: propAccounts.name })
}

export async function allocatePropAccountName(db: Db, rawName: string, newInstance: boolean) {
  const name = rawName.trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'accountName required' })
  }
  await syncPropAccountNames(db)
  const rows = await db.select({ name: propAccounts.name }).from(propAccounts)
  const existing = rows.map((r) => r.name)
  const exactTaken = existing.includes(name)
  const resolved = newInstance && exactTaken ? nextMarkedPropName(existing, name) : name
  await ensurePropAccount(db, resolved)
  return resolved
}

export async function listPropAccounts(db: Db) {
  await syncPropAccountNames(db)
  return db.select().from(propAccounts).orderBy(asc(propAccounts.name))
}

export async function updatePropAccountStatus(db: Db, rawName: string, status: PropAccountStatus) {
  const name = rawName.trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name required' })
  }
  await ensurePropAccount(db, name)
  const now = new Date()
  const [row] = await db
    .update(propAccounts)
    .set({ status, updatedAt: now })
    .where(eq(propAccounts.name, name))
    .returning()
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  }
  return row
}

export async function propAccountsPayload(db: Db) {
  const rows = await listPropAccounts(db)
  const accounts = rows.map((r) => ({
    name: r.name,
    status: r.status as PropAccountStatus,
  }))
  const names = accounts.map((a) => a.name)
  const selectableNames = accounts.filter((a) => a.status !== 'failed').map((a) => a.name)
  return { accounts, names, selectableNames }
}
