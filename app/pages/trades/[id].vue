<script setup lang="ts">
import { tradeNoteHints } from '#shared/tradeNoteHints'
import { estimateQuoteVolumeUsdt } from '#shared/tradeQuoteVolume'

const route = useRoute()
const id = computed(() => Number(route.params.id))

const { data, refresh, pending, error } = await useFetch(() => `/api/trades/${id.value}`, {
  watch: [id],
  server: false,
})

const { fmtUsdt, fmtInstrumentPrice, fmtPriceMovePct } = useMoney()
const dayPlanOpen = ref(false)
const dayPlanLoading = ref(false)
const dayPlanText = ref('')
const dayPlanError = ref('')

const tradeDayKey = computed(() => {
  const iso = data.value?.trade?.exitAt
  return iso ? localDayKeyFromIso(iso) : ''
})

async function openDayPlanModal() {
  if (!tradeDayKey.value) return
  dayPlanOpen.value = true
  dayPlanLoading.value = true
  dayPlanError.value = ''
  try {
    const n = await $fetch<{ tradePlan?: string }>('/api/notes', {
      query: { scope: 'day', key: tradeDayKey.value },
    })
    dayPlanText.value = (n.tradePlan ?? '').trim()
  } catch {
    dayPlanText.value = ''
    dayPlanError.value = 'Не удалось загрузить план дня'
  } finally {
    dayPlanLoading.value = false
  }
}

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

/** Ноги для графика (после merge в БД хранятся в merged_from.legs). */
const mergeLegsForChart = computed(() => {
  const legs = data.value?.trade?.mergedFrom?.legs
  if (!legs?.length) return undefined
  return legs.map((l) => ({
    entryAt: l.entryAt,
    exitAt: l.exitAt,
    entryPrice: l.entryPrice,
    exitPrice: l.exitPrice,
  }))
})

function mergeGeneralFromTrade(t: {
  noteSystem?: string | null
  noteTechnique?: string | null
  noteAnalysis?: string | null
}): string {
  return [t.noteSystem, t.noteTechnique, t.noteAnalysis]
    .map((x) => (x ?? '').trim())
    .filter((x) => x.length > 0)
    .join('\n\n')
}

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
  /** Один общий анализ → в API кладётся в note_system, остальные general-поля очищаются. */
  noteGeneral: '',
  noteSystemTs: '',
  noteTechniqueTs: '',
  noteAnalysisTs: '',
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

/** true: три блока общего анализа; false: три блока анализа по ТС (режим по умолчанию). */
const showGeneralAnalysis = ref(false)

const hasGenNotes = computed(() => form.noteGeneral.trim().length > 0)
const hasTsNotes = computed(() =>
  [form.noteSystemTs, form.noteTechniqueTs, form.noteAnalysisTs].some((s) => (s ?? '').trim().length > 0),
)

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
    form.noteGeneral = mergeGeneralFromTrade(t)
    form.noteSystemTs = t.noteSystemTs ?? ''
    form.noteTechniqueTs = t.noteTechniqueTs ?? ''
    form.noteAnalysisTs = t.noteAnalysisTs ?? ''
    {
      const hasGen = mergeGeneralFromTrade(t).trim().length > 0
      const hasTs = [t.noteSystemTs, t.noteTechniqueTs, t.noteAnalysisTs].some(
        (x) => (x ?? '').trim().length > 0,
      )
      if (hasGen && !hasTs) {
        showGeneralAnalysis.value = true
      } else if (!hasGen) {
        showGeneralAnalysis.value = false
      }
    }
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
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  })
}

const unmerging = ref(false)

