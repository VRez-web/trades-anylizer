export function useMoney() {
  const { unit, basis } = useDisplayUnit()

  function fmt(n: number, opts?: { max?: number; min?: number }) {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: opts?.min ?? 2,
      maximumFractionDigits: opts?.max ?? 2,
    }).format(n)
  }

  /** Процент со знаком (ру-RU), например дневной PnL к депозиту. */
  function fmtSignedPercent(pct: number, fractionDigits = 2): string {
    const abs = Math.abs(pct)
    const num = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(abs)
    if (pct > 0) return `+${num} %`
    if (pct < 0) return `−${num} %`
    return `${new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(0)} %`
  }

  /** strict: только переданная база (объём сделки / дня), без фолбэка на объём страницы. */
  function resolveBasis(override?: number | null, strict = false) {
    if (override != null && Number.isFinite(override) && override > 0) return override
    if (strict) return null
    const b = basis.value
    return b != null && Number.isFinite(b) && b > 0 ? b : null
  }

  function fmtAsPct(n: number, override?: number | null, strict = false) {
    const den = resolveBasis(override, strict)
    if (den == null) return '—'
    return fmtSignedPercent((n / den) * 100)
  }

  /**
   * Суммы в USDT (PnL, комиссии и т.д.) или % от объёма.
   * Для одной сделки передавайте её объём + strict: % = net / объём сделки ≈ ход цены минус комиссии.
   */
  function fmtUsdt(
    n: number,
    opts?: { max?: number; min?: number; basis?: number | null; strict?: boolean; forceUsdt?: boolean },
  ) {
    if (unit.value === 'pct' && !opts?.forceUsdt) return fmtAsPct(n, opts?.basis, opts?.strict)
    return `${fmt(n, opts)} USDT`
  }

  /**
   * Цена инструмента (не USDT PnL): больше знаков у дешёвых тикеров.
   */
  function fmtInstrumentPrice(price: number) {
    if (!Number.isFinite(price)) return '—'
    const abs = Math.abs(price)
    let maxFractionDigits = 8
    if (abs >= 10_000) maxFractionDigits = 2
    else if (abs >= 100) maxFractionDigits = 2
    else if (abs >= 1) maxFractionDigits = 4
    else if (abs >= 0.01) maxFractionDigits = 6
    const minFractionDigits = abs >= 100 ? 2 : 0
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: maxFractionDigits,
    }).format(price)
  }

  /** Для календаря и подписей: «+12 USDT» / «−5 USDT» или % */
  function fmtSignedUsdt(
    n: number,
    fractionDigits = 0,
    overrideBasis?: number | null,
    opts?: { strict?: boolean; forceUsdt?: boolean },
  ) {
    if (unit.value === 'pct' && !opts?.forceUsdt) return fmtAsPct(n, overrideBasis, opts?.strict)
    const abs = Math.abs(n)
    const num = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(abs)
    if (n > 0) return `+${num} USDT`
    if (n < 0) return `−${num} USDT`
    return `0 USDT`
  }

  /**
   * Изменение цены от входа к выходу в % (к цене входа).
   * Long: (выход − вход) / вход; Short: (вход − выход) / вход.
   */
  function fmtPriceMovePct(side: 'long' | 'short', entryPrice: number, exitPrice: number): string | null {
    if (!Number.isFinite(entryPrice) || entryPrice === 0 || !Number.isFinite(exitPrice)) return null
    const r =
      side === 'long'
        ? (exitPrice - entryPrice) / entryPrice
        : (entryPrice - exitPrice) / entryPrice
    return fmtSignedPercent(r * 100)
  }

  return {
    unit,
    fmt,
    fmtUsdt,
    fmtSignedUsdt,
    fmtInstrumentPrice,
    fmtPriceMovePct,
    fmtSignedPercent,
  }
}
