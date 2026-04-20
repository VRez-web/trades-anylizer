/** Ключ дня YYYY-MM-DD в локальном времени для даты из ISO-строки. */
export function localDayKeyFromIso(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
