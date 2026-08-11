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

const root = ref<HTMLDivElement | null>(null)
let chart: ReturnType<typeof createChart> | null = null
let resizeObserver: ResizeObserver | null = null
let markersLayout: ReturnType<typeof bindSeriesMarkersLayoutSync> | null = null

function buildChartMarkers() {
  return (props.markers ?? []).map((m) => {
    const isPurchase = m.kind === 'purchase'
    return {
      time: eventUnixSeconds(m.t),
      position: isPurchase ? ('belowBar' as const) : ('aboveBar' as const),
      color: isPurchase ? '#b91c1c' : '#15803d',
      shape: isPurchase ? ('arrowDown' as const) : ('arrowUp' as const),
      text: isPurchase ? '−' : '+',
    }
  })
}

function redraw() {
  if (!root.value) return
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
  markersLayout?.unbind()
  resizeObserver?.disconnect()
  chart?.remove()
  chart = null
})
</script>

<template>
  <div ref="root" class="eq" />
</template>

<style scoped>
.eq {
  min-height: 280px;
  width: 100%;
}
</style>
