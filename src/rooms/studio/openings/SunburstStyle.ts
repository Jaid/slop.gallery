import type {Rolls, Spread} from './base/OpeningStyle.ts'
import type {Ring} from './lib/cells.ts'

import MotifStyle from './base/MotifStyle.ts'
import {ringCells} from './lib/cells.ts'
import {circle, panes, point} from './lib/polygons.ts'

/** Round openings of long rays round a small round hub, like a wheel’s spokes, more of them the larger the wheel, the rays by chance forking halfway out into twice as many. */
export default class SunburstStyle extends MotifStyle {
  readonly description = 'Wheels of long rays round a small hub'
  readonly id = 'sunburst'
  protected readonly layouts = {
    row: 3,
    flanked: 2,
    medallion: 2,
    staggered: 1,
    grid: 1,
  }
  protected override readonly least = 0.55

  protected motif(rolls: Rolls, reach: Spread) {
    const radius = Math.min(reach.x, reach.y)
    const bar = this.bar(rolls, 0.04, 0.06, radius)
    // About as wide rays at the rim whatever the size, within reason.
    const count = Math.max(8, Math.round(rolls.integer('count', 12, 24) * Math.min(1.8, Math.max(0.5, radius / 1.6))))
    // The rays start where they are wide enough to let light through.
    const hub = Math.max(radius * rolls.between('hub', 0.1, 0.18), count * (bar + this.smallest) / (Math.PI * 2))
    const turn = rolls.between('turn', 0, Math.PI * 2)
    const rings: Array<Ring> = [{
      count: 1,
      inner: 0,
      outer: hub,
      offset: 0,
    }]
    if (rolls.chance('fork', 0.5)) {
      const fork = hub + (radius - hub) * rolls.between('fork-at', 0.4, 0.6)
      rings.push({
        count,
        inner: hub,
        outer: fork,
        offset: turn,
      }, {
        count: count * 2,
        inner: fork,
        outer: radius,
        offset: turn,
      })
    } else {
      rings.push({
        count,
        inner: hub,
        outer: radius,
        offset: turn,
      })
    }
    return panes([circle(point(0, 0), radius)], ringCells(rings), bar, this.smallest)
  }
}
