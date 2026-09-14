<script setup lang="ts">
type PropEvent = {
  id: number
  kind: 'purchase' | 'payout'
  accountName: string
  amountUsdt: number
  signedUsdt: number
  eventAt: string
  note: string | null
}

type PropStats = {
  summary: {
    purchasesTotal: number
    payoutsTotal: number
    netCashflow: number
    tradesNet: number
    combinedNet: number
    eventsCount: number
    tradesCount: number
  }
}

type PropTradeRow = {
  id: number
  symbol: string
  exitAt: string
  net: number
  side: string
  accountName?: string | null
}

const { fmtUsdt, fmtSignedUsdt } = useMoney()
const {
  names: propAccountNames,
  accounts: propAccounts,
  selectableNames: propSelectableNames,
  refresh: refreshAccountNames,
} = usePropAccountNames()

const statusSaving = ref<string | null>(null)

function onAccountStatusChange(name: string, ev: Event) {
  const v = (ev.target as HTMLSelectElement).value
  if (v === 'active' || v === 'passed' || v === 'failed') {
    void setAccountStatus(name, v)
  }
}

async function setAccountStatus(name: string, status: PropAccountStatus) {
  statusSaving.value = name
  try {
    await $fetch('/api/prop/accounts', { method: 'PATCH', body: { name, status } })
    await refreshAccountNames()
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { statusMessage?: string } }).data?.statusMessage ?? '')
        : ''
    alert(msg || 'Не удалось обновить статус')
  } finally {
    statusSaving.value = null
  }
}

const selectedAccount = ref('')

const { data: events, refresh: refreshEvents } = await useFetch<PropEvent[]>('/api/prop/events')

const statsUrl = computed(() => {
  const base = '/api/prop/stats'
  if (!selectedAccount.value) return base
  return `${base}?accountName=${encodeURIComponent(selectedAccount.value)}`
})
const { data: stats, refresh: refreshStats } = await useFetch<PropStats>(statsUrl, { watch: [statsUrl] })

const tradesUrl = computed(() => {
  const q = new URLSearchParams({ tradeSource: 'prop', sort: 'exit_desc' })
  if (selectedAccount.value) q.set('accountName', selectedAccount.value)
  return `/api/trades?${q}`
})
const { data: propTrades, refresh: refreshTrades } = await useFetch<PropTradeRow[]>(tradesUrl, {
  watch: [tradesUrl],
})

async function refreshAll() {
  await Promise.all([refreshEvents(), refreshStats(), refreshTrades(), refreshAccountNames()])
}

const addOpen = ref(false)
const addSaving = ref(false)
const addForm = reactive({
  kind: 'purchase' as 'purchase' | 'payout',
  accountName: '',
  amountUsdt: '' as string | number,
  eventAt: '',
  note: '',
})

function isoLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function openAdd() {
  addForm.kind = 'purchase'
  addForm.accountName = selectedAccount.value || ''
  addForm.amountUsdt = ''
  addForm.eventAt = isoLocal(new Date())
  addForm.note = ''
  addOpen.value = true
}

async function submitAdd() {
  addSaving.value = true
  try {
    await $fetch('/api/prop/events', {
      method: 'POST',
      body: {
        kind: addForm.kind,
        accountName: addForm.accountName,
        amountUsdt: Number(addForm.amountUsdt),
        eventAt: new Date(addForm.eventAt).toISOString(),
        note: addForm.note.trim() || null,
      },
    })
    addOpen.value = false
    await refreshAll()
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { statusMessage?: string } }).data?.statusMessage ?? '')
        : ''
    alert(msg || 'Не удалось сохранить')
  } finally {
    addSaving.value = false
  }
}

