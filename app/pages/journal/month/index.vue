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

const { fmtUsdt } = useMoney()

function fmtWinRatePct(p: number | null) {
  if (p == null || Number.isNaN(p)) return '—'
  return `${(p * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`
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

    <div v-if="data?.stats" class="card month-block">
      <h2 class="block-title">Месяц</h2>
      <JournalMetrics :stats="data.stats" />
    </div>

    <section v-if="data?.sideWinRate" class="card month-block">
      <h2 class="block-title">Long / Short</h2>
      <p class="muted block-hint">Win — сделки с положительным чистым результатом.</p>
      <div class="side-grid">
        <article class="side-card">
          <h3 class="side-card__title">Long</h3>
          <template v-if="data.sideWinRate.long.total">
            <p class="side-card__stat">
              {{ data.sideWinRate.long.total }} сделок · {{ data.sideWinRate.long.wins }}W /
              {{ data.sideWinRate.long.losses }}L
            </p>
            <p class="side-card__wr">WR <strong>{{ fmtWinRatePct(data.sideWinRate.long.winRate) }}</strong></p>
            <p class="side-card__net" :class="data.sideWinRate.long.net >= 0 ? 'pos' : 'neg'">
              {{ fmtUsdt(data.sideWinRate.long.net) }}
            </p>
          </template>
          <p v-else class="muted">Нет сделок</p>
        </article>
        <article class="side-card">
          <h3 class="side-card__title">Short</h3>
          <template v-if="data.sideWinRate.short.total">
            <p class="side-card__stat">
              {{ data.sideWinRate.short.total }} сделок · {{ data.sideWinRate.short.wins }}W /
              {{ data.sideWinRate.short.losses }}L
            </p>
            <p class="side-card__wr">WR <strong>{{ fmtWinRatePct(data.sideWinRate.short.winRate) }}</strong></p>
            <p class="side-card__net" :class="data.sideWinRate.short.net >= 0 ? 'pos' : 'neg'">
              {{ fmtUsdt(data.sideWinRate.short.net) }}
            </p>
          </template>
          <p v-else class="muted">Нет сделок</p>
        </article>
      </div>
    </section>

    <section v-if="data?.tickerSummary?.length" class="card month-block">
      <h2 class="block-title">По тикерам</h2>
      <div class="info-grid">
        <div v-for="row in data.tickerSummary" :key="row.key" class="info-tile">
          <div class="info-tile__sym">{{ row.key }}</div>
          <div class="info-tile__meta">
            <span>{{ row.count }} сделок</span>
            <strong :class="row.sum >= 0 ? 'pos' : 'neg'">{{ fmtUsdt(row.sum) }}</strong>
          </div>
        </div>
      </div>
    </section>

    <section v-if="data?.labelSummary?.length" class="card month-block">
      <h2 class="block-title">По лейблам</h2>
      <p class="muted block-hint">
        Сделка с несколькими лейблами учитывается в каждой группе; «без лейблов» — без привязки к лейблу.
      </p>
      <div class="info-grid">
        <div v-for="row in data.labelSummary" :key="row.key" class="info-tile info-tile--wide">
          <div class="info-tile__lbl">{{ row.key }}</div>
          <div class="info-tile__meta">
            <span>{{ row.count }} упом.</span>
            <strong :class="row.sum >= 0 ? 'pos' : 'neg'">{{ fmtUsdt(row.sum) }}</strong>
          </div>
        </div>
      </div>
    </section>

    <div class="card month-block">
      <h2>Кривая за месяц</h2>
      <ClientOnly>
        <EquityChart v-if="equityPoints.length" :points="equityPoints" />
        <p v-else class="muted">Нет сделок</p>
      </ClientOnly>
    </div>

    <div class="card month-block">
      <h2 class="block-title">Описание месяца</h2>
      <textarea v-model="note" class="textarea" rows="6" />
      <button type="button" class="btn btn-primary" style="margin-top: 0.5rem" @click="saveNote">Сохранить</button>
    </div>
  </div>
</template>

<style scoped>
.month-block {
  margin-bottom: 1rem;
}
.block-title {
  margin: 0 0 0.65rem;
  font-size: 1rem;
  font-weight: 600;
}
.block-hint {
  margin: 0 0 0.65rem;
  font-size: 0.78rem;
}
.side-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
@media (max-width: 560px) {
  .side-grid {
    grid-template-columns: 1fr;
  }
}
.side-card {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.65rem 0.75rem;
}
.side-card__title {
  margin: 0 0 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
}
.side-card__stat {
  margin: 0 0 0.25rem;
  font-size: 0.8125rem;
  color: var(--muted);
}
.side-card__wr {
  margin: 0 0 0.25rem;
  font-size: 0.875rem;
}
.side-card__net {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem 0.65rem;
}
.info-tile {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.45rem 0.55rem;
  font-size: 0.8125rem;
}
.info-tile--wide {
  min-width: 0;
}
.info-tile__sym {
  font-weight: 600;
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
  word-break: break-word;
}
.info-tile__lbl {
  font-weight: 500;
  margin-bottom: 0.25rem;
  word-break: break-word;
  line-height: 1.3;
}
.info-tile__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.35rem;
  color: var(--muted);
  font-size: 0.75rem;
}
.info-tile__meta strong {
  font-size: 0.8125rem;
}
</style>
