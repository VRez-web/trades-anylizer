<script setup lang="ts">
import { calcRr, formatRr } from '#shared/tradeRr'

const props = defineProps<{
  side: 'long' | 'short'
  entryPrice: number
  exitPrice?: number | null
}>()

const stopLoss = defineModel<string>('stopLoss', { default: '' })
const takeProfit = defineModel<string>('takeProfit', { default: '' })

const emit = defineEmits<{
  'apply-rr': [rr: number]
}>()

const { fmtInstrumentPrice } = useMoney()

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

const actualRr = computed(() => {
  const sl = parseFloat(stopLoss.value.replace(',', '.'))
  const exit = props.exitPrice
  if (!Number.isFinite(sl) || typeof exit !== 'number' || !Number.isFinite(exit)) return null
  return calcRr(props.side, props.entryPrice, sl, exit)
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
        Long: SL &lt; вход &lt; TP (план). Фактический выход может отличаться от TP.
      </template>
      <template v-else>
        Short: TP (план) &lt; вход &lt; SL. Фактический выход может отличаться от TP.
      </template>
    </p>
    <div class="rr-grid">
      <label class="lbl">
        <span class="lbl-t">Стоп (цена)</span>
        <input v-model="stopLoss" class="input input-compact" type="text" inputmode="decimal" placeholder="—" />
      </label>
      <label class="lbl">
        <span class="lbl-t">Тейк план (цена)</span>
        <input v-model="takeProfit" class="input input-compact" type="text" inputmode="decimal" placeholder="—" />
      </label>
    </div>
    <p class="entry-line muted">
      Вход: <strong>{{ fmtInstrumentPrice(entryPrice) }}</strong>
      · {{ side === 'long' ? 'Long' : 'Short' }}
      <template v-if="typeof exitPrice === 'number' && Number.isFinite(exitPrice)">
        · выход факт: <strong>{{ fmtInstrumentPrice(exitPrice) }}</strong>
      </template>
    </p>
    <div v-if="parsed && 'err' in parsed" class="err">{{ parsed.err }}</div>
    <div v-else class="out">
      <span v-if="parsed && 'rr' in parsed" class="rr-chip">
        <span class="muted">RR план</span>
        <strong>{{ formatRr(parsed.rr, 3) }}</strong>
      </span>
      <span v-if="actualRr != null" class="rr-chip">
        <span class="muted">RR факт</span>
        <strong>{{ formatRr(actualRr, 3) }}</strong>
      </span>
      <button
        v-if="parsed && 'rr' in parsed"
        type="button"
        class="btn btn-tiny"
        @click="apply"
      >
        RR план → поле сделки
      </button>
    </div>
    <p v-if="!stopLoss.trim() && !takeProfit.trim()" class="muted tiny">Введите стоп и плановый тейк.</p>
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
.rr-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
}
.tiny {
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
}
</style>
