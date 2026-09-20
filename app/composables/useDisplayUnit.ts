export type DisplayUnit = 'usdt' | 'pct'

const STORAGE_KEY = 'trades-analyzer:display-unit'

export function useDisplayUnit() {
  const unit = useState<DisplayUnit>('display-unit', () => 'usdt')
  const basis = useState<number | null>('display-unit-basis', () => null)

  function setUnit(next: DisplayUnit) {
    unit.value = next
    if (import.meta.client) localStorage.setItem(STORAGE_KEY, next)
  }

  function toggleUnit() {
    setUnit(unit.value === 'usdt' ? 'pct' : 'usdt')
  }

  function setBasis(n: number | null | undefined) {
    basis.value = n != null && Number.isFinite(n) && n > 0 ? n : null
  }

  if (import.meta.client) {
    onMounted(() => {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw === 'pct' || raw === 'usdt') unit.value = raw
    })
  }

  return { unit, basis, setUnit, toggleUnit, setBasis }
}
