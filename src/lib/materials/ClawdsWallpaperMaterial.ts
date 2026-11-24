import type {Node} from 'three/webgpu'

import {abs, cameraPosition, color, float, max, mix, mx_cell_noise_float, mx_noise_float, normalWorldGeometry, positionWorld, select, time, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, insideBy, visibleDetail} from './filters.ts'

export type ClawdsOptions = {
  colors?: {
    /** the pink of the awake faces’ cheeks */
    blush: string
    /** the white vinyl of the die-cut border */
    border: string
    /** the paper ground */
    ground: string
    /** the flower’s heart, round its face, and the glints in its open eyes */
    heart: string
    /** the drawn lines and the face */
    line: string
    /** the petals */
    petals: string
  }
  /** up to how far from the camera a sticker shows its whole face, and from how far on none of it, in meters; no nearer than it starts waking */
  faces?: readonly [shown: number, gone: number]
  /** height of the floor the rows are laid out from */
  floorY?: number
  /** diameter of a sticker to the tips of its border, in meters */
  size?: number
  /** distance between neighboring stickers, in meters; every other row shifts by half of it, so each sticker has six neighbors this far away */
  spacing?: number
  /** how far each sticker is turned at most, either way, in degrees */
  tilt?: number
  /** how near the camera must come for a sticker to be wide awake, and from how far it starts waking, in meters */
  wake?: readonly [awake: number, dozing: number]
}
type Float = Node<'float'>
type Vec2 = Node<'vec2'>
type Point = readonly [x: number, y: number]
/** a petal: the tip of its fill, the direction it points to in degrees counterclockwise from +x, and its half-width round the tip and where its axis passes closest to the heart */
type Petal = readonly [tip: Point, direction: number, tipRadius: number, baseRadius: number]
/** a quadratic Bézier: start, control point and end */
type Curve = readonly [Point, Point, Point]
type CurveNodes = readonly [Vec2, Vec2, Vec2]
/** an ellipse: its middle and its radii along x and y */
type Oval = readonly [center: Point, radius: Point]

