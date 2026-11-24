import type {Rolls, Spread} from './base/OpeningStyle.ts'
import type {Ring} from './lib/cells.ts'

import MotifStyle from './base/MotifStyle.ts'
import {ringCells} from './lib/cells.ts'
import {circle, panes, point} from './lib/polygons.ts'

/** Concentric rings round a round middle like a target or a labyrinth, more of them the larger it is, each ring broken by a few bridges, every other ring’s bridges turned halfway between the last one’s. */
export default class RingStyle extends MotifStyle {
  readonly description = 'Concentric broken rings like a target or labyrinth'
  readonly id = 'rings'
  protected readonly layouts = {
    row: 2,
    flanked: 2,
    medallion: 2,
    staggered: 2,
    grid: 2,
  }
  protected override readonly least = 0.55

  protected motif(rolls: Rolls, reach: Spread) {
    const radius = Math.min(reach.x, reach.y)
    const bar = this.bar(rolls, 0.05, 0.08, radius)
    // About as wide rings whatever the size, two at the least.
    const count = Math.max(2, Math.round(rolls.integer('rings', 3, 5) * Math.min(1.6, Math.sqrt(radius / 1.6))))
    const bridges = rolls.integer('bridges', 3, 6)
    const core = radius * rolls.between('core', 0.12, 0.22)
    const turn = rolls.between('turn', 0, Math.PI * 2)
    const rings: Array<Ring> = [{
      count: 1,
      inner: 0,
      outer: core,
      offset: 0,
    }]
    for (let ring = 0; ring < count; ring++) {
      rings.push({
        count: bridges,
        inner: core + (radius - core) * ring / count,
        outer: core + (radius - core) * (ring + 1) / count,
        offset: turn + (ring % 2 ? Math.PI / bridges : 0),
      })
    }
    return panes([circle(point(0, 0), radius)], ringCells(rings), bar, this.smallest)
  }
}
