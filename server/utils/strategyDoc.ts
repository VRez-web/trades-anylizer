export type StrategySystemItem = {
  asset: string
  markdown: string
}

type StrategyDocPayload = {
  version: 1
  activeAsset: string
  systems: StrategySystemItem[]
}

const FALLBACK_ASSET = 'GENERAL'

function normalizeAsset(raw: unknown): string {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase()
  return s || FALLBACK_ASSET
}

function normalizeSystems(raw: unknown): StrategySystemItem[] {
  if (!Array.isArray(raw)) return []
  const out: StrategySystemItem[] = []
  const seen = new Set<string>()
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const obj = row as { asset?: unknown; markdown?: unknown }
    const asset = normalizeAsset(obj.asset)
    if (seen.has(asset)) continue
    seen.add(asset)
    out.push({
      asset,
      markdown: String(obj.markdown ?? ''),
    })
  }
  return out
}

export function decodeStrategyDoc(markdownRaw: string | null | undefined): {
  systems: StrategySystemItem[]
  activeAsset: string
} {
  const raw = String(markdownRaw ?? '')
  try {
    const parsed = JSON.parse(raw) as Partial<StrategyDocPayload>
    if (parsed?.version === 1) {
      const systems = normalizeSystems(parsed.systems)
      if (systems.length) {
        const active = normalizeAsset(parsed.activeAsset)
        const activeAsset = systems.some((x) => x.asset === active) ? active : systems[0].asset
        return { systems, activeAsset }
      }
    }
  } catch {
    /* legacy markdown format */
  }
  return {
    systems: [{ asset: FALLBACK_ASSET, markdown: raw }],
    activeAsset: FALLBACK_ASSET,
  }
}

export function encodeStrategyDoc(systemsRaw: StrategySystemItem[], activeAssetRaw: string): string {
  let systems = normalizeSystems(systemsRaw)
  if (!systems.length) {
    systems = [{ asset: FALLBACK_ASSET, markdown: '' }]
  }
  const active = normalizeAsset(activeAssetRaw)
  const activeAsset = systems.some((x) => x.asset === active) ? active : systems[0].asset
  const payload: StrategyDocPayload = {
    version: 1,
    activeAsset,
    systems,
  }
  return JSON.stringify(payload)
}
