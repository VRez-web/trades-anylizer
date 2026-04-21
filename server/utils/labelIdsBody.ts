import type { LabelKind } from '../database/schema'

export function emptyLabelIds(): Record<LabelKind, number[]> {
  return { system: [], technique: [], psychology: [] }
}

export function parseLabelIds(body: Record<string, unknown>): Record<LabelKind, number[]> | null {
  if (!('labelIds' in body) || body.labelIds == null || typeof body.labelIds !== 'object') return null
  const o = body.labelIds as Record<string, unknown>
  const out = emptyLabelIds()
  for (const k of ['system', 'technique', 'psychology'] as const) {
    const arr = o[k]
    if (!Array.isArray(arr)) continue
    out[k] = arr.map((x) => Number(x)).filter((n) => Number.isFinite(n))
  }
  return out
}
