<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const offset = computed(() => Number(route.query.offset ?? 0) || 0)

const { data, refresh } = await useFetch(
  () => `/api/journal/week?offset=${offset.value}`,
  { watch: [offset] },
)

const note = ref('')
watch(
  data,
  (d) => {
    if (d && typeof d === 'object' && 'note' in d) note.value = (d as { note: string }).note
  },
  { immediate: true },
)

function go(delta: number) {
  const next = offset.value + delta
  router.replace({ query: { ...route.query, offset: String(next) } })
}

async function saveNote() {
  if (!data.value?.weekKey) return
  await $fetch('/api/notes', {
    method: 'PUT',
    body: { scope: 'week', periodKey: data.value.weekKey, content: note.value },
  })
  await refresh()
}

const { fmtUsdt } = useMoney()
</script>

<template>
  <div class="page week-page">
    <div class="week-head">
      <h1 class="week-title">Журнал: неделя</h1>
      <div class="week-nav">
        <button type="button" class="btn" @click="go(-1)">←</button>
        <span v-if="data?.weekKey" class="muted week-key">{{ data.weekKey }}</span>
        <button type="button" class="btn" @click="go(1)">→</button>
      </div>
    </div>

    <p v-if="data?.range" class="muted week-range">
      {{ data.range.start?.slice(0, 10) }} — {{ data.range.end?.slice(0, 10) }}
    </p>

    <section v-if="data?.stats" class="card week-summary">
      <p class="week-summary-label">Итого за неделю</p>
      <JournalMetrics compact :stats="data.stats" />
    </section>

    <div class="week-split">
      <section v-if="data?.dayBlocks?.length" class="week-days">
        <h2 class="week-split-heading">По дням</h2>
        <div class="day-list">
          <article v-for="b in data.dayBlocks" :key="b.date" class="card day-block">
            <div class="day-head">
              <NuxtLink :to="`/journal/day?date=${b.date}`" class="day-link">{{ b.date }}</NuxtLink>
              <span v-if="b.label" class="muted day-label">{{ b.label }}</span>
            </div>
            <JournalMetrics v-if="b.stats.longCount + b.stats.shortCount > 0" compact :stats="b.stats" />
            <p v-else class="muted day-empty">Нет сделок</p>
            <ul v-if="b.trades?.length" class="trade-lines">
              <li v-for="tr in b.trades" :key="tr.id">
                <NuxtLink :to="`/trades/${tr.id}`" class="trade-line">
                  <span class="trade-sym">{{ tr.symbol }}</span>
                  <span class="trade-side" :class="tr.side">{{ tr.side === 'long' ? 'L' : 'S' }}</span>
                  <span class="trade-net" :class="tr.net >= 0 ? 'pos' : 'neg'">{{ fmtUsdt(tr.net) }}</span>
                </NuxtLink>
              </li>
            </ul>
          </article>
        </div>
      </section>

      <aside class="card week-note">
        <h2 class="week-split-heading">Описание недели</h2>
        <textarea v-model="note" class="textarea" rows="12" placeholder="Итоги, контекст, план…" />
        <button type="button" class="btn btn-primary week-save" @click="saveNote">Сохранить</button>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.week-page {
  max-width: 1200px;
}
.week-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}
.week-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}
.week-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.week-key {
  font-size: 0.875rem;
}
.week-range {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
}

.week-summary {
  padding: 0.65rem 0.85rem;
  margin-bottom: 1rem;
}
.week-summary-label {
  margin: 0 0 0.35rem;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.week-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 380px);
  gap: 1.25rem;
  align-items: start;
}

.week-split-heading {
  margin: 0 0 0.65rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--muted);
}

.day-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.day-block {
  padding: 0.65rem 0.85rem;
}

.day-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.75rem;
  margin-bottom: 0.4rem;
}

.day-link {
  font-weight: 600;
  text-decoration: none;
  color: var(--accent);
}
.day-link:hover {
  text-decoration: underline;
}

.day-label {
  font-size: 0.75rem;
}

.day-empty {
  margin: 0;
  font-size: 0.8125rem;
}

.trade-lines {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  border-top: 1px solid var(--border, #e2e8f0);
}

.trade-lines li {
  border-bottom: 1px solid var(--border, #e2e8f0);
}
.trade-lines li:last-child {
  border-bottom: none;
}

.trade-line {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0;
  text-decoration: none;
  color: inherit;
  font-size: 0.8125rem;
}
.trade-line:hover .trade-sym {
  color: var(--accent);
}

.trade-sym {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  min-width: 0;
  flex: 1;
}

.trade-side {
  font-size: 0.65rem;
  font-weight: 700;
  width: 1.25rem;
  height: 1.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  flex-shrink: 0;
}
.trade-side.long {
  background: rgba(34, 197, 94, 0.15);
  color: #15803d;
}
.trade-side.short {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

.trade-net {
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.trade-net.pos {
  color: var(--green, #15803d);
}
.trade-net.neg {
  color: var(--red, #b91c1c);
}

.week-note {
  padding: 0.85rem 1rem;
  position: sticky;
  top: 0.75rem;
}

.week-note .textarea {
  width: 100%;
  min-height: 12rem;
  box-sizing: border-box;
}

.week-save {
  margin-top: 0.65rem;
}

@media (max-width: 900px) {
  .week-split {
    grid-template-columns: 1fr;
  }
  .week-note {
    position: static;
  }
}
</style>
