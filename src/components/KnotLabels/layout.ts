import type {KnotEntry} from 'knot-materials'

import flattenString from 'flatten-string'

/** what a nameplate shows: its Knot under a label, like Knottingham’s exhibit numbers */
export type KnotLabel = Pick<KnotEntry, 'author' | 'harness' | 'id' | 'modelTitle' | 'placeholder' | 'rarity' | 'title'> & {
  candidate?: {icon?: string}
  label: string
}

export const labelAtlasColumns = 10
// Keep at least 800 texels per meter for legible text, within the 8192 px atlas limit.
export const labelWidth = 720
export const labelHeight = 480
export const labelBackground = '#122029'

/** where the face of the sign at `index` lies in the atlas, in its logical pixels */
export function labelTile(index: number) {
  return {
    x: index % labelAtlasColumns * labelWidth,
    y: Math.floor(index / labelAtlasColumns) * labelHeight,
  }
}

export function knotDetailLine(harness?: string, effortLevel?: string) {
  return flattenString.list(harness === 'none' ? 'non-agentic' : harness, effortLevel && `${effortLevel} effort`)
}