/**
 * A smiling daisy, as drawn in black lines, in units of its drawing: the heart lies at the origin, y points up and the petals reach a bit short of 1. Petals and heart are measured to the edge of their fill, with the line drawn outside of it; the faces’ strokes are measured along their middle.
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
  /** half the width of the faces’ strokes */
  stroke: 0.021,
  /** seen from afar: dozing, its eyes closed in a smile */
  dozing: {
    /** each a ^ of two legs, left eye first */
    eyes: [
      [[[-0.175, -0.005], [-0.175, 0.07], [-0.125, 0.135]], [[-0.125, 0.135], [-0.085, 0.095], [-0.06, 0.02]]],
      [[[0.08, 0.055], [0.08, 0.155], [0.125, 0.18]], [[0.125, 0.18], [0.17, 0.125], [0.185, 0.055]]],
    ] satisfies ReadonlyArray<readonly [Curve, Curve]>,
    /** a w of two lobes */
    mouth: [
      [[-0.095, -0.075], [-0.02, -0.255], [0.02, -0.08]],
      [[0.02, -0.08], [0.11, -0.215], [0.125, -0.035]],
    ] satisfies readonly [Curve, Curve],
  },
  /** up close: wide awake, with big glinting eyes under determined brows, a small cat mouth and blushing cheeks */
  awake: {
    /** each where the dozing eye lies, left eye first */
    eyes: [
      [[-0.115, 0.05], [0.048, 0.064]],
      [[0.13, 0.075], [0.048, 0.064]],
    ] satisfies ReadonlyArray<Oval>,
    /** the glints in each eye, from its middle: a big one up left and a small one down right */
    glints: [
      [[-0.014, 0.024], 0.016],
      [[0.016, -0.022], 0.008],
    ] satisfies ReadonlyArray<readonly [Point, number]>,
    /** sloping down toward the nose, left brow first */
    brows: [
      [[-0.19, 0.17], [-0.125, 0.168], [-0.06, 0.125]],
      [[0.07, 0.15], [0.125, 0.19], [0.18, 0.18]],
    ] satisfies ReadonlyArray<Curve>,
    /** how much higher the brows sit while they show up, the inner end and the outer one */
    browLift: [0.05, 0.015],
    mouth: [
      [[-0.05, -0.04], [-0.035, -0.13], [0.01, -0.06]],
      [[0.01, -0.06], [0.055, -0.13], [0.07, -0.035]],
    ] satisfies readonly [Curve, Curve],
    /** under the eyes, mirrored for the left cheek */
    blush: [[0.2, -0.035], [0.05, 0.027]] satisfies Oval,
    /** half the width of the darker hatches across each cheek, and how far apart they are */
    hatch: [0.006, 0.026],
  },
}
/** how many straight pieces draw each curve of a face */
const curvePieces = 6
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
const point = ([x, y]: Point) => vec2(x, y)
/** The curve on its way from `from` to `to`, at `progress` from 0 to 1. */
const between = (from: Curve, to: Curve, progress: Float): CurveNodes => [mix(point(from[0]), point(to[0]), progress), mix(point(from[1]), point(to[1]), progress), mix(point(from[2]), point(to[2]), progress)]
/** where a face looks, how awake it is and whether it is there at all */
type Mood = {
  /** 0 open to 1 shut, while the eyes blink */
  blink: Float
  /** toward the camera, seen in the sticker’s own frame: the sine of how far off its front the camera is, either way */
  gaze: Vec2
  /** 0 for no face to 1 for the whole of it */
  presence: Float
  /** 0 dozing to 1 wide awake */
  wake: Float
}
/** the part of a curve that is drawn, from where to where along it, 0 being its start and 1 its end */
type Span = readonly [from: Float, to: Float]
/** Distance to the middle of the curves, each drawn as straight pieces, or only the part of each its span gives. */
function curves(p: Vec2, drawn: ReadonlyArray<CurveNodes>, spans?: ReadonlyArray<Span>) {
  let nearest: Float | undefined
  for (const [index, [a, b, c]] of drawn.entries()) {
    const span = spans?.[index]
    const along = (fraction: number) => {
      const t = span ? span[1].sub(span[0]).mul(fraction).add(span[0]) : float(fraction)
      const s = t.oneMinus()
      return a.mul(s.mul(s)).add(b.mul(s.mul(t).mul(2))).add(c.mul(t.mul(t)))
    }
    for (let piece = 0; piece < curvePieces; piece++) {
      const start = along(piece / curvePieces)
      const run = along((piece + 1) / curvePieces).sub(start)
      const fromStart = p.sub(start)
      const off = fromStart.sub(run.mul(fromStart.dot(run).div(run.dot(run).max(1e-8)).clamp(0, 1)))
      const squared = off.dot(off)
      nearest = nearest ? nearest.min(squared) : squared
    }
  }
  return nearest!.sqrt()
}
/** An approximate distance to an axis-aligned ellipse, after Inigo Quilez, which keeps its scale for thin ones. */
function oval(p: Vec2, center: Vec2, radius: Vec2) {
  const q = p.sub(center)
  const k0 = q.div(radius).length()
  const k1 = q.div(radius.mul(radius)).length()
  return select(k1.lessThan(1e-6), radius.x.min(radius.y).negate(), k0.mul(k0.sub(1)).div(k1.max(1e-6)))
}
/** The exact distance to an axis-aligned stadium of half the width and height `half`: a rectangle with its shorter sides rounded off whole, lying while it is wider than tall and standing otherwise. */
function stadium(p: Vec2, center: Vec2, half: Vec2) {
  const round = half.x.min(half.y)
  const q = p.sub(center).abs().sub(half).add(round)
  return q.max(0).length().add(q.x.max(q.y).min(0)).sub(round)
}
/**
 * The face on the heart, waking as `wake` rises, one step after another, each a shape that could be drawn as it is. Before that, as `presence` rises, its strokes grow out of dots: each eye out of its tip, the mouth out of its middle. Then the eyes, closed in a smile, relax into straight lids, which open into round eyes; the w mouth draws up into a small cat mouth; brows grow out of dots, high up in surprise, and settle into a frown; last the cheeks blush. The open eyes look at the camera and blink.
 *
 * Returns the distances to its black strokes and to the glints in its eyes, and how much each cheek’s pink and its darker hatches cover.
 */
