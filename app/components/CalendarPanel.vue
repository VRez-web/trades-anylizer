<script setup lang="ts">
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

const props = defineProps<{
  year: number
  month: number
  days: Record<string, number>
  /** По дате yyyy-MM-dd: есть ли текст анализа дня и торгового плана (из журнала) */
  journalByDay?: Record<string, { analysis: boolean; plan: boolean }>
}>()

const emit = defineEmits<{
  'update:year': [y: number]
  'update:month': [m: number]
  pick: [date: string]
}>()

const { fmtSignedUsdt } = useMoney()

const anchor = computed(() => new Date(props.year, props.month - 1, 1))

const label = computed(() => format(anchor.value, 'LLLL yyyy', { locale: undefined }))

const cells = computed(() => {
  const start = startOfWeek(startOfMonth(anchor.value), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(anchor.value), { weekStartsOn: 1 })
  return eachDayOfInterval({ start, end }).map((d) => {
    const key = format(d, 'yyyy-MM-dd')
    const inMonth = isSameMonth(d, anchor.value)
    const v = props.days[key]
    const j = props.journalByDay?.[key]
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
      journalBadge,
    }
  })
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
      <button type="button" class="btn" @click="prev">←</button>
      <h2 class="title">{{ label }}</h2>
      <button type="button" class="btn" @click="next">→</button>
    </div>
    <div class="weekdays">
      <span v-for="w in ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']" :key="w">{{ w }}</span>
    </div>
    <div class="grid">
      <button
        v-for="c in cells"
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
    <p class="cal-legend muted">
      П — план, А — анализ, П+А — оба заполнены, — — пусто
    </p>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  text-transform: capitalize;
}
.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 4px;
  font-size: 0.7rem;
  color: var(--muted);
  text-align: center;
}
.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
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
