<script setup lang="ts">
type PreviewRow = {
  symbol: string
  side: string
  exitAt: string
  entryPrice: number
  exitPrice: number
  net: number
  duplicate: boolean
}

type ImportResult = {
  preview: PreviewRow[]
  totalParsed: number
  imported: number
  skipped: number
  errors: string[]
}

const props = defineProps<{
  open: boolean
  accountNames: string[]
  defaultAccount?: string
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  imported: []
}>()

const { fmtSignedUsdt } = useMoney()

const text = ref('')
const accountName = ref('')
const loading = ref(false)
const result = ref<ImportResult | null>(null)
const importError = ref('')

watch(
  () => props.open,
  (v) => {
    if (v) resetForm()
  },
)

function resetForm() {
  text.value = ''
  result.value = null
  importError.value = ''
  accountName.value = props.defaultAccount || props.accountNames[0] || ''
}

const previewRows = computed(() => result.value?.preview ?? [])
const newCount = computed(() => previewRows.value.filter((r) => !r.duplicate).length)

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

function importBody(dryRun: boolean) {
  return {
    text: text.value.trim(),
    accountName: accountName.value.trim(),
    dryRun,
    tzOffsetMinutes: new Date().getTimezoneOffset(),
  }
}

function validateBeforeRequest() {
  if (!accountName.value.trim()) {
    importError.value = 'Выберите или введите аккаунт пропа'
    return false
  }
  if (!text.value.trim()) {
    importError.value = 'Вставьте таблицу History из FundingPips (Ctrl+C)'
    return false
  }
  return true
}

async function runPreview() {
  importError.value = ''
  if (!validateBeforeRequest()) return
  loading.value = true
  try {
    result.value = await $fetch<ImportResult>('/api/trades/import/fundingpips', {
      method: 'POST',
      body: importBody(true),
    })
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { statusMessage?: string } }).data?.statusMessage ?? '')
        : ''
    importError.value = msg || 'Не удалось выполнить предпросмотр'
    result.value = null
  } finally {
    loading.value = false
  }
}

async function runImport() {
  if (!newCount.value) return
  if (!validateBeforeRequest()) return
  loading.value = true
  importError.value = ''
  try {
    const res = await $fetch<ImportResult>('/api/trades/import/fundingpips', {
      method: 'POST',
      body: importBody(false),
    })
    result.value = res
    emit('imported')
    close()
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { statusMessage?: string } }).data?.statusMessage ?? '')
        : ''
    importError.value = msg || 'Не удалось импортировать'
  } finally {
    loading.value = false
  }
}

function close() {
  resetForm()
  emit('update:open', false)
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="close">
    <div class="modal card">
      <h2 class="modal-title">Импорт FundingPips</h2>
      <p class="muted modal-lead">
        На дашборде FundingPips: вкладка History → выделите нужные строки → Ctrl+C → вставьте ниже. Импортируется
        всё, что вы скопировали.
      </p>

      <div class="modal-grid">
        <label class="fl fl-span">
          <span class="fl-l">Аккаунт пропа</span>
          <input
            v-model="accountName"
            class="input"
            placeholder="FundingPips 5k$"
            list="fp-import-accounts"
          />
          <datalist id="fp-import-accounts">
            <option v-for="n in accountNames" :key="n" :value="n" />
          </datalist>
        </label>

        <label class="fl fl-span">
          <span class="fl-l">Таблица из буфера</span>
          <textarea
            v-model="text"
            class="input textarea"
            rows="8"
            placeholder="Symbol	Type	Open Date	Open	Closed Date	…"
          />
        </label>
      </div>

      <p v-if="importError" class="err">{{ importError }}</p>

      <div v-if="result" class="preview-stats muted">
        Распознано {{ result.totalParsed }} · Новых {{ newCount }}
        <template v-if="result.skipped"> · Пропущено (дубликаты) {{ result.skipped }}</template>
        <template v-if="result.imported"> · Импортировано {{ result.imported }}</template>
      </div>

      <div v-if="previewRows.length" class="preview-wrap">
        <table class="preview-tbl">
          <thead>
            <tr>
              <th>Выход</th>
              <th>Тикер</th>
              <th>Сторона</th>
              <th>Чистый</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in previewRows" :key="`${r.symbol}-${r.exitAt}-${i}`">
              <td>{{ fmtWhen(r.exitAt) }}</td>
              <td>{{ r.symbol }}</td>
              <td>{{ r.side === 'long' ? 'Long' : 'Short' }}</td>
              <td :class="r.net >= 0 ? 'pos' : 'neg'">{{ fmtSignedUsdt(r.net, 2) }}</td>
              <td>
                <span v-if="r.duplicate" class="dup-badge">есть</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="result?.errors?.length" class="parse-errors">
        <p v-for="(e, i) in result.errors.slice(0, 5)" :key="i" class="muted tiny">{{ e }}</p>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn" :disabled="loading" @click="close">Закрыть</button>
        <button type="button" class="btn" :disabled="loading" @click="runPreview">
          {{ loading ? '…' : 'Предпросмотр' }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="loading || !newCount"
          @click="runImport"
        >
          {{ loading ? '…' : `Импортировать ${newCount}` }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.modal {
  width: min(640px, 100%);
  max-height: min(90vh, 720px);
  overflow: auto;
  padding: 1rem 1.1rem;
}
.modal-title {
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
}
.modal-lead {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
  line-height: 1.45;
}
.modal-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.65rem 1rem;
}
.fl {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.fl-l {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
}
.fl-span {
  grid-column: 1 / -1;
}
.textarea {
  resize: vertical;
  min-height: 8rem;
  font-family: inherit;
  font-size: 0.8125rem;
}
.err {
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
  color: var(--red, #b91c1c);
}
.preview-stats {
  margin: 0.65rem 0 0.35rem;
  font-size: 0.8125rem;
}
.preview-wrap {
  overflow-x: auto;
  margin: 0.35rem 0;
  max-height: 220px;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.preview-tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}
.preview-tbl th,
.preview-tbl td {
  border-bottom: 1px solid var(--border);
  padding: 0.35rem 0.45rem;
  text-align: left;
}
.dup-badge {
  font-size: 0.65rem;
  color: var(--muted);
}
.parse-errors {
  margin-top: 0.35rem;
}
.tiny {
  margin: 0.15rem 0;
  font-size: 0.72rem;
}
.modal-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>
