export type PropAccountStatus = 'active' | 'passed' | 'failed'

export type PropAccountItem = {
  name: string
  status: PropAccountStatus
}

export function propAccountStatusLabel(status: PropAccountStatus) {
  if (status === 'passed') return 'Прошёл'
  if (status === 'failed') return 'Не прошёл'
  return 'В процессе'
}

export function usePropAccountNames() {
  const { data, refresh, pending } = useFetch<{
    accounts: PropAccountItem[]
    names: string[]
    selectableNames: string[]
  }>('/api/prop/accounts', {
    key: 'prop-account-names',
  })
  const accounts = computed(() => data.value?.accounts ?? [])
  const names = computed(() => data.value?.names ?? [])
  /** Аккаунты, доступные при добавлении сделки (без «не прошёл»). */
  const selectableNames = computed(() => data.value?.selectableNames ?? names.value)
  return { accounts, names, selectableNames, refresh, pending }
}
