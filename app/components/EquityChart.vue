<script setup lang="ts">
import {
  createChart,
  createSeriesMarkers,
  ColorType,
  LineSeries,
  LineStyle,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
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

const root = ref<HTMLDivElement | null>(null)

const { unit, fmtUsdt } = useMoney()

let chart: ReturnType<typeof createChart> | null = null
let series: ReturnType<ReturnType<typeof createChart>['addSeries']> | null = null
let markersApi: ISeriesMarkersPluginApi<Time> | null = null
let resizeObserver: ResizeObserver | null = null

function toUnix(iso: string) {
  return Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp
}

function formatAxisPrice(value: number) {
  if (unit.value === 'pct') {
    return `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} %`
  }
  const sign = value < 0 ? '−' : ''
  return `${sign}$${Math.abs(value).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`
}

/** Маркер должен стоять ровно на времени точки серии, иначе библиотека его не рисует. */
function nearestPointTime(timeSec: number) {
  let best: UTCTimestamp | null = null
  let bestDt = Infinity
  for (const p of props.points) {
    const t = toUnix(p.t)
    const dt = Math.abs(t - timeSec)
    if (dt < bestDt) {
      bestDt = dt
      best = t
    }
  }
  return best
}

function buildMarkers(): SeriesMarker<Time>[] {
  const out: SeriesMarker<Time>[] = []
  for (const m of props.markers ?? []) {
    const time = nearestPointTime(eventUnixSeconds(m.t))
    if (time == null) continue
    const payout = m.kind === 'payout'
    const amount = fmtUsdt(payout ? Math.abs(m.amountUsdt) : -Math.abs(m.amountUsdt), { forceUsdt: true, max: 0, min: 0 })
    out.push({
      time,
      position: 'inBar',
      shape: 'circle',
      color: payout ? '#15803d' : '#b91c1c',
      size: 1.4,
      text: `${payout ? '+' : ''}${amount} · ${m.accountName}`,
    })
  }
  return out.sort((a, b) => (a.time as number) - (b.time as number))
}

function redraw() {
  if (!root.value) return
  chart?.remove()
  chart = null
  series = null
  markersApi = null
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
      scaleMargins: { top: 0.08, bottom: 0.08 },
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
    color: '#2563eb',
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    priceFormat: { type: 'custom', minMove: 0.01, formatter: formatAxisPrice },
  })
  const byTime = new Map<UTCTimestamp, number>()
  for (const p of props.points) byTime.set(toUnix(p.t), p.cumulative)
  series.setData([...byTime].sort((a, b) => a[0] - b[0]).map(([time, value]) => ({ time, value })))

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
      const min = Math.min(res.priceRange.minValue, 0)
      const max = Math.max(res.priceRange.maxValue, 0)
      const span = Math.max(max - min, Math.abs(max) * 0.08, 1)
      const pad = span * 0.08
      return { ...res, priceRange: { minValue: min - pad, maxValue: max + pad } }
    },
  })

  markersApi = createSeriesMarkers(series, buildMarkers())
  chart.timeScale().fitContent()
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
    markersApi?.setMarkers(buildMarkers())
  },
)

onMounted(() => {
  redraw()
  resizeObserver = new ResizeObserver(() => {
    if (chart && root.value) chart.applyOptions({ width: root.value.clientWidth })
  })
  if (root.value) resizeObserver.observe(root.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  chart?.remove()
  chart = null
  series = null
  markersApi = null
})
</script>

<template>
  <div ref="root" class="eq" />
</template>

<style scoped>
.eq {
  min-height: 420px;
  width: 100%;
}
</style>
