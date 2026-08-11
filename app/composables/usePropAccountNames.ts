export function usePropAccountNames() {
  const { data, refresh, pending } = useFetch<{ names: string[] }>('/api/prop/accounts', {
    key: 'prop-account-names',
  })
  const names = computed(() => data.value?.names ?? [])
  return { names, refresh, pending }
}
