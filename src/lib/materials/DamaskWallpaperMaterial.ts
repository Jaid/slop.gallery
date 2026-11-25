import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {abs, color, float, max, mix, mx_noise_float, normalWorldGeometry, positionWorld, select, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, inside, visibleDetail} from './filters.ts'
import {arc, circle, ellipse, leaf, repeat, subtract, unite} from './sdf.ts'

export type DamaskOptions = {
  colors?: {
    /** the gilded print */
    gold: number
    /** the silk ground */
    ground: number
    /** the shadowed folds of the ground’s weave */
    shade: number
  }
  /** height of the floor the repeat is laid out from */
  floorY?: number
  /** width and height of the half-drop repeat, in meters */
  repeat?: readonly [number, number]
  /** meters per motif unit; the motif spans about 2 × 3 units */
  scale?: number
}
type Float = Node<'float'>

type Vec2 = Node<'vec2'>

const crimson = {
  ground: hsl.integer(22, 89, 17),
  shade: hsl.integer(19, 85, 9.4),
  gold: hsl.integer(71, 61, 44),
}
/** Share of the wall the gilding covers on average, for walls too far away to draw the motif. */
export const damaskCoverage = 0.32

/** Pointed leaves of one motif half: center, half-length, half-width and direction, in motif units. */
const leaves = [
  // the crown
  [[0, 1.08], 0.34, 0.1, Math.PI / 2],
  [[0.17, 0.98], 0.24, 0.07, 1.05],
  // the stem under the pomegranate
  [[0, -0.48], 0.28, 0.07, Math.PI / 2],
  // leaves sprouting from the cartouche, up and down the diagonals of the repeat
  [[0.74, 0.32], 0.32, 0.09, 0.8],
  [[0.72, -0.12], 0.26, 0.08, -0.6],
  // the pendant
  [[0, -1.12], 0.26, 0.08, -Math.PI / 2],
] as const
/**
 * One damask motif, mirrored about its vertical axis, in motif units: a seeded pomegranate in a cartouche of two tapering stems, crowned by a palmette and standing on back-to-back scrolls, with leaves along the diagonals of the repeat.
 *
 * Returns the gilded silhouette and, separately, the seeds and leaf veins that are cut back into the ground, so the fine cuts can fade out sooner than the silhouette.
 */
function motif(point: Vec2) {
  const p = vec2(point.x.abs(), point.y)
  const heart = ellipse(p, [0, 0.12], 0.34, 0.46)
  // Each stem of the cartouche is an arc that tapers toward the crown and the base.
  const rise = p.y.sub(0.1).div(0.95)
  const taper = rise.mul(rise).min(1).mul(-0.7).add(1)
  const stem = max(circle(p, [-0.5, 0.1], 1.05).abs().sub(taper.mul(0.1)), p.y.sub(0.1).abs().sub(0.86))
  const shape = unite(
    heart,
    stem,
    ...leaves.map(([center, length, width, angle]) => leaf(p, center, length, width, angle)),
    arc(p, [0.24, -0.86], 0.16, 0.045, 1.2),
    circle(p, [0.36, -0.98], 0.05),
    circle(p, [0, 1.52], 0.06),
  )
  // Seeds: a lattice of fine cuts inside the pomegranate.
  const seed = 0.13
  const diagonal = (value: Float) => repeat(value, seed).abs()
  const seeds = max(diagonal(p.x.add(p.y)).min(diagonal(p.x.sub(p.y))).sub(0.01), heart.add(0.07))
  const veins = unite(...leaves.map(([[x, y], length, , angle]) => {
    const along = p.x.sub(x).mul(Math.cos(angle)).add(p.y.sub(y).mul(Math.sin(angle)))
    const across = p.y.sub(y).mul(Math.cos(angle)).sub(p.x.sub(x).mul(Math.sin(angle)))
    return max(across.abs().sub(0.012), along.add(0.03).abs().sub(length * 0.6))
  }))
  return {
    shape,
    cuts: seeds.min(veins),
  }
}
/** The small four-way sprig between motifs. */
function sprig(point: Vec2) {
  const p = vec2(point.x.abs(), point.y.abs())
  return unite(
    subtract(unite(
      leaf(p, [0, 0.36], 0.3, 0.085, Math.PI / 2),
      leaf(p, [0.15, 0], 0.13, 0.05),
      leaf(p, [0.14, 0.22], 0.2, 0.06, 1),
    ), circle(p, [0, 0], 0.1)),
    circle(p, [0, 0], 0.06),
  )
}

