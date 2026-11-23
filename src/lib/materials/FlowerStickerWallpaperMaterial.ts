import type {Node} from 'three/webgpu'

import {abs, color, float, max, mix, mx_cell_noise_float, mx_noise_float, normalWorldGeometry, positionWorld, select, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, insideBy, visibleDetail} from './filters.ts'

export type FlowerStickerOptions = {
  colors?: {
    /** the white vinyl of the die-cut border */
    border: string
    /** the paper ground */
    ground: string
    /** the flower’s heart, round its face */
    heart: string
    /** the drawn lines and the face */
    line: string
    /** the petals */
    petals: string
  }
  /** height of the floor the rows are laid out from */
  floorY?: number
  /** diameter of a sticker to the tips of its border, in meters */
  size?: number
  /** distance between neighboring stickers, in meters; every other row shifts by half of it, so each sticker has six neighbors this far away */
  spacing?: number
  /** how far each sticker is turned at most, either way, in degrees */
  tilt?: number
}
type Float = Node<'float'>
type Vec2 = Node<'vec2'>
type Point = readonly [x: number, y: number]
/** a petal: the tip of its fill, the direction it points to in degrees counterclockwise from +x, and its half-width round the tip and where its axis passes closest to the heart */
type Petal = readonly [tip: Point, direction: number, tipRadius: number, baseRadius: number]
/** a quadratic Bézier: start, control point and end */
type Curve = readonly [Point, Point, Point]

/**
 * A smiling daisy, as drawn in black lines, in units of its drawing: the heart lies at the origin, y points up and the petals reach a bit short of 1. Petals and heart are measured to the edge of their fill, with the line drawn outside of it; the face’s strokes are measured along their middle.
 */
export const flowerSticker = {
  heart: 0.285,
  line: 0.025,
  /** the die-cut border round the outline */
  border: 0.05,
  petals: [
    [[0.825, 0.16], 8, 0.085, 0.105],
    [[0.595, 0.725], 49, 0.105, 0.115],
    [[0.1, 0.905], 84, 0.1, 0.06],
    [[-0.44, 0.865], 119, 0.105, 0.08],
    [[-0.695, 0.57], 139, 0.08, 0.075],
    [[-0.845, 0.1], 173, 0.095, 0.085],
    [[-0.75, -0.38], -153, 0.095, 0.08],
    [[-0.485, -0.685], -128, 0.095, 0.08],
    [[-0.025, -0.79], -94, 0.085, 0.105],
    [[0.515, -0.66], -50, 0.105, 0.075],
    [[0.805, -0.215], -10, 0.095, 0.1],
  ] satisfies ReadonlyArray<Petal>,
  face: {
    /** half the width of its strokes */
    stroke: 0.021,
    curves: [
      // the eyes, closed in a smile, each a ^ of two legs
      [[-0.175, -0.005], [-0.175, 0.07], [-0.125, 0.135]],
      [[-0.125, 0.135], [-0.085, 0.095], [-0.06, 0.02]],
      [[0.08, 0.055], [0.08, 0.155], [0.125, 0.18]],
      [[0.125, 0.18], [0.17, 0.125], [0.185, 0.055]],
      // the mouth, a w of two lobes
      [[-0.095, -0.075], [-0.02, -0.255], [0.02, -0.08]],
      [[0.02, -0.08], [0.11, -0.215], [0.125, -0.035]],
    ] satisfies ReadonlyArray<Curve>,
  },
}
/** how many straight pieces draw each curve of the face */
const curvePieces = 6
/** The point on a quadratic Bézier at `t`. */
const onCurve = ([a, b, c]: Curve, t: number): Point => {
  const s = 1 - t
  return [s * s * a[0] + 2 * s * t * b[0] + t * t * c[0], s * s * a[1] + 2 * s * t * b[1] + t * t * c[1]]
}
/** How far the drawing reaches from its heart, its die-cut border included. */
export const flowerStickerReach = Math.max(...flowerSticker.petals.map(([[x, y]]) => Math.hypot(x, y)), flowerSticker.heart) + flowerSticker.line + flowerSticker.border

