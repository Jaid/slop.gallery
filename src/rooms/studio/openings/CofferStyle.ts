import type {Rolls, Spread} from './base/OpeningStyle.ts'
import type {Polygons} from './lib/polygons.ts'

import MotifStyle from './base/MotifStyle.ts'
import {gridCells, ringCells} from './lib/cells.ts'
import {outline} from './lib/outlines.ts'
import {panes} from './lib/polygons.ts'

/** A grid of square, round, rounded or diamond roof lights like the Cell’s coffers, or rows of them staggered like bricks, filling the room it has, each split by a cross, an X or, if large enough, a grid of three by three. */
export default class CofferStyle extends MotifStyle {
  readonly description = 'Grid of roof lights, each split by a cross, an X or a grid'
  protected override readonly gaps = [0.12, 0.3] as const
  readonly id = 'coffers'
  protected readonly layouts = {
    grid: 4,
    staggered: 1,
  }
  protected override readonly round = false
  protected override readonly tile = [0.32, 0.7] as const

  protected motif(rolls: Rolls, reach: Spread) {
    const radius = Math.min(reach.x, reach.y)
    const kind = rolls.item('outline', ['square', 'rounded', 'circle', 'diamond'] as const)
    const bar = this.bar(rolls)
    const division = radius >= 0.42 ? rolls.item('division', ['cross', 'x', 'grid'] as const) : rolls.item('division', ['cross', 'x'] as const)
    const cells: Polygons = {
      cross: gridCells(radius, radius * 1.5),
      x: ringCells([{
        count: 4,
        inner: 0,
        outer: radius * 2,
        offset: Math.PI / 4,
      }]),
      grid: gridCells(radius * 2 / 3, radius * 1.5, 0, true),
    }[division]
    return panes(outline(kind, {
      x: radius,
      y: radius,
    }), cells, bar, this.smallest)
  }
}
