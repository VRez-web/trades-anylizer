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

const { data: trades, refresh } = await useFetch(
  () => `/api/trades?day=${encodeURIComponent(date.value)}&tzOffset=${new Date().getTimezoneOffset()}`,
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

function fmtTradeTime(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' })
}

const selectedForMerge = ref<number[]>([])

const selectedMergeMeta = computed(() => {
  const list = trades.value ?? []
  const selectedRows = list.filter((t: { id: number }) => selectedForMerge.value.includes(t.id))
  if (!selectedRows.length) return null
  const first = selectedRows[0] as { symbol: string; side: 'long' | 'short' }
  return { symbol: first.symbol, side: first.side }
})

function isMergeCandidateCompatible(t: { symbol: string; side: 'long' | 'short' }) {
  const base = selectedMergeMeta.value
  if (!base) return true
  return t.symbol === base.symbol && t.side === base.side
}

function toggleMergeSelect(id: number, mergeGroupId: number | null | undefined) {
  if (mergeGroupId != null) return
  const i = selectedForMerge.value.indexOf(id)
  if (i === -1) selectedForMerge.value = [...selectedForMerge.value, id]
  else selectedForMerge.value = selectedForMerge.value.filter((x) => x !== id)
}

function isSelectedForMerge(id: number) {
  return selectedForMerge.value.includes(id)
}

const merging = ref(false)

async function mergeSelected() {
  const ids = selectedForMerge.value
  if (ids.length < 2) return
  merging.value = true
  try {
    const res = await $fetch<{ tradeId: number }>('/api/trades/merge', {
      method: 'POST',
      body: { tradeIds: ids },
    })
    selectedForMerge.value = []
    await refresh()
    if (res?.tradeId) await navigateTo(`/trades/${res.tradeId}`)
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { statusMessage?: string } }).data?.statusMessage ?? '')
        : ''
    alert(msg || 'Не удалось объединить')
  } finally {
    merging.value = false
  }
}

const unmergingId = ref<number | null>(null)

async function unmergeGroup(mergeGroupId: number) {
  unmergingId.value = mergeGroupId
  try {
    await $fetch('/api/trades/unmerge', { method: 'POST', body: { mergeGroupId } })
    await refresh()
  } catch {
    /* ignore */
  } finally {
    unmergingId.value = null
  }
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

    <div class="h2-row">
      <h2 style="font-size: 1rem; margin: 0">Сделки</h2>
      <button
        type="button"
        class="btn btn-tiny"
        :disabled="merging || selectedForMerge.length < 2"
        @click="mergeSelected"
      >
        Объединить выбранные ({{ selectedForMerge.length }})
      </button>
    </div>
    <p v-if="selectedMergeMeta" class="muted merge-hint">
      Для объединения доступны только сделки: <strong>{{ selectedMergeMeta.symbol }}</strong> ·
      <strong>{{ selectedMergeMeta.side }}</strong>.
    </p>
    <div v-if="!trades?.length" class="muted">Пусто</div>
    <table v-else class="tbl">
      <thead>
        <tr>
          <th class="merge-col" />
          <th class="ord-col" title="Порядок по времени входа">#</th>
          <th>Тикер</th>
          <th>Сторона</th>
          <th>Вход</th>
          <th>Выход</th>
          <th>Чистый</th>
          <th>Общий</th>
          <th>ТС</th>
          <th>Слияние</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(t, i) in trades"
          :key="t.id"
          class="trade-row"
          tabindex="0"
          role="link"
          :aria-label="`Сделка ${t.symbol}`"
          @click="goTrade(t.id)"
          @keydown.enter.prevent="goTrade(t.id)"
        >
          <td class="merge-col" @click.stop>
            <input
              v-if="!t.mergeGroupId && !t.mergedFrom"
              type="checkbox"
              :checked="isSelectedForMerge(t.id)"
              :aria-label="`Выбрать сделку ${t.id}`"
              :disabled="!isSelectedForMerge(t.id) && !isMergeCandidateCompatible(t)"
              @change="toggleMergeSelect(t.id, t.mergeGroupId)"
            />
          </td>
          <td class="ord-col muted" title="Порядок по времени входа">{{ i + 1 }}</td>
          <td class="trade-symbol">{{ t.symbol }}</td>
          <td>{{ t.side }}</td>
          <td class="time-t">{{ fmtTradeTime(t.entryAt) }}</td>
          <td class="time-t">{{ fmtTradeTime(t.exitAt) }}</td>
          <td :class="t.net >= 0 ? 'pos' : 'neg'">
            {{ fmtUsdt(t.net) }}
            <span v-if="tradePricePct(t)" class="net-pct-bracket muted"> ({{ tradePricePct(t) }})</span>
          </td>
          <td>
            <span class="analysis-cell" :class="t.generalAnalysisDone ? 'yes' : 'no'">{{
              t.generalAnalysisDone ? 'да' : 'нет'
            }}</span>
          </td>
          <td>
            <span class="analysis-cell" :class="t.tsAnalysisDone ? 'yes' : 'no'">{{
              t.tsAnalysisDone ? 'да' : 'нет'
            }}</span>
          </td>
          <td class="grp-cell" @click.stop>
            <template v-if="t.mergeGroupId">
              <span class="grp-badge">гр. {{ t.mergeGroupId }}</span>
              <button
                type="button"
                class="btn btn-tiny btn-unmerge"
                :disabled="unmergingId === t.mergeGroupId"
                @click="unmergeGroup(t.mergeGroupId)"
              >
                Разъединить
              </button>
            </template>
            <span v-else-if="t.mergedFrom?.sourceIds?.length" class="grp-badge merged-badge">объединена</span>
            <span v-else class="muted">—</span>
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
.h2-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 1.25rem 0 0.5rem;
}
.merge-col {
  width: 2rem;
  vertical-align: middle;
  text-align: center;
}
.time-t {
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  white-space: nowrap;
}
.ord-col {
  width: 2rem;
  text-align: center;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}
.grp-cell {
  vertical-align: middle;
  font-size: 0.8125rem;
}
.grp-badge {
  font-weight: 600;
  margin-right: 0.35rem;
}
.btn-unmerge {
  margin-top: 0.15rem;
}
.merged-badge {
  font-size: 0.75rem;
}
.merge-hint {
  margin: 0 0 0.6rem;
  font-size: 0.8rem;
}
</style>
