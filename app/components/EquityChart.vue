<script setup lang="ts">
import { createChart, ColorType, LineSeries } from 'lightweight-charts'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  points: { t: string; cumulative: number }[]
}>()

const root = ref<HTMLDivElement | null>(null)
let chart: ReturnType<typeof createChart> | null = null
let resizeObserver: ResizeObserver | null = null

function redraw() {
  if (!root.value) return
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
    timeScale: { borderColor: '#e2e8f0' },
  })
  const series = chart.addSeries(LineSeries, { color: '#2563eb', lineWidth: 2 })
  const data = props.points.map((p) => ({
    time: Math.floor(new Date(p.t).getTime() / 1000),
    value: p.cumulative,
  }))
  series.setData(data)
  chart.timeScale().fitContent()
}

watch(
  () => props.points,
  () => nextTick(redraw),
  { deep: true },
)

onMounted(() => {
  redraw()
  resizeObserver = new ResizeObserver(() => {
    if (chart && root.value) {
      chart.applyOptions({ width: root.value.clientWidth })
    }
  })
  if (root.value) resizeObserver.observe(root.value)
})

onUnmounted(() => {
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
