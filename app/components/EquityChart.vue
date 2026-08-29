<script setup lang="ts">
import { createChart, ColorType, LineSeries, createSeriesMarkers } from 'lightweight-charts'
import { bindSeriesMarkersLayoutSync, eventUnixSeconds } from '#shared/tradeChartMarkers'
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
}>()

const wrap = ref<HTMLDivElement | null>(null)
const root = ref<HTMLDivElement | null>(null)
const tooltip = ref<{ x: number; y: number; text: string } | null>(null)
let chart: ReturnType<typeof createChart> | null = null
let resizeObserver: ResizeObserver | null = null
let markersLayout: ReturnType<typeof bindSeriesMarkersLayoutSync> | null = null
let crosshairHandler: ((param: { time?: unknown; point?: { x: number; y: number } }) => void) | null = null

const MARKER_TOLERANCE_SEC = 12 * 3600

function fmtAmount(kind: 'purchase' | 'payout', amount: number) {
  const n = Math.abs(amount)
  const s = n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return kind === 'purchase' ? `−$${s}` : `+$${s}`
}

function markerLabel(m: EquityChartMarker) {
  const kind = m.kind === 'purchase' ? 'Покупка пропа' : 'Выплата с пропа'
  const when = new Date(m.t).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
  return `${kind} · ${m.accountName} · ${fmtAmount(m.kind, m.amountUsdt)} · ${when}`
}

function findNearestMarker(timeSec: number): EquityChartMarker | null {
  const list = props.markers ?? []
  if (!list.length || !Number.isFinite(timeSec)) return null
  let best: EquityChartMarker | null = null
  let bestDt = Infinity
  for (const m of list) {
    const dt = Math.abs(eventUnixSeconds(m.t) - timeSec)
    if (dt < bestDt) {
      bestDt = dt
      best = m
    }
  }
  return bestDt <= MARKER_TOLERANCE_SEC ? best : null
}

function buildChartMarkers() {
  return (props.markers ?? []).map((m) => {
    const isPurchase = m.kind === 'purchase'
    const amt = Math.round(Math.abs(m.amountUsdt))
    return {
      time: eventUnixSeconds(m.t),
      position: isPurchase ? ('belowBar' as const) : ('aboveBar' as const),
      color: isPurchase ? '#b91c1c' : '#15803d',
      shape: isPurchase ? ('arrowDown' as const) : ('arrowUp' as const),
      text: isPurchase ? `−${amt}` : `+${amt}`,
    }
  })
}

function redraw() {
  if (!root.value) return
  tooltip.value = null
  if (crosshairHandler && chart) {
    chart.unsubscribeCrosshairMove(crosshairHandler)
    crosshairHandler = null
  }
  markersLayout?.unbind()
  markersLayout = null
  chart?.remove()
  chart = null
  if (!props.points.length) return
  chart = createChart(root.value, {
    width: root.value.clientWidth,
    height: 280,
    layout: {
      background: { type: ColorType.Solid, color: '#ffffff' },
      textColor: '#64748b',
    },
    grid: {
      vertLines: { color: '#e2e8f0' },
      horzLines: { color: '#e2e8f0' },
    },
    rightPriceScale: { borderColor: '#e2e8f0' },
    timeScale: { borderColor: '#e2e8f0', timeVisible: true },
  })
  const series = chart.addSeries(LineSeries, { color: '#2563eb', lineWidth: 2 })
  const data = props.points.map((p) => ({
    time: Math.floor(new Date(p.t).getTime() / 1000) as import('lightweight-charts').UTCTimestamp,
    value: p.cumulative,
  }))
  series.setData(data)
  const markerList = buildChartMarkers()
  if (markerList.length) {
    const markersApi = createSeriesMarkers(series, markerList)
    markersLayout = bindSeriesMarkersLayoutSync(chart, markersApi, markerList)
  }
  crosshairHandler = (param) => {
    if (!param.point || param.time == null || param.time === undefined) {
      tooltip.value = null
      return
    }
    const timeSec = typeof param.time === 'number' ? param.time : Number(param.time)
    const hit = findNearestMarker(timeSec)
    if (!hit) {
      tooltip.value = null
      return
    }
    tooltip.value = {
      x: param.point.x,
      y: param.point.y,
      text: markerLabel(hit),
    }
  }
  chart.subscribeCrosshairMove(crosshairHandler)
  chart.timeScale().fitContent()
  markersLayout?.refresh()
}

watch(
  () => [props.points, props.markers],
  () => nextTick(redraw),
  { deep: true },
)

onMounted(() => {
  redraw()
  resizeObserver = new ResizeObserver(() => {
    if (chart && root.value) {
      chart.applyOptions({ width: root.value.clientWidth })
      markersLayout?.refresh()
    }
  })
  if (root.value) resizeObserver.observe(root.value)
})

onUnmounted(() => {
  if (crosshairHandler && chart) chart.unsubscribeCrosshairMove(crosshairHandler)
  markersLayout?.unbind()
  resizeObserver?.disconnect()
  chart?.remove()
  chart = null
})
</script>

<template>
  <div ref="wrap" class="eq-wrap">
    <div ref="root" class="eq" />
    <div
      v-if="tooltip"
      class="eq-tooltip"
      :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
    >
      {{ tooltip.text }}
    </div>
  </div>
</template>

<style scoped>
.eq-wrap {
  position: relative;
  width: 100%;
}
.eq {
  min-height: 280px;
  width: 100%;
}
.eq-tooltip {
  position: absolute;
  z-index: 5;
  transform: translate(-50%, calc(-100% - 8px));
  max-width: min(320px, 90vw);
  padding: 0.35rem 0.55rem;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.92);
  color: #f8fafc;
  font-size: 0.72rem;
  line-height: 1.35;
  pointer-events: none;
  white-space: normal;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
