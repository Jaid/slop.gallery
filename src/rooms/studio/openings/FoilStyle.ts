import type {Rolls, Spread} from './base/OpeningStyle.ts'

import MotifStyle from './base/MotifStyle.ts'
import {ringCells} from './lib/cells.ts'
import {circle, panes, point, regular, unite} from './lib/polygons.ts'

/** Foiled openings after Gothic tracery, trefoils to sexfoils of round lobes round a middle, plain or divided between the lobes, laid out in a row, a grid, staggered rows or round a larger one. */
export default class FoilStyle extends MotifStyle {
  readonly description = 'Trefoils, quatrefoils and more, in rows, grids or round a larger one'
  readonly id = 'foils'
  protected readonly layouts = {
    row: 2,
    grid: 3,
    staggered: 2,
    flanked: 1,
    medallion: 1,
  }
  protected override readonly tile = [0.45, 1.1] as const

  protected motif(rolls: Rolls, reach: Spread) {
    const radius = Math.min(reach.x, reach.y)
    const lobes = rolls.item('lobes', [3, 4, 4, 5, 6])
    const bar = this.bar(rolls, undefined, undefined, radius)
    // How far the lobes’ middles stand out, as a share of the foil’s reach, little enough that neighboring lobes overlap.
    const stand = rolls.between('stand', 0.38, 0.5)
    const turn = rolls.chance('turn', 0.5) ? Math.PI / lobes : 0
    const out = radius * stand
    const lobe = radius - out
    // The middle is filled up to the cusps where neighboring lobes meet, halfway between them.
    const half = Math.PI / lobes
    const cusp = out * Math.cos(half) + Math.sqrt(lobe ** 2 - (out * Math.sin(half)) ** 2)
    const shape = unite([regular(lobes, cusp, turn + half), ...Array.from({length: lobes}, (_, index) => {
      const angle = turn + index / lobes * Math.PI * 2
      return circle(point(Math.cos(angle) * out, Math.sin(angle) * out), lobe)
    })])
    if (!rolls.chance('divided', 0.65)) {
      return shape
    }
    // Bars run out from the middle between the lobes.
    return panes(shape, ringCells([{
      count: lobes,
      inner: 0,
      outer: radius * 1.5,
      offset: turn + Math.PI / lobes,
    }]), bar, this.smallest)
  }
}
