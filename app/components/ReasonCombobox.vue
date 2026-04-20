<script setup lang="ts">
const props = defineProps<{
  modelValue: number | string | ''
  kind: 'entry' | 'exit'
  options: { id: number; label: string }[]
  /** классы для поля ввода, например `input input-tight` */
  inputClass?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | '']
  refresh: []
}>()

const inputClass = computed(() => props.inputClass ?? 'input')

const inputRef = ref<HTMLInputElement | null>(null)
const open = ref(false)
const inputValue = ref('')
const creating = ref(false)

function normId(v: typeof props.modelValue): number | '' {
  if (v === '' || v === null || v === undefined) return ''
  const n = Number(v)
  return Number.isFinite(n) ? n : ''
}

function syncFromModel() {
  const id = normId(props.modelValue)
  if (id === '') {
    inputValue.value = ''
    return
  }
  const r = props.options.find((o) => o.id === id)
  inputValue.value = r?.label ?? ''
}

watch(
  () => [props.modelValue, props.options] as const,
  () => syncFromModel(),
  { immediate: true, deep: true },
)

const filtered = computed(() => {
  const q = inputValue.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter((o) => o.label.toLowerCase().includes(q))
})

function pick(r: { id: number; label: string }) {
  emit('update:modelValue', r.id)
  inputValue.value = r.label
  open.value = false
}

async function commitEnter() {
  const raw = inputValue.value.trim()
  if (!raw) {
    emit('update:modelValue', '')
    open.value = false
    return
  }
  const exact = props.options.find((o) => o.label.toLowerCase() === raw.toLowerCase())
  if (exact) {
    pick(exact)
    return
  }
  creating.value = true
  try {
    const row = await $fetch<{ id: number; label: string }>('/api/reasons', {
      method: 'POST',
      body: { kind: props.kind, label: raw },
    })
    emit('refresh')
    emit('update:modelValue', row.id)
    inputValue.value = row.label
  } finally {
    creating.value = false
    open.value = false
  }
}

function onInput() {
  open.value = true
}

function onFocus() {
  open.value = true
}

function onBlur() {
  setTimeout(() => {
    open.value = false
    const raw = inputValue.value.trim()
    if (!raw) {
      emit('update:modelValue', '')
      return
    }
    const match = props.options.find((o) => o.label.toLowerCase() === raw.toLowerCase())
    if (match) {
      emit('update:modelValue', match.id)
      inputValue.value = match.label
      return
    }
    const id = normId(props.modelValue)
    if (id !== '') {
      const cur = props.options.find((o) => o.id === id)
      inputValue.value = cur?.label ?? ''
    } else {
      inputValue.value = ''
    }
  }, 180)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commitEnter()
  } else if (e.key === 'Escape') {
    open.value = false
    syncFromModel()
    inputRef.value?.blur()
  }
}
</script>

<template>
  <div class="reason-combo">
    <input
      ref="inputRef"
      v-model="inputValue"
      type="text"
      :class="inputClass"
      autocomplete="off"
      :placeholder="creating ? 'Сохранение…' : 'Поиск или новое…'"
      :disabled="creating"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeydown"
    />
    <div v-show="open" class="reason-list" role="listbox">
      <button
        v-for="r in filtered"
        :key="r.id"
        type="button"
        class="reason-item"
        role="option"
        @mousedown.prevent="pick(r)"
      >
        {{ r.label }}
      </button>
      <p
        v-if="inputValue.trim() && !filtered.length"
        class="reason-empty muted"
      >
        Enter — добавить в список
      </p>
    </div>
  </div>
</template>

<style scoped>
.reason-combo {
  position: relative;
  width: 100%;
}
.reason-list {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 2px);
  z-index: 40;
  max-height: 11rem;
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.1);
  padding: 0.2rem 0;
}
.reason-item {
  display: block;
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
.reason-item:hover,
.reason-item:focus-visible {
  background: var(--surface2);
  outline: none;
}
.reason-empty {
  margin: 0;
  padding: 0.35rem 0.55rem;
  font-size: 0.75rem;
}
</style>