/**
 * Gilded damask on crimson silk, for papered walls.
 *
 * The motif repeats in a half-drop: every other column is shifted by half a repeat, which lines the motifs up along the diagonals. Each pixel evaluates the motif of its own column and both neighbors, so leaves may reach across the column edges. Vertical faces are mapped along the wall, whichever way it faces, and up from the floor.
 *
 * The ground is a matte silk with a fine horizontal weave and soft moiré; the print is a satin gold leaf that sits a hair proud of it. Far away, the ornament fades to its average tone instead of shimmering.
 */
export default class DamaskWallpaperMaterial extends MeshStandardNodeMaterial {
  constructor({colors = crimson, floorY = 0, repeat: [width, height] = [0.6, 0.86], scale = 0.215}: DamaskOptions = {}) {
    if (!(width > 0 && height > 0 && scale > 0)) {
      throw new RangeError('A damask repeat needs a positive width, height and scale.')
    }
    super({
      roughness: 0.8,
      metalness: 0,
      envMapIntensity: 0.8,
    })
    const n = normalWorldGeometry
    const vertical = abs(n.y).lessThan(0.5)
    const tangent = select(vertical, vec3(n.z, 0, n.x.negate()).normalize(), vec3(1, 0, 0))
    const u = positionWorld.x.mul(tangent.x).add(positionWorld.z.mul(tangent.z)).toVar('damaskU')
    const v = select(vertical, positionWorld.y.sub(floorY), positionWorld.z).toVar('damaskV')
    // The geometric mean keeps the print on walls seen at a grazing angle, where only one direction is squeezed; TRAA resolves the rest.
    const footprint = u.fwidth().mul(v.fwidth()).sqrt().toVar('damaskFootprint')
    const column = u.div(width / 2).floor().toVar('damaskColumn')
    let print: Float | undefined
    let cuts: Float | undefined
    for (const offset of [-1, 0, 1]) {
      const index = column.add(offset)
      // Odd columns drop by half a repeat.
      const drop = index.mod(2).abs().mul(height / 2)
      const x = u.sub(index.add(0.5).mul(width / 2))
      const y = v.add(drop)
      const local = vec2(x, repeat(y.sub(height / 2), height)).div(scale)
      const {shape, cuts: cut} = motif(local)
      const field = offset === 0 ? shape.min(sprig(vec2(x, repeat(y, height)).div(scale))) : shape
      // A cut belongs to its own motif only.
      const own = max(cut, shape)
      print = print ? print.min(field) : field
      cuts = cuts ? cuts.min(own) : own
    }
    // The silhouette is drawn as long as its leaves span a few pixels; the 4 mm seeds and veins only up close.
    const cutDetail = visibleDetail(footprint, 0.006)
    const printed = inside(print!).mul(inside(cuts!).mul(cutDetail).oneMinus())
    const gilt = mix(float(damaskCoverage), printed, visibleDetail(footprint, 0.06)).toVar('damaskGilt')
    // Silk: a fine weave across the wall, and broad moiré bands where the threads catch the light differently.
    const weave = mix(float(0.5), mx_noise_float(vec3(u.mul(40), v.mul(900), 3)).mul(0.5).add(0.5), visibleDetail(footprint, 0.002))
    const moire = mx_noise_float(vec3(u.mul(3), v.mul(0.8), 7)).mul(0.5).add(0.5)
    const silk = mix(color(colors.shade), color(colors.ground), moire.mul(0.35).add(weave.mul(0.25)).add(0.45))
    const tarnish = mx_noise_float(vec3(u.mul(6), v.mul(6), 11)).mul(0.5).add(0.5)
    const gold = color(colors.gold).mul(tarnish.mul(0.25).add(0.85))
    this.colorNode = mix(silk, gold, gilt)
    // Only slightly metallic, or the screen-space reflections mirror the frames hung on it almost sharply.
    this.metalnessNode = gilt.mul(0.1)
    this.roughnessNode = mix(weave.mul(0.1).add(0.78), tarnish.mul(0.12).add(0.34), gilt)
    // The gold leaf stands a fraction of a millimeter proud of the silk.
    this.normalNode = heightNormal(gilt.mul(0.00025).add(weave.mul(0.00002)).mul(visibleDetail(footprint, 0.004)))
  }
}