function face(p: Vec2, {wake, gaze, blink, presence}: Mood) {
  const {stroke, dozing, awake} = flowerSticker
  // The strokes stretch out of dots, which first grow out of nothing, starting smaller than it, so none of them shows yet.
  const stretching = presence.smoothstep(0.2, 1)
  const swelling = presence.smoothstep(0, 0.3).mul(stroke + 0.01).sub(0.01)
  const towardEnd: Span = [stretching.oneMinus(), float(1)]
  const fromStart: Span = [float(0), stretching]
  const relaxing = wake.smoothstep(0, 0.25)
  const opening = wake.smoothstep(0.25, 0.55)
  const mouthing = wake.smoothstep(0.15, 0.7)
  const browing = wake.smoothstep(0.45, 0.7)
  const frowning = wake.smoothstep(0.65, 0.95)
  const blushing = wake.smoothstep(0.6, 1)
  const look = gaze.mul(opening)
  const openness = blink.mul(-0.92).add(1)
  let eyes: Float | undefined
  let glints: Float | undefined
  for (const [index, [center, [radiusX, radiusY]]] of awake.eyes.entries()) {
    // The lid is the line a shut eye is drawn with: the stadium an open eye is, with no height left but the stroke’s.
    const [x, y] = center
    const lidX = radiusX - stroke
    const [left, right] = dozing.eyes[index]
    const lid = curves(p, [between(left, [[x - lidX, y], [x - lidX / 2, y], [x, y]], relaxing), between(right, [[x, y], [x + lidX / 2, y], [x + lidX, y]], relaxing)], [towardEnd, fromStart]).sub(swelling)
    // The eye looks toward the camera, its glints, a reflection, follow less.
    const open = stadium(p, point(center).add(look.mul(0.03)), vec2(radiusX, mix(float(stroke), float(radiusY), opening.mul(openness))))
    const eye = select(opening.greaterThan(0), open, lid)
    eyes = eyes ? eyes.min(eye) : eye
    for (const [offset, size] of awake.glints) {
      const glint = p.sub(point(center).add(look.mul(0.012)).add(point(offset))).length().sub(opening.mul(openness).mul(size + 0.01).sub(0.01)).max(eye)
      glints = glints ? glints.min(glint) : glint
    }
  }
  const [inner, outer] = awake.browLift
  // A brow grows out of a dot in its middle, which starts smaller than nothing, so none of it shows yet.
  const brows = curves(p, awake.brows.map(([start, control, end], index) => {
    // Each brow’s inner end is the one nearer the nose.
    const [startLift, endLift] = index === 0 ? [outer, inner] : [inner, outer]
    const raised: Curve = [[start[0], start[1] + startLift], [control[0], control[1] + (startLift + endLift) / 2], [end[0], end[1] + endLift]]
    return between(raised, [start, control, end], frowning)
  }), awake.brows.map(() => [browing.mul(-0.5).add(0.5), browing.mul(0.5).add(0.5)] as const)).sub(browing.smoothstep(0, 0.4).mul(stroke * 1.3 + 0.01).sub(0.01))
  const mouth = curves(p, dozing.mouth.map((curve, index) => between(curve, awake.mouth[index], mouthing)), [towardEnd, fromStart]).sub(swelling)
  const [[blushX, blushY], blushRadius] = awake.blush
  const cheek = vec2(p.x.abs(), p.y)
  const blush = oval(cheek, vec2(blushX, blushY), point(blushRadius))
  const [hatchWidth, hatchSpacing] = awake.hatch
  // Three short slanted strokes across the cheek, the outer ones a little shorter.
  const slant = cheek.sub(vec2(blushX, blushY))
  const across = slant.x.mul(0.8).sub(slant.y.mul(0.6))
  const hatches = max(across.div(hatchSpacing).round().abs().greaterThan(1).select(float(1), across.sub(across.div(hatchSpacing).round().mul(hatchSpacing)).abs().sub(hatchWidth)), blush.add(0.012))
  return {
    ink: eyes!.min(brows).min(mouth),
    glints: glints!,
    blush,
    hatches,
    blushing,
  }
}

