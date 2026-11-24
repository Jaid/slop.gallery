import type {Rolls, Spread} from './base/OpeningStyle.ts'
import type {Point, Polygon} from './lib/polygons.ts'

import MotifStyle from './base/MotifStyle.ts'
import {outline} from './lib/outlines.ts'
import {circle, motifsWithin, point} from './lib/polygons.ts'

/** how the holes of a halftone shrink: toward the outline, from one side to the other, or in ripples round the middle */
const halftones = ['none', 'radial', 'linear', 'ripple'] as const

/** A field of round holes packed in a hexagonal grid within a round or angular outline, by chance shrinking like a halftone, one stretched over all the room or several of them. */
export default class PerforatedStyle extends MotifStyle {
  readonly description = 'Perforated field of round holes, by chance a halftone'
  readonly id = 'perforated'
  // No grid, whose many small fields would each keep their holes fine.
  protected readonly layouts = {
    field: 5,
    row: 1,
  }
  protected override readonly stretches = true

  protected motif(rolls: Rolls, reach: Spread) {
    const kind = rolls.item('outline', ['circle', 'hexagon', 'square', 'diamond', 'rounded', 'stadium'] as const)
    // A little coarser over a large field, which would otherwise take thousands of holes.
    const pitch = rolls.between('pitch', 0.14, 0.24) * Math.min(2.2, Math.max(1, Math.sqrt(Math.max(reach.x, reach.y) / 1.6)))
    /** the narrowest web left between two holes */
    const web = 0.035
    const largest = (pitch - web) / 2
    const halftone = rolls.item('halftone', halftones, [4, 3, 2, 1])
    const size = halftone === 'none' ? largest * rolls.between('hole', 0.65, 1) : largest
    const angle = rolls.between('angle', 0, Math.PI * 2)
    const ripples = rolls.between('ripples', 2, 4)
    /** how far out a point lies for the halftone, from 0 where the holes are largest to 1 where smallest */
    const out = ({x, y}: Point) => {
      switch (halftone) {
        case 'none': {
          return 0
        }
        case 'radial': {
          return Math.min(1, Math.hypot(x / reach.x, y / reach.y))
        }
        case 'linear': {
          // Along a rolled direction, from one end of the outline to the other.
          const [along, extent] = [x * Math.cos(angle) + y * Math.sin(angle), Math.abs(reach.x * Math.cos(angle)) + Math.abs(reach.y * Math.sin(angle))]
          return Math.min(1, Math.max(0, (along / extent + 1) / 2))
        }
        case 'ripple': {
          return (1 - Math.cos(Math.min(1, Math.hypot(x / reach.x, y / reach.y)) * ripples * Math.PI * 2)) / 2
        }
      }
    }
    const holes: Array<Polygon> = []
    const rows = Math.ceil(reach.y / (pitch * 0.866))
    const columns = Math.ceil(reach.x / pitch) + 1
    for (let row = -rows; row <= rows; row++) {
      for (let column = -columns; column <= columns; column++) {
        const center = point((column + (row % 2 ? 0.5 : 0)) * pitch, row * pitch * 0.866)
        // A halftone shrinks the holes to a quarter of the largest, ripples only by half, so their rings stay whole, leaving out those too small to let the light through.
        const hole = size * (1 - (halftone === 'ripple' ? 0.5 : 0.75) * out(center) ** 1.6)
        if (hole * 2 >= this.smallest) {
          holes.push(circle(center, hole))
        }
      }
    }
    return motifsWithin(outline(kind, reach), holes, 0)
  }
}
