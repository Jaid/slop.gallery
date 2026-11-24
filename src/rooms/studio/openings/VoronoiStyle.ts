import type {Rolls, Spread} from './base/OpeningStyle.ts'
import type {Point} from './lib/polygons.ts'

import MotifStyle from './base/MotifStyle.ts'
import {relax, voronoiCells} from './lib/cells.ts'
import {outline} from './lib/outlines.ts'
import {contains, panes, point, rectangle} from './lib/polygons.ts'

/** Openings divided into irregular panes like cracked glass or leaves, each pane the cell of a site strewn over the opening, evened out a little, one stretched over all the room or a few of them. */
export default class VoronoiStyle extends MotifStyle {
  readonly description = 'Irregular cells like cracked glass or leaves'
  readonly id = 'voronoi'
  protected readonly layouts = {
    field: 5,
    row: 1,
    flanked: 1,
  }
  protected override readonly stretches = true

  protected motif(rolls: Rolls, reach: Spread) {
    const bar = this.bar(rolls, 0.04, 0.07)
    // A little coarser over a large field, which would otherwise take a thousand cells and more.
    const cell = rolls.between('cell', 0.24, 0.42) * Math.min(2.2, Math.max(1, Math.sqrt(Math.max(reach.x, reach.y) / 1.6)))
    const frame = outline(rolls.item('outline', ['circle', 'rounded', 'stadium', 'octagon'] as const), reach)
    // Sites on a hexagonal lattice, each strayed up to a third of the spacing, kept where they lie inside the opening.
    const sites: Array<Point> = []
    const strays = rolls.child('sites')
    const rows = Math.ceil(reach.y / (cell * 0.866))
    const columns = Math.ceil(reach.x / cell)
    for (let row = -rows; row <= rows; row++) {
      for (let column = -columns; column <= columns; column++) {
        const site = point((column + (row % 2 ? 0.5 : 0)) * cell + strays.between([row, column, 'x'], -cell / 3, cell / 3), row * cell * 0.866 + strays.between([row, column, 'y'], -cell / 3, cell / 3))
        if (contains(frame, site)) {
          sites.push(site)
        }
      }
    }
    const bounds = rectangle(point(0, 0), reach.x * 2, reach.y * 2)
    return panes(frame, voronoiCells(relax(sites, bounds, 1), bounds), bar, this.smallest)
  }
}
