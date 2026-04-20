/** Интервал Bybit v5 market/kline: число минут или D / W / M */
export function klineIntervalToMs(interval: string): number {
  if (/^\d+$/.test(interval)) {
    return Number(interval) * 60 * 1000
  }
  switch (interval) {
    case 'D':
      return 86400000
    case 'W':
      return 7 * 86400000
    case 'M':
      return 30 * 86400000
    default:
      return 60000
  }
}