async function unmergeGroup() {
  const gid = data.value?.trade?.mergeGroupId
  if (gid == null) return
  unmerging.value = true
  try {
    await $fetch('/api/trades/unmerge', { method: 'POST', body: { mergeGroupId: gid } })
    await refresh()
  } finally {
    unmerging.value = false
  }
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
          noteSystem: form.noteGeneral.trim() || null,
          noteTechnique: null,
          noteAnalysis: null,
          noteSystemTs: form.noteSystemTs,
          noteTechniqueTs: form.noteTechniqueTs,
          noteAnalysisTs: form.noteAnalysisTs,
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
          noteSystem: form.noteGeneral.trim() || null,
          noteTechnique: null,
          noteAnalysis: null,
          noteSystemTs: form.noteSystemTs,
          noteTechniqueTs: form.noteTechniqueTs,
          noteAnalysisTs: form.noteAnalysisTs,
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
      <button type="button" class="btn" @click="openDayPlanModal">План дня</button>
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

      <p v-if="data.trade.mergeGroupId != null" class="merge-strip">
        <span class="muted">Старая группа ({{ data.trade.mergeGroupId }})</span>
        <span v-if="data.mergeGroupTrades?.length" class="merge-sibs">
          <NuxtLink
            v-for="s in data.mergeGroupTrades"
            :key="s.id"
            :to="`/trades/${s.id}`"
            class="merge-sib-link"
          >
            #{{ s.id }} ({{ fmtUsdt(s.net) }})
          </NuxtLink>
        </span>
        <button type="button" class="btn btn-tiny" :disabled="unmerging" @click="unmergeGroup">
          Разъединить
        </button>
      </p>

      <p v-else-if="data.trade.mergedFrom?.sourceIds?.length" class="merge-strip merged-from-strip">
        <span class="muted">Слияние:</span>
        <span class="merged-ids">{{
          data.trade.mergedFrom.sourceIds.map((id: number) => `#${id}`).join(', ')
        }}</span>
        <span class="muted tiny-hint">исходные сделки удалены, это одна агрегированная запись</span>
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
            :merge-legs="mergeLegsForChart"
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
              <input v-model="form.entryAt" class="input" type="datetime-local" step="1" />
            </div>
            <div>
              <label class="label">Выход</label>
              <input v-model="form.exitAt" class="input" type="datetime-local" step="1" />
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

          <label class="ts-toggle row">
            <input v-model="showGeneralAnalysis" type="checkbox" />
            <span>Редактировать общий анализ (отдельно от анализа по ТС)</span>
          </label>
          <p
            v-if="hasGenNotes && hasTsNotes && !showGeneralAnalysis"
            class="ts-both-hint muted"
          >
            Для этой сделки заполнены и анализ по ТС, и общий. Сейчас открыт анализ по ТС; включите галочку выше, чтобы
            увидеть общий анализ.
          </p>
          <p
            v-if="hasGenNotes && hasTsNotes && showGeneralAnalysis"
            class="ts-both-hint muted"
          >
            Сейчас открыт общий анализ. Снимите галочку, чтобы вернуться к трём блокам анализа по ТС.
          </p>

          <div v-show="!showGeneralAnalysis" class="notes-grid">
            <div class="note-cell">
              <div class="label note-label">
                <LabelWithHint :lines="tradeNoteHints.system">Система <span class="muted">(ТС)</span></LabelWithHint>
              </div>
              <LabelMultiCombobox
                v-model="form.labelIds.system"
                kind="system"
                :options="optionsSystem"
                input-class="input input-tight"
                class="label-row"
                @refresh="refreshAllLabels"
              />
              <textarea v-model="form.noteSystemTs" class="textarea textarea-dense" rows="7" placeholder="…" />
            </div>
            <div class="note-cell">
              <div class="label note-label">
                <LabelWithHint :lines="tradeNoteHints.technique"
                  >Техника <span class="muted">(ТС)</span></LabelWithHint>
              </div>
              <LabelMultiCombobox
                v-model="form.labelIds.technique"
                kind="technique"
                :options="optionsTechnique"
                input-class="input input-tight"
                class="label-row"
                @refresh="refreshAllLabels"
              />
              <textarea v-model="form.noteTechniqueTs" class="textarea textarea-dense" rows="7" placeholder="…" />
            </div>
            <div class="note-cell">
              <div class="label note-label">
                <LabelWithHint :lines="tradeNoteHints.psychology"
                  >Психология <span class="muted">(ТС)</span></LabelWithHint>
              </div>
              <LabelMultiCombobox
                v-model="form.labelIds.psychology"
                kind="psychology"
                :options="optionsPsychology"
                input-class="input input-tight"
                class="label-row"
                @refresh="refreshAllLabels"
              />
              <textarea v-model="form.noteAnalysisTs" class="textarea textarea-dense" rows="7" placeholder="…" />
            </div>
          </div>

          <div v-show="showGeneralAnalysis" class="general-one-block">
            <div class="general-tags-row">
              <div class="tag-col">
                <div class="label note-label">
                  <LabelWithHint :lines="tradeNoteHints.system">Метка: система</LabelWithHint>
                </div>
                <LabelMultiCombobox
                  v-model="form.labelIds.system"
                  kind="system"
                  :options="optionsSystem"
                  input-class="input input-tight"
                  class="label-row"
                  @refresh="refreshAllLabels"
                />
              </div>
              <div class="tag-col">
                <div class="label note-label">
                  <LabelWithHint :lines="tradeNoteHints.technique">Метка: техника</LabelWithHint>
                </div>
                <LabelMultiCombobox
                  v-model="form.labelIds.technique"
                  kind="technique"
                  :options="optionsTechnique"
                  input-class="input input-tight"
                  class="label-row"
                  @refresh="refreshAllLabels"
                />
              </div>
              <div class="tag-col">
                <div class="label note-label">
                  <LabelWithHint :lines="tradeNoteHints.psychology">Метка: психология</LabelWithHint>
                </div>
                <LabelMultiCombobox
                  v-model="form.labelIds.psychology"
                  kind="psychology"
                  :options="optionsPsychology"
                  input-class="input input-tight"
                  class="label-row"
                  @refresh="refreshAllLabels"
                />
              </div>
            </div>
            <div class="label note-label" style="margin-top: 0.65rem">Общий анализ</div>
            <textarea
              v-model="form.noteGeneral"
              class="textarea textarea-dense"
              rows="14"
              placeholder="…"
            />
          </div>

          <button type="button" class="btn btn-primary btn-save" :disabled="saving" @click="save">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  </div>
  <div v-else-if="pending" class="page muted">Загрузка…</div>
  <div v-else-if="error" class="page muted">Не удалось загрузить сделку</div>
  <div v-else class="page muted">Нет сделки</div>

  <div v-if="dayPlanOpen" class="modal-backdrop" role="dialog" aria-modal="true" @click.self="dayPlanOpen = false">
    <div class="modal-card">
      <div class="modal-head">
        <h2 class="modal-title">Торговый план на {{ tradeDayKey }}</h2>
        <button type="button" class="btn btn-tiny" @click="dayPlanOpen = false">Закрыть</button>
      </div>
      <p v-if="dayPlanLoading" class="muted">Загрузка…</p>
      <p v-else-if="dayPlanError" class="neg">{{ dayPlanError }}</p>
      <textarea
        v-else
        class="textarea modal-plan-text"
        :value="dayPlanText || 'План на этот день не заполнен.'"
        rows="16"
        readonly
      />
      <div class="modal-actions">
        <NuxtLink v-if="tradeDayKey" :to="`/journal/day?date=${tradeDayKey}`" class="btn btn-primary">Открыть день в журнале</NuxtLink>
      </div>
    </div>
  </div>
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
.ts-toggle {
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0.5rem 0 0.65rem;
  font-size: 0.8125rem;
  cursor: pointer;
}
.ts-toggle input {
  margin-top: 0.2rem;
}
.ts-both-hint {
  font-size: 0.8rem;
  line-height: 1.4;
  margin: 0.2rem 0 0.55rem;
}
.general-one-block {
  margin-top: 0.25rem;
}
.general-tags-row {
  display: grid;
  gap: 0.5rem 0.75rem;
  grid-template-columns: 1fr;
}
@media (min-width: 700px) {
  .general-tags-row {
    grid-template-columns: repeat(3, 1fr);
  }
}
.tag-col {
  min-width: 0;
}
.merge-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
}
.merge-sibs {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
}
.merge-sib-link {
  font-weight: 600;
}
.merged-from-strip .merged-ids {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: grid;
  place-items: center;
  z-index: 50;
  padding: 1rem;
}
.modal-card {
  width: min(820px, 100%);
  max-height: min(88vh, 900px);
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.9rem;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.6rem;
}
.modal-title {
  margin: 0;
  font-size: 1rem;
}
.modal-plan-text {
  width: 100%;
  font-size: 0.9rem;
  line-height: 1.45;
}
.modal-actions {
  margin-top: 0.6rem;
  display: flex;
  justify-content: flex-end;
}
</style>
