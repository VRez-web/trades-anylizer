import { useDb } from '../../utils/db'
import { labelDefs } from '../../database/schema'
import type { LabelKind } from '../../database/schema'

const KINDS = new Set<LabelKind>(['system', 'technique', 'psychology'])

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as { kind?: string; label?: string }
  if (!body?.kind || !KINDS.has(body.kind as LabelKind) || !body?.label?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'kind (system|technique|psychology) и label обязательны' })
  }
  const db = useDb()
  const now = new Date()
  try {
    const [row] = await db
      .insert(labelDefs)
      .values({ kind: body.kind as LabelKind, label: body.label.trim(), createdAt: now })
      .returning()
    return row
  } catch {
    throw createError({ statusCode: 409, statusMessage: 'Такой лейбл уже есть в этой категории' })
  }
})
