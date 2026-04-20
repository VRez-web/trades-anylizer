<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const now = new Date()
const year = ref(Number(route.query.year ?? now.getFullYear()))
const month = ref(Number(route.query.month ?? now.getMonth() + 1))

watch(
  () => route.query,
  (q) => {
    if (q.year) year.value = Number(q.year)
    if (q.month) month.value = Number(q.month)
  },
)

const { data, refresh } = await useFetch(
  () => `/api/journal/month?year=${year.value}&month=${month.value}`,
  { watch: [year, month] },
)

const note = ref('')
watch(
  data,
  (d) => {
    if (d && typeof d === 'object' && 'note' in d) note.value = (d as { note: string }).note
  },
  { immediate: true },
)

function shiftMonth(delta: number) {
  let m = month.value + delta
  let y = year.value
  if (m > 12) {
    m = 1
    y += 1
  } else if (m < 1) {
    m = 12
    y -= 1
  }
  month.value = m
  year.value = y
  router.replace({ query: { year: String(y), month: String(m) } })
}

const equityPoints = computed(() => {
  if (!data.value?.trades?.length) return []
  let c = 0
  return data.value.trades.map((t: { exitAt: string; net: number }) => {
    c += t.net
    return { t: t.exitAt, cumulative: c }
  })
})

async function saveNote() {
  if (!data.value?.monthKey) return
  await $fetch('/api/notes', {
    method: 'PUT',
    body: { scope: 'month', periodKey: data.value.monthKey, content: note.value },
  })
  await refresh()
}
</script>

<template>
  <div class="page">
    <div class="row" style="justify-content: space-between; align-items: center; margin-bottom: 1rem">
      <h1 style="margin: 0; font-size: 1.25rem">Журнал: месяц</h1>
      <div class="row">
        <button type="button" class="btn" @click="shiftMonth(-1)">←</button>
        <span class="muted">{{ year }}-{{ String(month).padStart(2, '0') }}</span>
        <button type="button" class="btn" @click="shiftMonth(1)">→</button>
      </div>
    </div>

    <div v-if="data?.stats" class="card" style="margin-bottom: 1rem">
      <h2>Месяц</h2>
      <JournalMetrics :stats="data.stats" />
    </div>

    <div class="card" style="margin-bottom: 1rem">
      <h2>Кривая за месяц</h2>
      <ClientOnly>
        <EquityChart v-if="equityPoints.length" :points="equityPoints" />
        <p v-else class="muted">Нет сделок</p>
      </ClientOnly>
    </div>

    <div class="card">
      <h2>Описание месяца</h2>
      <textarea v-model="note" class="textarea" rows="6" />
      <button type="button" class="btn btn-primary" style="margin-top: 0.5rem" @click="saveNote">Сохранить</button>
    </div>
  </div>
</template>
