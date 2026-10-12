import { asc, eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { labelDefs } from '../../database/schema'
import type { LabelKind } from '../../database/schema'
import { labelKinds } from '#shared/labelKind'

const KINDS = new Set<string>(labelKinds)

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const kind = q.kind as string | undefined
  const db = useDb()
  if (kind && KINDS.has(kind)) {
    return db
      .select()
      .from(labelDefs)
      .where(eq(labelDefs.kind, kind as LabelKind))
      .orderBy(asc(labelDefs.label))
  }
  return db.select().from(labelDefs).orderBy(asc(labelDefs.kind), asc(labelDefs.label))
})
