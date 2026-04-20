import { klineIntervalToMs } from './kline'

/** Unix-время события в секундах (как в lightweight-charts). */
export function eventUnixSeconds(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000)
}

/** Свечи по возрастанию времени открытия (обязательно перед привязкой маркеров). */
export function sortBarsByTime<T extends { time: number }>(bars: T[]): T[] {
  if (bars.length <= 1) return bars
  return [...bars].sort((a, b) => a.time - b.time)
}

/**
 * Время открытия свечи (unix sec), к которой относится момент `eventUnixSec`.
 * Берётся последняя свеча с `bar.time <= eventUnixSec` — это стандарт для интервалов вида [open, next_open).
 * Совпадает с тем, как строится OHLC на бирже для события внутри периода.
 *
 * Возвращаемое значение всегда равно `sortedBars[i].time` для какого‑то i — так lightweight-charts
 * сопоставляет маркер с точкой данных через `timeToIndex` → `dataByIndex`.
 */
export function barOpenTimeForEvent(sortedBars: { time: number }[], eventUnixSec: number): number {
  if (!sortedBars.length) return eventUnixSec
  const n = sortedBars.length
  let lo = 0
  let hi = n - 1
  let ans = sortedBars[0].time
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const t = sortedBars[mid].time
    if (t <= eventUnixSec) {
      ans = t
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

/** Средний шаг между соседними свечами (сек), для проверки границ; если одна свеча — из интервала TF. */
export function inferBarStepSec(sortedBars: { time: number }[], intervalKey: string): number {
  const fromTf = Math.floor(klineIntervalToMs(intervalKey) / 1000)
  if (sortedBars.length < 2) return Math.max(1, fromTf)
  const d = sortedBars[1].time - sortedBars[0].time
  if (d > 0 && Math.abs(d - fromTf) <= Math.max(60, fromTf * 0.2)) return d
  let sum = 0
  let k = 0
  for (let i = 1; i < sortedBars.length; i++) {
    const step = sortedBars[i].time - sortedBars[i - 1].time
    if (step > 0) {
      sum += step
      k++
    }
  }
  return k > 0 ? Math.round(sum / k) : Math.max(1, fromTf)
}

export const MARKER = {
  entry: '#15803d',
  exit: '#b91c1c',
} as const

export function sideLetter(side: 'long' | 'short'): string {
  return side === 'long' ? 'л' : 'ш'
}

/** Подпись входа/выхода: Вх1·л / Вых2·ш */
export function entryExitLabels(index1: number, side: 'long' | 'short') {
  const s = sideLetter(side)
  return {
    entry: `Вх${index1}·${s}`,
    exit: `Вых${index1}·${s}`,
  }
}

type TimeScaleApi = {
  subscribeVisibleLogicalRangeChange: (fn: () => void) => void
  unsubscribeVisibleLogicalRangeChange: (fn: () => void) => void
}

/**
 * Плагин маркеров lightweight-charts иногда считает X до того, как timeScale зафиксировал ширину и
 * fitContent/visible range. Обновляем маркеры после микротаска, двух rAF и при любом изменении
 * видимого логического диапазона. `refresh` вызывать при ресайзе контейнера графика.
 */
export function bindSeriesMarkersLayoutSync<T>(
  chart: { timeScale: () => TimeScaleApi },
  markersApi: { setMarkers: (m: T[]) => void },
  markers: T[],
): { unbind: () => void; refresh: () => void } {
  const refresh = () => markersApi.setMarkers(markers)
  const ts = chart.timeScale()
  refresh()
  queueMicrotask(refresh)
  requestAnimationFrame(() => {
    requestAnimationFrame(refresh)
  })
  const onRange = () => refresh()
  ts.subscribeVisibleLogicalRangeChange(onRange)
  return {
    unbind: () => ts.unsubscribeVisibleLogicalRangeChange(onRange),
    refresh,
  }
}
