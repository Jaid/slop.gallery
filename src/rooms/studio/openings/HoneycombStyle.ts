import type {Rolls, Spread} from './base/OpeningStyle.ts'

import MotifStyle from './base/MotifStyle.ts'
import {hexCells, triangleCells} from './lib/cells.ts'
import {outline} from './lib/outlines.ts'
import {panes} from './lib/polygons.ts'

/** Openings glazed in hexagonal panes like a honeycomb, or by chance in triangles, in a hexagonal, round, rounded or stadium frame, one stretched over all the room or several of them. */
export default class HoneycombStyle extends MotifStyle {
  readonly description = 'Honeycomb or triangle panes in a hexagon, circle or stadium'
  readonly id = 'honeycomb'
  protected readonly layouts = {
    field: 4,
    row: 1,
    flanked: 1,
    staggered: 1,
  }
  protected override readonly stretches = true

  protected motif(rolls: Rolls, reach: Spread) {
    const bar = this.bar(rolls)
    const frame = rolls.chance('hexagonal', 0.6) ? 'hexagon' : rolls.item('frame', ['circle', 'rounded', 'stadium'] as const)
    const triangles = rolls.chance('triangles', 0.3)
    // A cell from its middle to a corner, so that even a small frame holds a few across.
    const cell = Math.min(rolls.between('cell', 0.25, 0.5), Math.min(reach.x, reach.y) / 2.2)
    const cover = Math.hypot(reach.x, reach.y)
    return panes(outline(frame, reach), triangles ? triangleCells(cell * 2.4, cover) : hexCells(cell, cover), bar, this.smallest)
  }
}
