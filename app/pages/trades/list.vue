<script setup lang="ts">
type LabelItem = { kind: string; label: string }

type TradeSource = 'live' | 'test' | 'prop'

type TradeRow = {
  id: number
  symbol: string
  side: string
  entryAt: string
  exitAt: string
  net: number
  rr: number | null
  analysisDone: boolean
  tradeSource?: TradeSource
  labels?: LabelItem[]
}

type LabelGroupMode = 'full' | 'combo'

const LABEL_KIND_ORDER: Record<string, number> = { system: 0, technique: 1, psychology: 2 }
const LABEL_KIND_RU: Record<string, string> = {
  system: 'система',
  technique: 'техника',
  psychology: 'психология',
}

const LIST_FILTERS_KEY = 'trades-analyzer:list-filters'

const side = ref<'all' | 'long' | 'short'>('all')
const result = ref<'all' | 'win' | 'loss'>('all')
/** all — без фильтра; with/without — как в isAnalysisComplete (общий и/или ТС). */
const analysis = ref<'all' | 'with' | 'without'>('all')
const fromDate = ref('')
const toDate = ref('')
const rrMin = ref('')
const rrMax = ref('')
const labelIds = ref<number[]>([])
const tradeSource = ref<'all' | TradeSource>('all')
const sort = ref<'exit_desc' | 'exit_asc'>('exit_desc')

const infoOpen = ref(false)
const labelGroupMode = ref<LabelGroupMode>('full')
const hiddenInfoLabelKeys = ref<string[]>([])
const excludeHiddenFromTotals = ref(true)
const filtersReady = ref(false)

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
  const min = Number(rrMin.value)
  if (rrMin.value !== '' && Number.isFinite(min)) q.rrMin = String(min)
  const max = Number(rrMax.value)
  if (rrMax.value !== '' && Number.isFinite(max)) q.rrMax = String(max)
  if (labelIds.value.length) q.labelIds = labelIds.value.join(',')
  if (tradeSource.value !== 'all') q.tradeSource = tradeSource.value
  return q
})

type SavedListFilters = {
  side?: typeof side.value
  result?: typeof result.value
  analysis?: typeof analysis.value
  fromDate?: string
  toDate?: string
  rrMin?: string
  rrMax?: string
  labelIds?: number[]
  tradeSource?: typeof tradeSource.value
  sort?: typeof sort.value
  infoOpen?: boolean
}

function loadSavedFilters() {
  try {
    const raw = localStorage.getItem(LIST_FILTERS_KEY)
    if (!raw) return
    const j = JSON.parse(raw) as SavedListFilters
    if (j.side === 'all' || j.side === 'long' || j.side === 'short') side.value = j.side
    if (j.result === 'all' || j.result === 'win' || j.result === 'loss') result.value = j.result
    if (j.analysis === 'all' || j.analysis === 'with' || j.analysis === 'without') analysis.value = j.analysis
    if (typeof j.fromDate === 'string') fromDate.value = j.fromDate
    if (typeof j.toDate === 'string') toDate.value = j.toDate
    if (typeof j.rrMin === 'string') rrMin.value = j.rrMin
    if (typeof j.rrMax === 'string') rrMax.value = j.rrMax
    if (Array.isArray(j.labelIds)) {
      labelIds.value = j.labelIds.filter((n) => Number.isFinite(n) && n > 0)
    }
    if (j.tradeSource === 'all' || j.tradeSource === 'live' || j.tradeSource === 'test' || j.tradeSource === 'prop') {
      tradeSource.value = j.tradeSource
    }
    if (j.sort === 'exit_desc' || j.sort === 'exit_asc') sort.value = j.sort
    if (j.infoOpen === true) infoOpen.value = true
  } catch {
    /* ignore */
  }
}

