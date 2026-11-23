import type {Node} from 'three/webgpu'

import {color, float, hash, max, min, mix, mx_noise_float, normalWorldGeometry, positionWorld, select, vec2, vec3} from 'three/tsl'

import {heightNormal, inside, visibleDetail} from './filters.ts'
import PlanarMirrorMaterial from './PlanarMirrorMaterial.ts'

/** One mix of terrazzo: the color of the cement binder and the marble chips scattered through it, as sRGB hex strings. */
export type TerrazzoMix = {
  binder: string
  /** the chips’ colors, drawn evenly at random, so a color listed twice shows twice as often */
  chips: ReadonlyArray<string>
}
/** the room’s floor plan, which the border is measured from: the size of a rectangular one between its walls’ center lines, or the radius of a round one’s wall’s center line */
export type TerrazzoPlan = {
  radius: number
} | {
  size: readonly [number, number]
}
export type TerrazzoFloorOptions = TerrazzoPlan & {
  /** the mix of the border along the walls, if any; see `inset` */
  border?: TerrazzoMix
  /** the middle of the room’s floor plan in world x/z */
  center: readonly [number, number]
  field: TerrazzoMix
  /** extra share of the mirror at grazing angles */
  grazingStrength?: number
  /** how far from the walls’ center lines the field begins and the border ends */
  inset?: number
  /** mip level the mirror is read at, 0 being its full resolution */
  loss?: number
  /** whether the polished floor mirrors the room (heavy mode) */
  reflections?: boolean
  /** roughness of the polished floor in heavy mode */
  roughness?: number
  seed?: number
  /** share of the mirror when looking straight down */
  strength?: number
}

type Float = Node<'float'>

/** Warm Venetian terrazzo: an ivory binder with mostly Carrara white and cream chips, set off by rosso Verona, giallo, nero and verde Alpi. */
export const venetianTerrazzo: TerrazzoMix = {
  binder: '#d9cfbc',
  chips: ['#f1ece2', '#e6dccb', '#f1ece2', '#ddd0b8', '#a8473a', '#c39a5a', '#26221f', '#6f7d6a', '#f1ece2', '#e6dccb'],
}

/** Dark terrazzo for a border: a near-black binder with white, carnelian and ochre chips. */
export const blackTerrazzo: TerrazzoMix = {
  binder: '#26211f',
  chips: ['#ece6da', '#9d3b2c', '#c99a4b', '#ece6da', '#565250', '#b8ad98'],
}

/** The chips come in three sizes, each scattered over cells of its own size, in meters, one chip per cell; a cell may stay empty. */
const chipCells = {
  large: 0.2,
  coarse: 0.085,
  fine: 0.032,
} as const
/** spacing of the brass divider strips in meters, from the room’s middle, and their half-width */
const strips = {
  spacing: 1.2,
  halfWidth: 0.0025,
} as const
/**
 * Which chip of a layer lies nearest to the point, in cells of `cell` meters over the world x/z `point`: its signed distance in radii of the chip, negative inside it, and a random pick for its color.
 * A cell holds a chip with the chance of `density`, an irregular shard: a pentagon of random size, stretch and turn whose sides are each cut a little off the regular. The nearest of the nine cells around the point wins.
 */
function chipLayer(point: Node<'vec2'>, cell: number, seed: number, name: string, {density = 1, size = [0.2, 0.4]}: {
  /** share of the cells that hold a chip */
  density?: number
  /** smallest and largest radius in cells */
  size?: readonly [number, number]
} = {}) {
  const scaled = point.div(cell).toVar(`${name}Scaled`)
  const base = scaled.floor().toVar(`${name}Cell`)
  let nearest: Float = float(10)
  let pick: Float = float(0)
  for (const dx of [-1, 0, 1]) {
    for (const dz of [-1, 0, 1]) {
      const id = base.add(vec2(dx, dz))
      // Hashes need non-negative seeds below 2²⁴; the offset keeps every cell of a ±500 m floor positive.
      const key = id.x.mul(1021).add(id.y).add(900_013 + seed * 7919)
      const random = (stream: number) => hash(key.add(stream * 1_048_573))
      const center = id.add(vec2(random(1), random(2)).mul(0.8).add(0.1))
      const local = scaled.sub(center)
      const angle = random(3).mul(Math.PI * 2)
      const turned = vec2(local.x.mul(angle.cos()).add(local.y.mul(angle.sin())), local.y.mul(angle.cos()).sub(local.x.mul(angle.sin())))
      const stretch = random(4).mul(0.5).add(0.5)
      const radius = random(5).mul(size[1] - size[0]).add(size[0])
      const squashed = vec2(turned.x, turned.y.div(stretch))
      // A sawn shard: the farthest of five split planes round it, each turned a little off the regular pentagon.
      let polygon: Float = float(-10)
      for (let side = 0; side < 5; side++) {
        const direction = random(10 + side).sub(0.5).mul(0.9).add(side * Math.PI * 2 / 5)
        const reach = random(20 + side).mul(0.3).add(0.85)
        polygon = max(polygon, squashed.dot(vec2(direction.cos(), direction.sin())).div(reach))
      }
      const present = random(9).lessThan(density)
      const distance = select(present, polygon.div(radius).sub(1), float(10))
      const closer = distance.lessThan(nearest)
      pick = select(closer, random(8), pick)
      nearest = select(closer, distance, nearest)
    }
  }
  return {
    distance: nearest.toVar(`${name}Distance`),
    pick: pick.toVar(`${name}Pick`),
  }
}
/** The chip color of the mix that a pick between 0 and 1 draws. */
function chipColor({chips}: TerrazzoMix, pick: Float) {
  let result: Node<'color'> = color(chips[0])
  for (const [index, chip] of chips.entries()) {
    if (index) {
      result = select(pick.greaterThanEqual(index / chips.length), color(chip), result)
    }
  }
  return result
}

