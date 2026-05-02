<script setup lang="ts">
const props = defineProps<{
  side: 'long' | 'short'
  entryPrice: number
  /** Цена фактического выхода — подставляется в «Тейк»; поле можно поменять для «что если». */
  exitPrice?: number | null
}>()

const emit = defineEmits<{
  'apply-rr': [rr: number]
}>()

const stopLoss = ref('')
const takeProfit = ref('')

const { fmtInstrumentPrice } = useMoney()

watch(
  () => props.exitPrice,
  (exit) => {
    if (typeof exit === 'number' && Number.isFinite(exit) && exit !== 0) {
      takeProfit.value = String(exit)
    }
  },
  { immediate: true },
)

const parsed = computed(() => {
  const e = props.entryPrice
  const sl = parseFloat(stopLoss.value.replace(',', '.'))
  const tp = parseFloat(takeProfit.value.replace(',', '.'))
  if (!Number.isFinite(e) || !Number.isFinite(sl) || !Number.isFinite(tp)) return null
  if (props.side === 'long') {
    const risk = e - sl
    const reward = tp - e
    if (risk <= 0) return { err: 'Long: стоп ниже цены входа (SL < вход).' }
    if (reward <= 0) return { err: 'Long: тейк выше цены входа (TP > вход).' }
    return { rr: reward / risk, risk, reward }
  }
  const risk = sl - e
  const reward = e - tp
  if (risk <= 0) return { err: 'Short: стоп выше цены входа (SL > вход).' }
  if (reward <= 0) return { err: 'Short: тейк ниже цены входа (TP < вход).' }
  return { rr: reward / risk, risk, reward }
})

function apply() {
  const p = parsed.value
  if (p && 'rr' in p && typeof p.rr === 'number') emit('apply-rr', Math.round(p.rr * 1000) / 1000)
}
</script>

<template>
  <div class="rr-card">
    <h4 class="rr-title">Расчёт RR</h4>
    <p class="muted rr-hint">
      <template v-if="side === 'long'">
        Long: SL &lt; вход &lt; TP. Риск = вход − SL, награда = TP − вход.
      </template>
      <template v-else>
        Short: TP &lt; вход &lt; SL. Риск = SL − вход, награда = вход − TP.
      </template>
      Тейк по умолчанию — цена выхода сделки; можно заменить для расчёта планового RR.
    </p>
    <div class="rr-grid">
      <label class="lbl">
        <span class="lbl-t">Стоп (цена)</span>
        <input v-model="stopLoss" class="input input-compact" type="text" inputmode="decimal" placeholder="—" />
      </label>
      <label class="lbl">
        <span class="lbl-t">Тейк (цена)</span>
        <input v-model="takeProfit" class="input input-compact" type="text" inputmode="decimal" placeholder="—" />
      </label>
    </div>
    <p class="entry-line muted">
      Вход: <strong>{{ fmtInstrumentPrice(entryPrice) }}</strong>
      · {{ side === 'long' ? 'Long' : 'Short' }}
    </p>
    <div v-if="parsed && 'err' in parsed" class="err">{{ parsed.err }}</div>
    <div v-else-if="parsed && 'rr' in parsed" class="out">
      <span class="muted">RR ≈</span>
      <strong class="rr-val">{{ parsed.rr.toFixed(3) }}</strong>
      <button type="button" class="btn btn-tiny" @click="apply">В поле RR сделки</button>
    </div>
    <p v-else class="muted tiny">Введите стоп и тейк в ценах инструмента.</p>
  </div>
</template>

<style scoped>
.rr-card {
  margin-top: 0.75rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--border);
}
.rr-title {
  margin: 0 0 0.35rem;
  font-size: 0.8125rem;
  font-weight: 600;
}
.rr-hint {
  margin: 0 0 0.55rem;
  font-size: 0.72rem;
  line-height: 1.4;
}
.rr-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
.lbl {
  display: block;
  min-width: 0;
}
.lbl-t {
  display: block;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin-bottom: 0.15rem;
}
.input-compact {
  width: 100%;
  padding: 0.28rem 0.45rem;
  font-size: 0.8125rem;
}
.entry-line {
  margin: 0.5rem 0 0;
  font-size: 0.78rem;
}
.err {
  margin: 0.45rem 0 0;
  font-size: 0.8rem;
  color: var(--red, #b91c1c);
}
.out {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin-top: 0.45rem;
  font-size: 0.85rem;
}
.rr-val {
  font-variant-numeric: tabular-nums;
}
.tiny {
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
}
</style>
