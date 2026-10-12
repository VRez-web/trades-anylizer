<script setup lang="ts">
import { labelKinds, labelKindTitles, type LabelKind } from '#shared/labelKind'

type Row = { label: string; sum: number; count: number; wins: number }

const props = defineProps<{
  data: Partial<Record<LabelKind, Partial<Row>[]>> | null | undefined
}>()

const { fmtUsdt } = useMoney()

const sorted = computed(() => {
  const out = {} as Record<LabelKind, Row[]>
  for (const k of labelKinds) {
    out[k] = (props.data?.[k] ?? [])
      .map((r) => ({
        label: String(r.label ?? ''),
        sum: Number(r.sum ?? 0),
        count: Number(r.count ?? 0),
        wins: Number(r.wins ?? 0),
      }))
      .sort((a, b) => b.sum - a.sum)
  }
  return out
})

const maxAbs = computed(() => {
  let m = 1e-9
  for (const k of labelKinds) for (const r of sorted.value[k]) m = Math.max(m, Math.abs(r.sum))
  return m
})

function total(k: LabelKind) {
  return sorted.value[k].reduce((s, r) => s + r.sum, 0)
}

function wr(r: Row) {
  return r.count ? Math.round((r.wins / r.count) * 100) : 0
}

/** Половина трека = |sum| / max по всем типам — бары сравнимы между карточками. */
function halfPct(sum: number) {
  return (Math.abs(sum) / maxAbs.value) * 50
}
</script>

<template>
  <div class="grid">
    <div v-for="k in labelKinds" :key="k" class="card lb-card">
      <div class="head">
        <span class="dot" :class="`k-${k}`" />
        <span class="title">{{ labelKindTitles[k] }}</span>
        <span v-if="sorted[k].length" class="total" :class="total(k) >= 0 ? 'pos' : 'neg'">{{ fmtUsdt(total(k)) }}</span>
      </div>
      <div v-if="!sorted[k].length" class="muted">Нет данных</div>
      <div v-for="r in sorted[k]" :key="r.label" class="row">
        <div class="name" :title="r.label">{{ r.label }}</div>
        <div class="track">
          <div class="mid" />
          <div
            class="fill"
            :class="r.sum >= 0 ? 'fill-pos' : 'fill-neg'"
            :style="r.sum >= 0 ? { left: '50%', width: halfPct(r.sum) + '%' } : { right: '50%', width: halfPct(r.sum) + '%' }"
          />
        </div>
        <div class="meta muted" :title="`${r.count} сделок · winrate ${wr(r)}%`">{{ r.count }} · {{ wr(r) }}%</div>
        <div class="sum" :class="r.sum >= 0 ? 'pos' : 'neg'">{{ fmtUsdt(r.sum, { max: 0, min: 0 }) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
.lb-card {
  padding: 0.75rem 0.85rem;
}
.head {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}
.dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  margin-right: 0.4rem;
  background: var(--kc);
}
.title {
  font-weight: 600;
}
.total {
  margin-left: auto;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.row {
  display: grid;
  grid-template-columns: minmax(70px, 1.2fr) 2fr auto auto;
  gap: 0.45rem;
  align-items: center;
  margin-bottom: 0.3rem;
  font-size: 0.8rem;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.track {
  position: relative;
  height: 8px;
  background: var(--surface2);
  border-radius: 4px;
}
.mid {
  position: absolute;
  left: 50%;
  top: -2px;
  bottom: -2px;
  width: 1px;
  background: var(--border);
}
.fill {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 4px;
}
.fill-pos {
  background: rgba(34, 197, 94, 0.65);
}
.fill-neg {
  background: rgba(239, 68, 68, 0.65);
}
.meta {
  font-size: 0.72rem;
  white-space: nowrap;
}
.sum {
  min-width: 4.2rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.k-system {
  --kc: #2563eb;
}
.k-technique {
  --kc: #0d9488;
}
.k-psychology {
  --kc: #c026d3;
}
.k-other {
  --kc: #64748b;
}
</style>
