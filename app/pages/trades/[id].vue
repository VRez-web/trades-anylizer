<script setup lang="ts">
import { tradeNoteHints } from '#shared/tradeNoteHints'
import { estimateQuoteVolumeUsdt } from '#shared/tradeQuoteVolume'

const route = useRoute()
const id = computed(() => Number(route.params.id))

const { data, refresh } = await useFetch(() => `/api/trades/${id.value}`, {
  watch: [id],
})

const { fmtUsdt, fmtInstrumentPrice, fmtPriceMovePct } = useMoney()

const quoteVolPreview = computed(() => {
  const t = data.value?.trade
  if (!t) return null
  if (t.externalKey) return t.quoteVolumeUsdt ?? null
  return estimateQuoteVolumeUsdt(form.side, form.entryPrice, form.exitPrice, form.income)
})

const priceMoveStr = computed(() => {
  const t = data.value?.trade
  if (!t) return null
  return fmtPriceMovePct(t.side, t.entryPrice, t.exitPrice)
})

/** Для окраски % хода цены в сторону прибыли по цене */
const priceMoveNonNegative = computed(() => {
  const t = data.value?.trade
  if (!t || !t.entryPrice) return true
  const r =
    t.side === 'long'
      ? (t.exitPrice - t.entryPrice) / t.entryPrice
      : (t.entryPrice - t.exitPrice) / t.entryPrice
  return r >= 0
})

const form = reactive({
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
  noteSystem: '',
  noteTechnique: '',
  noteAnalysis: '',
  labelIds: {
    system: [] as number[],
    technique: [] as number[],
    psychology: [] as number[],
  },
})

function snapshotLabelIds(): string {
  const norm = (a: number[]) => [...a].sort((x, y) => x - y)
  return JSON.stringify({
    system: norm(form.labelIds.system),
    technique: norm(form.labelIds.technique),
    psychology: norm(form.labelIds.psychology),
  })
}

const lastSentLabelIds = ref('')
const labelsReady = ref(false)
let labelDebounceTimer: ReturnType<typeof setTimeout> | null = null

watch(id, () => {
  labelsReady.value = false
  if (labelDebounceTimer) {
    clearTimeout(labelDebounceTimer)
    labelDebounceTimer = null
  }
})

watch(
  data,
  (d) => {
    if (!d?.trade) {
      labelsReady.value = false
      return
    }
    const t = d.trade
    form.symbol = t.symbol
    form.side = t.side
    form.entryAt = isoLocal(new Date(t.entryAt))
    form.exitAt = isoLocal(new Date(t.exitAt))
    form.leverage = t.leverage
    form.entryPrice = t.entryPrice
    form.exitPrice = t.exitPrice
    form.income = t.income
    form.commission = t.commission
    form.funding = t.funding
    form.rr = t.rr ?? ''
    form.noteSystem = t.noteSystem ?? ''
    form.noteTechnique = t.noteTechnique ?? ''
    form.noteAnalysis = t.noteAnalysis ?? ''
    const lb = d.labels as
      | { system: { id: number }[]; technique: { id: number }[]; psychology: { id: number }[] }
      | undefined
    if (lb) {
      form.labelIds.system = lb.system.map((x) => x.id)
      form.labelIds.technique = lb.technique.map((x) => x.id)
      form.labelIds.psychology = lb.psychology.map((x) => x.id)
    }
    lastSentLabelIds.value = snapshotLabelIds()
    labelsReady.value = true
  },
  { immediate: true },
)

watch(
  () => snapshotLabelIds(),
  (snap) => {
    if (!labelsReady.value || !data.value?.trade) return
    if (snap === lastSentLabelIds.value) return
    if (labelDebounceTimer) clearTimeout(labelDebounceTimer)
    labelDebounceTimer = setTimeout(async () => {
      labelDebounceTimer = null
      const current = snapshotLabelIds()
      if (current !== snap) return
      if (current === lastSentLabelIds.value) return
      try {
        await $fetch(`/api/trades/${id.value}`, {
          method: 'PATCH',
          body: {
            labelIds: {
              system: [...form.labelIds.system],
              technique: [...form.labelIds.technique],
              psychology: [...form.labelIds.psychology],
            },
          },
        })
        lastSentLabelIds.value = snapshotLabelIds()
        await refresh()
      } catch {
        /* сеть */
      }
    }, 450)
  },
)

