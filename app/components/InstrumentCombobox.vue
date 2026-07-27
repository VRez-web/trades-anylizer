<script setup lang="ts">
import { defaultChartMeta, type ChartMeta } from '#shared/chartMeta'

type InstrumentItem = {
  symbol: string
  category: string
  chartProvider: 'bybit' | 'yahoo'
  label: string
}

const props = defineProps<{
  modelValue: string
  inputClass?: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:meta': [value: ChartMeta]
}>()

const inputClass = computed(() => props.inputClass ?? 'input')
const inputRef = ref<HTMLInputElement | null>(null)
const open = ref(false)
const inputValue = ref('')
const items = ref<InstrumentItem[]>([])
const loading = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function emitMeta(symbol: string, item?: InstrumentItem) {
  if (item) {
    emit('update:meta', {
      chartSymbol: item.symbol,
      chartProvider: item.chartProvider,
      marketCategory: item.category === 'forex' ? 'forex' : item.category,
    })
    return
  }
  emit('update:meta', defaultChartMeta(symbol))
}

function syncFromModel() {
  inputValue.value = (props.modelValue ?? '').trim().toUpperCase()
}

watch(
  () => props.modelValue,
  () => syncFromModel(),
  { immediate: true },
)

async function fetchItems(q: string) {
  loading.value = true
  try {
    const res = await $fetch<{ items: InstrumentItem[] }>('/api/market/instruments', {
      query: { q, limit: 25 },
    })
    items.value = res.items ?? []
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

function scheduleFetch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    fetchItems(inputValue.value.trim().toUpperCase())
  }, 220)
}

function onInput() {
  open.value = true
  scheduleFetch()
}

function onFocus() {
  open.value = true
  if (!items.value.length) fetchItems(inputValue.value.trim().toUpperCase())
}

function pick(item: InstrumentItem) {
  emit('update:modelValue', item.symbol)
  emitMeta(item.symbol, item)
  inputValue.value = item.symbol
  open.value = false
}

function commitFreeText() {
  const sym = inputValue.value.trim().toUpperCase()
  if (!sym) {
    emit('update:modelValue', '')
    return
  }
  const exact = items.value.find((x) => x.symbol === sym)
  if (exact) {
    pick(exact)
    return
  }
  emit('update:modelValue', sym)
  emitMeta(sym)
}

function onBlur() {
  setTimeout(() => {
    open.value = false
    commitFreeText()
  }, 180)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commitFreeText()
    open.value = false
    inputRef.value?.blur()
  } else if (e.key === 'Escape') {
    open.value = false
    syncFromModel()
    inputRef.value?.blur()
  }
}

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<template>
  <div class="inst-combo">
    <input
      ref="inputRef"
      v-model="inputValue"
      type="text"
      :class="inputClass"
      autocomplete="off"
      :placeholder="placeholder ?? 'BTCUSDT, GBPUSD…'"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeydown"
    />
    <div v-show="open" class="inst-list" role="listbox">
      <p v-if="loading" class="inst-hint muted">Поиск…</p>
      <button
        v-for="item in items"
        :key="`${item.chartProvider}-${item.symbol}-${item.category}`"
        type="button"
        class="inst-item"
        role="option"
        @mousedown.prevent="pick(item)"
      >
        <span class="inst-item__sym">{{ item.symbol }}</span>
        <span class="inst-item__meta muted">{{ item.label.replace(`${item.symbol} · `, '') }}</span>
      </button>
      <p v-if="!loading && inputValue.trim() && !items.length" class="inst-hint muted">
        Enter — использовать «{{ inputValue.trim().toUpperCase() }}» (авто-источник)
      </p>
    </div>
  </div>
</template>

<style scoped>
.inst-combo {
  position: relative;
  width: 100%;
}
.inst-list {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 2px);
  z-index: 50;
  max-height: 13rem;
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.1);
  padding: 0.2rem 0;
}
.inst-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.05rem;
  width: 100%;
  text-align: left;
  padding: 0.35rem 0.55rem;
  border: none;
  background: transparent;
  font-size: inherit;
  color: var(--text);
  cursor: pointer;
  font-family: inherit;
}
.inst-item:hover,
.inst-item:focus-visible {
  background: var(--surface2);
  outline: none;
}
.inst-item__sym {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.inst-item__meta {
  font-size: 0.72rem;
}
.inst-hint {
  margin: 0;
  padding: 0.35rem 0.55rem;
  font-size: 0.75rem;
}
</style>
