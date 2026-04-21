import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { schema as appSchema } from '../database/schema'

const migration0 = `
CREATE TABLE \`period_notes\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`scope\` text NOT NULL,
	\`period_key\` text NOT NULL,
	\`content\` text DEFAULT '' NOT NULL,
	\`updated_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`period_notes_scope_key\` ON \`period_notes\` (\`scope\`,\`period_key\`);--> statement-breakpoint
CREATE TABLE \`reasons\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`kind\` text NOT NULL,
	\`label\` text NOT NULL,
	\`created_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`strategy_doc\` (
	\`id\` integer PRIMARY KEY NOT NULL,
	\`markdown\` text DEFAULT '' NOT NULL,
	\`updated_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE \`trades\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`symbol\` text NOT NULL,
	\`side\` text NOT NULL,
	\`entry_reason_id\` integer,
	\`exit_reason_id\` integer,
	\`entry_at\` integer NOT NULL,
	\`exit_at\` integer NOT NULL,
	\`leverage\` real NOT NULL,
	\`entry_price\` real NOT NULL,
	\`exit_price\` real NOT NULL,
	\`income\` real NOT NULL,
	\`commission\` real NOT NULL,
	\`funding\` real NOT NULL,
	\`rr\` real,
	\`check_system\` integer DEFAULT false NOT NULL,
	\`check_technique\` integer DEFAULT false NOT NULL,
	\`check_psychology\` integer DEFAULT false NOT NULL,
	\`check_analysis\` integer DEFAULT false NOT NULL,
	\`description\` text,
	\`conclusion\` text,
	\`created_at\` integer NOT NULL,
	\`updated_at\` integer NOT NULL,
	FOREIGN KEY (\`entry_reason_id\`) REFERENCES \`reasons\`(\`id\`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (\`exit_reason_id\`) REFERENCES \`reasons\`(\`id\`) ON UPDATE no action ON DELETE no action
);
`
const migration1 = `
ALTER TABLE trades ADD COLUMN external_key text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS trades_external_key_unique ON trades (external_key);
`
const migration2 = `
ALTER TABLE trades ADD COLUMN note_system text;
--> statement-breakpoint
ALTER TABLE trades ADD COLUMN note_technique text;
--> statement-breakpoint
ALTER TABLE trades ADD COLUMN note_analysis text;
--> statement-breakpoint
UPDATE trades SET note_system = description WHERE description IS NOT NULL AND (note_system IS NULL OR note_system = '');
--> statement-breakpoint
UPDATE trades SET note_analysis = conclusion WHERE conclusion IS NOT NULL AND (note_analysis IS NULL OR note_analysis = '');
`
const migration3 = `
ALTER TABLE trades ADD COLUMN entry_notional_usdt real;
`
const migration4 = `
ALTER TABLE period_notes ADD COLUMN trade_plan text NOT NULL DEFAULT '';
`
const migration5 = `
CREATE TABLE \`label_defs\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`kind\` text NOT NULL,
	\`label\` text NOT NULL,
	\`created_at\` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`label_defs_kind_label\` ON \`label_defs\` (\`kind\`,\`label\`);
--> statement-breakpoint
CREATE TABLE \`trade_label_links\` (
	\`trade_id\` integer NOT NULL,
	\`label_id\` integer NOT NULL,
	PRIMARY KEY (\`trade_id\`, \`label_id\`),
	FOREIGN KEY (\`trade_id\`) REFERENCES \`trades\`(\`id\`) ON DELETE CASCADE ON UPDATE no action,
	FOREIGN KEY (\`label_id\`) REFERENCES \`label_defs\`(\`id\`) ON DELETE CASCADE ON UPDATE no action
);
`

const MIGRATIONS = [migration0, migration1, migration2, migration3, migration4, migration5]

function splitMigration(sql: string) {
  return sql.split(/-->\s*statement-breakpoint\s*/g).map((s) => s.trim()).filter(Boolean)
}

function migrateSqlite(sqlite: Database.Database) {
  const row = sqlite.prepare('PRAGMA user_version').get() as { user_version: number }
  let v = row.user_version
  for (let i = v; i < MIGRATIONS.length; i++) {
    for (const statement of splitMigration(MIGRATIONS[i])) {
      sqlite.exec(statement)
    }
    sqlite.pragma(`user_version = ${i + 1}`)
    v = i + 1
  }
}

let _sqlite: Database.Database | null = null
let _db: ReturnType<typeof drizzle<typeof appSchema>> | null = null

export function useDb() {
  if (_db && _sqlite) return _db
  /** На Render и т.п.: смонтируйте Persistent Disk и задайте DATA_DIR (абсолютный путь к каталогу с БД). */
  const dataRoot = process.env.DATA_DIR?.trim() || join(process.cwd(), '.data')
  const dir = dataRoot
  mkdirSync(dir, { recursive: true })
  const dbPath = join(dir, 'app.db')
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  migrateSqlite(sqlite)
  const db = drizzle(sqlite, { schema: appSchema })
  const rows = sqlite.prepare('SELECT id FROM strategy_doc WHERE id = 1').all()
  if (rows.length === 0) {
    const now = new Date()
    sqlite.prepare('INSERT INTO strategy_doc (id, markdown, updated_at) VALUES (1, ?, ?)').run('', now.getTime())
  }
  _sqlite = sqlite
  _db = db
  return db
}

export { appSchema as schema }
