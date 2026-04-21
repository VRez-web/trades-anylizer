import { sqliteTable, integer, text, real, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core'

export const labelKindEnum = ['system', 'technique', 'psychology'] as const
export type LabelKind = (typeof labelKindEnum)[number]

export const labelDefs = sqliteTable(
  'label_defs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: text('kind', { enum: labelKindEnum }).notNull(),
    label: text('label').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    kindLabelIdx: uniqueIndex('label_defs_kind_label').on(t.kind, t.label),
  }),
)

export const reasons = sqliteTable('reasons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind', { enum: ['entry', 'exit'] }).notNull(),
  label: text('label').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const mergeGroups = sqliteTable('merge_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
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
    noteSystemTs: text('note_system_ts'),
    noteTechniqueTs: text('note_technique_ts'),
    noteAnalysisTs: text('note_analysis_ts'),
    mergeGroupId: integer('merge_group_id').references(() => mergeGroups.id, { onDelete: 'set null' }),
    /** JSON: {"sourceIds":[1,2,3]} — исходные id до слияния (строки удалены). */
    mergedFrom: text('merged_from'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => ({
    externalKeyIdx: uniqueIndex('trades_external_key_unique').on(t.externalKey),
  }),
)

export const tradeLabelLinks = sqliteTable(
  'trade_label_links',
  {
    tradeId: integer('trade_id')
      .notNull()
      .references(() => trades.id, { onDelete: 'cascade' }),
    labelId: integer('label_id')
      .notNull()
      .references(() => labelDefs.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tradeId, t.labelId] }),
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

export const schema = { labelDefs, mergeGroups, periodNotes, reasons, strategyDoc, tradeLabelLinks, trades }
