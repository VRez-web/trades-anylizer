export function estimateQuoteVolumeUsdt(
  side: 'long' | 'short',
  entryPrice: number,
  exitPrice: number,
  income: number,
): number | null {
  const d = side === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice
  if (!Number.isFinite(entryPrice) || !Number.isFinite(exitPrice) || !Number.isFinite(income)) return null
  if (Math.abs(d) < 1e-12) return null
  return Math.abs((income * entryPrice) / d)
}
