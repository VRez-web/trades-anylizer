export type TradeSide = 'long' | 'short'

/** RR = reward / risk; null если данные некорректны. */
export function calcRr(
  side: TradeSide,
  entry: number,
  stop: number,
  target: number,
): number | null {
  if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(target)) return null
  if (side === 'long') {
    const risk = entry - stop
    const reward = target - entry
    if (risk <= 0 || reward <= 0) return null
    return reward / risk
  }
  const risk = stop - entry
  const reward = entry - target
  if (risk <= 0 || reward <= 0) return null
  return reward / risk
}

export function formatRr(rr: number | null | undefined, digits = 2) {
  if (rr == null || !Number.isFinite(rr)) return '—'
  return rr.toFixed(digits)
}
