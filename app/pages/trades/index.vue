<script setup lang="ts">
const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)

const calendarUrl = computed(
  () => `/api/stats/calendar?year=${year.value}&month=${month.value}`,
)
const { data: calendar, refresh: refreshCal } = await useFetch(calendarUrl)

const { data: equity, refresh: refreshEq } = await useFetch('/api/stats/equity')
const { data: entryReasons, refresh: refreshEntry } = await useFetch('/api/stats/by-reason', {
  query: { kind: 'entry' },
})
const { data: exitReasons, refresh: refreshExit } = await useFetch('/api/stats/by-reason', {
  query: { kind: 'exit' },
})

const equityPoints = computed(() => {
  if (!equity.value) return []
  return equity.value.map((p: { t: string; cumulative: number }) => ({
    t: p.t,
    cumulative: p.cumulative,
  }))
})

const entryRows = computed(() => {
  if (!entryReasons.value) return []
  return entryReasons.value.map((r: { label: string; sum: number }) => ({
    label: r.label,
    sum: r.sum,
  }))
})

const exitRows = computed(() => {
  if (!exitReasons.value) return []
  return exitReasons.value.map((r: { label: string; sum: number }) => ({
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

    <div class="bars-row">
      <ReasonBars title="По причинам входа" :rows="entryRows" />
      <ReasonBars title="По причинам выхода" :rows="exitRows" />
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
.bars-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
@media (max-width: 900px) {
  .bars-row {
    grid-template-columns: 1fr;
  }
}
</style>