function saveFilters() {
  if (!import.meta.client || !filtersReady.value) return
  const payload: SavedListFilters = {
    side: side.value,
    result: result.value,
    analysis: analysis.value,
    fromDate: fromDate.value,
    toDate: toDate.value,
    rrMin: rrMin.value,
    rrMax: rrMax.value,
    labelIds: [...labelIds.value],
    tradeSource: tradeSource.value,
    sort: sort.value,
    infoOpen: infoOpen.value,
  }
  localStorage.setItem(LIST_FILTERS_KEY, JSON.stringify(payload))
}

function toggleLabelId(id: number) {
  const i = labelIds.value.indexOf(id)
  if (i === -1) labelIds.value = [...labelIds.value, id]
  else labelIds.value = labelIds.value.filter((x) => x !== id)
}

function clearLabelIds() {
  labelIds.value = []
}

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
} = await useFetch<{
  trades: TradeRow[]
  dayJournal?: {
    totalDays: number
    daysWithAnalysis: number
    daysWithTradePlan: number
    daysWithBoth: number
    daysWithoutAny: number
  }
}>(infographicUrl, { immediate: false })

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

watch(labelGroupMode, () => {
  hiddenInfoLabelKeys.value = []
})

onMounted(() => {
  loadSavedFilters()
  filtersReady.value = true
  saveFilters()
  if (infoOpen.value) refreshInfo()
})

watch(
  [side, result, analysis, fromDate, toDate, rrMin, rrMax, labelIds, tradeSource, sort, infoOpen],
  () => {
    saveFilters()
  },
  { deep: true },
)

const NO_LABEL_KEY = '— без лейблов'

function labelKeyForItem(lb: LabelItem): string {
  const kind = LABEL_KIND_RU[lb.kind] ?? lb.kind
  return `[${kind}] ${lb.label}`
}

function tradeLabelKeys(t: TradeRow): string[] {
  if (!t.labels?.length) return [NO_LABEL_KEY]
  return t.labels.map((lb) => labelKeyForItem(lb))
}

/** Пары лейблов из разных типов (system / technique / psychology) на одной сделке. */
function tradeComboKeys(t: TradeRow): string[] {
  const lbs = t.labels ?? []
  if (lbs.length < 2) return []
  const out = new Set<string>()
  for (let i = 0; i < lbs.length; i++) {
    for (let j = i + 1; j < lbs.length; j++) {
      const a = lbs[i]
      const b = lbs[j]
      if (a.kind === b.kind) continue
      const oa = LABEL_KIND_ORDER[a.kind] ?? 99
      const ob = LABEL_KIND_ORDER[b.kind] ?? 99
      const [x, y] = oa <= ob ? [a, b] : [b, a]
      out.add(`${labelKeyForItem(x)} + ${labelKeyForItem(y)}`)
    }
  }
  return [...out]
}

function tradeInfoGroupKeys(t: TradeRow, mode: LabelGroupMode): string[] {
  if (mode === 'combo') return tradeComboKeys(t)
  return tradeLabelKeys(t)
}

function tradeVisibleForInfoStats(t: TradeRow): boolean {
  if (!excludeHiddenFromTotals.value || !hiddenInfoLabelKeys.value.length) return true
  const hidden = new Set(hiddenInfoLabelKeys.value)
  const keys = tradeInfoGroupKeys(t, labelGroupMode.value)
  if (!keys.length) return !hidden.has(NO_LABEL_KEY)
  return keys.some((k) => !hidden.has(k))
}

function hideInfoLabel(key: string) {
  if (!hiddenInfoLabelKeys.value.includes(key)) {
    hiddenInfoLabelKeys.value = [...hiddenInfoLabelKeys.value, key]
  }
}

function resetHiddenInfoLabels() {
  hiddenInfoLabelKeys.value = []
}

function tradeSourceBadge(source: TradeSource | undefined): string | null {
  if (source === 'test') return 'тест'
  if (source === 'prop') return 'проп'
  return null
}

function isoLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const addOpen = ref(false)
const addSaving = ref(false)
const addForm = reactive({
  symbol: '',
  side: 'long' as 'long' | 'short',
  entryAt: '',
  exitAt: '',
  leverage: 1,
  entryPrice: 0,
  exitPrice: 0,
  income: 0,
  commission: 0,
  funding: 0,
  rr: '' as string | number,
  isTest: true,
})

function openAddTrade() {
  const now = new Date()
  const hourAgo = new Date(now.getTime() - 3600_000)
  addForm.symbol = ''
  addForm.side = 'long'
  addForm.entryAt = isoLocal(hourAgo)
  addForm.exitAt = isoLocal(now)
  addForm.leverage = 1
  addForm.entryPrice = 0
  addForm.exitPrice = 0
  addForm.income = 0
  addForm.commission = 0
  addForm.funding = 0
  addForm.rr = ''
  addForm.isTest = true
  addOpen.value = true
}

async function submitAddTrade() {
  addSaving.value = true
  try {
    const row = await $fetch<{ id: number }>('/api/trades', {
      method: 'POST',
      body: {
        symbol: addForm.symbol,
        side: addForm.side,
        entryAt: new Date(addForm.entryAt).toISOString(),
        exitAt: new Date(addForm.exitAt).toISOString(),
        leverage: addForm.leverage,
        entryPrice: addForm.entryPrice,
        exitPrice: addForm.exitPrice,
        income: addForm.income,
        commission: addForm.commission,
        funding: addForm.funding,
        rr: addForm.rr === '' ? null : Number(addForm.rr),
        tradeSource: addForm.isTest ? 'test' : 'live',
      },
    })
    addOpen.value = false
    await refresh()
    if (infoOpen.value) await refreshInfo()
    await navigateTo(`/trades/${row.id}`)
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { statusMessage?: string } }).data?.statusMessage ?? '')
        : ''
    alert(msg || 'Не удалось добавить сделку')
  } finally {
    addSaving.value = false
  }
}

const { fmtUsdt } = useMoney()

function fmtExit(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' })
}

function goTrade(id: number) {
  navigateTo(`/trades/${id}`)
}

const infoTrades = computed(() => infoPack.value?.trades ?? [])

const infoTradesForStats = computed(() => infoTrades.value.filter(tradeVisibleForInfoStats))

const infoSummary = computed(() => {
  const rows = infoTradesForStats.value
  const sum = rows.reduce((s, t) => s + t.net, 0)
  return { count: rows.length, sum }
})

const avgRr = computed(() => {
  const rows = infoTradesForStats.value.filter((t) => Number.isFinite(t.rr))
  if (!rows.length) return null
  const sum = rows.reduce((s, t) => s + (t.rr ?? 0), 0)
  return { value: sum / rows.length, count: rows.length }
})

const dayJournalInfo = computed(() => {
  return (
    infoPack.value?.dayJournal ?? {
      totalDays: 0,
      daysWithAnalysis: 0,
      daysWithTradePlan: 0,
      daysWithBoth: 0,
      daysWithoutAny: 0,
    }
  )
})

const bySymbol = computed(() => {
  const m = new Map<string, { net: number; count: number }>()
  for (const t of infoTradesForStats.value) {
    const cur = m.get(t.symbol) ?? { net: 0, count: 0 }
    cur.net += t.net
    cur.count += 1
    m.set(t.symbol, cur)
  }
  return [...m.entries()].sort((a, b) => Math.abs(b[1].net) - Math.abs(a[1].net))
})

