<script setup lang="ts">
type LabelItem = { kind: string; label: string }

type TradeRow = {
  id: number
  symbol: string
  side: string
  entryAt: string
  exitAt: string
  net: number
  analysisDone: boolean
  labels?: LabelItem[]
}

const side = ref<'all' | 'long' | 'short'>('all')
const result = ref<'all' | 'win' | 'loss'>('all')
/** all — без фильтра; with/without — как в isAnalysisComplete (общий и/или ТС). */
const analysis = ref<'all' | 'with' | 'without'>('all')
const fromDate = ref('')
const toDate = ref('')
const labelId = ref('')
const sort = ref<'exit_desc' | 'exit_asc'>('exit_desc')

const infoOpen = ref(false)

const { data: allLabels } = await useFetch('/api/labels')

const labelOptions = computed(() => {
  const L = allLabels.value ?? []
  return L.map((x: { id: number; kind: string; label: string }) => ({
    id: x.id,
    label: `[${x.kind}] ${x.label}`,
  }))
})

const query = computed(() => {
  const q: Record<string, string> = { sort: sort.value }
  if (side.value !== 'all') q.side = side.value
  if (result.value !== 'all') q.result = result.value
  if (analysis.value === 'with' || analysis.value === 'without') q.analysis = analysis.value
  if (fromDate.value) q.from = new Date(fromDate.value + 'T00:00:00').toISOString()
  if (toDate.value) q.to = new Date(toDate.value + 'T23:59:59.999').toISOString()
  const lid = Number(labelId.value)
  if (labelId.value !== '' && Number.isFinite(lid) && lid > 0) q.labelId = String(lid)
  return q
})

const listUrl = computed(() => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(query.value)) p.set(k, v)
  return `/api/trades?${p}`
})

const infographicUrl = computed(() => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(query.value)) p.set(k, v)
  return `/api/trades/infographic?${p}`
})

const { data: trades, pending, refresh } = await useFetch(listUrl, { watch: [listUrl] })

const {
  data: infoPack,
  pending: infoPending,
  refresh: refreshInfo,
} = await useFetch<{ trades: TradeRow[] }>(infographicUrl, { immediate: false })

async function toggleInfographic() {
  if (!infoOpen.value) {
    infoOpen.value = true
    await refreshInfo()
  } else {
    infoOpen.value = false
  }
}

watch(query, () => {
  if (infoOpen.value) refreshInfo()
})

const { fmtUsdt } = useMoney()

function fmtExit(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' })
}

function goTrade(id: number) {
  navigateTo(`/trades/${id}`)
}

const infoTrades = computed(() => infoPack.value?.trades ?? [])

const infoSummary = computed(() => {
  const rows = infoTrades.value
  const sum = rows.reduce((s, t) => s + t.net, 0)
  return { count: rows.length, sum }
})

const bySymbol = computed(() => {
  const m = new Map<string, { net: number; count: number }>()
  for (const t of infoTrades.value) {
    const cur = m.get(t.symbol) ?? { net: 0, count: 0 }
    cur.net += t.net
    cur.count += 1
    m.set(t.symbol, cur)
  }
  return [...m.entries()].sort((a, b) => Math.abs(b[1].net) - Math.abs(a[1].net))
})

const byLabel = computed(() => {
  const m = new Map<string, { net: number; count: number }>()
  for (const t of infoTrades.value) {
    const lbs = t.labels?.length ? t.labels : null
    if (!lbs) {
      const key = '— без лейблов'
      const cur = m.get(key) ?? { net: 0, count: 0 }
      cur.net += t.net
      cur.count += 1
      m.set(key, cur)
      continue
    }
    for (const lb of lbs) {
      const key = `[${lb.kind}] ${lb.label}`
      const cur = m.get(key) ?? { net: 0, count: 0 }
      cur.net += t.net
      cur.count += 1
      m.set(key, cur)
    }
  }
  return [...m.entries()].sort((a, b) => Math.abs(b[1].net) - Math.abs(a[1].net))
})

