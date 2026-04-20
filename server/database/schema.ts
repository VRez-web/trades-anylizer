import { sqliteTable, integer, text, real, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const reasons = sqliteTable('reasons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind', { enum: ['entry', 'exit'] }).notNull(),
  label: text('label').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const trades = sqliteTable(
  'trades',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    externalKey: text('external_key'),
    symbol: text('symbol').notNull(),
    side: text('side', { enum: ['long', 'short'] }).notNull(),
    entryReasonId: integer('entry_reason_id').references(() => reasons.id),
    exitReasonId: integer('exit_reason_id').references(() => reasons.id),
    entryAt: integer('entry_at', { mode: 'timestamp' }).notNull(),
    exitAt: integer('exit_at', { mode: 'timestamp' }).notNull(),
    leverage: real('leverage').notNull(),
    entryPrice: real('entry_price').notNull(),
    exitPrice: real('exit_price').notNull(),
    income: real('income').notNull(),
    commission: real('commission').notNull(),
    funding: real('funding').notNull(),
    entryNotionalUsdt: real('entry_notional_usdt'),
    rr: real('rr'),
    noteSystem: text('note_system'),
    noteTechnique: text('note_technique'),
    noteAnalysis: text('note_analysis'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    externalKeyIdx: uniqueIndex('trades_external_key_unique').on(t.externalKey),
  }),
)

export const periodNotes = sqliteTable(
  'period_notes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    scope: text('scope', { enum: ['day', 'week', 'month'] }).notNull(),
    periodKey: text('period_key').notNull(),
    content: text('content').notNull().default(''),
    tradePlan: text('trade_plan').notNull().default(''),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    scopeKeyIdx: uniqueIndex('period_notes_scope_key').on(t.scope, t.periodKey),
  }),
)

export const strategyDoc = sqliteTable('strategy_doc', {
  id: integer('id').primaryKey(),
  markdown: text('markdown').notNull().default(''),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const schema = { periodNotes, reasons, strategyDoc, trades }
