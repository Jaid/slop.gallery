import type {Rolls, Spread} from './base/OpeningStyle.ts'
import type {Point, Polygon} from './lib/polygons.ts'

import OpeningStyle from './base/OpeningStyle.ts'
import {circle, point, star} from './lib/polygons.ts'

/** the sizes of the holes, radii in meters, and how often each is strewn compared with the others */
const sizes = [0.04, 0.055, 0.08, 0.11] as const
const sizeWeights = [5, 3, 2, 1] as const
/** where the holes are strewn: evenly over an oval or over the whole room, or thickest along a band across it like the Milky Way */
const skies = ['oval', 'field', 'band'] as const

/** Holes of a few sizes strewn over the room it has like stars, the largest by chance twinkling with four points, which scatter a starry sky of light over the floor. */
export default class ConstellationStyle extends OpeningStyle {
  readonly description = 'Starry scatter of small holes, by chance a Milky Way'
  readonly id = 'constellation'
  override readonly weight = 0.8

  make(rolls: Rolls, spread: Spread) {
    const sky = rolls.item('sky', skies, [2, 2, 3])
    const density = rolls.between('density', 0.6, 1.4)
    const twinkle = rolls.chance('twinkle', 0.5)
    // The band crosses the middle at a slant, about a third as wide as the room is deep.
    const slant = rolls.between('slant', -0.6, 0.6) + (spread.x >= spread.y ? 0 : Math.PI / 2)
    const band = Math.min(spread.x, spread.y) * rolls.between('band', 0.25, 0.45)
    /** how likely a hole drawn at a point is kept */
    const kept = ({x, y}: Point) => (sky === 'band' ? 0.12 + 0.88 * Math.exp(-(((-x * Math.sin(slant) + y * Math.cos(slant)) / band) ** 2)) : 1)
    const placed: Array<{
      center: Point
      size: number
    }> = []
    // Placed holes by the square half a meter wide they lie in, which no two holes keep farther apart than.
    const near = new Map<string, typeof placed>
    const square = ({x, y}: Point) => [Math.floor(x / 0.5), Math.floor(y / 0.5)] as const
    const tries = Math.round(spread.x * spread.y * 4 * 15 * density * (sky === 'band' ? 1.6 : 1))
    /** Whether a hole of `size` twinkles, reaching half as far again with its points. */
    const twinkles = (size: number) => twinkle && size === sizes.at(-1)
    for (let index = 0; index < tries; index++) {
      const draw = rolls.child(['star', index])
      const size = draw.item('size', sizes, sizeWeights)
      const extent = twinkles(size) ? size * 1.5 : size
      // Evenly over the oval or the room, all of it inside.
      const [width, depth] = [spread.x - extent, spread.y - extent]
      let center: Point
      if (sky === 'oval') {
        const angle = draw.between('angle', 0, Math.PI * 2)
        const out = Math.sqrt(draw.between('out', 0, 1))
        center = point(Math.cos(angle) * out * width, Math.sin(angle) * out * depth)
      } else {
        center = point(draw.between('x', -width, width), draw.between('y', -depth, depth))
      }
      if (draw.between('kept', 0, 1) > kept(center)) {
        continue
      }
      // Each keeps clear of the others by at least its own size, more where both are large.
      const [column, row] = square(center)
      const neighbors = [-1, 0, 1].flatMap(dx => [-1, 0, 1].flatMap(dy => near.get(`${column + dx},${row + dy}`) ?? []))
      if (!neighbors.every(other => Math.hypot(other.center.x - center.x, other.center.y - center.y) > (other.size + size) * 1.8 + 0.06)) {
        continue
      }
      const hole = {
        center,
        size,
      }
      placed.push(hole)
      near.set(`${column},${row}`, [...near.get(`${column},${row}`) ?? [], hole])
    }
    return placed.map(({center, size}): Polygon => (twinkles(size) ? star(4, size * 1.5, size * 0.55, Math.PI / 4, center) : circle(center, size)))
  }
}
