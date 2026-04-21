<script setup lang="ts">
import {
  CandlestickSeries,
  ColorType,
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

export interface JournalDayTrade {
  id: number
  entryAt: string
  exitAt: string
  entryPrice: number
  exitPrice: number
  side: 'long' | 'short'
  net: number
}

const props = withDefaults(
  defineProps<{
    symbol: string
    trades: JournalDayTrade[]
    height?: number
    marketCategory?: string
  }>(),
  { height: 340, marketCategory: 'linear' },
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
  const list = props.trades
  if (!list.length) {
    const now = Date.now()
    return { startMs: now - 1440 * 60 * 1000, endMs: now }
  }
  let lo = Infinity
  let hi = -Infinity
  for (const t of list) {
    const a = new Date(t.entryAt).getTime()
    const b = new Date(t.exitAt).getTime()
    lo = Math.min(lo, a, b)
    hi = Math.max(hi, a, b)
  }
  const span = Math.max(hi - lo, 60_000)
  const iv = klineIntervalToMs(tf.value)
  const pad = Math.max(48 * iv, Math.floor(span * 0.25))
  return { startMs: Math.floor(lo - pad), endMs: Math.floor(hi + pad) }
})

const tradesKey = computed(() =>
  props.trades.map((t) => `${t.id}:${t.entryAt}:${t.exitAt}:${t.entryPrice}:${t.exitPrice}:${t.side}`).join('|'),
)

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
  watch: [tf, () => props.symbol, tradesKey, () => props.marketCategory],
})

const root = ref<HTMLDivElement | null>(null)
let chart: ReturnType<typeof createChart> | null = null
let resizeObserver: ResizeObserver | null = null
let markersLayout: ReturnType<typeof bindSeriesMarkersLayoutSync> | null = null

function priceRange(
  bars: { low: number; high: number }[],
  prices: number[],
) {
  let lo = Infinity
  let hi = -Infinity
  for (const c of bars) {
    lo = Math.min(lo, c.low)
    hi = Math.max(hi, c.high)
  }
  for (const p of prices) {
    lo = Math.min(lo, p)
    hi = Math.max(hi, p)
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
  if (!root.value || !props.trades.length) return
  markersLayout?.unbind()
  markersLayout = null
  chart?.remove()
  chart = null
  const raw = data.value?.bars as
    | { time: number; open: number; high: number; low: number; close: number }[]
    | undefined
  if (!raw?.length) return
  const bars = sortBarsByTime(raw)
  const prices: number[] = []
  for (const t of props.trades) {
    prices.push(t.entryPrice, t.exitPrice)
  }
  const pr = priceRange(bars, prices)
  const mid = pr ? (pr.from + pr.to) / 2 : prices.reduce((a, b) => a + b, 0) / prices.length
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
  type DayMarker = {
    time: number
    position: 'atPriceMiddle'
    price: number
    color: string
    shape: 'circle'
    text: string
  }
  const markers: DayMarker[] = []
  props.trades.forEach((t, idx) => {
    const i = idx + 1
    const { entry: labIn, exit: labOut } = entryExitLabels(i, t.side)
    const te = eventUnixSeconds(t.entryAt)
    const tx = eventUnixSeconds(t.exitAt)
    const at = barOpenTimeForEvent(bars, te)
    const bt = barOpenTimeForEvent(bars, tx)
    markers.push(
      {
        time: at,
        position: 'atPriceMiddle' as const,
        price: t.entryPrice,
        color: MARKER.entry,
        shape: 'circle' as const,
        text: labIn,
      },
      {
        time: bt,
        position: 'atPriceMiddle' as const,
        price: t.exitPrice,
        color: MARKER.exit,
        shape: 'circle' as const,
        text: labOut,
      },
    )
  })
  markers.sort((a, b) => a.time - b.time || a.price - b.price)
  chart.timeScale().fitContent()
  if (pr) {
    series.priceScale().applyOptions({ autoScale: false })
    series.priceScale().setVisibleRange(pr)
  }
  const markersApi = createSeriesMarkers(series, markers as Parameters<typeof createSeriesMarkers>[1], {
    autoScale: true,
  })
  if (pr) {
    series.priceScale().setVisibleRange(pr)
  }
  markersLayout = bindSeriesMarkersLayoutSync(chart, markersApi, markers)
}

const errText = computed(() => {
  const e = error.value as { statusMessage?: string; message?: string } | null
  if (!e) return ''
  return e.statusMessage || e.message || 'Ошибка загрузки'
})

watch(
  () => [data.value?.bars, props.trades, props.height, tradesKey.value],
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
  watch(
    root,
    (el) => {
      resizeObserver?.disconnect()
      if (el) resizeObserver!.observe(el)
    },
    { immediate: true },
  )
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
      <span class="muted title-line">
        {{ symbol }} · {{ trades.length }} {{ trades.length === 1 ? 'сделка' : 'сделок' }} за день
      </span>
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
      Нет свечей в выбранном диапазоне (проверьте тикер или таймфрейм).
    </div>
    <div
      v-else-if="data?.bars?.length && !error && trades.length"
      ref="root"
      class="ch"
      :style="{ '--trade-chart-h': `${height}px` }"
    />
    <p class="hint muted">
      Кружки — цены входа/выхода из журнала. По горизонтали маркер стоит на той же временной метке, что и свеча (открытие
      бара, UTC), в чей интервал попал момент сделки. Номер в подписи (Вх1, Вых2…) — порядок в списке дня; л/ш — сторона.
      Чистый PnL с комиссией и фандингом — в показателях дня; по одной только цене на графике его не восстановить.
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
  min-height: var(--trade-chart-h, 340px);
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