onUnmounted(() => {
  if (labelDebounceTimer) clearTimeout(labelDebounceTimer)
})

function isoLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

const isFromSync = computed(() => Boolean(data.value?.trade?.externalKey))

const { data: allLabels, refresh: refreshAllLabels } = await useFetch('/api/labels')

const optionsSystem = computed(() =>
  (allLabels.value ?? [])
    .filter((x: { kind: string }) => x.kind === 'system')
    .map((x: { id: number; label: string }) => ({ id: x.id, label: x.label })),
)
const optionsTechnique = computed(() =>
  (allLabels.value ?? [])
    .filter((x: { kind: string }) => x.kind === 'technique')
    .map((x: { id: number; label: string }) => ({ id: x.id, label: x.label })),
)
const optionsPsychology = computed(() =>
  (allLabels.value ?? [])
    .filter((x: { kind: string }) => x.kind === 'psychology')
    .map((x: { id: number; label: string }) => ({ id: x.id, label: x.label })),
)

const saving = ref(false)

async function save() {
  saving.value = true
  try {
    const labelIds = {
      system: form.labelIds.system,
      technique: form.labelIds.technique,
      psychology: form.labelIds.psychology,
    }
    if (isFromSync.value) {
      await $fetch(`/api/trades/${id.value}`, {
        method: 'PATCH',
        body: {
          rr: form.rr === '' ? null : Number(form.rr),
          noteSystem: form.noteSystem,
          noteTechnique: form.noteTechnique,
          noteAnalysis: form.noteAnalysis,
          labelIds,
        },
      })
    } else {
      await $fetch(`/api/trades/${id.value}`, {
        method: 'PATCH',
        body: {
          symbol: form.symbol,
          side: form.side,
          entryAt: new Date(form.entryAt).toISOString(),
          exitAt: new Date(form.exitAt).toISOString(),
          leverage: form.leverage,
          entryPrice: form.entryPrice,
          exitPrice: form.exitPrice,
          income: form.income,
          commission: form.commission,
          funding: form.funding,
          rr: form.rr === '' ? null : Number(form.rr),
          noteSystem: form.noteSystem,
          noteTechnique: form.noteTechnique,
          noteAnalysis: form.noteAnalysis,
          labelIds,
        },
      })
    }
    await refresh()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="data?.trade" class="page page-trade">
    <div class="trade-head row">
      <NuxtLink :to="`/trades/day/${localDayKeyFromIso(data.trade.exitAt)}`" class="btn">← День</NuxtLink>
      <h1 class="trade-title">{{ data.trade.symbol }}</h1>
    </div>

    <section class="card trade-summary">
      <p class="sum-line">
        <span class="sum-chunk">
          <span class="sum-lbl">Чистый:</span>
          <strong :class="data.trade.net >= 0 ? 'pos' : 'neg'">{{ fmtUsdt(data.trade.net) }}</strong>
        </span>
        <span v-if="priceMoveStr" class="sum-chunk">
          <span class="muted sum-lbl">Ход цены:</span>
          <strong class="pct" :class="priceMoveNonNegative ? 'pos' : 'neg'">{{ priceMoveStr }}</strong>
          <span class="muted tiny-hint">к цене входа</span>
        </span>
        <span class="sum-chunk muted">{{ Math.round(data.trade.durationMs / 60000) }} мин</span>
        <span v-if="quoteVolPreview != null" class="sum-chunk">
          <span class="muted sum-lbl">Объём:</span>
          <strong>{{ fmtUsdt(quoteVolPreview) }}</strong>
          <span class="muted tiny-hint">номинал</span>
        </span>
        <span v-else class="sum-chunk muted">Объём: —</span>
      </p>
      <p v-if="!data.trade.externalKey && quoteVolPreview != null" class="vol-hint muted">
        Для ручной сделки объём — оценка по доходу и движению цены.
      </p>

      <template v-if="isFromSync">
        <dl class="ro-grid trade-summary-grid">
          <div>
            <dt>Тикер</dt>
            <dd>{{ data.trade.symbol }}</dd>
          </div>
          <div>
            <dt>Сторона</dt>
            <dd>{{ data.trade.side }}</dd>
          </div>
          <div>
            <dt>Вход</dt>
            <dd>{{ fmtWhen(data.trade.entryAt) }}</dd>
          </div>
          <div>
            <dt>Выход</dt>
            <dd>{{ fmtWhen(data.trade.exitAt) }}</dd>
          </div>
          <div>
            <dt>Плечо</dt>
            <dd>{{ data.trade.leverage }}</dd>
          </div>
          <div>
            <dt>Цена входа</dt>
            <dd>{{ fmtInstrumentPrice(data.trade.entryPrice) }}</dd>
          </div>
          <div>
            <dt>Цена выхода</dt>
            <dd>{{ fmtInstrumentPrice(data.trade.exitPrice) }}</dd>
          </div>
          <div>
            <dt>Доход</dt>
            <dd>{{ fmtUsdt(data.trade.income) }}</dd>
          </div>
          <div>
            <dt>Комиссия</dt>
            <dd>{{ fmtUsdt(data.trade.commission) }}</dd>
          </div>
          <div>
            <dt>Фандинг</dt>
            <dd>{{ fmtUsdt(data.trade.funding) }}</dd>
          </div>
        </dl>
      </template>
    </section>

    <div class="trade-split">
      <div class="trade-split__chart card chart-card">
        <ClientOnly>
          <TradeCandleChart
            :symbol="data.trade.symbol"
            :side="data.trade.side"
            :entry-at="data.trade.entryAt"
            :exit-at="data.trade.exitAt"
            :entry-price="data.trade.entryPrice"
            :exit-price="data.trade.exitPrice"
            :height="300"
          />
          <TradeRrCalculator
            :side="data.trade.side"
            :entry-price="data.trade.entryPrice"
            @apply-rr="form.rr = $event"
          />
          <template #fallback>
            <div class="muted chart-fallback">Загрузка графика…</div>
          </template>
        </ClientOnly>
      </div>

      <div class="trade-split__editor">
        <div class="card trade-params-card">
          <div class="meta-rr-row">
            <label class="meta-rr-label">
              <span class="meta-lbl">RR</span>
              <input v-model="form.rr" class="input input-tight" type="number" step="0.01" placeholder="—" />
            </label>
            <span class="muted meta-rr-hint">можно взять с графика (блок «Расчёт RR»)</span>
          </div>

          <div v-if="!isFromSync" class="grid2 manual-grid">
            <div>
              <label class="label">Тикер</label>
              <input v-model="form.symbol" class="input" />
            </div>
            <div>
              <label class="label">Сторона</label>
              <select v-model="form.side" class="input">
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
            <div>
              <label class="label">Вход</label>
              <input v-model="form.entryAt" class="input" type="datetime-local" />
            </div>
            <div>
              <label class="label">Выход</label>
              <input v-model="form.exitAt" class="input" type="datetime-local" />
            </div>
            <div>
              <label class="label">Плечо</label>
              <input v-model.number="form.leverage" class="input" type="number" step="0.1" />
            </div>
            <div>
              <label class="label">Цена входа <span class="muted">(инструмент)</span></label>
              <input v-model.number="form.entryPrice" class="input" type="number" step="any" />
            </div>
            <div>
              <label class="label">Цена выхода <span class="muted">(инструмент)</span></label>
              <input v-model.number="form.exitPrice" class="input" type="number" step="any" />
            </div>
            <div>
              <label class="label">Доход <span class="muted">(USDT)</span></label>
              <input v-model.number="form.income" class="input" type="number" step="any" />
            </div>
            <div>
              <label class="label">Комиссия <span class="muted">(USDT)</span></label>
              <input v-model.number="form.commission" class="input" type="number" step="any" />
            </div>
            <div>
              <label class="label">Фандинг <span class="muted">(USDT)</span></label>
              <input v-model.number="form.funding" class="input" type="number" step="any" />
            </div>
          </div>

          <div class="notes-grid">
            <div class="note-cell">
              <div class="label note-label">
                <LabelWithHint :lines="tradeNoteHints.system">Система</LabelWithHint>
              </div>
              <LabelMultiCombobox
                v-model="form.labelIds.system"
                kind="system"
                :options="optionsSystem"
                input-class="input input-tight"
                class="label-row"
                @refresh="refreshAllLabels"
              />
              <textarea v-model="form.noteSystem" class="textarea textarea-dense" rows="7" placeholder="…" />
            </div>
            <div class="note-cell">
              <div class="label note-label">
                <LabelWithHint :lines="tradeNoteHints.technique">Техника</LabelWithHint>
              </div>
              <LabelMultiCombobox
                v-model="form.labelIds.technique"
                kind="technique"
                :options="optionsTechnique"
                input-class="input input-tight"
                class="label-row"
                @refresh="refreshAllLabels"
              />
              <textarea v-model="form.noteTechnique" class="textarea textarea-dense" rows="7" placeholder="…" />
            </div>
            <div class="note-cell">
              <div class="label note-label">
                <LabelWithHint :lines="tradeNoteHints.psychology">Психология</LabelWithHint>
              </div>
              <LabelMultiCombobox
                v-model="form.labelIds.psychology"
                kind="psychology"
                :options="optionsPsychology"
                input-class="input input-tight"
                class="label-row"
                @refresh="refreshAllLabels"
              />
              <textarea v-model="form.noteAnalysis" class="textarea textarea-dense" rows="7" placeholder="…" />
            </div>
          </div>

          <button type="button" class="btn btn-primary btn-save" :disabled="saving" @click="save">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="page muted">Загрузка…</div>
</template>

<style scoped>
.page-trade {
  max-width: min(1520px, 100%);
  margin-left: auto;
  margin-right: auto;
}
.trade-head {
  margin-bottom: 0.85rem;
}
.trade-title {
  margin: 0;
  font-size: 1.2rem;
}
.trade-summary {
  margin-bottom: 0.85rem;
  padding: 0.9rem 1rem 1rem;
}
.vol-hint {
  font-size: 0.75rem;
  margin: 0.35rem 0 0;
}
.trade-split {
  display: grid;
  gap: 0.85rem;
  align-items: start;
}
@media (min-width: 960px) {
  .trade-split {
    grid-template-columns: minmax(300px, 1fr) minmax(360px, 1.25fr);
  }
}
.trade-split__chart {
  min-width: 0;
}
.trade-split__editor {
  min-width: 0;
}
.chart-fallback {
  padding: 2rem 0.5rem;
  font-size: 0.875rem;
}
.trade-summary-grid {
  margin-top: 0.45rem;
}
@media (min-width: 700px) {
  .trade-summary-grid {
    grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  }
}
.trade-params-card {
  margin-bottom: 0;
  padding: 0.75rem 0.9rem;
}
.chart-card {
  padding: 0.65rem 0.9rem 0.85rem;
}
.sum-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.75rem 1.75rem;
  margin: 0 0 0.65rem;
  font-size: 0.875rem;
  line-height: 1.55;
}
.sum-chunk {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.5rem;
}
.sum-lbl {
  font-weight: 500;
}
.sum-line .pct {
  font-weight: 600;
}
.tiny-hint {
  font-size: 0.7rem;
  margin-left: 0.15rem;
}
.meta-rr-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.5rem 1rem;
  margin-bottom: 0.6rem;
}
.meta-rr-label {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}
.meta-rr-hint {
  font-size: 0.72rem;
  padding-bottom: 0.2rem;
}
.label-row {
  margin-bottom: 0.4rem;
}
.meta-lbl {
  display: block;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin-bottom: 0.15rem;
}
.input-tight {
  padding: 0.28rem 0.45rem;
  font-size: 0.8125rem;
  width: 100%;
}
.ro-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 0.35rem 0.65rem;
  margin: 0;
}
.ro-grid dt {
  margin: 0;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
  line-height: 1.2;
}
.ro-grid dd {
  margin: 0.1rem 0 0;
  font-weight: 600;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
}
.notes-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-top: 0.65rem;
}
.note-cell .label {
  margin-bottom: 0.35rem;
  font-size: 0.8125rem;
}
.textarea-dense {
  min-height: 11rem;
  font-size: 0.9rem;
  line-height: 1.5;
  padding: 0.55rem 0.65rem;
}
.btn-save {
  margin-top: 0.55rem;
  padding: 0.38rem 0.85rem;
  font-size: 0.8125rem;
}
.manual-grid {
  margin-top: 0.35rem;
}
</style>