async function removeEvent(id: number) {
  if (!confirm('Удалить запись?')) return
  await $fetch(`/api/prop/events/${id}`, { method: 'DELETE' })
  await refreshAll()
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

function kindLabel(kind: PropEvent['kind']) {
  return kind === 'purchase' ? 'Покупка' : 'Выплата'
}

const filteredEvents = computed(() => {
  const list = events.value ?? []
  if (!selectedAccount.value) return list
  return list.filter((e) => e.accountName === selectedAccount.value)
})

const listLink = computed(() => {
  const q = new URLSearchParams({ tradeSource: 'prop' })
  if (selectedAccount.value) q.set('accountName', selectedAccount.value)
  return `/trades/list?${q}`
})

const importOpen = ref(false)
</script>

<template>
  <div class="page prop-page">
    <div class="head-row">
      <h1 class="title">Проп-аккаунты</h1>
      <div class="head-actions">
        <button type="button" class="btn" @click="importOpen = true">Импорт FundingPips</button>
        <button type="button" class="btn btn-primary" @click="openAdd">+ Покупка / выплата</button>
      </div>
    </div>

    <p class="muted lead">
      Покупки и выплаты отображаются на основной кривой доходности (страница «Сделки»). Торговый PnL проп-сделок
      учитывается только здесь.
    </p>

    <label class="account-filter">
      <span class="account-filter-lbl">Аккаунт</span>
      <select v-model="selectedAccount" class="input">
        <option value="">Все аккаунты</option>
        <option v-for="n in propAccountNames" :key="n" :value="n">{{ n }}</option>
      </select>
    </label>

    <div v-if="propAccounts.length" class="card accounts-status">
      <h2 class="block-h">Статус аккаунтов</h2>
      <p class="muted accounts-status-hint">
        «Не прошёл» скрывается при добавлении проп-сделки в списке сделок.
      </p>
      <div class="accounts-status-list">
        <div v-for="a in propAccounts" :key="a.name" class="accounts-status-row">
          <span class="accounts-status-name">{{ a.name }}</span>
          <select
            class="input input-compact accounts-status-select"
            :value="a.status"
            :disabled="statusSaving === a.name"
            @change="onAccountStatusChange(a.name, $event)"
          >
            <option value="active">В процессе</option>
            <option value="passed">Прошёл</option>
            <option value="failed">Не прошёл</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="stats?.summary" class="summary-grid">
      <div class="card summary-tile">
        <div class="summary-lbl">Покупки аккаунтов</div>
        <strong class="neg">−{{ fmtUsdt(stats.summary.purchasesTotal) }}</strong>
      </div>
      <div class="card summary-tile">
        <div class="summary-lbl">Выплаты</div>
        <strong class="pos">+{{ fmtUsdt(stats.summary.payoutsTotal) }}</strong>
      </div>
      <div class="card summary-tile">
        <div class="summary-lbl">Денежный поток</div>
        <strong :class="stats.summary.netCashflow >= 0 ? 'pos' : 'neg'">{{
          fmtSignedUsdt(stats.summary.netCashflow)
        }}</strong>
      </div>
      <div class="card summary-tile">
        <div class="summary-lbl">Торговый PnL (проп-сделки)</div>
        <strong :class="stats.summary.tradesNet >= 0 ? 'pos' : 'neg'">{{
          fmtSignedUsdt(stats.summary.tradesNet)
        }}</strong>
      </div>
      <div class="card summary-tile">
        <div class="summary-lbl">Всего сделок</div>
        <strong>{{ stats.summary.tradesCount }}</strong>
      </div>
      <div class="card summary-tile summary-tile--wide">
        <div class="summary-lbl">Итого по пропу</div>
        <strong :class="stats.summary.combinedNet >= 0 ? 'pos' : 'neg'">{{
          fmtSignedUsdt(stats.summary.combinedNet)
        }}</strong>
        <span class="muted summary-sub">выплаты − покупки + PnL сделок</span>
      </div>
    </div>

    <div class="card">
      <div class="block-head">
        <h2 class="block-h">Сделки</h2>
        <NuxtLink :to="listLink" class="btn btn-tiny">Открыть в списке</NuxtLink>
      </div>
      <div v-if="!propTrades?.length" class="muted">Нет проп-сделок</div>
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Выход</th>
              <th>Тикер</th>
              <th v-if="!selectedAccount">Аккаунт</th>
              <th>Сторона</th>
              <th>Чистый</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in propTrades" :key="t.id">
              <td class="t-when">{{ fmtWhen(t.exitAt) }}</td>
              <td>
                <NuxtLink :to="`/trades/${t.id}`" class="sym-link">{{ t.symbol }}</NuxtLink>
              </td>
              <td v-if="!selectedAccount">{{ t.accountName || '—' }}</td>
              <td>{{ t.side === 'long' ? 'Long' : 'Short' }}</td>
              <td :class="t.net >= 0 ? 'pos' : 'neg'">{{ fmtSignedUsdt(t.net) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="block-head">
        <h2 class="block-h">Покупки и выплаты</h2>
      </div>
      <div v-if="!filteredEvents.length" class="muted">Нет записей</div>
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Тип</th>
              <th v-if="!selectedAccount">Аккаунт</th>
              <th>Сумма</th>
              <th>Комментарий</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in filteredEvents" :key="e.id">
              <td class="t-when">{{ fmtWhen(e.eventAt) }}</td>
              <td>
                <span class="kind-badge" :class="`kind-badge--${e.kind}`">{{ kindLabel(e.kind) }}</span>
              </td>
              <td v-if="!selectedAccount">{{ e.accountName }}</td>
              <td :class="e.signedUsdt >= 0 ? 'pos' : 'neg'">{{ fmtSignedUsdt(e.signedUsdt) }}</td>
              <td class="note-cell">{{ e.note || '—' }}</td>
              <td>
                <button type="button" class="btn btn-tiny" @click="removeEvent(e.id)">Удалить</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="addOpen" class="modal-backdrop" @click.self="addOpen = false">
      <div class="modal card">
        <h2 class="modal-title">Покупка или выплата</h2>
        <div class="modal-grid">
          <label class="fl">
            <span class="fl-l">Тип</span>
            <select v-model="addForm.kind" class="input">
              <option value="purchase">Покупка аккаунта</option>
              <option value="payout">Выплата</option>
            </select>
          </label>
          <label class="fl">
            <span class="fl-l">Аккаунт</span>
            <input
              v-model="addForm.accountName"
              class="input"
              placeholder="FTMO 100k"
              list="prop-account-datalist"
            />
            <datalist id="prop-account-datalist">
              <option v-for="n in propAccountNames" :key="n" :value="n" />
            </datalist>
          </label>
          <label class="fl">
            <span class="fl-l">Сумма, USDT</span>
            <input v-model="addForm.amountUsdt" class="input" type="number" step="0.01" min="0" />
          </label>
          <label class="fl">
            <span class="fl-l">Дата</span>
            <input v-model="addForm.eventAt" class="input" type="datetime-local" />
          </label>
          <label class="fl fl-span">
            <span class="fl-l">Комментарий</span>
            <input v-model="addForm.note" class="input" placeholder="опционально" />
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" :disabled="addSaving" @click="addOpen = false">Отмена</button>
          <button type="button" class="btn btn-primary" :disabled="addSaving" @click="submitAdd">
            {{ addSaving ? 'Сохранение…' : 'Сохранить' }}
          </button>
        </div>
      </div>
    </div>

    <FundingPipsImportModal
      v-model:open="importOpen"
      :account-names="propSelectableNames"
      :default-account="selectedAccount"
      @imported="refreshAll"
    />
  </div>
</template>

<style scoped>
.prop-page {
  max-width: 960px;
}
.head-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.head-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.title {
  margin: 0;
  font-size: 1.35rem;
}
.lead {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  line-height: 1.45;
  max-width: 42rem;
}
.account-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.account-filter-lbl {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
}
.account-filter .input {
  min-width: 12rem;
}
.accounts-status {
  margin-bottom: 1rem;
  padding: 0.75rem 0.85rem;
}
.accounts-status-hint {
  margin: 0 0 0.65rem;
  font-size: 0.8125rem;
}
.accounts-status-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.accounts-status-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.accounts-status-name {
  font-weight: 600;
  font-size: 0.875rem;
}
.accounts-status-select {
  min-width: 9rem;
}
.input-compact {
  font-size: 0.8125rem;
  padding: 0.3rem 0.45rem;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.65rem;
  margin-bottom: 1rem;
}
.summary-tile {
  padding: 0.65rem 0.85rem;
}
.summary-tile--wide {
  grid-column: 1 / -1;
}
.summary-lbl {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
  margin-bottom: 0.25rem;
}
.summary-sub {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.72rem;
}
.card + .card {
  margin-top: 1rem;
}
.block-h {
  margin: 0 0 0.35rem;
  font-size: 1rem;
}
.block-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.block-head .block-h {
  margin: 0;
}
.table-wrap {
  overflow-x: auto;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.tbl th,
.tbl td {
  border-bottom: 1px solid var(--border);
  padding: 0.45rem 0.5rem;
  text-align: left;
  vertical-align: middle;
}
.t-when {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
}
.sym-link {
  color: inherit;
  text-decoration: none;
  font-weight: 600;
}
.sym-link:hover {
  text-decoration: underline;
}
.note-cell {
  max-width: 14rem;
  font-size: 0.8125rem;
  color: var(--muted);
}
.kind-badge {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}
.kind-badge--purchase {
  color: #b91c1c;
  background: rgba(185, 28, 28, 0.1);
  border: 1px solid rgba(185, 28, 28, 0.3);
}
.kind-badge--payout {
  color: #166534;
  background: rgba(22, 101, 52, 0.1);
  border: 1px solid rgba(22, 101, 52, 0.3);
}
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
  width: min(520px, 100%);
  padding: 1rem 1.1rem;
}
.modal-title {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
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
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>
