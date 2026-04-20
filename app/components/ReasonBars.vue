<script setup lang="ts">
const props = defineProps<{
  title: string
  rows: { label: string; sum: number }[]
}>()

const { fmtUsdt } = useMoney()

const maxAbs = computed(() => {
  let m = 1e-9
  for (const r of props.rows) m = Math.max(m, Math.abs(r.sum))
  return m
})

function widthPct(sum: number) {
  return Math.min(100, (Math.abs(sum) / maxAbs.value) * 100)
}
</script>

<template>
  <div class="card rb">
    <h3>{{ title }}</h3>
    <div v-if="!rows.length" class="muted">Нет данных</div>
    <div v-for="(r, i) in rows" :key="i" class="row">
      <div class="name">{{ r.label }}</div>
      <div class="track">
        <div
          class="fill"
          :class="r.sum >= 0 ? 'pos' : 'neg'"
          :style="{ width: widthPct(r.sum) + '%' }"
        />
      </div>
      <div class="sum" :class="r.sum >= 0 ? 'pos' : 'neg'">{{ fmtUsdt(r.sum) }}</div>
    </div>
  </div>
</template>

<style scoped>
.rb .row {
  display: grid;
  grid-template-columns: minmax(80px, 1fr) 3fr auto;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.45rem;
  font-size: 0.85rem;
}
.name {
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.track {
  height: 8px;
  background: var(--surface2);
  border-radius: 4px;
  overflow: hidden;
}
.fill {
  height: 100%;
  border-radius: 4px;
}
.fill.pos {
  background: rgba(34, 197, 94, 0.65);
}
.fill.neg {
  background: rgba(239, 68, 68, 0.65);
}
.sum {
  font-variant-numeric: tabular-nums;
  min-width: 5.5rem;
  text-align: right;
}
</style>
