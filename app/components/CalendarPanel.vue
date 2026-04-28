<script setup lang="ts">
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  getISOWeekYear,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

const props = defineProps<{
  year: number
  month: number
  days: Record<string, number>
  monthTradesCount?: number
  /** По дате yyyy-MM-dd: есть ли текст анализа дня и торгового плана (из журнала) */
  journalByDay?: Record<string, { analysis: boolean; plan: boolean }>
  /** Флаг анализа выбранного месяца (`period_notes.scope='month'`). */
  journalMonthAnalysis?: boolean
  /** По ISO-ключу недели yyyy-Www: есть ли анализ недели (`period_notes.scope='week'`). */
  journalWeekAnalysisByKey?: Record<string, boolean>
}>()

const emit = defineEmits<{
  'update:year': [y: number]
  'update:month': [m: number]
  pick: [date: string]
}>()

const { fmtSignedUsdt } = useMoney()

const anchor = computed(() => new Date(props.year, props.month - 1, 1))

const label = computed(() => format(anchor.value, 'LLLL yyyy', { locale: undefined }))

function tradeWord(count: number) {
  const n = Math.abs(Math.trunc(count)) % 100
  const n1 = n % 10
  if (n > 10 && n < 20) return 'сделок'
  if (n1 > 1 && n1 < 5) return 'сделки'
  if (n1 === 1) return 'сделка'
  return 'сделок'
}

const monthTradesLabel = computed(() => {
  const count = Number.isFinite(props.monthTradesCount) ? Math.max(0, Math.trunc(props.monthTradesCount ?? 0)) : 0
  return `${count} ${tradeWord(count)}`
})

