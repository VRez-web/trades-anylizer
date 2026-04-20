function precisionFromRef(abs: number) {
  if (!Number.isFinite(abs) || abs <= 0) {
    return { type: 'price', minMove: 0.01, precision: 4 }
  }
  if (abs >= 10_000) return { type: 'price', minMove: 1, precision: 0 }
  if (abs >= 1000) return { type: 'price', minMove: 0.5, precision: 1 }
  if (abs >= 100) return { type: 'price', minMove: 0.1, precision: 2 }
  if (abs >= 10) return { type: 'price', minMove: 0.01, precision: 2 }
  if (abs >= 1) return { type: 'price', minMove: 0.001, precision: 3 }
  if (abs >= 0.1) return { type: 'price', minMove: 0.0001, precision: 4 }
  if (abs >= 0.01) return { type: 'price', minMove: 0.00001, precision: 5 }
  return { type: 'price', minMove: 0.0000001, precision: 7 }
}

/** Формат цены для шкалы lightweight-charts по тикеру и опорной цене. */
export function chartAxisPriceFormat(symbol: string, refPrice: number) {
  const r = symbol.toUpperCase()
  if (r.startsWith('BTC')) return { type: 'price', minMove: 0.5, precision: 1 }
  if (r.startsWith('ETH')) return { type: 'price', minMove: 0.05, precision: 2 }
  if (r.startsWith('SOL') || r.startsWith('BNB')) return { type: 'price', minMove: 0.01, precision: 2 }
  return precisionFromRef(refPrice)
}