/** Distance to a petal’s fill: a rounded cone from where its axis passes closest to the heart out to its tip, after Inigo Quilez’ uneven capsule. */
function petal(p: Vec2, [[x, y], direction, tipRadius, baseRadius]: Petal) {
  const angle = direction * Math.PI / 180
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  // The middle of the tip’s round, and how far along the axis it lies from the base.
  const tipX = x - dx * tipRadius
  const tipY = y - dy * tipRadius
  const length = tipX * dx + tipY * dy
  const baseX = tipX - dx * length
  const baseY = tipY - dy * length
  const along = p.x.sub(baseX).mul(dx).add(p.y.sub(baseY).mul(dy))
  const across = p.y.sub(baseY).mul(dx).sub(p.x.sub(baseX).mul(dy)).abs()
  const b = (baseRadius - tipRadius) / length
  const a = Math.sqrt(1 - b * b)
  const k = across.mul(-b).add(along.mul(a))
  const q = vec2(across, along)
  return select(k.lessThan(0), q.length().sub(baseRadius), select(k.greaterThan(a * length), q.sub(vec2(0, length)).length().sub(tipRadius), across.mul(a).add(along.mul(b)).sub(baseRadius)))
}
/** Distance to the middle of the face’s strokes, each curve drawn as straight pieces. */
function strokes(p: Vec2) {
  let nearest: Float | undefined
  for (const curve of flowerSticker.face.curves) {
    for (let piece = 0; piece < curvePieces; piece++) {
      const [ax, ay] = onCurve(curve, piece / curvePieces)
      const [bx, by] = onCurve(curve, (piece + 1) / curvePieces)
      const abX = bx - ax
      const abY = by - ay
      const fromA = p.sub(vec2(ax, ay))
      const h = fromA.dot(vec2(abX / (abX * abX + abY * abY), abY / (abX * abX + abY * abY))).clamp(0, 1)
      const off = fromA.sub(vec2(abX, abY).mul(h))
      const squared = off.dot(off)
      nearest = nearest ? nearest.min(squared) : squared
    }
  }
  return nearest!.sqrt()
}

/**
 * Smiling daisy stickers on terracotta paper, for papered walls.
 *
 * The stickers lie on a triangular lattice: every other row is shifted by half the spacing, so each has six neighbors at the same distance, and each is turned a little its own way. Every pixel draws only the sticker nearest to it, which the size must leave room for. Vertical faces are mapped along the wall, whichever way it faces, and up from the floor.
 *
 * The ground is a matte paper with a fine weave and a soft mottle; the stickers are a glossy vinyl a hair proud of it, petals in the paper’s own color round a white heart, in a black outline, die-cut with a white border round it. Drawn shapes are filtered over the pixel’s footprint, so lines thinner than a pixel fade to their share of it.
 */
