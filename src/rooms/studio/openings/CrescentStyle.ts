import type {Rolls, Spread} from './base/OpeningStyle.ts'
import type {Point, Polygon} from './lib/polygons.ts'

import OpeningStyle from './base/OpeningStyle.ts'
import {circle, narrowerThan, point, star, subtract, trim} from './lib/polygons.ts'

/** A crescent moon nearly as large as the room is deep, off to one side, among five-pointed stars strewn over the rest of the room, which casts the moon’s own picture onto the floor. */
export default class CrescentStyle extends OpeningStyle {
  readonly description = 'Crescent moon among five-pointed stars'
  readonly id = 'crescent'
  override readonly weight = 0.5

  make(rolls: Rolls, spread: Spread) {
    const [long, short] = spread.x >= spread.y ? [spread.x, spread.y] : [spread.y, spread.x]
    const moon = short * rolls.between('moon', 0.7, 0.95)
    // Off to one side along the longer axis, some way across, but whole.
    const along = (long - moon) * rolls.between('along', 0.25, 0.85) * (rolls.chance('side', 0.5) ? 1 : -1)
    const across = (short - moon) * rolls.between('across', -1, 1)
    const middle = spread.x >= spread.y ? point(along, across) : point(across, along)
    const bite = moon * rolls.between('bite', 0.78, 0.9)
    const away = rolls.between('away', 0.35, 0.55) * moon
    const turn = rolls.between('turn', 0, Math.PI * 2)
    const crescent = subtract([circle(middle, moon)], [circle(point(middle.x + Math.cos(turn) * away, middle.y + Math.sin(turn) * away), bite)])
    // The horns thin out to nothing, which the light would only blur, so they end where they get too narrow.
    const moonlit = trim(crescent, this.smallest)
    const stars: Array<Polygon> = []
    // The stars keep off the moon’s whole disc, its dark part too.
    const taken: Array<{
      center: Point
      size: number
    }> = [{
      center: middle,
      size: moon,
    }]
    const count = Math.round(spread.x * spread.y * 4 * rolls.between('stars', 0.3, 0.7))
    for (let index = 0; index < count * 30 && stars.length < count; index++) {
      const draw = rolls.child(['star', index])
      const size = draw.between('size', 0.08, 0.2)
      const center = point(draw.between('x', -spread.x + size, spread.x - size), draw.between('y', -spread.y + size, spread.y - size))
      if (!taken.every(other => Math.hypot(other.center.x - center.x, other.center.y - center.y) > other.size + size + 0.15)) {
        continue
      }
      taken.push({
        center,
        size,
      })
      stars.push(star(5, size, size * 0.42, draw.between('turn', 0, Math.PI * 2), center))
    }
    return [...moonlit.filter(piece => !narrowerThan(piece, this.smallest)), ...stars]
  }
}