const byLabel = computed(() => {
  const m = new Map<string, { net: number; count: number }>()
  const hidden = new Set(hiddenInfoLabelKeys.value)
  const mode = labelGroupMode.value
  for (const t of infoTradesForStats.value) {
    if (mode === 'combo') {
      const combos = tradeComboKeys(t)
      if (!combos.length) continue
      for (const key of combos) {
        if (hidden.has(key)) continue
        const cur = m.get(key) ?? { net: 0, count: 0 }
        cur.net += t.net
        cur.count += 1
        m.set(key, cur)
      }
      continue
    }
    const lbs = t.labels?.length ? t.labels : null
    if (!lbs) {
      const key = NO_LABEL_KEY
      if (hidden.has(key)) continue
      const cur = m.get(key) ?? { net: 0, count: 0 }
      cur.net += t.net
      cur.count += 1
      m.set(key, cur)
      continue
    }
    for (const lb of lbs) {
      const key = labelKeyForItem(lb)
      if (hidden.has(key)) continue
      const cur = m.get(key) ?? { net: 0, count: 0 }
      cur.net += t.net
      cur.count += 1
      m.set(key, cur)
    }
  }
  return [...m.entries()].sort((a, b) => Math.abs(b[1].net) - Math.abs(a[1].net))
})