function weekKeyFromDate(d: Date) {
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`
}

/** Сумма PnL за отображаемый месяц (по дням из `days`). */
const monthNet = computed(() => {
  const pad = String(props.month).padStart(2, '0')
  const prefix = `${props.year}-${pad}-`
  let sum = 0
  for (const [k, v] of Object.entries(props.days)) {
    if (!k.startsWith(prefix) || typeof v !== 'number' || !Number.isFinite(v)) continue
    sum += v
  }
  return sum
})

const cells = computed(() => {
  const start = startOfWeek(startOfMonth(anchor.value), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(anchor.value), { weekStartsOn: 1 })
  return eachDayOfInterval({ start, end }).map((d) => {
    const key = format(d, 'yyyy-MM-dd')
    const inMonth = isSameMonth(d, anchor.value)
    const v = props.days[key]
    const j = props.journalByDay?.[key]
    const weekKey = weekKeyFromDate(d)
    const hasWeekAnalysis = props.journalWeekAnalysisByKey?.[weekKey] === true
    const hasPlan = j?.plan === true
    const hasAnalysis = j?.analysis === true
    let journalBadge: { text: string; title: string; kind: 'full' | 'plan' | 'analysis' | 'empty' }
    if (hasPlan && hasAnalysis) {
      journalBadge = { text: 'П+А', title: 'План и анализ', kind: 'full' }
    } else if (hasPlan) {
      journalBadge = { text: 'П', title: 'Только торговый план', kind: 'plan' }
    } else if (hasAnalysis) {
      journalBadge = { text: 'А', title: 'Только анализ дня', kind: 'analysis' }
    } else {
      journalBadge = { text: '—', title: 'Нет плана и анализа', kind: 'empty' }
    }
    return {
      key,
      dayNum: format(d, 'd'),
      inMonth,
      sum: v,
      hasWeekAnalysis,
      journalBadge,
    }
  })
})

const weekRows = computed(() => {
  const rows: Array<{
    key: string
    hasWeekAnalysis: boolean
    cells: Array<(typeof cells.value)[number]>
  }> = []
  for (let i = 0; i < cells.value.length; i += 7) {
    const rowCells = cells.value.slice(i, i + 7)
    if (rowCells.length === 0) continue
    const [y, m, d] = rowCells[0].key.split('-').map(Number)
    const rowDate = y && m && d ? new Date(y, m - 1, d) : new Date()
    const key = weekKeyFromDate(rowDate)
    rows.push({
      key,
      hasWeekAnalysis: props.journalWeekAnalysisByKey?.[key] === true,
      cells: rowCells,
    })
  }
  return rows
})

const monthAnalysisBadge = computed(() => {
  return props.journalMonthAnalysis
    ? { text: 'Анализ месяца: есть', kind: 'ok' as const }
    : { text: 'Анализ месяца: нет', kind: 'off' as const }
})

const weekAnalysisProgress = computed(() => {
  const byKey = props.journalWeekAnalysisByKey ?? {}
  const set = new Set<string>()
  for (const row of weekRows.value) {
    if (row.cells.some((c) => c.inMonth)) {
      set.add(row.key)
    }
  }
  const keys = Array.from(set)
  const withAnalysis = keys.filter((k) => byKey[k] === true).length
  return {
    text: `Анализ недель: ${withAnalysis}/${keys.length}`,
    kind: withAnalysis > 0 ? 'ok' : 'off',
  } as const
})

function prev() {
  if (props.month <= 1) {
    emit('update:year', props.year - 1)
    emit('update:month', 12)
  } else {
    emit('update:month', props.month - 1)
  }
}

function next() {
  if (props.month >= 12) {
    emit('update:year', props.year + 1)
    emit('update:month', 1)
  } else {
    emit('update:month', props.month + 1)
  }
}
</script>

<template>
  <div class="card cal">
    <div class="head">
      <button type="button" class="btn cal-nav-btn" aria-label="Предыдущий месяц" @click="prev">←</button>
      <div class="title-wrap">
        <h2 class="title">
          <span class="title-month">{{ label }}</span>
          <span
            class="title-net"
            :class="{ 'title-net--pos': monthNet > 0, 'title-net--neg': monthNet < 0, 'title-net--zero': monthNet === 0 }"
          >
            ({{ fmtSignedUsdt(monthNet, 0) }})
          </span>
          <span class="title-count">
            {{ monthTradesLabel }}
          </span>
        </h2>
      </div>
      <button type="button" class="btn cal-nav-btn" aria-label="Следующий месяц" @click="next">→</button>
    </div>
    <div class="period-badges">
      <span class="period-badge" :class="`period-badge--${monthAnalysisBadge.kind}`">
        {{ monthAnalysisBadge.text }}
      </span>
      <span class="period-badge" :class="`period-badge--${weekAnalysisProgress.kind}`">
        {{ weekAnalysisProgress.text }}
      </span>
    </div>
    <div class="weekdays">
      <span class="weekdays-empty" aria-hidden="true"></span>
      <span v-for="w in ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']" :key="w">{{ w }}</span>
    </div>
    <div class="rows">
      <div v-for="row in weekRows" :key="row.key" class="week-row">
        <span class="week-side-badge" :class="row.hasWeekAnalysis ? 'week-side-badge--on' : 'week-side-badge--off'">
          Н
        </span>
        <div class="week-cells">
          <button
            v-for="c in row.cells"
            :key="c.key"
            type="button"
            class="cell"
            :class="{
              off: !c.inMonth,
              gain: c.inMonth && c.sum != null && c.sum > 0,
              loss: c.inMonth && c.sum != null && c.sum < 0,
            }"
            @click="emit('pick', c.key)"
          >
            <span
              v-if="c.inMonth"
              class="jbadge"
              :class="`jbadge--${c.journalBadge.kind}`"
              :title="c.journalBadge.title"
            >
              {{ c.journalBadge.text }}
            </span>
            <span class="num">{{ c.dayNum }}</span>
            <span v-if="c.inMonth && c.sum != null && c.sum !== 0" class="mini" :class="c.sum > 0 ? 'pos' : 'neg'">
              {{ fmtSignedUsdt(c.sum, 0) }}
            </span>
          </button>
        </div>
      </div>
    </div>
    <p class="cal-legend muted">
      П — план, А — анализ, П+А — оба заполнены, Н — есть анализ недели
    </p>
  </div>
</template>

<style scoped>
.head {
  display: grid;
  grid-template-columns: 2.5rem minmax(0, 1fr) 2.5rem;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.cal-nav-btn {
  width: 2.5rem;
  height: 2.5rem;
  min-width: 2.5rem;
  min-height: 2.5rem;
  padding: 0;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  font-size: 1.1rem;
}
.title-wrap {
  min-width: 0;
  text-align: center;
}
.title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 0.35rem 0.5rem;
  line-height: 1.25;
}
.title-month {
  text-transform: capitalize;
}
.title-net {
  font-weight: 600;
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.title-net--zero {
  color: var(--muted);
  font-weight: 500;
}
.title-net--pos {
  color: #15803d;
}
.title-net--neg {
  color: #b91c1c;
}
.title-count {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--muted);
  white-space: nowrap;
}
.weekdays {
  display: grid;
  grid-template-columns: 1.35rem repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 4px;
  font-size: 0.7rem;
  color: var(--muted);
  text-align: center;
}
.weekdays-empty {
  opacity: 0;
}
.period-badges {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-bottom: 0.55rem;
}
.period-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.68rem;
  line-height: 1.2;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 7px;
}
.period-badge--ok {
  color: #166534;
  border-color: rgba(22, 101, 52, 0.35);
  background: rgba(22, 101, 52, 0.1);
}
.period-badge--off {
  color: var(--muted);
  background: var(--surface);
}
.rows {
  display: grid;
  gap: 4px;
}
.week-row {
  display: grid;
  grid-template-columns: 1.35rem minmax(0, 1fr);
  gap: 4px;
}
.week-side-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid var(--border);
  font-size: 0.62rem;
  font-weight: 700;
  min-height: 60px;
}
.week-side-badge--on {
  color: #166534;
  border-color: rgba(22, 101, 52, 0.4);
  background: rgba(22, 101, 52, 0.14);
}
.week-side-badge--off {
  color: var(--muted);
  background: var(--surface);
}
.week-cells {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}
.cell {
  position: relative;
  min-height: 60px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface2);
  color: var(--text);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px 5px;
  font-size: 0.8rem;
  gap: 1px;
}
.cell:hover {
  border-color: var(--accent);
}
.cell.off {
  opacity: 0.35;
}
.cell.gain {
  background: rgba(21, 128, 61, 0.1);
}
.cell.loss {
  background: rgba(185, 28, 28, 0.08);
}
.num {
  font-weight: 600;
}
.mini {
  font-size: 0.65rem;
  margin-top: 1px;
  line-height: 1.1;
}
.jbadge {
  position: absolute;
  top: 3px;
  right: 3px;
  z-index: 1;
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 0.58rem;
  font-weight: 600;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  max-width: calc(100% - 6px);
  text-align: center;
}
.jbadge--full {
  color: var(--text);
  border-color: rgba(21, 128, 61, 0.45);
  background: rgba(21, 128, 61, 0.12);
}
.jbadge--plan {
  color: #1d4ed8;
  border-color: rgba(37, 99, 235, 0.4);
  background: rgba(37, 99, 235, 0.1);
}
.jbadge--analysis {
  color: #6d28d9;
  border-color: rgba(124, 58, 237, 0.4);
  background: rgba(124, 58, 237, 0.1);
}
.jbadge--empty {
  opacity: 0.85;
}
.cal-legend {
  margin: 0.65rem 0 0;
  font-size: 0.68rem;
  line-height: 1.35;
}
</style>
