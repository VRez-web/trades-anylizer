<script setup lang="ts">
import { createChart, ColorType, LineSeries, LineStyle } from 'lightweight-charts'
import { eventUnixSeconds } from '#shared/tradeChartMarkers'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

export type EquityChartMarker = {
  t: string
  kind: 'purchase' | 'payout'
  accountName: string
  amountUsdt: number
}

const props = defineProps<{
  points: { t: string; cumulative: number }[]
  markers?: EquityChartMarker[]
  volumeBasis?: number | null
}>()

const wrap = ref<HTMLDivElement | null>(null)
const root = ref<HTMLDivElement | null>(null)
const hovered = ref<number | null>(null)
const dots = ref<{ x: number; y: number; kind: 'purchase' | 'payout'; text: string }[]>([])

const { unit, fmtUsdt } = useMoney()

let chart: ReturnType<typeof createChart> | null = null
let series: ReturnType<ReturnType<typeof createChart>['addSeries']> | null = null
let resizeObserver: ResizeObserver | null = null
let rangeHandler: (() => void) | null = null

function markerLabel(m: EquityChartMarker) {
  const kind = m.kind === 'purchase' ? 'Покупка пропа' : 'Выплата с пропа'
  const when = new Date(m.t).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
  const signed = m.kind === 'purchase' ? -Math.abs(m.amountUsdt) : Math.abs(m.amountUsdt)
  return `${kind} · ${m.accountName} · ${fmtUsdt(signed, { basis: props.volumeBasis })} · ${when}`
}

function toUnix(iso: string) {
  return Math.floor(new Date(iso).getTime() / 1000) as import('lightweight-charts').UTCTimestamp
}

