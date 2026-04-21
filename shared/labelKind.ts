export const labelKinds = ['system', 'technique', 'psychology'] as const
export type LabelKind = (typeof labelKinds)[number]
