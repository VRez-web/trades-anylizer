export function useBybitSyncLoading() {
  return useState('bybit-sync-overlay', () => ({ active: false }))
}
