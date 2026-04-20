<script setup lang="ts">
import { format } from 'date-fns'

const route = useRoute()
const router = useRouter()
const date = computed(() => String(route.params.date))

function shiftDay(delta: number) {
  const d = new Date(date.value + 'T12:00:00')
  d.setDate(d.getDate() + delta)
  router.push(`/trades/day/${format(d, 'yyyy-MM-dd')}`)
}

const { data: trades } = await useFetch(
  () => `/api/trades?day=${encodeURIComponent(date.value)}`,
  { watch: [date] },
)

const noteText = ref('')
const planText = ref('')
const noteLoading = ref(true)

async function loadNote() {
  noteLoading.value = true
  try {
    const n = await $fetch<{ content?: string; tradePlan?: string }>('/api/notes', {
      query: { scope: 'day', key: date.value },
    })
    noteText.value = n.content ?? ''
    planText.value = n.tradePlan ?? ''
  } finally {
    noteLoading.value = false
  }
}

onMounted(loadNote)
watch(date, loadNote)

const { fmtUsdt, fmtPriceMovePct, fmtSignedPercent } = useMoney()
const runtimeConfig = useRuntimeConfig()

const depositUsdt = computed(() => {
  const n = Number(runtimeConfig.public.depositUsdt)
  return Number.isFinite(n) && n > 0 ? n : 0
})

const hasDayAnalysis = computed(() => noteText.value.trim().length > 0)
const hasDayPlan = computed(() => planText.value.trim().length > 0)

const daySum = computed(() => {
  if (!trades.value?.length) return 0
  return trades.value.reduce((s: number, t: { net: number }) => s + t.net, 0)
})

const daySumPctOfDeposit = computed(() => {
  const d = depositUsdt.value
  if (d <= 0) return null
  return (daySum.value / d) * 100
})

function tradePricePct(
  t: { side: string; entryPrice: number; exitPrice: number },
): string | null {
  return fmtPriceMovePct(t.side as 'long' | 'short', t.entryPrice, t.exitPrice)
}

const journalDayUrl = computed(() => `/journal/day?date=${encodeURIComponent(date.value)}`)

function goTrade(id: number) {
  navigateTo(`/trades/${id}`)
}
</script>

<template>
  <div class="page">
    <div class="day-toolbar">
      <div class="day-toolbar-left">
        <NuxtLink to="/trades" class="btn">← Календарь</NuxtLink>
        <div class="day-nav row">
          <button type="button" class="btn" aria-label="Предыдущий день" @click="shiftDay(-1)">
            ←
          </button>
          <span class="day-date">{{ date }}</span>
          <button type="button" class="btn" aria-label="Следующий день" @click="shiftDay(1)">
            →
          </button>
        </div>
      </div>
      <div class="analysis-pin">
        <div class="pin-group">
          <span class="muted analysis-pin-label">План</span>
          <template v-if="noteLoading"><span class="muted">…</span></template>
          <span v-else class="analysis-flag" :class="hasDayPlan ? 'yes' : 'no'">{{
            hasDayPlan ? 'есть' : 'нет'
          }}</span>
        </div>
        <div class="pin-group">
          <span class="muted analysis-pin-label">Анализ</span>
          <template v-if="noteLoading"><span class="muted">…</span></template>
          <span v-else class="analysis-flag" :class="hasDayAnalysis ? 'yes' : 'no'">{{
            hasDayAnalysis ? 'есть' : 'нет'
          }}</span>
        </div>
        <NuxtLink :to="journalDayUrl" class="btn btn-primary btn-tiny">Перейти</NuxtLink>
      </div>
    </div>

    <p class="muted day-sum">
      Сумма за день:
      <strong :class="daySum >= 0 ? 'pos' : 'neg'">{{ fmtUsdt(daySum) }}</strong>
      <template v-if="depositUsdt > 0 && daySumPctOfDeposit != null">
        <span class="day-sum-pct muted"> ({{ fmtSignedPercent(daySumPctOfDeposit) }} к депозиту)</span>
      </template>
    </p>

    <h2 style="font-size: 1rem; margin: 1.25rem 0 0.5rem">Сделки</h2>
    <div v-if="!trades?.length" class="muted">Пусто</div>
    <table v-else class="tbl">
      <thead>
        <tr>
          <th>Тикер</th>
          <th>Сторона</th>
          <th>Чистый</th>
          <th>Анализ</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="t in trades"
          :key="t.id"
          class="trade-row"
          tabindex="0"
          role="link"
          :aria-label="`Сделка ${t.symbol}`"
          @click="goTrade(t.id)"
          @keydown.enter.prevent="goTrade(t.id)"
        >
          <td class="trade-symbol">{{ t.symbol }}</td>
          <td>{{ t.side }}</td>
          <td :class="t.net >= 0 ? 'pos' : 'neg'">
            {{ fmtUsdt(t.net) }}
            <span v-if="tradePricePct(t)" class="net-pct-bracket muted"> ({{ tradePricePct(t) }})</span>
          </td>
          <td>
            <span class="analysis-cell" :class="t.analysisDone ? 'yes' : 'no'">{{
              t.analysisDone ? 'да' : 'нет'
            }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.day-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  margin-bottom: 1rem;
}
.day-toolbar-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}
.day-nav {
  gap: 0.35rem;
}
.day-date {
  font-weight: 600;
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
}
.analysis-pin {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.85rem;
  font-size: 0.8125rem;
  flex-shrink: 0;
  margin-left: auto;
}
.pin-group {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem 0.45rem;
}
.analysis-pin-label {
  font-size: inherit;
}
.analysis-flag {
  font-weight: 600;
}
.analysis-flag.yes {
  color: var(--green);
}
.analysis-flag.no {
  color: var(--muted);
}
.btn-tiny {
  padding: 0.3rem 0.55rem;
  font-size: 0.8125rem;
  line-height: 1.2;
}
.day-sum {
  margin: 0 0 1rem;
}
.day-sum-pct {
  font-size: 0.85em;
}
.net-pct-bracket {
  font-size: 0.85em;
  font-weight: 500;
  margin-left: 0.15rem;
  white-space: nowrap;
}
@media (max-width: 640px) {
  .analysis-pin {
    width: 100%;
    margin-left: 0;
    justify-content: flex-end;
  }
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.tbl th,
.tbl td {
  border-bottom: 1px solid var(--border);
  padding: 0.45rem 0.35rem;
  text-align: left;
}
.tbl tbody tr.trade-row {
  cursor: pointer;
}
.tbl tbody tr.trade-row:hover {
  background: var(--surface2);
}
.tbl tbody tr.trade-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.trade-symbol {
  color: var(--accent);
  font-weight: 500;
}
.analysis-cell {
  font-size: 0.8125rem;
  font-weight: 600;
}
.analysis-cell.yes {
  color: var(--green);
}
.analysis-cell.no {
  color: var(--muted);
}
</style>
