import type {Node} from 'three/webgpu'

import {color, exp, float, max, mix, mx_cell_noise_float, mx_noise_float, select, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial, SphereGeometry} from 'three/webgpu'

import {heightNormal, insideBy, visibleDetail} from '#src/lib/materials/filters.ts'
import {impastoColor, impastoOrder, impastoPaints} from '#src/lib/materials/impastoPaints.ts'
import {swatch} from '#src/lib/materials/oilPaints.ts'

import PortraitFrame, {frameBack, frameTriangleBudget} from '../base/PortraitFrame.ts'
import {withOpening} from '../lib/frameBack.ts'
import {along, assembleFrame, ornament, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {aroundLoop, aroundOpening, frameSurface} from '../lib/materials/frameAttributes.ts'
import {backSurface, hangingWire, scribble} from '../lib/materials/frameBacks.ts'
import frameStudio from '../lib/materials/frameStudio.ts'

type Float = Node<'float'>
type Vec3 = Node<'vec3'>

const imageDepth = -0.052
const crust = 0
const back = 1
/** the swelling cushion the paint was built up into: a lip rising from the work, its broad crown and a fat roll down to the wall */
const cushion = {
  lip: [0.012, -0.032],
  crown: [0.072, -0.024],
  edge: 0.1,
}
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.043)
  .arc(cushion.lip[0], cushion.lip[1], 0.3, {steps: 4})
  .arc(cushion.crown[0], cushion.crown[1], 0.1, {steps: 8})
  .arc(cushion.edge, -0.058, 0.38, {steps: 7})
  .line(cushion.edge, frameBack)
  .line(-0.005, frameBack, {material: back})
/** the thick dabs of paint the knife set down on the crown, slanting all the same way: how far out, how long, wide and high each is, how far apart they lie, how far they slant off the member and how many triangles round and up each takes */
const dab = {
  reach: 0.047,
  length: 0.062,
  width: 0.034,
  height: 0.008,
  spacing: 0.075,
  inset: 0.035,
  slant: 0.62,
  segments: [8, 3] as const,
  /** how far its foot is sunk into the crust */
  sink: 0.0035,
  /** the largest a dab is scaled to, of its own size */
  scale: 1.12,
  /** how far a dab strays from the row along the member, as a share of the spacing, and across it, in meters */
  stray: [0.3, 0.011] as const,
}
/** the triangles of one dab: two per segment of its dome, but one at its pole */
const dabTriangles = dab.segments[0] * (dab.segments[1] * 2 - 1)
/**
 * the knife strokes the crust is laid in: the cells they start in along the frame and across its profile, in meters, the middle share of its cell a stroke starts in, how far they slant off running along it, the way the dabs do, and how much either way, how long and how wide they are
 * A stroke stays within its cell and the next along and across, which is all a point needs to look at: it slants forward and up out of the middle of its cell, never so far as two cells on.
 */
export const crustStrokes = {
  along: 0.066,
  across: 0.058,
  start: [0.3, 0.6],
  slant: 0.75,
  wander: 0.28,
  length: [0.05, 0.078],
  halfWidth: [0.011, 0.016],
  /** how far paint squeezed out from under the blade’s sides and the ragged lip reach past them at most, as a share of its half width and in meters */
  squeezed: 0.18,
  lip: 0.0025,
} as const
const strokes = crustStrokes
/**
 * the paints the crust moves through round the frame, as the painter loaded the knife from one part of the palette at a time: the dusk’s cool shadows and its warm lights, each a few paints by how often the knife took them, which drift into each other every {@link familyLength} meters or so; now and then a stroke of the other family lands among them
 */
const families = {
  cool: (['prussianBlue', 'cobaltTeal', 'prussianBlue', 'cobaltTeal', 'titaniumWhite'] as const).map(paint => impastoPaints[paint]),
  warm: (['naplesYellow', 'cadmiumOrange', 'naplesYellow', 'alizarinCrimson', 'cadmiumOrange'] as const).map(paint => impastoPaints[paint]),
  accent: 0.16,
}
const familyLength = 0.3
/** A pseudo-random number from 0 to 1 for the number, the same on every run. */
const scatter = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43_758.5453
  return value - Math.floor(value)
}
/** How far in front of the frame’s middle the profile’s face lies `r` out past the opening, between its sight edge and its outer edge. */
function faceAt(r: number) {
  const face = profile.points.filter(point => point.z > frameBack)
  for (const [index, point] of face.slice(0, -1).entries()) {
    const next = face[index + 1]
    if (r >= point.r && r <= next.r && next.r > point.r) {
      return point.z + (next.z - point.z) * (r - point.r) / (next.r - point.r)
    }
  }
  return profile.front
}
/**
 * A dab of heavy paint the knife set down and drew off, its middle at the origin, running along +x: a low mound planed flat across its top by the blade, tilting up toward where it lifted off, where the paint heaped into a lip. Its kind is the index of its paint in {@link impastoOrder}.
 */
