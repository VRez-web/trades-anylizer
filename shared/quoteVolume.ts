export function sumQuoteVolumeUsdt(rows: { quoteVolumeUsdt?: number | null }[] | null | undefined) {
  if (!rows?.length) return null
  let sum = 0
  let any = false
  for (const r of rows) {
    const v = r.quoteVolumeUsdt
    if (v != null && Number.isFinite(v) && v > 0) {
      sum += v
      any = true
    }
  }
  return any ? sum : null
}