const byEntryHour = computed(() => {
  const m = new Map<number, { net: number; count: number }>()
  for (const t of infoTradesForStats.value) {
    const h = new Date(t.entryAt).getHours()
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
  const rows = infoTradesForStats.value
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

function fmtRr(v: number | null) {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

</script>

<template>
  <div class="page list-page">
    <div class="head-row">
      <NuxtLink to="/trades" class="btn">← Календарь</NuxtLink>
      <h1 class="title">Все сделки</h1>
      <button type="button" class="btn btn-primary" @click="openAddTrade">+ Добавить сделку</button>
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
          <span class="fl-l">Источник</span>
          <select v-model="tradeSource" class="input">
            <option value="all">Все</option>
            <option value="live">Live</option>
            <option value="test">Тест</option>
            <option value="prop">Проп</option>
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
        <label class="fl">
          <span class="fl-l">RR от</span>
          <input v-model="rrMin" class="input" type="number" step="0.1" />
        </label>
        <label class="fl">
          <span class="fl-l">RR до</span>
          <input v-model="rrMax" class="input" type="number" step="0.1" />
        </label>
        <div class="fl fl-label-span label-filter">
          <div class="label-filter-head">
            <span class="fl-l">Лейблы</span>
            <button
              v-if="labelIds.length"
              type="button"
              class="btn btn-tiny label-filter-clear"
              @click="clearLabelIds"
            >
              Сбросить ({{ labelIds.length }})
            </button>
          </div>
          <p class="muted label-filter-hint">Можно выбрать несколько — сделка с любым из отмеченных.</p>
          <div class="label-filter-list">
            <label v-for="o in labelOptions" :key="o.id" class="label-filter-item">
              <input
                type="checkbox"
                :checked="labelIds.includes(o.id)"
                @change="toggleLabelId(o.id)"
              />
              <span>{{ o.label }}</span>
            </label>
          </div>
        </div>
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
          , средний RR:
          <strong>{{ fmtRr(avgRr?.value ?? null) }}</strong>
          <span class="muted"> (по {{ avgRr?.count ?? 0 }} сделк{{ (avgRr?.count ?? 0) === 1 ? 'е' : 'ам' }})</span>
          <span v-if="hiddenInfoLabelKeys.length" class="muted">
            · скрыто лейблов: {{ hiddenInfoLabelKeys.length }}
            <button type="button" class="btn btn-tiny" @click="resetHiddenInfoLabels">Показать все</button>
          </span>
          <span class="muted">(группировки ниже по этому же набору)</span>
        </p>

        <h3 class="info-h">Журнал по дням</h3>
        <p class="muted info-note">
          По дням, в которые есть сделки после фильтрации: анализ и торговый план из дневного журнала.
        </p>
        <div class="info-grid">
          <div class="info-tile">
            <div class="info-tile__sym">Дней со сделками</div>
            <div class="info-tile__meta"><strong>{{ dayJournalInfo.totalDays }}</strong></div>
          </div>
          <div class="info-tile">
            <div class="info-tile__sym">С анализом</div>
            <div class="info-tile__meta"><strong>{{ dayJournalInfo.daysWithAnalysis }}</strong></div>
          </div>
          <div class="info-tile">
            <div class="info-tile__sym">С торговым планом</div>
            <div class="info-tile__meta"><strong>{{ dayJournalInfo.daysWithTradePlan }}</strong></div>
          </div>
          <div class="info-tile">
            <div class="info-tile__sym">И анализ, и план</div>
            <div class="info-tile__meta"><strong>{{ dayJournalInfo.daysWithBoth }}</strong></div>
          </div>
          <div class="info-tile">
            <div class="info-tile__sym">Без заполнения</div>
            <div class="info-tile__meta"><strong>{{ dayJournalInfo.daysWithoutAny }}</strong></div>
          </div>
        </div>

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
        <div class="info-label-toolbar">
          <label class="info-label-mode">
            <span class="fl-l">Группировка</span>
            <select v-model="labelGroupMode" class="input input-compact">
              <option value="full">По одному лейблу</option>
              <option value="combo">Пары из разных типов</option>
            </select>
          </label>
          <label class="info-label-mode info-label-check">
            <input v-model="excludeHiddenFromTotals" type="checkbox" />
            <span>Исключать сделки со скрытыми лейблами из итогов</span>
          </label>
        </div>
        <p class="muted info-note">
          <template v-if="labelGroupMode === 'full'">
            Сделка с несколькими лейблами учитывается в каждой группе; «без лейблов» — без привязки к лейблу.
          </template>
          <template v-else>
            Показываются пары лейблов с разных типов (система / техника / психология) на одной сделке —
            например «[technique] по тс + [psychology] нарратив не отработал». Сделка с 3+ лейблами даёт несколько пар.
          </template>
          Нажмите × на плитке, чтобы скрыть группу и пересчитать статистику.
        </p>
        <div v-if="!byLabel.length" class="muted info-note">Нет лейблов для отображения</div>
        <div v-else class="info-grid">
          <div v-for="[lb, agg] in byLabel" :key="lb" class="info-tile info-tile--wide info-tile--label">
            <button
              type="button"
              class="info-tile-hide"
              title="Скрыть лейбл"
              aria-label="Скрыть лейбл"
              @click="hideInfoLabel(lb)"
            >
              ×
            </button>
            <div class="info-tile__lbl">{{ lb }}</div>
            <div class="info-tile__meta">
              <span>{{ agg.count }} {{ labelGroupMode === 'combo' ? 'сдел.' : 'упом.' }}</span>
              <strong :class="agg.net >= 0 ? 'pos' : 'neg'">{{ fmtUsdt(agg.net) }}</strong>
            </div>
          </div>
        </div>

        <h3 class="info-h">По часу входа (локальное время)</h3>
        <div class="info-grid info-grid--hours">
          <div v-for="[h, agg] in byEntryHour" :key="h" class="info-tile info-tile--hour">
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
            <th class="col-src">Тип</th>
            <th class="col-side">Сторона</th>
            <th class="col-net">Чистый</th>
            <th class="col-rr">RR</th>
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
            <td>
              <span v-if="tradeSourceBadge(t.tradeSource)" class="src-badge">{{ tradeSourceBadge(t.tradeSource) }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td>{{ t.side }}</td>
            <td :class="t.net >= 0 ? 'pos' : 'neg'">{{ fmtUsdt(t.net) }}</td>
            <td>{{ t.rr == null ? '—' : t.rr.toFixed(2) }}</td>
            <td>
              <span class="an" :class="t.analysisDone ? 'yes' : 'no'">{{
                t.analysisDone ? 'да' : 'нет'
              }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="addOpen" class="modal-backdrop" @click.self="addOpen = false">
      <div class="modal card">
        <h2 class="modal-title">Новая сделка</h2>
        <p class="muted modal-lead">Ручной ввод — для тестовых сделок отметьте «Тестовая».</p>
        <div class="modal-grid">
          <label class="fl">
            <span class="fl-l">Тикер</span>
            <input v-model="addForm.symbol" class="input" placeholder="BTCUSDT" />
          </label>
          <label class="fl">
            <span class="fl-l">Сторона</span>
            <select v-model="addForm.side" class="input">
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </label>
          <label class="fl">
            <span class="fl-l">Вход</span>
            <input v-model="addForm.entryAt" class="input" type="datetime-local" step="1" />
          </label>
          <label class="fl">
            <span class="fl-l">Выход</span>
            <input v-model="addForm.exitAt" class="input" type="datetime-local" step="1" />
          </label>
          <label class="fl">
            <span class="fl-l">Плечо</span>
            <input v-model.number="addForm.leverage" class="input" type="number" step="0.1" />
          </label>
          <label class="fl">
            <span class="fl-l">Цена входа</span>
            <input v-model.number="addForm.entryPrice" class="input" type="number" step="any" />
          </label>
          <label class="fl">
            <span class="fl-l">Цена выхода</span>
            <input v-model.number="addForm.exitPrice" class="input" type="number" step="any" />
          </label>
          <label class="fl">
            <span class="fl-l">Доход</span>
            <input v-model.number="addForm.income" class="input" type="number" step="any" />
          </label>
          <label class="fl">
            <span class="fl-l">Комиссия</span>
            <input v-model.number="addForm.commission" class="input" type="number" step="any" />
          </label>
          <label class="fl">
            <span class="fl-l">Фандинг</span>
            <input v-model.number="addForm.funding" class="input" type="number" step="any" />
          </label>
          <label class="fl">
            <span class="fl-l">RR</span>
            <input v-model="addForm.rr" class="input" type="number" step="0.1" />
          </label>
          <label class="fl fl-check">
            <input v-model="addForm.isTest" type="checkbox" />
            <span>Тестовая сделка</span>
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" :disabled="addSaving" @click="addOpen = false">Отмена</button>
          <button type="button" class="btn btn-primary" :disabled="addSaving" @click="submitAddTrade">
            {{ addSaving ? 'Сохранение…' : 'Создать' }}
          </button>
        </div>
      </div>
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
.col-rr {
  width: 10%;
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
.src-badge {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  color: #92400e;
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.35);
}
.info-label-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem 1rem;
  align-items: flex-end;
  margin-bottom: 0.35rem;
}
.info-label-mode {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.78rem;
}
.info-label-check {
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
  padding-bottom: 0.15rem;
}
.input-compact {
  min-width: 11rem;
  font-size: 0.8125rem;
}
.info-tile--label {
  position: relative;
  padding-top: 1.35rem;
}
.info-tile-hide {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 1.25rem;
  height: 1.25rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}
.info-tile-hide:hover {
  color: #b91c1c;
  border-color: rgba(185, 28, 28, 0.4);
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.modal {
  width: min(640px, 100%);
  max-height: 90vh;
  overflow: auto;
  padding: 1rem 1.1rem;
}
.modal-title {
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
}
.modal-lead {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
}
.modal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 0.65rem 1rem;
}
.fl-check {
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
  grid-column: 1 / -1;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
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
.label-filter {
  grid-column: 1 / -1;
}
.label-filter-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem 0.75rem;
  margin-bottom: 0.25rem;
}
.label-filter-hint {
  margin: 0 0 0.45rem;
  font-size: 0.75rem;
}
.label-filter-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  max-height: 9rem;
  overflow-y: auto;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface2);
}
.label-filter-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  cursor: pointer;
  user-select: none;
}
.label-filter-item input {
  flex-shrink: 0;
}
.label-filter-clear {
  font-size: 0.7rem;
  padding: 0.2rem 0.45rem;
}
</style>
