/** «FTMO 100k #2» → «FTMO 100k» */
export function stripPropInstanceMark(name: string) {
  return name.trim().replace(/ #\d+$/, '').trim()
}

export function propInstanceNumber(name: string): number | null {
  const m = name.trim().match(/ #(\d+)$/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

export function nameConflictsWithExisting(existing: string[], raw: string) {
  const typed = raw.trim()
  if (!typed) return false
  const base = stripPropInstanceMark(typed)
  return existing.some((n) => {
    const t = n.trim()
    return t === typed || stripPropInstanceMark(t) === base
  })
}

/** Следующее свободное имя: FTMO 100k → FTMO 100k #2 → #3 … */
export function nextMarkedPropName(existing: string[], raw: string) {
  const typed = raw.trim()
  const base = stripPropInstanceMark(typed) || typed
  const taken = new Set(existing.map((n) => n.trim()).filter(Boolean))
  if (!base) return typed

  const used = new Set<number>()
  for (const n of existing) {
    const t = n.trim()
    if (stripPropInstanceMark(t) !== base) continue
    const num = propInstanceNumber(t)
    used.add(num ?? 1)
  }
  if (!used.size && !taken.has(typed) && !taken.has(base)) return typed

  let i = 2
  while (used.has(i) || taken.has(`${base} #${i}`)) i += 1
  return `${base} #${i}`
}
