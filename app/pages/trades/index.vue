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
  () => `/api/stats/calendar?year=${year.value}&month=${month.value}`,
)
const { data: calendar } = await useFetch(calendarUrl)

const { data: equity } = await useFetch('/api/stats/equity')

const byLabelUrl = computed(
  () => `/api/stats/by-label?year=${year.value}&month=${month.value}`,
)
const { data: byLabel } = await useFetch(byLabelUrl)

const equityPoints = computed(() => {
  if (!equity.value) return []
  return equity.value.map((p: { t: string; cumulative: number }) => ({
    t: p.t,
    cumulative: p.cumulative,
  }))
})

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
        :journal-by-day="calendar?.journalByDay ?? {}"
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
      <ClientOnly>
        <EquityChart v-if="equityPoints.length" :points="equityPoints" />
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
.bars-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;
}
@media (max-width: 1100px) {
  .bars-row {
    grid-template-columns: 1fr;
  }
}
</style>
