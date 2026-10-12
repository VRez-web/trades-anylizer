export const labelKinds = ['system', 'technique', 'psychology', 'other'] as const
export type LabelKind = (typeof labelKinds)[number]

export const labelKindTitles: Record<LabelKind, string> = {
  system: 'Система',
  technique: 'Техника',
  psychology: 'Психология',
  other: 'Общие',
}

export function emptyLabelPack<T>(): Record<LabelKind, T[]> {
  return { system: [], technique: [], psychology: [], other: [] }
}