function knifeDab(paint: number) {
  const dome = new SphereGeometry(1, dab.segments[0], dab.segments[1], 0, Math.PI * 2, 0, Math.PI / 2)
  // The dome rises along y; tipped forward, it rises toward the viewer.
  dome.rotateX(Math.PI / 2)
  const position = dome.getAttribute('position')
  const seed = paint * 2.3 + 0.7
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index)
    const y = position.getY(index)
    const up = Math.max(0, position.getZ(index))
    const angle = Math.atan2(y, x)
    const lumps = 1 + Math.sin(angle * 3 + seed) * 0.08 + Math.sin(angle * 5 + seed * 1.7) * 0.05
    // A soft mound, its foot running out flat into the crust rather than standing up off it; the blade planed its top flat, tilting up toward the lip, which rises over the plane where the paint heaped up ahead of it.
    const mound = up ** 1.5
    const plane = 0.6 + x * 0.25
    const lip = Math.max(0, x) ** 3 * 0.5 * mound
    const z = Math.min(mound, plane) + lip
    position.setXYZ(index, x * dab.length / 2 * lumps, y * dab.width / 2 * lumps * (1 + x * 0.12), z * dab.height)
  }
  // Smooth over the indexed dome, before the ornament drops its index.
  dome.computeVertexNormals()
  return ornament(dome, {kind: paint})
}
/** How warm the crust’s paints are round the cell `round` of the `count` round the frame, 0 cool to 1 warm, drifting seamlessly round it and a little across it. */
function familyAt(round: Float, count: Float, across: Float) {
  const angle = round.div(count).mul(Math.PI * 2)
  const radius = count.mul(strokes.along / familyLength / (Math.PI * 2))
  return mx_noise_float(vec3(angle.cos().mul(radius), angle.sin().mul(radius), across.mul(0.15))).smoothstep(-0.18, 0.18)
}
/** A paint of the warm or the cool family, picked by `random` 0–1. */
function familyPaint(isWarm: Node<'bool'>, random: Float) {
  const index = random.mul(families.cool.length).floor()
  return select(isWarm, swatch(families.warm, index), swatch(families.cool, index))
}
/** How high a dab of its own size stands over its foot, its lip included. */
function dabHeight() {
  const geometry = knifeDab(0)
  geometry.computeBoundingBox()
  const height = geometry.boundingBox!.max.z
  geometry.dispose()
  return height
}
/**
 * One knife stroke laid into the crust, in the cell `cell` of strokes along and across the frame: a swathe of a paint, or two folded together, set down straight and dragged off slanting across the member, planed flat by the blade and ridged along its sides, ending in a ragged heaped lip.
 * `at` is the point in meters along the frame and across its profile, `count` the cells round the frame, whose numbers wrap so the last meets the first, and `layer` tells apart the strokes of the layers.
 * Returns how much the stroke covers the point, its color and how high its paint stands.
 */