export default class FlowerStickerWallpaperMaterial extends MeshStandardNodeMaterial {
  constructor({colors = {
    border: '#f7f4ee',
    ground: '#db6d4a',
    heart: '#f7f4ee',
    line: '#1d1a19',
    petals: '#db6d4a',
  }, floorY = 0, size = 0.15, spacing = 0.2, tilt = 25}: FlowerStickerOptions = {}) {
    if (!(size > 0 && spacing >= size)) {
      throw new RangeError('Stickers need a positive size and a spacing at least as large.')
    }
    super({
      roughness: 0.85,
      metalness: 0,
      envMapIntensity: 0.8,
    })
    const n = normalWorldGeometry
    const vertical = abs(n.y).lessThan(0.5)
    const tangent = select(vertical, vec3(n.z, 0, n.x.negate()).normalize(), vec3(1, 0, 0))
    const u = positionWorld.x.mul(tangent.x).add(positionWorld.z.mul(tangent.z)).toVar('flowerU')
    const v = select(vertical, positionWorld.y.sub(floorY), positionWorld.z).toVar('flowerV')
    // The geometric mean keeps the stickers on walls seen at a grazing angle, where only one direction is squeezed; TRAA resolves the rest.
    const footprint = u.fwidth().mul(v.fwidth()).sqrt().toVar('flowerFootprint')
    // The nearest sticker: of the even rows’ or of the odd rows’, which are shifted by half a spacing either way.
    const rows = spacing * Math.sqrt(3)
    const evenCell = vec2(u.div(spacing).round(), v.div(rows).round())
    const oddCell = vec2(u.div(spacing).sub(0.5).round().add(0.5), v.div(rows).sub(0.5).round().add(0.5))
    const fromEven = vec2(u, v).sub(evenCell.mul(vec2(spacing, rows)))
    const fromOdd = vec2(u, v).sub(oddCell.mul(vec2(spacing, rows)))
    const isEven = fromEven.length().lessThan(fromOdd.length())
    const cell = select(isEven, evenCell, oddCell)
    const fromCenter = select(isEven, fromEven, fromOdd)
    // Doubled, as cell noise floors its input: the odd rows’ centers lie halfway between whole numbers and would share the turn of an even neighbor.
    const turn = mx_cell_noise_float(vec3(cell.mul(2), 0)).mul(2).sub(1).mul(tilt * Math.PI / 180).toVar('flowerTurn')
    const scale = size / 2 / flowerStickerReach
    const p = vec2(fromCenter.x.mul(turn.cos()).add(fromCenter.y.mul(turn.sin())), fromCenter.y.mul(turn.cos()).sub(fromCenter.x.mul(turn.sin()))).div(scale).toVar('flowerPoint')
    const width = footprint.div(scale).toVar('flowerWidth')
    const covers = (distance: Float) => insideBy(distance, width)
    const {border, heart: heartRadius, line, petals, face} = flowerSticker
    const heart = p.length().sub(heartRadius)
    const petalFill = petals.map(entry => petal(p, entry)).reduce((a, b) => a.min(b))
    const shape = petalFill.min(heart)
    const sticker = covers(shape.sub(line + border)).toVar('flowerSticker')
    // Filled: the heart, and the petals where the heart and its line don’t lie over them; black: the lines round both and the face.
    const heartFill = covers(heart)
    const petalsFill = covers(petalFill).mul(covers(heart.sub(line)).oneMinus())
    const fill = heartFill.add(petalsFill)
    const smile = covers(strokes(p).sub(face.stroke)).mul(covers(heart))
    const ink = max(covers(shape.sub(line)).sub(fill), smile).toVar('flowerInk')
    // Paper: a fine weave across the wall and a broad, faint mottle, both round the ground’s own color.
    const weave = mix(float(0.5), mx_noise_float(vec3(u.mul(60), v.mul(700), 3)).mul(0.5).add(0.5), visibleDetail(footprint, 0.002))
    const mottle = mx_noise_float(vec3(u.mul(2.5), v.mul(1.5), 7)).mul(0.5).add(0.5)
    const paper = color(colors.ground).mul(mottle.mul(0.08).add(weave.mul(0.05)).add(0.935))
    const vinyl = mix(mix(color(colors.border), color(colors.petals), petalsFill), color(colors.heart), heartFill)
    this.colorNode = mix(mix(paper, vinyl, sticker), color(colors.line), ink)
    this.roughnessNode = mix(weave.mul(0.08).add(0.82), float(0.3), sticker)
    // The vinyl stands a tenth of a millimeter proud of the paper.
    this.normalNode = heightNormal(sticker.mul(0.0001).add(weave.mul(0.00002)).mul(visibleDetail(footprint, 0.004)))
  }
}
