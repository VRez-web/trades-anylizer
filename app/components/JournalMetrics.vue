<script setup lang="ts">
const props = defineProps<{
  /** Компактный вид для шапки журнала дня */
  compact?: boolean
  stats: {
    wins: number
    losses: number
    longCount: number
    shortCount: number
    netProfit: number
    commission: number
    funding: number
    avgLeverage: number
  }
}>()

const { fmt, fmtUsdt } = useMoney()

const total = computed(() => props.stats.longCount + props.stats.shortCount)
function pct(part: number) {
  if (!total.value) return 0
  return Math.round((part / total.value) * 100)
}
</script>

<template>
  <dl class="m" :class="{ 'm--compact': compact }">
    <div>
      <dt>Побед / поражений</dt>
      <dd>{{ props.stats.wins }} / {{ props.stats.losses }}</dd>
    </div>
    <div>
      <dt>Long / Short</dt>
      <dd>
        Long {{ props.stats.longCount }} ({{ pct(props.stats.longCount) }}%) · Short
        {{ props.stats.shortCount }} ({{ pct(props.stats.shortCount) }}%)
      </dd>
    </div>
    <div>
      <dt>Чистая прибыль</dt>
      <dd :class="props.stats.netProfit >= 0 ? 'pos' : 'neg'">{{ fmtUsdt(props.stats.netProfit) }}</dd>
    </div>
    <div>
      <dt>Комиссия</dt>
      <dd>{{ fmtUsdt(props.stats.commission) }}</dd>
    </div>
    <div>
      <dt>Фандинг (сумма)</dt>
      <dd>{{ fmtUsdt(props.stats.funding) }}</dd>
    </div>
    <div>
      <dt>Среднее плечо</dt>
      <dd>{{ fmt(props.stats.avgLeverage) }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.m {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.75rem;
  margin: 0;
}
.m dt {
  margin: 0;
  font-size: 0.75rem;
  color: var(--muted);
}
.m dd {
  margin: 0.15rem 0 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.m--compact {
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  gap: 0.4rem 0.65rem;
}
.m--compact dt {
  font-size: 0.65rem;
  line-height: 1.2;
}
.m--compact dd {
  font-size: 0.8125rem;
  margin-top: 0.08rem;
}
</style>
