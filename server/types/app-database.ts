import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { schema } from '../database/schema'

export type AppDatabase = PostgresJsDatabase<typeof schema>
