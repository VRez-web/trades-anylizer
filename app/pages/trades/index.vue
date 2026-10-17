<script setup lang="ts">
const CALENDAR_YM_KEY = 'trades-analyzer:calendar-ym'
const { unit, setBasis } = useDisplayUnit()

const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)
/** После onMounted — чтобы не перезаписать localStorage до чтения и не ломать гидрацию */
const calendarPersistReady = ref(false)

onMounted(() => {
  try {
    const raw = localStorage.getItem(CALENDAR_YM_KEY)
    if (raw) {
      const j = JSON.parse(raw) as { year?: number; month?: number }
      const yy = Number(j.year)
      const mm = Number(j.month)
      if (Number.isFinite(yy) && yy >= 1970 && yy <= 2100 && Number.isFinite(mm) && mm >= 1 && mm <= 12) {
        year.value = yy
        month.value = mm
      }
    }
  } catch {
    /* ignore */
  }
  calendarPersistReady.value = true
  localStorage.setItem(CALENDAR_YM_KEY, JSON.stringify({ year: year.value, month: month.value }))
})

watch([year, month], ([yy, mm]) => {
  if (!import.meta.client || !calendarPersistReady.value) return
  localStorage.setItem(CALENDAR_YM_KEY, JSON.stringify({ year: yy, month: mm }))
})

const calendarUrl = computed(
  () => `/api/stats/calendar?year=${year.value}&month=${month.value}&tzOffset=${new Date().getTimezoneOffset()}`,
)
const byLabelUrl = computed(
  () => `/api/stats/by-label?year=${year.value}&month=${month.value}`,
)

const [{ data: calendar }, { data: equity }, { data: byLabel }] = await Promise.all([
  useFetch(calendarUrl),
  useFetch<{
    points: { t: string; cumulative: number }[]
    markers: { t: string; kind: 'purchase' | 'payout'; accountName: string; amountUsdt: number }[]
    quoteVolumeUsdt?: number | null
  }>('/api/stats/equity'),
  useFetch(byLabelUrl),
])

const equityPoints = computed(() => {
  const raw = equity.value
  if (!raw || !('points' in raw) || !Array.isArray(raw.points)) return []
  const vol = raw.quoteVolumeUsdt
  const asPct = unit.value === 'pct' && vol != null && vol > 0
  return raw.points.map((p) => ({
    t: p.t,
    cumulative: asPct ? (p.cumulative / vol) * 100 : p.cumulative,
  }))
})

watch(
  [calendar, equity],
  () => {
    const monthVol = Number((calendar.value as { monthQuoteVolume?: number } | null)?.monthQuoteVolume)
    if (Number.isFinite(monthVol) && monthVol > 0) {
      setBasis(monthVol)
      return
    }
    setBasis(equity.value?.quoteVolumeUsdt ?? null)
  },
  { immediate: true },
)

const equityMarkers = computed(() => {
  const raw = equity.value
  if (!raw || !('markers' in raw) || !Array.isArray(raw.markers)) return []
  return raw.markers as {
    t: string
    kind: 'purchase' | 'payout'
    accountName: string
    amountUsdt: number
  }[]
})

function goDay(date: string) {
  navigateTo(`/trades/day/${date}`)
}
</script>

<template>
  <div class="page">
    <h1 style="margin: 0 0 1rem; font-size: 1.35rem">Сделки</h1>

    <div class="cal-row">
      <CalendarPanel
        :year="year"
        :month="month"
        :days="calendar?.days ?? {}"
        :day-meta="calendar?.dayMeta ?? {}"
        :month-trades-count="calendar?.monthTradesCount ?? 0"
        :journal-by-day="calendar?.journalByDay ?? {}"
        :journal-month-analysis="calendar?.journalMonthAnalysis === true"
        :journal-week-analysis-by-key="calendar?.journalWeekAnalysisByKey ?? {}"
        :month-quote-volume="calendar?.monthQuoteVolume ?? null"
        :day-quote-volume="calendar?.dayQuoteVolume ?? {}"
        @update:year="year = $event"
        @update:month="month = $event"
        @pick="goDay"
      />
    </div>

    <p class="muted bars-caption">
      Инфографика по лейблам за выбранный месяц (дата выхода из сделки попадает в месяц).
    </p>
    <LabelBarsGrid :data="byLabel" />

    <div class="card" style="margin-top: 1rem">
      <h2>Кривая доходности</h2>
      <ClientOnly>
        <EquityChart
          v-if="equityPoints.length"
          :points="equityPoints"
          :markers="equityMarkers"
          :volume-basis="equity?.quoteVolumeUsdt ?? null"
        />
        <template #fallback>
          <div class="muted" style="padding: 2rem">Загрузка графика…</div>
        </template>
      </ClientOnly>
      <p v-if="equityPoints.length === 0" class="muted">Пока нет закрытых сделок</p>
    </div>
  </div>
</template>

<style scoped>
.cal-row {
  min-height: 380px;
  margin-bottom: 1rem;
}
.bars-caption {
  margin: 0 0 0.65rem;
  font-size: 0.8125rem;
}
</style>
