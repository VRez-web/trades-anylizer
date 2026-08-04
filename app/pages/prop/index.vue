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
  series: { t: string; net: number; cumulative: number }[]
}

const { fmtUsdt, fmtSignedUsdt } = useMoney()

const { data: events, refresh: refreshEvents } = await useFetch<PropEvent[]>('/api/prop/events')
const { data: stats, refresh: refreshStats } = await useFetch<PropStats>('/api/prop/stats')

async function refreshAll() {
  await Promise.all([refreshEvents(), refreshStats()])
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
  addForm.accountName = ''
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

const equityPoints = computed(() => {
  return (stats.value?.series ?? []).map((p) => ({ t: p.t, cumulative: p.cumulative }))
})

const accountNames = computed(() => {
  const set = new Set<string>()
  for (const e of events.value ?? []) set.add(e.accountName)
  return [...set].sort()
})
</script>

<template>
  <div class="page prop-page">
    <div class="head-row">
      <h1 class="title">Проп-аккаунты</h1>
      <button type="button" class="btn btn-primary" @click="openAdd">+ Покупка / выплата</button>
    </div>

    <p class="muted lead">
      Покупки и выплаты проп-счетов учитываются отдельно. Сделки с источником «Проп» не попадают в основную кривую
      доходности на странице «Сделки».
    </p>

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
        <span class="muted summary-sub">{{ stats.summary.tradesCount }} сделок</span>
      </div>
      <div class="card summary-tile summary-tile--wide">
        <div class="summary-lbl">Итого по пропу</div>
        <strong :class="stats.summary.combinedNet >= 0 ? 'pos' : 'neg'">{{
          fmtSignedUsdt(stats.summary.combinedNet)
        }}</strong>
        <span class="muted summary-sub">выплаты − покупки + PnL сделок</span>
      </div>
    </div>

    <div class="card chart-block">
      <h2 class="block-h">Кривая денежных потоков</h2>
      <p class="muted block-note">Только покупки и выплаты (без торгового PnL).</p>
      <ClientOnly>
        <EquityChart v-if="equityPoints.length" :points="equityPoints" />
        <p v-else class="muted">Пока нет записей — добавьте покупку или выплату.</p>
      </ClientOnly>
    </div>

    <div class="card">
      <div class="block-head">
        <h2 class="block-h">Записи</h2>
        <NuxtLink to="/trades/list?tradeSource=prop" class="btn btn-tiny">Проп-сделки в списке</NuxtLink>
      </div>
      <p v-if="accountNames.length" class="muted accounts-line">
        Аккаунты: {{ accountNames.join(', ') }}
      </p>
      <div v-if="!events?.length" class="muted">Нет записей</div>
      <div v-else class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Тип</th>
              <th>Аккаунт</th>
              <th>Сумма</th>
              <th>Комментарий</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in events" :key="e.id">
              <td class="t-when">{{ fmtWhen(e.eventAt) }}</td>
              <td>
                <span class="kind-badge" :class="`kind-badge--${e.kind}`">{{ kindLabel(e.kind) }}</span>
              </td>
              <td>{{ e.accountName }}</td>
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
            <input v-model="addForm.accountName" class="input" placeholder="FTMO 100k" />
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
.chart-block {
  margin-bottom: 1rem;
  padding: 0.85rem 1rem;
}
.block-h {
  margin: 0 0 0.35rem;
  font-size: 1rem;
}
.block-note {
  margin: 0 0 0.75rem;
  font-size: 0.8125rem;
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
.accounts-line {
  margin: 0 0 0.65rem;
  font-size: 0.8125rem;
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