function stroke(at: Node<'vec2'>, cell: Node<'vec2'>, count: Float, footprint: Float, layer: number) {
  const wrapped = vec2(cell.x.sub(count.mul(cell.x.div(count).floor())), cell.y)
  const warmth = familyAt(wrapped.x, count, wrapped.y)
  /** a random number from 0 to 1 for this stroke, another for every `k` */
  const random = (k: number) => mx_cell_noise_float(vec3(wrapped, k + layer * 16))
  const between = (k: number, [low, high]: readonly [number, number]) => random(k).mul(high - low).add(low)
  const start = cell.add(vec2(between(0, strokes.start), between(1, strokes.start))).mul(vec2(strokes.along, strokes.across))
  const angle = random(2).sub(0.5).mul(strokes.wander * 2).add(strokes.slant)
  const direction = vec2(angle.cos(), angle.sin())
  const offset = at.sub(start)
  const ahead = offset.dot(direction)
  const aside = offset.dot(vec2(direction.y.negate(), direction.x))
  const length = between(3, strokes.length)
  const halfWidth = between(4, strokes.halfWidth)
  const noiseSeed = wrapped.x.mul(1.37).add(wrapped.y.mul(5.1)).add(layer * 3.3)
  // Crisp along the blade’s sides but for paint squeezed out from under them, straight where it set down, ragged along the lip.
  const ragged = mx_noise_float(vec3(ahead.mul(90), aside.sign().mul(3).add(noiseSeed), 0.5)).max(0).mul(strokes.squeezed).add(1)
  const lipEdge = mx_noise_float(vec3(aside.mul(160), noiseSeed, 2.5)).mul(strokes.lip)
  const shape = max(aside.abs().sub(halfWidth.mul(ragged)), ahead.negate()).max(ahead.sub(length).sub(lipEdge))
  const cover = insideBy(shape, footprint)
  // Planed flat, thin where the knife set down, ridged along both sides where the blade squeezed the paint up and heaped into the lip where it lifted off.
  const across = aside.abs().div(halfWidth).clamp(0, 1)
  const load = ahead.div(length).clamp(0, 1).smoothstep(0, 0.5).mul(0.7).add(0.3)
  const ridges = exp(across.sub(0.9).div(0.12).pow2().negate()).mul(0.0022)
  const lip = exp(ahead.sub(length.mul(0.92)).div(0.006).pow2().negate()).mul(0.0055).mul(across.oneMinus().sqrt())
  const chatter = ahead.mul(Math.PI * 2 / 0.007).add(mx_noise_float(vec3(aside.mul(80), noiseSeed, 4.5)).mul(2)).sin().mul(0.00018).mul(visibleDetail(footprint, 0.007))
  const scored = mx_noise_float(vec3(ahead.mul(18), aside.mul(420), noiseSeed)).mul(0.00025).mul(visibleDetail(footprint, 0.0018))
  const height = load.mul(0.0032).add(ridges.add(lip).mul(visibleDetail(footprint, 0.004))).add(scored).add(chatter)
  // One paint of the family the knife was loading from there, or two folded through each other along the stroke without mixing in.
  const fold = mx_noise_float(vec3(ahead.mul(40), aside.mul(70), noiseSeed.add(7))).add(aside.div(halfWidth).mul(0.4)).smoothstep(-0.1, 0.1)
  const isWarm = random(8).lessThan(warmth.mul(1 - 2 * families.accent).add(families.accent))
  const first = familyPaint(isWarm, random(6))
  const paint = select(random(5).lessThan(0.45), mix(first, familyPaint(isWarm, random(7)), fold), first)
  return {
    color: paint,
    cover,
    height,
    /** how far up the ridges and the lip, which the blade left glossier than its planed flat */
    raised: ridges.add(lip).div(0.0055).clamp(0, 1),
  }
}

/** The Impasto Orb’s: a plain moulding the painter kept loading with paint off the knife until no wood showed, its crust laid in slanting knife strokes of the dusk’s blues, teals and warm lights, a row of thick knife dabs set down on its crown. */
export default class ImpastoFrame extends PortraitFrame {
  override readonly description = 'No moulding shows any more under the paint the painter kept loading onto it with a palette knife: a fat cushion of crust round the work, laid all over in short knife strokes slanting across the members, each planed flat by the blade, ridged along its sides where the paint squeezed out and heaped into a ragged lip where the knife lifted off, in Prussian blue, cobalt teal, Naples yellow, cadmium orange, alizarin crimson and titanium white, many with a second paint folded through them unmixed. Along its crown, a row of thick dabs slants the same way, each a lump of a single paint planed off by the blade, tilting up into its lip. Turned round, it is bare poplar, the knife wiped clean on it in streaks of every paint, a title scrawled in charcoal and the hanging wire across it.'
  // The dabs stand highest where they strayed to the highest part of the crown.
  override readonly front = Math.max(profile.front, Math.max(...[-1, -0.5, 0, 0.5, 1].map(share => faceAt(dab.reach + share * dab.stray[1]))) - dab.sink + dabHeight() * dab.scale)
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#4b6f7c'
  override readonly title = 'Impasto'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const moulding = withOpening(sweepProfile(profile, halfWidth, halfHeight), back, halfWidth, halfHeight)
    // As many dabs as the triangles the moulding leaves.
    const left = frameTriangleBudget - moulding.values().reduce((sum, part) => sum + part.getAttribute('position').count / 3, 0)
    const spots = along(halfWidth, halfHeight, dab.reach, faceAt(dab.reach) - dab.sink, {
      spacing: dab.spacing,
      inset: dab.inset,
      limit: Math.floor(left / dabTriangles),
    })
    // The paints follow each other round the frame, every dab slanting the same way, each a size of its own, a little askew and strayed from the row, sitting on the crust where it strayed to.
    const spacing = spots.length > 1 ? Math.hypot(spots[1].position[0] - spots[0].position[0], spots[1].position[1] - spots[0].position[1]) : 0
    const byPaint = Map.groupBy(spots.map((spot, index) => {
      const member = spot.angle ?? 0
      const [run, out] = [[Math.cos(member), Math.sin(member)], [-Math.sin(member), Math.cos(member)]]
      const forward = (scatter(index + 0.21) - 0.5) * 2 * dab.stray[0] * spacing
      const aside = (scatter(index + 0.83) - 0.5) * 2 * dab.stray[1]
      const [x, y] = spot.position
      return {
        ...spot,
        position: [x + run[0] * forward + out[0] * aside, y + run[1] * forward + out[1] * aside, faceAt(dab.reach + aside) - dab.sink] as const,
        angle: member + dab.slant + (scatter(index) - 0.5) * 0.3,
        scale: dab.scale - scatter(index + 0.5) * 0.3,
      }
    }), (_, index) => index % impastoOrder.length)
    return assembleFrame([...moulding, ...[...byPaint].map(([paint, placements]) => [crust, place(knifeDab(paint), placements)] as const)])
  }

  protected override createMaterials() {
    return [new CrustMaterial, new PoplarBackMaterial]
  }
}

