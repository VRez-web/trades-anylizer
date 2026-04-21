<script setup lang="ts">
import { format } from 'date-fns'
import { defaultTradePlanTemplate } from '#shared/tradePlanTemplate'
import type { JournalDayTrade } from '~/components/JournalDayCandleChart.vue'

const route = useRoute()
const router = useRouter()

const dateStr = computed(() => {
  const q = route.query.date as string | undefined
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q
  return format(new Date(), 'yyyy-MM-dd')
})

const { data, refresh } = await useFetch(
  () => `/api/journal/day?date=${encodeURIComponent(dateStr.value)}`,
  { watch: [dateStr] },
)

const note = ref('')
const tradePlan = ref('')
watch(
  data,
  (d) => {
    if (d && typeof d === 'object') {
      if ('note' in d) note.value = (d as { note: string }).note
      if ('tradePlan' in d) {
        const raw = (d as { tradePlan: string }).tradePlan ?? ''
        tradePlan.value = raw.trim() === '' ? defaultTradePlanTemplate : raw
      }
    }
  },
  { immediate: true },
)

function shift(delta: number) {
  const d = new Date(dateStr.value + 'T12:00:00')
  d.setDate(d.getDate() + delta)
  const next = format(d, 'yyyy-MM-dd')
  router.replace({ query: { ...route.query, date: next } })
}

const symbols = computed(() => {
  const ts = data.value?.trades
  if (!ts?.length) return [] as string[]
  return [...new Set(ts.map((t: { symbol: string }) => t.symbol))].sort()
})

const selectedSymbol = ref<string | null>(null)

watch(
  symbols,
  (syms) => {
    if (!syms.length) {
      selectedSymbol.value = null
      return
    }
    if (!selectedSymbol.value || !syms.includes(selectedSymbol.value)) {
      selectedSymbol.value = syms[0]
    }
  },
  { immediate: true },
)

const tradesForChart = computed((): JournalDayTrade[] => {
  const ts = data.value?.trades
  if (!ts?.length || !selectedSymbol.value) return []
  return ts
    .filter((t: { symbol: string }) => t.symbol === selectedSymbol.value)
    .map(
      (t: {
        id: number
        entryAt: string
        exitAt: string
        entryPrice: number
        exitPrice: number
        side: string
        net: number
      }) => ({
        id: t.id,
        entryAt: t.entryAt,
        exitAt: t.exitAt,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        side: t.side as 'long' | 'short',
        net: t.net,
      }),
    )
})

const { fmtInstrumentPrice, fmtSignedUsdt } = useMoney()

async function saveNote() {
  await $fetch('/api/notes', {
    method: 'PUT',
    body: {
      scope: 'day',
      periodKey: dateStr.value,
      content: note.value,
      tradePlan: tradePlan.value,
    },
  })
  await refresh()
}
</script>

