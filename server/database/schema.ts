import {
  pgTable,
  serial,
  integer,
  text,
  doublePrecision,
  uniqueIndex,
  primaryKey,
  timestamp,
} from 'drizzle-orm/pg-core'

export const labelKindEnum = ['system', 'technique', 'psychology'] as const
export type LabelKind = (typeof labelKindEnum)[number]

export const labelDefs = pgTable(
  'label_defs',
  {
    id: serial('id').primaryKey(),
    kind: text('kind', { enum: labelKindEnum }).notNull(),
    label: text('label').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => ({
    kindLabelIdx: uniqueIndex('label_defs_kind_label').on(t.kind, t.label),
  }),
)

export const reasons = pgTable('reasons', {
  id: serial('id').primaryKey(),
  kind: text('kind', { enum: ['entry', 'exit'] }).notNull(),
  label: text('label').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
})

export const mergeGroups = pgTable('merge_groups', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
})

export const trades = pgTable(
  'trades',
  {
    id: serial('id').primaryKey(),
    externalKey: text('external_key'),
    symbol: text('symbol').notNull(),
    side: text('side', { enum: ['long', 'short'] }).notNull(),
    entryReasonId: integer('entry_reason_id').references(() => reasons.id),
    exitReasonId: integer('exit_reason_id').references(() => reasons.id),
    entryAt: timestamp('entry_at', { withTimezone: true, mode: 'date' }).notNull(),
    exitAt: timestamp('exit_at', { withTimezone: true, mode: 'date' }).notNull(),
    leverage: doublePrecision('leverage').notNull(),
    entryPrice: doublePrecision('entry_price').notNull(),
    exitPrice: doublePrecision('exit_price').notNull(),
    income: doublePrecision('income').notNull(),
    commission: doublePrecision('commission').notNull(),
    funding: doublePrecision('funding').notNull(),
    entryNotionalUsdt: doublePrecision('entry_notional_usdt'),
    rr: doublePrecision('rr'),
    noteSystem: text('note_system'),
    noteTechnique: text('note_technique'),
    noteAnalysis: text('note_analysis'),
    noteSystemTs: text('note_system_ts'),
    noteTechniqueTs: text('note_technique_ts'),
    noteAnalysisTs: text('note_analysis_ts'),
    mergeGroupId: integer('merge_group_id').references(() => mergeGroups.id, { onDelete: 'set null' }),
    mergedFrom: text('merged_from'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => ({
    externalKeyIdx: uniqueIndex('trades_external_key_unique').on(t.externalKey),
  }),
)

export const tradeLabelLinks = pgTable(
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

export const periodNotes = pgTable(
  'period_notes',
  {
    id: serial('id').primaryKey(),
    scope: text('scope', { enum: ['day', 'week', 'month'] }).notNull(),
    periodKey: text('period_key').notNull(),
    content: text('content').notNull().default(''),
    tradePlan: text('trade_plan').notNull().default(''),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => ({
    scopeKeyIdx: uniqueIndex('period_notes_scope_key').on(t.scope, t.periodKey),
  }),
)

export const strategyDoc = pgTable('strategy_doc', {
  id: integer('id').primaryKey(),
  markdown: text('markdown').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
})

export const schema = { labelDefs, mergeGroups, periodNotes, reasons, strategyDoc, tradeLabelLinks, trades }
