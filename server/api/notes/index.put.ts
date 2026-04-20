import { and, eq } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { periodNotes } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as {
    scope?: 'day' | 'week' | 'month'
    periodKey?: string
    content?: string
    tradePlan?: string
  }
  if (!body.scope || !body.periodKey) {
    throw createError({ statusCode: 400, statusMessage: 'scope and periodKey required' })
  }
  const db = useDb()
  const now = new Date()
  const existing = await db
    .select()
    .from(periodNotes)
    .where(and(eq(periodNotes.scope, body.scope), eq(periodNotes.periodKey, body.periodKey)))
  const prev = existing[0]
  const content = body.content !== undefined ? String(body.content) : (prev?.content ?? '')
  const tradePlan = body.tradePlan !== undefined ? String(body.tradePlan) : (prev?.tradePlan ?? '')
  if (existing.length) {
    await db
      .update(periodNotes)
      .set({ content, tradePlan, updatedAt: now })
      .where(and(eq(periodNotes.scope, body.scope), eq(periodNotes.periodKey, body.periodKey)))
  } else {
    await db.insert(periodNotes).values({
      scope: body.scope,
      periodKey: body.periodKey,
      content,
      tradePlan,
      updatedAt: now,
    })
  }
  const [row] = await db
    .select()
    .from(periodNotes)
    .where(and(eq(periodNotes.scope, body.scope), eq(periodNotes.periodKey, body.periodKey)))
  return row
})
