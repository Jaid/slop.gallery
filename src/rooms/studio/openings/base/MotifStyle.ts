import type {LayoutOptions, Slot} from '../lib/layouts.ts'
import type {Polygons} from '../lib/polygons.ts'
import type {Rolls, Spread} from './OpeningStyle.ts'

import {field, flanked, grid, medallion, row, staggered} from '../lib/layouts.ts'
import {translate} from '../lib/polygons.ts'
import OpeningStyle from './OpeningStyle.ts'

/** the ways a pattern may lay its motifs out over the room it has, see `lib/layouts.ts` */
export const layoutKinds = ['field', 'row', 'grid', 'staggered', 'flanked', 'medallion'] as const
export type LayoutKind = typeof layoutKinds[number]

/**
 * A kind of openings made of motifs, such as rose windows, laid out to cover the room they have: one stretched over all of it, side by side, in a grid, in staggered rows, a large one flanked by smaller ones or one in the middle with one in each corner, as the seed rolls among the ways the kind allows that fit the room.
 * Every motif of a pattern is made from the same rolls, scaled to its size.
 */
export default abstract class MotifStyle extends OpeningStyle {
  /** the range seeds roll the least room between two motifs in, in meters */
  protected readonly gaps: readonly [min: number, max: number] = [0.25, 0.5]
  /** how often seeds lay the motifs out each way compared with the others; a way not listed never */
  protected abstract readonly layouts: Partial<Record<LayoutKind, number>>
  /** how far the smallest motif of a flank or a corner may still reach */
  protected readonly least: number = 0.45
  /** whether a motif keeps within the circle of its reach, which staggered rows and corners round a medallion need; unless said otherwise, the motifs that don’t stretch do */
  protected readonly round?: boolean
  /** whether a motif fills a reach longer one way than the other, rather than only a square of its shorter side, which a field needs */
  protected readonly stretches: boolean = false
  /** the range seeds roll how far the motifs of a grid or staggered rows would like to reach in */
  protected readonly tile: readonly [min: number, max: number] = [0.7, 1.5]

  make(rolls: Rolls, spread: Spread): Polygons {
    const options: LayoutOptions = {
      gap: rolls.between('gap', ...this.gaps),
      least: this.least,
      round: this.round ?? !this.stretches,
      stretches: this.stretches,
      wanted: rolls.between('tile', ...this.tile),
    }
    const ways: Record<LayoutKind, () => Array<Slot> | undefined> = {
      field: () => field(spread, options),
      row: () => row(spread, options),
      grid: () => grid(spread, options),
      staggered: () => staggered(spread, options),
      flanked: () => flanked(spread, options),
      medallion: () => medallion(spread, options, rolls.between('medallion', 0.8, 1)),
    }
    const fitting: Array<{
      slots: Array<Slot>
      weight: number
    }> = []
    for (const kind of layoutKinds) {
      const weight = this.layouts[kind]
      const slots = weight ? ways[kind]() : undefined
      if (weight && slots) {
        fitting.push({
          slots,
          weight,
        })
      }
    }
    const slots = fitting.length ? rolls.item('layout', fitting, fitting.map(way => way.weight)).slots : row(spread, options)
    // Motifs of the same size come out the same, so each size is made once.
    const made = new Map<string, Polygons>
    return slots.flatMap(({middle, reach}) => {
      const key = `${reach.x}:${reach.y}`
      const motif = made.get(key) ?? this.motif(rolls, reach)
      made.set(key, motif)
      return translate(motif, middle)
    })
  }

  /** One motif centered on the origin, reaching out to `reach` from it and no farther, or only to the shorter of its sides either way unless the kind stretches. */
  protected abstract motif(rolls: Rolls, reach: Spread): Polygons
}