<template>
  <div class="page journal-day">
    <header class="journal-day__toolbar">
      <h1 class="journal-day__title">Журнал: день</h1>
      <div class="row journal-day__nav">
        <button type="button" class="btn" @click="shift(-1)">←</button>
        <span class="muted journal-day__date">{{ dateStr }}</span>
        <button type="button" class="btn" @click="shift(1)">→</button>
      </div>
    </header>

    <section v-if="data?.stats" class="card journal-day__metrics">
      <h2 class="journal-day__h">Показатели</h2>
      <JournalMetrics compact :stats="data.stats" />
    </section>

    <div class="journal-day__main">
      <section class="card journal-day__chart-col">
        <h2 class="journal-day__h">Свечи по тикеру</h2>
        <p class="muted journal-day__lead">
          Выберите тикер. Кружки стоят на уровнях цены входа и выхода из журнала; ниже — цены и чистый результат по каждой сделке.
        </p>
        <div v-if="symbols.length" class="ticker-row">
          <button
            v-for="sym in symbols"
            :key="sym"
            type="button"
            class="btn ticker-pill"
            :class="{ 'ticker-pill--active': sym === selectedSymbol }"
            @click="selectedSymbol = sym"
          >
            {{ sym }}
          </button>
        </div>
        <ClientOnly>
          <template v-if="tradesForChart.length && selectedSymbol">
            <JournalDayCandleChart
              :symbol="selectedSymbol"
              :trades="tradesForChart"
              :height="320"
            />
            <ul class="journal-day__trade-sum">
              <li v-for="(t, i) in tradesForChart" :key="t.id">
                Сделка {{ i + 1 }}:
                {{ fmtInstrumentPrice(t.entryPrice) }} → {{ fmtInstrumentPrice(t.exitPrice) }} · чистый
                <span :class="t.net >= 0 ? 'pos' : 'neg'">{{ fmtSignedUsdt(t.net, 2) }}</span>
              </li>
            </ul>
          </template>
          <p v-else class="muted journal-day__empty">Нет сделок в этот день — график недоступен.</p>
          <template #fallback>
            <div class="muted">Загрузка графика…</div>
          </template>
        </ClientOnly>
      </section>

      <aside class="journal-day__aside">
        <div class="card journal-day__block">
          <h2 class="journal-day__h">Торговый план</h2>
          <p class="muted journal-day__hint">
            План на день; в календаре сделок статус «есть / нет» берётся из этого поля. Для пустого дня в
            поле сразу подставляется структура: A/B, метод входа, запасной сценарий, условия отмены плана.
          </p>
          <textarea
            v-model="tradePlan"
            class="textarea textarea-plan"
            rows="22"
            placeholder=""
          />
          <button type="button" class="btn btn-primary journal-day__save" @click="saveNote">
            Сохранить
          </button>
        </div>

        <div class="card journal-day__block">
          <h2 class="journal-day__h">Описание дня</h2>
          <textarea v-model="note" class="textarea" rows="8" placeholder="Итоги, эмоции, что улучшить…" />
          <button type="button" class="btn btn-primary journal-day__save" @click="saveNote">
            Сохранить
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.journal-day__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.journal-day__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
}
.journal-day__nav {
  gap: 0.35rem;
  align-items: center;
}
.journal-day__date {
  font-variant-numeric: tabular-nums;
  font-size: 0.9rem;
}
.journal-day__metrics {
  margin-bottom: 0.75rem;
  padding: 0.65rem 0.85rem;
}
.journal-day__metrics .journal-day__h {
  margin: 0 0 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.journal-day__main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 380px);
  gap: 1rem;
  align-items: start;
}
@media (max-width: 960px) {
  .journal-day__main {
    grid-template-columns: 1fr;
  }
}
.journal-day__chart-col {
  min-width: 0;
}
.journal-day__h {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
}
.journal-day__lead {
  margin: 0 0 0.65rem;
  font-size: 0.8125rem;
  line-height: 1.4;
}
.journal-day__hint {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  line-height: 1.35;
}
.ticker-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}
.ticker-pill {
  padding: 0.3rem 0.65rem;
  font-size: 0.8125rem;
  border-radius: 999px;
}
.ticker-pill--active {
  border-color: var(--accent);
  background: var(--surface2);
  color: var(--accent);
  font-weight: 600;
}
.journal-day__empty {
  margin: 0;
  font-size: 0.875rem;
}
.journal-day__trade-sum {
  margin: 0.65rem 0 0;
  padding: 0.5rem 0.65rem;
  list-style: none;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface2);
  font-size: 0.8125rem;
  line-height: 1.45;
}
.journal-day__trade-sum li {
  margin: 0.2rem 0;
}
.journal-day__trade-sum li:first-child {
  margin-top: 0;
}
.journal-day__trade-sum li:last-child {
  margin-bottom: 0;
}
.journal-day__aside {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}
.journal-day__block .journal-day__h {
  margin-bottom: 0.35rem;
}
.journal-day__save {
  margin-top: 0.5rem;
}
.textarea-plan {
  min-height: 22rem;
  font-size: 0.875rem;
  line-height: 1.45;
}
</style>
