import type {Rolls, Spread} from './base/OpeningStyle.ts'
import type {Point, Polygon} from './lib/polygons.ts'

import MotifStyle from './base/MotifStyle.ts'
import {circle, ellipse, point, rotate} from './lib/polygons.ts'

/** the golden angle, by which each seed of a sunflower’s head turns from the last */
const goldenAngle = Math.PI * (3 - Math.sqrt(5))

/** Holes spiraling out from the middle like the seeds of a sunflower’s head, growing outward, round or by chance stretched into petals along their spokes, larger in a larger head. */
export default class SunflowerStyle extends MotifStyle {
  readonly description = 'Sunflower spirals of growing holes or petals'
  readonly id = 'sunflower'
  protected readonly layouts = {
    row: 3,
    flanked: 2,
    medallion: 2,
    staggered: 1,
  }

  protected motif(rolls: Rolls, reach: Spread) {
    const radius = Math.min(reach.x, reach.y)
    const scale = Math.min(1.5, Math.max(0.8, Math.sqrt(radius / 1.6)))
    const [smallest, largest] = [rolls.between('smallest', 0.04, 0.05) * scale, rolls.between('largest', 0.065, 0.1) * scale]
    const petals = rolls.chance('petals', 0.4)
    /** how far apart the seeds lie, as a factor on their size, which keeps a web between them */
    const spacing = rolls.between('spacing', 1.15, 1.45)
    // Vogel’s spiral puts seed n at √n steps out; its neighbors lie about 1.6 steps apart there.
    const step = (largest * 2 * spacing + 0.035) / 1.6
    const count = Math.floor(((radius - largest * 1.6) / step) ** 2)
    const holes: Array<Polygon> = []
    const placed: Array<{
      center: Point
      size: number
    }> = []
    const turn = rolls.between('turn', 0, Math.PI * 2)
    for (let index = 1; index <= count; index++) {
      const out = Math.sqrt(index) * step
      const angle = turn + index * goldenAngle
      const size = smallest + (largest - smallest) * Math.sqrt(index / count)
      const center = point(Math.cos(angle) * out, Math.sin(angle) * out)
      // Petals reach half as far again along their spokes, so they keep clear of each other by that reach.
      const extent = petals ? size * 1.6 : size
      if (!placed.every(other => Math.hypot(other.center.x - center.x, other.center.y - center.y) > other.size + extent + 0.035)) {
        continue
      }
      placed.push({
        center,
        size: extent,
      })
      holes.push(petals ? rotate([ellipse(point(0, 0), extent, size * 0.75)], angle, center)[0] : circle(center, size))
    }
    return holes
  }
}
