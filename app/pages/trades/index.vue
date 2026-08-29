<script setup lang="ts">
const CALENDAR_YM_KEY = 'trades-analyzer:calendar-ym'

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
const { data: calendar } = await useFetch(calendarUrl)

const { data: equity } = await useFetch('/api/stats/equity')

const byLabelUrl = computed(
  () => `/api/stats/by-label?year=${year.value}&month=${month.value}`,
)
const { data: byLabel } = await useFetch(byLabelUrl)

const equityPoints = computed(() => {
  const raw = equity.value
  if (!raw || !('points' in raw) || !Array.isArray(raw.points)) return []
  return raw.points.map((p: { t: string; cumulative: number }) => ({
    t: p.t,
    cumulative: p.cumulative,
  }))
})

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

const equityEventsSorted = computed(() =>
  [...equityMarkers.value].sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime()),
)

const { fmtUsdt } = useMoney()

function fmtPropEventAmount(kind: 'purchase' | 'payout', amount: number) {
  const n = Math.abs(amount)
  return kind === 'purchase' ? `−${fmtUsdt(n)}` : `+${fmtUsdt(n)}`
}

function fmtPropEventWhen(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

function propEventKindLabel(kind: 'purchase' | 'payout') {
  return kind === 'purchase' ? 'Покупка' : 'Выплата'
}

const systemRows = computed(() => {
  if (!byLabel.value?.system) return []
  return byLabel.value.system.map((r: { label: string; sum: number }) => ({
    label: r.label,
    sum: r.sum,
  }))
})
const techniqueRows = computed(() => {
  if (!byLabel.value?.technique) return []
  return byLabel.value.technique.map((r: { label: string; sum: number }) => ({
    label: r.label,
    sum: r.sum,
  }))
})
const psychologyRows = computed(() => {
  if (!byLabel.value?.psychology) return []
  return byLabel.value.psychology.map((r: { label: string; sum: number }) => ({
    label: r.label,
    sum: r.sum,
  }))
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
        @update:year="year = $event"
        @update:month="month = $event"
        @pick="goDay"
      />
    </div>

    <p class="muted bars-caption">
      Инфографика по лейблам за выбранный месяц (дата выхода из сделки попадает в месяц).
    </p>
    <div class="bars-row">
      <ReasonBars title="Лейблы системы" :rows="systemRows" />
      <ReasonBars title="Лейблы техники" :rows="techniqueRows" />
      <ReasonBars title="Лейблы психологии" :rows="psychologyRows" />
    </div>

    <div class="card" style="margin-top: 1rem">
      <h2>Кривая доходности</h2>
      <p class="muted bars-caption">
        Live/test PnL и денежный поток пропов (покупки и выплаты). Торговый PnL проп-сделок не включён.
      </p>
      <ClientOnly>
        <EquityChart
          v-if="equityPoints.length"
          :points="equityPoints"
          :markers="equityMarkers"
        />
        <template #fallback>
          <div class="muted" style="padding: 2rem">Загрузка графика…</div>
        </template>
      </ClientOnly>
      <p v-if="equityPoints.length === 0" class="muted">Пока нет закрытых сделок</p>
      <div v-if="equityMarkers.length" class="eq-legend">
        <span class="eq-legend-item"><span class="eq-dot eq-dot--purchase" /> Покупка проп-счёта</span>
        <span class="eq-legend-item"><span class="eq-dot eq-dot--payout" /> Выплата с пропа</span>
      </div>
      <ul v-if="equityEventsSorted.length" class="eq-events">
        <li v-for="(m, i) in equityEventsSorted" :key="`${m.t}-${m.kind}-${i}`" class="eq-event">
          <span class="eq-event-kind" :class="`eq-event-kind--${m.kind}`">{{ propEventKindLabel(m.kind) }}</span>
          <span class="eq-event-account">{{ m.accountName }}</span>
          <span class="eq-event-amt" :class="m.kind === 'payout' ? 'pos' : 'neg'">{{
            fmtPropEventAmount(m.kind, m.amountUsdt)
          }}</span>
          <span class="eq-event-when muted">{{ fmtPropEventWhen(m.t) }}</span>
        </li>
      </ul>
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
.bars-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}
.eq-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  margin-top: 0.65rem;
  font-size: 0.78rem;
  color: var(--muted);
}
.eq-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.eq-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
}
.eq-dot--purchase {
  background: #b91c1c;
}
.eq-dot--payout {
  background: #15803d;
}
.eq-events {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  border-top: 1px solid var(--border);
}
.eq-event {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.65rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--border);
  font-size: 0.8125rem;
}
.eq-event-kind {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
}
.eq-event-kind--purchase {
  color: #b91c1c;
  background: rgba(185, 28, 28, 0.08);
}
.eq-event-kind--payout {
  color: #166534;
  background: rgba(22, 101, 52, 0.08);
}
.eq-event-account {
  font-weight: 600;
}
.eq-event-amt {
  font-variant-numeric: tabular-nums;
}
.eq-event-when {
  margin-left: auto;
  font-size: 0.75rem;
}
</style>