/**
 * Clawds: smiling daisy stickers on terracotta paper, for papered walls, which wake up as the camera comes near. The wallpaper of the upstairs hall to come, and until it is built, of the landing the Antechamber’s flight up ends at.
 *
 * The stickers lie on a triangular lattice: every other row is shifted by half the spacing, so each has six neighbors at the same distance, and each is turned a little its own way. Every pixel draws only the sticker nearest to it, which the size must leave room for. Vertical faces are mapped along the wall, whichever way it faces, and up from the floor.
 *
 * Far away, the flowers have no faces. Coming within {@link ClawdsOptions.faces}, their faces draw themselves out of dots, dozing with their eyes closed in a smile. Coming within {@link ClawdsOptions.wake} of one wakes it, each a little sooner or later than its neighbors: it opens its eyes, follows the camera with them, blinks now and then at its own pace, raises its brows, frowns and blushes. Walking along a wall, the flowers wake round the camera and doze off behind it.
 *
 * The ground is a matte paper with a fine weave and a soft mottle; the stickers are a glossy vinyl a hair proud of it, petals in the paper’s own color round a white heart, in a black outline, die-cut with a white border round it. Drawn shapes are filtered over the pixel’s footprint, so lines thinner than a pixel fade to their share of it.
 */
export default class ClawdsWallpaperMaterial extends MeshStandardNodeMaterial {
  constructor({colors = {
    blush: '#f39aa7',
    border: '#f7f4ee',
    ground: '#db6d4a',
    heart: '#f7f4ee',
    line: '#1d1a19',
    petals: '#e3795a',
  }, floorY = 0, size = 0.15, spacing = 0.2, tilt = 25, wake: [awake, dozing] = [0.6, 0.9], faces: [shown, gone] = [3, 3.5]}: ClawdsOptions = {}) {
    if (!(size > 0 && spacing >= size)) {
      throw new RangeError('Stickers need a positive size and a spacing at least as large.')
    }
    if (!(awake >= 0 && dozing > awake)) {
      throw new RangeError('Stickers wake nearer than they doze.')
    }
    if (!(shown >= dozing && gone > shown)) {
      throw new RangeError('Faces show nearer than they are gone and no nearer than they wake.')
    }
    super({
      roughness: 0.85,
      metalness: 0,
      envMapIntensity: 0.8,
    })
    const n = normalWorldGeometry
    const vertical = abs(n.y).lessThan(0.5)
    const tangent = select(vertical, vec3(n.z, 0, n.x.negate()).normalize(), vec3(1, 0, 0))
    const bitangent = select(vertical, vec3(0, 1, 0), vec3(0, 0, 1))
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
    const fromCenter = select(isEven, fromEven, fromOdd).toVar('flowerFromCenter')
    // A random number from 0 to 1 per sticker, another for every `k`. Doubled, as cell noise floors its input: the odd rows’ centers lie halfway between whole numbers and would share the numbers of an even neighbor.
    const random = (k: number) => mx_cell_noise_float(vec3(cell.mul(2), k))
    const turn = random(0).mul(2).sub(1).mul(tilt * Math.PI / 180).toVar('flowerTurn')
    const toSticker = (vector: Vec2) => vec2(vector.x.mul(turn.cos()).add(vector.y.mul(turn.sin())), vector.y.mul(turn.cos()).sub(vector.x.mul(turn.sin())))
    const scale = size / 2 / flowerStickerReach
    const p = toSticker(fromCenter).div(scale).toVar('flowerPoint')
    const width = footprint.div(scale).toVar('flowerWidth')
    const covers = (distance: Float) => insideBy(distance, width)
    // How near the camera is to the middle of this sticker, each waking a little sooner or later than its neighbors, and where it is seen from.
    const toCamera = cameraPosition.sub(positionWorld.sub(tangent.mul(fromCenter.x)).sub(bitangent.mul(fromCenter.y))).toVar('flowerToCamera')
    const distance = toCamera.length()
    const nearness = distance.add(random(1).sub(0.5).mul(0.5)).toVar('flowerNearness')
    const wake = nearness.sub(dozing).div(awake - dozing).clamp(0, 1).smoothstep(0, 1).toVar('flowerWake')
    const presence = nearness.sub(gone).div(shown - gone).clamp(0, 1).smoothstep(0, 1)
    const gaze = toSticker(vec2(toCamera.dot(tangent), toCamera.dot(bitangent)).div(distance.max(0.01)))
    // A blink of about a fifth of a second, every 3 to 7 seconds.
    const period = random(2).mul(4).add(3)
    const phase = time.div(period).add(random(3)).fract().mul(period)
    const blink = phase.sub(0.1).abs().smoothstep(0, 0.1).oneMinus()
    const {border, heart: heartRadius, line, petals} = flowerSticker
    const heart = p.length().sub(heartRadius)
    const petalFill = petals.map(entry => petal(p, entry)).reduce((a, b) => a.min(b))
    const shape = petalFill.min(heart)
    const sticker = covers(shape.sub(line + border)).toVar('flowerSticker')
    // Filled: the heart, and the petals where the heart and its line don’t lie over them; black: the lines round both and the face.
    const heartFill = covers(heart).toVar('flowerHeart')
    const petalsFill = covers(petalFill).mul(covers(heart.sub(line)).oneMinus())
    const fill = heartFill.add(petalsFill)
    const features = face(p, {
      wake,
      gaze,
      blink,
      presence,
    })
    const ink = max(covers(shape.sub(line)).sub(fill), covers(features.ink).mul(heartFill)).toVar('flowerInk')
    // Paper: a fine weave across the wall and a broad, faint mottle, both round the ground’s own color.
    const weave = mix(float(0.5), mx_noise_float(vec3(u.mul(60), v.mul(700), 3)).mul(0.5).add(0.5), visibleDetail(footprint, 0.002))
    const mottle = mx_noise_float(vec3(u.mul(2.5), v.mul(1.5), 7)).mul(0.5).add(0.5)
    const paper = color(colors.ground).mul(mottle.mul(0.08).add(weave.mul(0.05)).add(0.935))
    // The cheeks’ pink fades out softly at its edge.
    const pink = color(colors.blush)
    const cheeks = mix(mix(color(colors.heart), pink, insideBy(features.blush, width.max(0.02))), pink.mul(0.82), covers(features.hatches))
    const heartColor = mix(color(colors.heart), cheeks, features.blushing)
    const vinyl = mix(mix(color(colors.border), color(colors.petals), petalsFill), heartColor, heartFill)
    const drawn = mix(mix(paper, vinyl, sticker), color(colors.line), ink)
    this.colorNode = mix(drawn, color(colors.heart), covers(features.glints).mul(heartFill))
    this.roughnessNode = mix(weave.mul(0.08).add(0.82), float(0.3), sticker)
    // The vinyl stands a tenth of a millimeter proud of the paper.
    this.normalNode = heightNormal(sticker.mul(0.0001).add(weave.mul(0.00002)).mul(visibleDetail(footprint, 0.004)))
  }
}