/**
 * The crust: heavy paint built up thick over the moulding, laid in knife strokes slanting across the members, two layers of them, the later over the earlier, seamless round the miters, over a ground of paints folded through each other where none lies; the dabs on the crown are fresh lumps of a single paint, scored by the blade. Oil paint dries satin, the dabs a little glossier.
 */
class CrustMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.75,
      clearcoatRoughness: 0.18,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('impastoFootprint')
    // Where the point lies round the frame, in meters along the crown’s loop, a whole number of strokes to the round, and across the profile.
    const at = aroundOpening(p.xy, surface.opening)
    const loop = surface.opening.x.add(surface.opening.y).add(dab.reach * 2).mul(4).toVar('impastoLoop')
    const count = loop.div(strokes.along).round().max(4).toVar('impastoCount')
    const round = at.distance.div(at.perimeter).mul(count).toVar('impastoRound')
    const point = vec2(round.mul(strokes.along), surface.across).toVar('impastoPoint')
    // The ground: paints folded through each other in broad bands, lumpy, seamless round the frame.
    const circle = aroundLoop(at.distance, at.perimeter, loop)
    const folds = mx_noise_float(vec3(circle.mul(18), point.y.mul(30))).mul(0.7).add(mx_noise_float(vec3(circle.mul(70), point.y.mul(70).add(4.2))).mul(0.25))
    const band = point.y.mul(40).add(folds.mul(2.6)).floor()
    const groundWarm = familyAt(round, count, float(0)).greaterThan(mx_cell_noise_float(vec3(band, 8.5, 0)).mul(0.6).add(0.2))
    let surfaceColor: Vec3 = familyPaint(groundWarm, mx_cell_noise_float(vec3(band, 9.5, 0))).mul(0.85)
    let height: Float = mx_noise_float(vec3(circle.mul(90), point.y.mul(90).add(2.9))).mul(0.0003)
    let painted: Float = float(0)
    let raised: Float = float(0)
    // Two layers of strokes, the later over the earlier and offset from it by half a cell, each looking at the point’s own cell and those before it, which its strokes reach into, the later ones on top.
    for (const layer of [0, 1]) {
      const shifted = point.add(vec2(strokes.along, strokes.across).mul(layer * 0.5))
      const base = shifted.div(vec2(strokes.along, strokes.across)).floor()
      for (const dy of [-1, 0]) {
        for (const dx of [-1, 0]) {
          const cell = base.add(vec2(dx, dy))
          const {color: strokeColor, cover, height: strokeHeight, raised: strokeRaised} = stroke(shifted, cell, count, footprint, layer)
          surfaceColor = mix(surfaceColor, strokeColor, cover)
          raised = mix(raised, strokeRaised, cover)
          height = mix(height, height.mul(0.5).add(strokeHeight), cover)
          painted = painted.max(cover)
        }
      }
    }
    surfaceColor = surfaceColor.toVar('impastoCrust')
    // The dabs: fresh lumps of a single paint, now and then streaked with white along the blade, scored by its edge.
    const isDab = surface.isOrnament
    const dabPaint = surface.member.sub(4).round()
    const local = surface.plane
    // A dab of the family round it, folded through with streaks of white or a neighbor along the blade.
    const streak = mx_noise_float(vec3(local.x.mul(60), local.y.mul(200), dabPaint)).smoothstep(0.2, 0.5)
    const fresh = mix(impastoColor(dabPaint), impastoColor(dabPaint.add(1).mod(impastoOrder.length)), streak.mul(0.6))
    const scoring = mx_noise_float(vec3(local.x.mul(30), local.y.mul(900), dabPaint.add(3))).mul(0.00009).mul(visibleDetail(footprint, 0.0012))
    this.colorNode = mix(surfaceColor, fresh, isDab)
    this.roughnessNode = mix(mix(float(0.6), float(0.42), painted).sub(raised.mul(0.2)), float(0.36), isDab)
    this.clearcoatNode = mix(painted.mul(0.2), float(0.3), isDab)
    // The varnish of drying oil follows the paint’s relief, not the smooth cushion under it.
    const relief = heightNormal(mix(height, scoring, isDab))
    this.normalNode = relief
    this.clearcoatNormalNode = relief
  }
}
/**
 * The back: bare poplar, its grain running across, where the painter wiped the knife clean in short streaks of every paint near the edges, a title scrawled in charcoal and the hanging wire across it.
 */
class PoplarBackMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.4,
    })
    const surface = backSurface()
    const {footprint, opening, point} = surface
    const grain = mx_noise_float(vec3(point.x.mul(2.5), point.y.mul(240), 3.3)).mul(0.5).add(0.5)
    const poplar = mix(color('#c9b68e'), color('#ddd0ae'), grain)
    // The knife wiped off in short streaks near the edges, along the nearest one, each its own paint, thinning out into dry drags where the blade ran clean.
    const outer = opening.add(profile.reach)
    const inset = outer.sub(point.abs())
    const onSide = inset.x.lessThan(inset.y)
    const fromEdge = inset.x.min(inset.y)
    const run = select(onSide, point.y, point.x)
    const edge = select(onSide, point.x.sign(), point.y.sign().mul(2))
    // One streak at most in every stretch along the edge, near its middle, short enough to stay inside it.
    const stretch = 0.09
    const lane = run.div(stretch).floor()
    const random = (k: number) => mx_cell_noise_float(vec3(lane, edge, k))
    const middle = lane.add(random(0).mul(0.2).add(0.4)).mul(stretch)
    const streakLength = random(1).mul(0.03).add(0.045)
    const streakWidth = random(2).mul(0.004).add(0.007)
    const ahead = run.sub(middle).mul(select(random(3).lessThan(0.5), float(1), float(-1)))
    const aside = fromEdge.sub(random(4).mul(0.025).add(0.018))
    const thinning = ahead.div(streakLength).add(0.5).clamp(0, 1)
    const wiped = select(random(5).lessThan(0.6), float(1), float(0))
    const streak = insideBy(max(ahead.abs().sub(streakLength.div(2)), aside.abs().sub(streakWidth.mul(thinning.oneMinus().mul(0.5).add(0.5)))), footprint).mul(wiped)
    const dryRun = mx_noise_float(vec3(ahead.mul(120), aside.mul(900), random(6).mul(9))).mul(0.5).add(0.5).smoothstep(thinning.mul(0.7).sub(0.15), thinning.mul(0.7).add(0.05))
    const wipe = streak.mul(dryRun)
    const wipedPaint = impastoColor(random(7).mul(impastoOrder.length).floor())
    // A title in charcoal across the upper part.
    const charcoal = scribble(surface, vec2(opening.x.mul(-0.25), opening.y.mul(0.62)), 0.3, 0.032, 4.2)
    const hanger = hangingWire(surface)
    const marked = mix(mix(poplar, wipedPaint, wipe), color('#2a2622'), charcoal.mul(0.85))
    this.colorNode = mix(marked, hanger.color, hanger.cover)
    this.metalnessNode = hanger.cover
    this.roughnessNode = mix(mix(float(0.75), float(0.45), wipe), float(0.35), hanger.cover)
    this.normalNode = heightNormal(wipe.mul(0.0004).add(grain.mul(0.00003)).add(hanger.height).add(charcoal.mul(0.00001)))
  }
}