const byExitHour = computed(() => {
  const m = new Map<number, { net: number; count: number }>()
  for (const t of infoTrades.value) {
    const h = new Date(t.exitAt).getHours()
    const cur = m.get(h) ?? { net: 0, count: 0 }
    cur.net += t.net
    cur.count += 1
    m.set(h, cur)
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0])
})

/** При фильтре «Результат: все» — общий винрейт и по long/short (win = положительный net). */
const winRateBySide = computed(() => {
  if (result.value !== 'all') return null
  const rows = infoTrades.value
  const wins = rows.filter((t) => t.net > 0).length
  const n = rows.length
  const longs = rows.filter((t) => t.side === 'long')
  const shorts = rows.filter((t) => t.side === 'short')
  const lw = longs.filter((t) => t.net > 0).length
  const sw = shorts.filter((t) => t.net > 0).length
  return {
    overall: {
      total: n,
      wins,
      pct: n ? wins / n : null,
    },
    long: {
      total: longs.length,
      wins: lw,
      pct: longs.length ? lw / longs.length : null,
    },
    short: {
      total: shorts.length,
      wins: sw,
      pct: shorts.length ? sw / shorts.length : null,
    },
  }
})

function fmtWinRatePct(p: number | null) {
  if (p == null || Number.isNaN(p)) return '—'
  return `${(p * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`
}

</script>