/**
 * Polished terrazzo, mapped by world position so the pattern stays put however the floor is split into slabs: marble chips of two sizes ground flush in a cement binder, a field of one mix within a border of another along the walls, straight or round.
 *
 * Every chip is an irregular shard with a color of its own. In heavy mode the polish mirrors the room softly, bent a little by the waviness of a ground floor. Chips smaller than a pixel fade to their average before they could shimmer.
 */
export default class TerrazzoFloorMaterial extends PlanarMirrorMaterial {
  constructor(options: TerrazzoFloorOptions) {
    const {border, center, field, grazingStrength = 0.3, inset = 0, loss = 2.5, reflections = true, roughness, seed = 0, strength = 0.06} = options
    if (!('radius' in options ? options.radius > 0 : options.size[0] > 0 && options.size[1] > 0) || inset < 0) {
      throw new RangeError('A terrazzo floor needs a positive size or radius and a border inset of at least zero.')
    }
    const point = positionWorld.xz.toVar('terrazzoPoint')
    const footprint = max(positionWorld.x.fwidth(), positionWorld.z.fwidth()).toVar('terrazzoFootprint')
    // Sparse large pieces, a scatter of medium chips and fine grit, so the binder shows between them.
    const large = chipLayer(point, chipCells.large, seed + 2, 'terrazzoLarge', {
      density: 0.45,
      size: [0.26, 0.4],
    })
    const coarse = chipLayer(point, chipCells.coarse, seed, 'terrazzoCoarse', {
      density: 0.7,
      size: [0.2, 0.36],
    })
    const fine = chipLayer(point, chipCells.fine, seed + 1, 'terrazzoFine', {
      density: 0.8,
      size: [0.18, 0.32],
    })
    // Chips cover the binder; seen from far off, each layer fades to a wash of its average color.
    const coverage = (layer: ReturnType<typeof chipLayer>, cell: number) => mix(float(0.3), inside(layer.distance), visibleDetail(footprint, cell * 0.6))
    const coarseCoverage = coverage(coarse, chipCells.coarse).toVar('terrazzoCoarseCoverage')
    const fineCoverage = coverage(fine, chipCells.fine).toVar('terrazzoFineCoverage')
    const largeCoverage = mix(float(0.15), inside(large.distance), visibleDetail(footprint, chipCells.large * 0.6)).toVar('terrazzoLargeCoverage')
    // Marble shows its veins in the large pieces.
    const veins = mx_noise_float(vec3(point.mul(14), large.pick.mul(50))).abs().smoothstep(0.02, 0.09).mul(0.18).add(0.82)
    // Brass divider strips in a square grid from the room’s middle, ground flush with the floor.
    const fromMiddle = point.sub(vec2(...center)).toVar('terrazzoFromMiddle')
    const toStrip = fromMiddle.div(strips.spacing).add(0.5).fract().sub(0.5).abs().mul(strips.spacing)
    const strip = inside(min(toStrip.x, toStrip.y).sub(strips.halfWidth)).mul(visibleDetail(footprint, strips.halfWidth * 8)).toVar('terrazzoStrip')
    // The border runs along the walls, as far in as the inset; the field fills the rest.
    const toWall = 'radius' in options ? float(options.radius).sub(fromMiddle.length()) : min(float(options.size[0] / 2).sub(fromMiddle.x.abs()), float(options.size[1] / 2).sub(fromMiddle.y.abs()))
    const inBorder = border ? inside(toWall.sub(inset)).toVar('terrazzoBorder') : float(0)
    const mottle = mx_noise_float(vec3(point.mul(1.3), seed + 3)).mul(0.04).add(1)
    const shade = (blend: TerrazzoMix) => {
      const stone = mix(color(blend.binder).mul(mottle), chipColor(blend, fine.pick), fineCoverage)
      const chipped = mix(stone, chipColor(blend, coarse.pick), coarseCoverage)
      return mix(chipped, chipColor(blend, large.pick).mul(veins), largeCoverage)
    }
    const top = normalWorldGeometry.y.step(0.5)
    const finish = reflections ? roughness ?? 0.2 : 0.4
    super(null, {
      color: '#ffffff',
      roughness: finish,
      reflection: reflections ? {
        strength,
        grazingStrength,
        loss,
        mask: top,
      } : undefined,
    })
    const stoneSurface = border ? mix(shade(field), shade(border), inBorder) : shade(field)
    // Strips only run through the field; the border is one pour.
    const inStrip = strip.mul(inBorder.oneMinus()).mul(top)
    const surface = mix(stoneSurface, color('#c8a15c'), inStrip)
    const sawn = color(field.binder).mul(0.7)
    this.colorNode = mix(sawn, surface, top)
    // Ground flush, the chips polish a shade smoother than the binder.
    this.roughnessNode = mix(float(finish).add(0.05).sub(max(max(coarseCoverage, fineCoverage), largeCoverage).mul(0.06)), float(0.18), inStrip)
    this.metalnessNode = inStrip
    // A ground floor is never quite flat.
    const waviness = mx_noise_float(vec3(point.mul(3), seed + 5)).mul(0.00015).mul(visibleDetail(footprint, 0.05))
    this.normalNode = heightNormal(waviness.mul(top))
  }
}