function formatAxisPrice(value: number) {
  if (unit.value === 'pct') {
    return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} %`
  }
  const sign = value < 0 ? '−' : ''
  return `${sign}$${Math.abs(value).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`
}

function valueAtTime(timeSec: number) {
  const pts = props.points
  if (!pts.length) return 0
  let best = pts[0]
  let bestDt = Infinity
  for (const p of pts) {
    const dt = Math.abs(toUnix(p.t) - timeSec)
    if (dt < bestDt) {
      bestDt = dt
      best = p
    }
  }
  return best.cumulative
}

function layoutDots() {
  if (!chart || !series) {
    dots.value = []
    return
  }
  const next: typeof dots.value = []
  for (const m of props.markers ?? []) {
    const time = eventUnixSeconds(m.t) as import('lightweight-charts').UTCTimestamp
    const x = chart.timeScale().timeToCoordinate(time)
    const y = series.priceToCoordinate(valueAtTime(time))
    if (x == null || y == null) continue
    next.push({ x, y, kind: m.kind, text: markerLabel(m) })
  }
  dots.value = next
}

function redraw() {
  if (!root.value) return
  hovered.value = null
  if (rangeHandler && chart) {
    chart.timeScale().unsubscribeVisibleLogicalRangeChange(rangeHandler)
    rangeHandler = null
  }
  chart?.remove()
  chart = null
  series = null
  dots.value = []
  if (!props.points.length) return

  chart = createChart(root.value, {
    width: root.value.clientWidth,
    height: 420,
    layout: {
      background: { type: ColorType.Solid, color: '#ffffff' },
      textColor: '#5b6778',
      fontSize: 12,
    },
    grid: {
      vertLines: { color: '#d6dde6' },
      horzLines: { color: '#d6dde6' },
    },
    leftPriceScale: {
      visible: true,
      borderColor: '#9aa6b2',
      scaleMargins: { top: 0.06, bottom: 0.08 },
    },
    rightPriceScale: { visible: false },
    timeScale: {
      borderColor: '#9aa6b2',
      timeVisible: false,
    },
    crosshair: {
      vertLine: { color: '#94a3b8', width: 1, style: LineStyle.Dashed, labelVisible: false },
      horzLine: { color: '#94a3b8', width: 1, style: LineStyle.Dashed, labelVisible: true },
    },
  })

  series = chart.addSeries(LineSeries, {
    color: '#4472C4',
    lineWidth: 3,
    priceLineVisible: false,
    lastValueVisible: false,
    priceFormat: {
      type: 'custom',
      minMove: 0.01,
      formatter: formatAxisPrice,
    },
  })

  const data = props.points.map((p) => ({
    time: toUnix(p.t),
    value: p.cumulative,
  }))
  series.setData(data)

  series.createPriceLine({
    price: 0,
    color: '#94a3b8',
    lineWidth: 1,
    lineStyle: LineStyle.Solid,
    axisLabelVisible: true,
    title: '',
  })

  series.applyOptions({
    autoscaleInfoProvider: (original) => {
      const res = original()
      if (!res?.priceRange) return res
      const dataMin = res.priceRange.minValue
      const dataMax = res.priceRange.maxValue
      const min = Math.min(dataMin, 0)
      const max = Math.max(dataMax, 0)
      const span = Math.max(max - min, Math.abs(max) * 0.08, 1)
      const pad = span * 0.08
      return {
        ...res,
        priceRange: { minValue: min - pad, maxValue: max + pad },
      }
    },
  })

  chart.timeScale().fitContent()
  rangeHandler = () => layoutDots()
  chart.timeScale().subscribeVisibleLogicalRangeChange(rangeHandler)
  nextTick(() => {
    requestAnimationFrame(() => layoutDots())
  })
}

watch(
  () => [props.points, props.markers],
  () => nextTick(redraw),
  { deep: true },
)

watch(
  () => [fmtUsdt(0), props.volumeBasis, unit.value],
  () => {
    series?.applyOptions({
      priceFormat: { type: 'custom', minMove: 0.01, formatter: formatAxisPrice },
    })
    layoutDots()
  },
)

onMounted(() => {
  redraw()
  resizeObserver = new ResizeObserver(() => {
    if (chart && root.value) {
      chart.applyOptions({ width: root.value.clientWidth })
      layoutDots()
    }
  })
  if (root.value) resizeObserver.observe(root.value)
})

onUnmounted(() => {
  if (rangeHandler && chart) chart.timeScale().unsubscribeVisibleLogicalRangeChange(rangeHandler)
  resizeObserver?.disconnect()
  chart?.remove()
  chart = null
  series = null
})
</script>

<template>
  <div ref="wrap" class="eq-wrap">
    <div ref="root" class="eq" />
    <button
      v-for="(d, i) in dots"
      :key="i"
      type="button"
      class="eq-dot-btn"
      :class="[`eq-dot-btn--${d.kind}`, { 'is-hot': hovered === i }]"
      :style="{ left: `${d.x}px`, top: `${d.y}px` }"
      :aria-label="d.text"
      @mouseenter="hovered = i"
      @mouseleave="hovered = null"
      @focus="hovered = i"
      @blur="hovered = null"
    />
    <div
      v-if="hovered != null && dots[hovered]"
      class="eq-tooltip"
      :style="{ left: `${dots[hovered].x}px`, top: `${dots[hovered].y}px` }"
    >
      {{ dots[hovered].text }}
    </div>
  </div>
</template>

<style scoped>
.eq-wrap {
  position: relative;
  width: 100%;
}
.eq {
  min-height: 420px;
  width: 100%;
}
.eq-dot-btn {
  position: absolute;
  z-index: 4;
  width: 12px;
  height: 12px;
  margin: 0;
  padding: 0;
  border-radius: 50%;
  border: 2px solid #fff;
  transform: translate(-50%, -50%);
  cursor: pointer;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.12);
}
.eq-dot-btn--purchase {
  background: #b91c1c;
}
.eq-dot-btn--payout {
  background: #15803d;
}
.eq-dot-btn.is-hot {
  animation: eq-pulse 1.1s ease-out infinite;
}
@keyframes eq-pulse {
  0% {
    box-shadow: 0 0 0 0 currentColor;
    transform: translate(-50%, -50%) scale(1);
  }
  70% {
    box-shadow: 0 0 0 10px transparent;
    transform: translate(-50%, -50%) scale(1.35);
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
    transform: translate(-50%, -50%) scale(1);
  }
}
.eq-dot-btn--purchase.is-hot {
  color: rgba(185, 28, 28, 0.45);
}
.eq-dot-btn--payout.is-hot {
  color: rgba(21, 128, 61, 0.45);
}
.eq-tooltip {
  position: absolute;
  z-index: 5;
  transform: translate(-50%, calc(-100% - 12px));
  max-width: min(320px, 90vw);
  padding: 0.35rem 0.55rem;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.92);
  color: #f8fafc;
  font-size: 0.72rem;
  line-height: 1.35;
  pointer-events: none;
  white-space: normal;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
}
</style>
