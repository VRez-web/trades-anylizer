<script setup lang="ts">
import {
  CandlestickSeries,
  ColorType,
  LineStyle,
  createChart,
  createSeriesMarkers,
} from 'lightweight-charts'
import { chartAxisPriceFormat } from '#shared/chartPriceFormat'
import { klineIntervalToMs } from '#shared/kline'
import {
  MARKER,
  barOpenTimeForEvent,
  bindSeriesMarkersLayoutSync,
  entryExitLabels,
  eventUnixSeconds,
  sortBarsByTime,
} from '#shared/tradeChartMarkers'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

/** Ноги объединённой сделки (время/цена каждой исходной записи). Без этого — одна пара вход/выход. */
type MergeLeg = {
  entryAt: string
  exitAt: string
  entryPrice: number
  exitPrice: number
}

const props = withDefaults(
  defineProps<{
    symbol: string
    entryAt: string
    exitAt: string
    entryPrice: number
    exitPrice: number
    /** Если задано и не пусто — на графике все ноги (круги), без пунктира по сводным ценам. */
    mergeLegs?: MergeLeg[]
    side?: 'long' | 'short'
    height?: number
    marketCategory?: string
  }>(),
  { side: 'long', height: 380, marketCategory: 'linear' },
)

const tf = ref('15')
const tfOptions = [
  { label: '1м', v: '1' },
  { label: '3м', v: '3' },
  { label: '5м', v: '5' },
  { label: '15м', v: '15' },
  { label: '30м', v: '30' },
  { label: '1ч', v: '60' },
  { label: '4ч', v: '240' },
  { label: '1д', v: 'D' },
]

const range = computed(() => {
  const times: number[] = []
  const legs = props.mergeLegs
  if (legs?.length) {
    for (const leg of legs) {
      times.push(new Date(leg.entryAt).getTime(), new Date(leg.exitAt).getTime())
    }
  } else {
    times.push(new Date(props.entryAt).getTime(), new Date(props.exitAt).getTime())
  }
  const lo = Math.min(...times)
  const hi = Math.max(...times)
  const span = Math.max(hi - lo, 60_000)
  const iv = klineIntervalToMs(tf.value)
  const pad = Math.max(48 * iv, Math.floor(span * 0.25))
  return { startMs: Math.floor(lo - pad), endMs: Math.floor(hi + pad) }
})

const klineUrl = computed(() => {
  const p = new URLSearchParams({
    symbol: props.symbol,
    interval: tf.value,
    start: String(range.value.startMs),
    end: String(range.value.endMs),
    category: props.marketCategory,
  })
  return `/api/market/kline?${p}`
})

const { data, error, pending } = useFetch(klineUrl, {
  watch: [tf, () => props.symbol, () => props.entryAt, () => props.exitAt, () => props.marketCategory, () => props.mergeLegs],
})

const root = ref<HTMLDivElement | null>(null)
let chart: ReturnType<typeof createChart> | null = null
let resizeObserver: ResizeObserver | null = null
let markersLayout: ReturnType<typeof bindSeriesMarkersLayoutSync> | null = null