<template>
  <div class="page list-page">
    <div class="head-row">
      <NuxtLink to="/trades" class="btn">← Календарь</NuxtLink>
      <h1 class="title">Все сделки</h1>
    </div>

    <div class="card filters">
      <div class="filters-grid">
        <label class="fl">
          <span class="fl-l">Сторона</span>
          <select v-model="side" class="input">
            <option value="all">Все</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </label>
        <label class="fl">
          <span class="fl-l">Результат</span>
          <select v-model="result" class="input">
            <option value="all">Все</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
          </select>
        </label>
        <label class="fl">
          <span class="fl-l">Анализ</span>
          <select v-model="analysis" class="input">
            <option value="all">Все</option>
            <option value="with">Есть</option>
            <option value="without">Нет</option>
          </select>
        </label>
        <label class="fl">
          <span class="fl-l">С даты</span>
          <input v-model="fromDate" class="input" type="date" />
        </label>
        <label class="fl">
          <span class="fl-l">По дату</span>
          <input v-model="toDate" class="input" type="date" />
        </label>
        <label class="fl fl-label-span">
          <span class="fl-l">Лейбл</span>
          <select v-model="labelId" class="input">
            <option value="">Любой</option>
            <option v-for="o in labelOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
          </select>
        </label>
      </div>
      <div class="filters-toolbar">
        <label class="fl fl-sort">
          <span class="fl-l">Порядок</span>
          <select v-model="sort" class="input">
            <option value="exit_desc">Выход: новые сверху</option>
            <option value="exit_asc">Выход: старые сверху</option>
          </select>
        </label>
        <div class="filters-toolbar__btns">
          <button type="button" class="btn btn-toolbar" @click="refresh()">Обновить</button>
          <button
            type="button"
            class="btn btn-toolbar"
            :class="{ 'btn-primary': infoOpen }"
            @click="toggleInfographic"
          >
            {{ infoOpen ? 'Скрыть инфографику' : 'Сформировать инфографику' }}
          </button>
        </div>
      </div>
    </div>

    <section v-if="infoOpen" class="card info-block">
      <template v-if="infoPending">
        <p class="muted">Сбор данных…</p>
      </template>
      <template v-else-if="!infoTrades.length">
        <p class="muted">Нет сделок по текущим фильтрам</p>
      </template>
      <template v-else>
        <p class="info-lead">
          По выбранным фильтрам: <strong>{{ infoSummary.count }}</strong> сделок, чистый
          <strong :class="infoSummary.sum >= 0 ? 'pos' : 'neg'">{{ fmtUsdt(infoSummary.sum) }}</strong>
          <span class="muted">(группировки ниже по этому же набору)</span>
        </p>

        <div v-if="result === 'all' && winRateBySide" class="info-winrate">
          <h3 class="info-h">Винрейт</h3>
          <p class="muted info-note">
            Win — сделки с положительным чистым (как в фильтре «Win»). Показывается только при «Результат: все».
          </p>
          <div class="info-winrate-overall">
            <span class="info-winrate-label">Общий</span>
            <template v-if="winRateBySide.overall.total">
              <span class="info-winrate-stat"
                >{{ winRateBySide.overall.wins }} / {{ winRateBySide.overall.total }}</span
              >
              <strong class="info-winrate-pct">{{ fmtWinRatePct(winRateBySide.overall.pct) }}</strong>
            </template>
            <span v-else class="muted">нет сделок</span>
          </div>
          <p class="info-subh">По стороне</p>
          <div class="info-winrate-row">
            <div class="info-winrate-card">
              <span class="info-winrate-label">Long</span>
              <template v-if="winRateBySide.long.total">
                <span class="info-winrate-stat"
                  >{{ winRateBySide.long.wins }} / {{ winRateBySide.long.total }}</span
                >
                <strong class="info-winrate-pct">{{ fmtWinRatePct(winRateBySide.long.pct) }}</strong>
              </template>
              <span v-else class="muted">нет сделок</span>
            </div>
            <div class="info-winrate-card">
              <span class="info-winrate-label">Short</span>
              <template v-if="winRateBySide.short.total">
                <span class="info-winrate-stat"
                  >{{ winRateBySide.short.wins }} / {{ winRateBySide.short.total }}</span
                >
                <strong class="info-winrate-pct">{{ fmtWinRatePct(winRateBySide.short.pct) }}</strong>
              </template>
              <span v-else class="muted">нет сделок</span>
            </div>
          </div>
        </div>

        <h3 class="info-h">По тикерам</h3>
        <div class="info-grid">
          <div v-for="[sym, agg] in bySymbol" :key="sym" class="info-tile">
            <div class="info-tile__sym">{{ sym }}</div>
            <div class="info-tile__meta">
              <span>{{ agg.count }} шт.</span>
              <strong :class="agg.net >= 0 ? 'pos' : 'neg'">{{ fmtUsdt(agg.net) }}</strong>
            </div>
          </div>
        </div>

        <h3 class="info-h">По лейблам</h3>
        <p class="muted info-note">
          Сделка с несколькими лейблами учитывается в каждой группе; «без лейблов» — без привязки к лейблу.
        </p>
        <div class="info-grid">
          <div v-for="[lb, agg] in byLabel" :key="lb" class="info-tile info-tile--wide">
            <div class="info-tile__lbl">{{ lb }}</div>
            <div class="info-tile__meta">
              <span>{{ agg.count }} упом.</span>
              <strong :class="agg.net >= 0 ? 'pos' : 'neg'">{{ fmtUsdt(agg.net) }}</strong>
            </div>
          </div>
        </div>

        <h3 class="info-h">По часу выхода (локальное время)</h3>
        <div class="info-grid info-grid--hours">
          <div v-for="[h, agg] in byExitHour" :key="h" class="info-tile info-tile--hour">
            <div class="info-tile__sym">{{ h }}:00</div>
            <div class="info-tile__meta">
              <span>{{ agg.count }}</span>
              <strong :class="agg.net >= 0 ? 'pos' : 'neg'">{{ fmtUsdt(agg.net) }}</strong>
            </div>
          </div>
        </div>

      </template>
    </section>

    <div v-if="pending" class="muted">Загрузка…</div>
    <div v-else-if="!trades?.length" class="muted">Нет сделок по фильтру</div>
    <div v-else class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th class="col-time">Выход</th>
            <th class="col-sym">Тикер</th>
            <th class="col-side">Сторона</th>
            <th class="col-net">Чистый</th>
            <th class="col-an">Анализ</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="t in trades"
            :key="t.id"
            class="tbl-row"
            tabindex="0"
            role="link"
            @click="goTrade(t.id)"
            @keydown.enter.prevent="goTrade(t.id)"
          >
            <td class="t-exit">{{ fmtExit(t.exitAt) }}</td>
            <td class="sym">{{ t.symbol }}</td>
            <td>{{ t.side }}</td>
            <td :class="t.net >= 0 ? 'pos' : 'neg'">{{ fmtUsdt(t.net) }}</td>
            <td>
              <span class="an" :class="t.analysisDone ? 'yes' : 'no'">{{
                t.analysisDone ? 'да' : 'нет'
              }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.list-page {
  max-width: 1200px;
}
.head-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.title {
  margin: 0;
  font-size: 1.25rem;
}
.filters {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
}
.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 0.65rem 1rem;
  align-items: end;
}
.fl-label-span {
  grid-column: 1 / -1;
}
@media (min-width: 720px) {
  .fl-label-span {
    grid-column: span 2;
  }
}
.filters-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.65rem 1rem;
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--border);
}
.fl-sort {
  flex: 1 1 200px;
  max-width: 320px;
  min-width: 0;
}
.filters-toolbar__btns {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  flex: 0 0 auto;
}
.btn-toolbar {
  font-size: 0.8125rem;
  padding: 0.4rem 0.75rem;
  align-self: center;
}
.fl {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}
.fl-l {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
}
.table-wrap {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.tbl {
  display: table;
  width: 100%;
  min-width: 520px;
  border-collapse: collapse;
  font-size: 0.9rem;
  table-layout: fixed;
}
.tbl thead {
  display: table-header-group;
}
.tbl tbody {
  display: table-row-group;
}
.tbl tr {
  display: table-row;
}
.tbl th,
.tbl td {
  display: table-cell;
  border-bottom: 1px solid var(--border);
  padding: 0.45rem 0.5rem;
  text-align: left;
  vertical-align: middle;
}
.col-time {
  width: 26%;
}
.col-sym {
  width: 18%;
}
.col-side {
  width: 12%;
}
.col-net {
  width: 22%;
}
.col-an {
  width: 12%;
}
.tbl tbody tr.tbl-row {
  cursor: pointer;
}
.tbl tbody tr.tbl-row:hover {
  background: var(--surface2);
}
.t-exit {
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  white-space: nowrap;
}
.sym {
  font-weight: 600;
  color: var(--accent);
}
.an {
  font-size: 0.8125rem;
  font-weight: 600;
}
.an.yes {
  color: var(--green);
}
.an.no {
  color: var(--muted);
}
.info-block {
  margin-bottom: 1.25rem;
  padding: 1rem 1.1rem;
}
.info-lead {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  line-height: 1.5;
}
.info-h {
  margin: 1.15rem 0 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
}
.info-h:first-of-type {
  margin-top: 0;
}
.info-note {
  font-size: 0.78rem;
  margin: 0 0 0.5rem;
  max-width: 52rem;
}
.info-winrate {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}
.info-winrate .info-h {
  margin-top: 0;
}
.info-subh {
  margin: 0.65rem 0 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.info-winrate-overall {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem 1rem;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.55rem 0.75rem;
  max-width: 28rem;
}
.info-winrate-overall .info-winrate-label {
  min-width: 4.5rem;
}
.info-winrate-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem;
  max-width: 28rem;
}
@media (max-width: 480px) {
  .info-winrate-row {
    grid-template-columns: 1fr;
  }
}
.info-winrate-card {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 0.65rem;
  font-size: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.info-winrate-label {
  font-weight: 600;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
}
.info-winrate-stat {
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  font-size: 0.8125rem;
}
.info-winrate-pct {
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem 0.65rem;
}
.info-grid--hours {
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
}
.info-tile {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.45rem 0.55rem;
  font-size: 0.8125rem;
}
.info-tile--wide {
  grid-column: span 1;
  min-width: 0;
}
.info-tile--hour {
  text-align: center;
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
