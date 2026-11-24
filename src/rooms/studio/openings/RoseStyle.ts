import type {Rolls, Spread} from './base/OpeningStyle.ts'
import type {Ring} from './lib/cells.ts'

import MotifStyle from './base/MotifStyle.ts'
import {ringCells} from './lib/cells.ts'
import {circle, panes, point} from './lib/polygons.ts'

/** Rose windows: each a round opening divided round a round hub into two or three rings of sectors, fewer in a small one, each ring split twice as finely as the one inside it, its outermost ring by chance a wreath of round oculi instead. */
export default class RoseStyle extends MotifStyle {
  readonly description = 'Rose windows round a hub, ringed by sectors and by chance oculi'
  readonly id = 'rose'
  protected readonly layouts = {
    row: 3,
    flanked: 3,
    medallion: 3,
    staggered: 1,
    grid: 1,
  }
  protected override readonly least = 0.6

  protected motif(rolls: Rolls, reach: Spread) {
    const radius = Math.min(reach.x, reach.y)
    const bar = this.bar(rolls, undefined, undefined, radius)
    const hub = radius * rolls.between('hub', 0.14, 0.22)
    // A small rose has no room for many rings.
    const tiers = Math.min(rolls.item('tiers', [2, 2, 3]), radius < 0.8 ? 1 : (radius < 1.3 ? 2 : 3))
    const count = rolls.item('count', [6, 8, 10, 12])
    const turn = rolls.between('turn', 0, Math.PI * 2)
    const oculi = rolls.chance('oculi', 0.45)
    // The rings’ edges, from the hub out, the inner ones a little narrower than the outer.
    const edges = [hub, ...Array.from({length: tiers}, (_, index) => hub + (radius - hub) * ((index + 1) / tiers) ** 0.9)]
    const rings: Array<Ring> = [{
      count: 1,
      inner: 0,
      outer: hub,
      offset: 0,
    }]
    for (let tier = 0; tier < tiers; tier++) {
      // Doubling three times over would split the outermost ring too finely to see.
      const sectors = Math.min(count * 2 ** tier, 32)
      rings.push({
        count: sectors,
        inner: edges[tier],
        outer: edges[tier + 1],
        offset: turn + (tier % 2 ? Math.PI / sectors : 0),
      })
    }
    if (!oculi) {
      return panes([circle(point(0, 0), radius)], ringCells(rings), bar, this.smallest)
    }
    // The outermost ring gives way to oculi, as many as its sectors would have been, each as large as fits between its neighbors and the ring’s edges.
    const wreath = rings.pop()!
    const middle = (wreath.inner + wreath.outer) / 2
    const size = Math.min((wreath.outer - wreath.inner) / 2, middle * Math.sin(Math.PI / wreath.count)) - bar / 2
    const inner = panes([circle(point(0, 0), wreath.inner + bar / 2)], ringCells(rings), bar, this.smallest)
    const around = Array.from({length: wreath.count}, (_, index) => {
      const angle = wreath.offset + (index + 0.5) / wreath.count * Math.PI * 2
      return circle(point(Math.cos(angle) * middle, Math.sin(angle) * middle), size)
    })
    return [...inner, ...around]
  }
}