function priceRange(bars: { low: number; high: number }[], extra: number[]) {
  let lo = Infinity
  let hi = -Infinity
  for (const c of bars) {
    lo = Math.min(lo, c.low)
    hi = Math.max(hi, c.high)
  }
  for (const p of extra) {
    if (Number.isFinite(p)) {
      lo = Math.min(lo, p)
      hi = Math.max(hi, p)
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null
  if (lo === hi) {
    const mid = lo
    const pad = Math.max(Math.abs(mid) * 0.0005, 1e-12)
    return { from: mid - pad, to: mid + pad }
  }
  const span = hi - lo
  const pad = Math.max(span * 0.08, hi * 1e-8)
  return { from: lo - pad, to: hi + pad }
}

function draw() {
  if (!root.value) return
  markersLayout?.unbind()
  markersLayout = null
  chart?.remove()
  chart = null
  const raw = data.value?.bars as
    | { time: number; open: number; high: number; low: number; close: number }[]
    | undefined
  if (!raw?.length) return
  const bars = sortBarsByTime(raw)
  const legs = props.mergeLegs
  const extraPrices =
    legs?.length != null && legs.length > 0
      ? legs.flatMap((l) => [l.entryPrice, l.exitPrice])
      : [props.entryPrice, props.exitPrice]
  const pr = priceRange(bars, extraPrices)
  const mid = pr
    ? (pr.from + pr.to) / 2
    : legs?.length
      ? legs.reduce((s, l) => s + l.entryPrice + l.exitPrice, 0) / (legs.length * 2)
      : (props.entryPrice + props.exitPrice) / 2
  const priceFmt = chartAxisPriceFormat(props.symbol, mid)
  const chartWidth = Math.max(1, Math.floor(root.value.getBoundingClientRect().width))
  chart = createChart(root.value, {
    width: chartWidth,
    height: props.height,
    layout: {
      background: { type: ColorType.Solid, color: '#ffffff' },
      textColor: '#64748b',
    },
    grid: {
      vertLines: { color: '#e2e8f0' },
      horzLines: { color: '#e2e8f0' },
    },
    rightPriceScale: {
      borderColor: '#e2e8f0',
      scaleMargins: { top: 0.08, bottom: 0.08 },
    },
    timeScale: {
      borderColor: '#e2e8f0',
      timeVisible: true,
      secondsVisible: true,
    },
  })
  const series = chart.addSeries(CandlestickSeries, {
    upColor: '#22c55e',
    downColor: '#ef4444',
    borderVisible: false,
    wickUpColor: '#22c55e',
    wickDownColor: '#ef4444',
    priceFormat: priceFmt,
    priceLineVisible: false,
    lastValueVisible: false,
  })
  series.setData(bars)
  const useLegs = legs?.length != null && legs.length > 0

  type M =
    | {
        time: number
        position: 'atPriceMiddle'
        price: number
        color: string
        shape: 'circle'
        text: string
      }
    | {
        time: number
        position: 'atPriceMiddle'
        price: number
        color: string
        shape: 'arrowUp' | 'arrowDown'
        text: string
      }

  let markersSorted: M[]

  if (useLegs && legs) {
    const circleMarkers: M[] = []
    legs.forEach((leg, idx) => {
      const i = idx + 1
      const { entry: lIn, exit: lOut } = entryExitLabels(i, props.side)
      const te = eventUnixSeconds(leg.entryAt)
      const tx = eventUnixSeconds(leg.exitAt)
      const at = barOpenTimeForEvent(bars, te)
      const bt = barOpenTimeForEvent(bars, tx)
      circleMarkers.push(
        {
          time: at,
          position: 'atPriceMiddle',
          price: leg.entryPrice,
          color: MARKER.entry,
          shape: 'circle',
          text: lIn,
        },
        {
          time: bt,
          position: 'atPriceMiddle',
          price: leg.exitPrice,
          color: MARKER.exit,
          shape: 'circle',
          text: lOut,
        },
      )
    })
    markersSorted = circleMarkers.sort((a, b) => a.time - b.time || a.price - b.price)
  } else {
    const { entry: labIn, exit: labOut } = entryExitLabels(1, props.side)
    series.createPriceLine({
      price: props.entryPrice,
      color: MARKER.entry,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Вход',
    })
    series.createPriceLine({
      price: props.exitPrice,
      color: MARKER.exit,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Выход',
    })
    const tEntry = eventUnixSeconds(props.entryAt)
    const tExit = eventUnixSeconds(props.exitAt)
    const te = barOpenTimeForEvent(bars, tEntry)
    const tx = barOpenTimeForEvent(bars, tExit)
    const markers: M[] =
      props.side === 'short'
        ? [
            {
              time: te,
              position: 'atPriceMiddle',
              price: props.entryPrice,
              color: MARKER.entry,
              shape: 'arrowDown',
              text: labIn,
            },
            {
              time: tx,
              position: 'atPriceMiddle',
              price: props.exitPrice,
              color: MARKER.exit,
              shape: 'arrowUp',
              text: labOut,
            },
          ]
        : [
            {
              time: te,
              position: 'atPriceMiddle',
              price: props.entryPrice,
              color: MARKER.entry,
              shape: 'arrowUp',
              text: labIn,
            },
            {
              time: tx,
              position: 'atPriceMiddle',
              price: props.exitPrice,
              color: MARKER.exit,
              shape: 'arrowDown',
              text: labOut,
            },
          ]
    markersSorted = [...markers].sort((a, b) => a.time - b.time || a.price - b.price)
  }
  chart.timeScale().fitContent()
  if (pr) {
    series.priceScale().applyOptions({ autoScale: false })
    series.priceScale().setVisibleRange(pr)
  }
  const markersApi = createSeriesMarkers(
    series,
    markersSorted as Parameters<typeof createSeriesMarkers>[1],
    { autoScale: true },
  )
  if (pr) {
    series.priceScale().setVisibleRange(pr)
  }
  markersLayout = bindSeriesMarkersLayoutSync(chart, markersApi, markersSorted)
}

const errText = computed(() => {
  const e = error.value as { statusMessage?: string; message?: string } | null
  if (!e) return ''
  return e.statusMessage || e.message || 'Ошибка загрузки'
})

const showMergeLegsHint = computed(() => (props.mergeLegs?.length ?? 0) > 0)

watch(
  () => [
    data.value?.bars,
    props.entryPrice,
    props.exitPrice,
    props.entryAt,
    props.exitAt,
    props.height,
    props.side,
    props.mergeLegs,
  ],
  async () => {
    await nextTick()
    draw()
  },
  { deep: true },
)

onMounted(() => {
  nextTick(draw)
  resizeObserver = new ResizeObserver(() => {
    if (chart && root.value) {
      const w = Math.max(1, Math.floor(root.value.getBoundingClientRect().width))
      chart.applyOptions({ width: w, height: props.height })
      markersLayout?.refresh()
    }
  })
  watch(root, (el) => {
    resizeObserver?.disconnect()
    if (el) resizeObserver!.observe(el)
  })
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  markersLayout?.unbind()
  markersLayout = null
  chart?.remove()
  chart = null
})
</script>

<template>
  <div class="wrap">
    <div class="head">
      <span class="muted title-line">{{ symbol }} · свечи Bybit ({{ marketCategory }})</span>
      <div class="tf row">
        <span class="muted tf-label">Таймфрейм:</span>
        <button
          v-for="x in tfOptions"
          :key="x.v"
          type="button"
          class="btn tf-btn"
          :class="{ active: tf === x.v }"
          @click="tf = x.v"
        >
          {{ x.label }}
        </button>
      </div>
    </div>
    <div v-if="pending" class="muted state">Загрузка свечей…</div>
    <div v-else-if="error" class="state err">{{ errText }}</div>
    <div v-else-if="!data?.bars?.length" class="muted state">
      Нет свечей в выбранном диапазоне (проверьте тикер или другой таймфрейм).
    </div>
    <div
      v-else-if="data?.bars?.length && !error"
      ref="root"
      class="ch"
      :style="{ '--trade-chart-h': `${height}px` }"
    />
    <p v-if="data?.bars?.length && !error" class="hint muted">
      <template v-if="showMergeLegsHint">
        Объединённая сделка: <strong>круги</strong> — входы и выходы по каждой ноге (Вх1…). Пунктир по сводным ценам не рисуется.
        Привязка к свече — как ниже (UTC, интервал <strong>[open, следующий open)</strong>).
      </template>
      <template v-else>
        Пунктир — цены входа/выхода. По горизонтали маркер привязан к свече с тем же временем открытия, что и у бара на графике
        (интервал <strong>[open, следующий open)</strong>, UTC). Стрелки — направление у шорта/лонга; Вх1/Вых1 и л/ш — сторона.
      </template>
    </p>
  </div>
</template>

<style scoped>
.wrap {
  width: 100%;
}
.head {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  margin-bottom: 0.75rem;
}
.title-line {
  font-size: 0.875rem;
}
.tf {
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.tf-label {
  margin-right: 0.15rem;
  font-size: 0.8125rem;
}
.tf-btn {
  font-size: 0.8125rem;
  line-height: 1.2;
  padding: 0.25rem 0.5rem;
}
.tf-btn.active {
  background: var(--surface2);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}
.ch {
  min-height: var(--trade-chart-h, 380px);
  width: 100%;
}
.state {
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}
.state.err {
  color: var(--red);
}
.hint {
  font-size: 0.75rem;
  line-height: 1.35;
  margin: 0.5rem 0 0;
}
</style>
