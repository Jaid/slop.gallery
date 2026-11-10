import type {Placement} from '../lib/frameGeometry.ts'
import type {FrameSurface} from '../lib/materials/frameAttributes.ts'
import type {Node} from 'three/webgpu'

import {color, float, max, mix, mx_cell_noise_float, mx_noise_float, select, time, vec2, vec3} from 'three/tsl'
import {LatheGeometry, MeshPhysicalNodeMaterial, Vector2} from 'three/webgpu'

import {heightNormal, insideBy, visibleDetail} from '#src/lib/materials/filters.ts'
import {paintColor, paintOrder} from '#src/lib/materials/oilPaints.ts'

import PortraitFrame, {frameBack, frameTriangleBudget} from '../base/PortraitFrame.ts'
import {withOpening} from '../lib/frameBack.ts'
import {along, assembleFrame, ornament, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {frameSurface} from '../lib/materials/frameAttributes.ts'
import {backSurface, hangingWire} from '../lib/materials/frameBacks.ts'
import frameStudio from '../lib/materials/frameStudio.ts'

type Float = Node<'float'>
type Vec3 = Node<'vec3'>

const imageDepth = -0.05
const palette = 0
const back = 1
/** the broad face of the palette, sloping gently back from a rounded lip at the work to a round down to the wall */
const face = {
  from: 0.006,
  to: 0.09,
  inner: -0.036,
  outer: -0.044,
}
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.04)
  .arc(face.from, face.inner, 0.3, {steps: 4})
  .line(face.to, face.outer)
  .arc(0.104, -0.058, 0.45, {steps: 6})
  .line(0.104, frameBack)
  .line(-0.005, frameBack, {material: back})
/** the dollops of paint squeezed out in a row round the outer part of the face, as on a palette: how far out, how large, how far apart and how many triangles each takes */
const dollop = {
  reach: 0.074,
  radius: 0.0145,
  height: 0.0105,
  spacing: 0.09,
  inset: 0.05,
  segments: 9,
}
/** the triangles of one dollop: its outline’s five runs, two per segment each */
const dollopTriangles = 5 * 2 * dollop.segments
/**
 * The two layers of knife smears: the old ones, dried long ago, muddied with earth and white, and the newer ones over them, some of which the unseen knife comes back to. Each starts one smear in every stretch of the face `cell` long; every smear stays within its stretch and the next, so a point only needs to look at its own stretch and the two beside it.
 */
const layers = [{
  cell: 0.03,
  seed: 0,
  live: 0,
  muddied: 0.4,
}, {
  cell: 0.04,
  seed: 8,
  live: 0.4,
  muddied: 0.1,
}] as const
type SmearLayer = typeof layers[number]
/** how often the unseen knife comes back to scrape a smear anew, in seconds, how long a scrape takes and how long the fresh paint stays wet */
const knife = {
  period: 11,
  stroke: 0.7,
  drying: 5,
}
/** How far in front of the frame’s middle the face lies `r` out past the opening. */
const faceAt = (r: number) => face.inner + (face.outer - face.inner) * (r - face.from) / (face.to - face.from)
/** A pseudo-random number from 0 to 1 for the integer, the same on every run. */
const scatter = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43_758.5453
  return value - Math.floor(value)
}
/**
 * A dollop of paint squeezed out of its tube onto the palette, its middle at the origin: a lumpy mound that ends in a soft peak pulled over to one side as the tube was lifted off, and ridged round where it coiled out. Its kind is the index of its paint in {@link paintOrder}.
 */
function squeezed(paint: number) {
  const outline = [[1, 0], [0.97, 0.3], [0.8, 0.62], [0.5, 0.86], [0.2, 0.98], [0, 1]].map(([radius, height]) => new Vector2(radius * dollop.radius, height * dollop.height))
  const lathe = new LatheGeometry(outline, dollop.segments)
  // A lathe turns about y; tipped forward, its axis points at the viewer.
  lathe.rotateX(Math.PI / 2)
  const position = lathe.getAttribute('position')
  const seed = paint * 1.7 + 0.4
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index)
    const y = position.getY(index)
    const up = Math.max(0, position.getZ(index) / dollop.height)
    const angle = Math.atan2(y, x)
    // Lumps round its foot, the coil’s ridge winding up it, and the peak drawn over to one side.
    const lumps = 1 + Math.sin(angle * 3 + seed) * 0.12 + Math.sin(angle * 5 + seed * 2.3) * 0.06 + Math.sin(angle * 2 - up * 7 + seed) * 0.05 * up
    const lean = up ** 2.2 * dollop.radius * 0.55
    position.setXYZ(index, x * lumps + Math.cos(seed) * lean, y * lumps + Math.sin(seed) * lean, position.getZ(index) * (1 + Math.sin(angle * 2 + seed) * 0.08))
  }
  // Smooth over the indexed lathe, before the ornament drops its index.
  lathe.computeVertexNormals()
  return ornament(lathe, {kind: paint})
}
/**
 * One smear the palette knife left in a stretch of the face, as long as its layer’s cell along the member: a broad swathe of two paints dragged together, swirled into each other without mixing through, its paint rolled up thick along its sides and heaped where the knife lifted off, scored along by the knife’s edge. Some of the newer smears are scraped anew by an unseen knife now and then, which drags fresh paint over the old along the same swathe, a bead riding ahead of it, wet and glossy until it dries.
 * Returns how much the smear covers the point, its color, how high its paint stands and how wet it is.
 */
function smear(surface: FrameSurface, index: Float, footprint: Float, layer: SmearLayer) {
  /** a random number from 0 to 1 for this smear, another for every `k`, and for every round `round` of the knife */
  const random = (k: number, round: Float = float(0)) => mx_cell_noise_float(vec3(index, surface.member.add(layer.seed), round.mul(32).add(k)))
  const start = vec2(index.add(random(0)).mul(layer.cell), random(1).mul(0.05).add(0.022))
  // Most smears run along the member, either way, some slanting across it.
  const angle = random(2).sub(0.5).mul(1.4).add(select(random(3).lessThan(0.5), float(0), float(Math.PI)))
  const direction = vec2(angle.cos(), angle.sin())
  const offset = vec2(surface.along, surface.reach).sub(start)
  const ahead = offset.dot(direction)
  const aside = offset.dot(vec2(direction.y.negate(), direction.x))
  const length = random(4).mul(0.04).add(0.035)
  const halfWidth = random(5).mul(0.007).add(0.008)
  const noiseSeed = index.mul(1.37).add(surface.member.mul(5.1)).add(layer.seed)
  // The knife sets down round and lifts off gradually, so the swathe narrows toward its end, and its edges are ragged.
  const share = ahead.div(length).clamp(0, 1)
  const ragged = mx_noise_float(vec3(ahead.mul(110), noiseSeed, 0.5)).mul(0.12).add(mx_noise_float(vec3(ahead.mul(420), noiseSeed, 1.5)).mul(0.04)).add(1)
  const edge = halfWidth.mul(ragged).mul(share.smoothstep(0.45, 1).mul(-0.45).add(1))
  const capsule = vec2(ahead.min(0), aside).length().sub(edge)
  const shape = max(capsule, ahead.sub(length))
  // Filtered by the footprint, as the smears a pixel looks at change from one stretch to the next.
  const cover = insideBy(shape, footprint)
  // The knife comes back to the live smears once a round, at a moment of its own, and drags fresh paint along the swathe from its start.
  const isLive = random(7).lessThan(layer.live)
  const round = time.div(knife.period).floor()
  const slot = random(8).mul(knife.period - knife.stroke)
  const front = time.sub(round.mul(knife.period)).sub(slot).div(knife.stroke).clamp(0, 1).mul(length)
  const scraped = ahead.lessThan(front)
  const own = select(isLive, select(scraped, round, round.sub(1)), float(0))
  const paint = (k: number) => paintColor(random(k, own).mul(paintOrder.length).floor())
  // The second paint swirled through the first in broad streaks drawn out along the swathe.
  const swirl = mx_noise_float(vec3(ahead.mul(40), aside.mul(40), noiseSeed.add(own))).mul(0.004)
  const streak = mx_noise_float(vec3(ahead.mul(12), aside.add(swirl).mul(130), noiseSeed.add(own).add(3))).add(aside.div(halfWidth).mul(0.45))
  const mixed = mix(paint(10), paint(11), streak.smoothstep(-0.12, 0.12))
  // Dragged through a little white or a little of the earth already on the palette, the old smears muddied much more.
  const tinted = mix(mixed, select(random(12, own).lessThan(0.5), color('#f4efe2'), color('#5a3a22')), random(13, own).mul(0.3).add(layer.muddied))
  // How long ago the knife passed here: wet right behind it, drying over the next seconds, and long dry on the smears it never comes back to.
  const scrapedAt = round.mul(knife.period).add(slot).add(share.mul(knife.stroke))
  const age = select(scraped, time.sub(scrapedAt), time.sub(scrapedAt).add(knife.period))
  const wet = select(isLive, age.div(-knife.drying).exp(), float(0))
  // The paint lies in a flat swathe, rolled up thick along its sides, heaped where the knife lifted off, scored along by its edge, and a bead rides ahead of the knife while it drags.
  const across = aside.abs().div(edge).clamp(0, 1)
  const body = float(1).sub(across.pow(6)).max(0).sqrt().mul(0.0006)
  const rolls = across.sub(0.85).div(0.1).pow(2).negate().exp().mul(0.0006)
  const heap = ahead.sub(length.mul(0.94)).div(0.004).pow(2).negate().exp().mul(0.0016).mul(across.oneMinus().sqrt())
  const bead = select(isLive.and(front.lessThan(length)).and(front.greaterThan(0)), ahead.sub(front).div(0.003).pow(2).negate().exp().mul(0.002).mul(across.oneMinus().sqrt()), float(0))
  const scored = mx_noise_float(vec3(ahead.mul(16), aside.mul(450), noiseSeed)).mul(0.00012).add(mx_noise_float(vec3(ahead.mul(50), aside.mul(1300), noiseSeed)).mul(0.00004)).mul(visibleDetail(footprint, 0.002))
  const height = body.add(rolls.add(heap).mul(visibleDetail(footprint, 0.004))).add(scored).add(bead)
  return {
    color: tinted,
    cover,
    height,
    wet,
  }
}

/** The Forge’s: a painter’s palette laid round the work, its wood caked with knife smears and a row of fresh dollops squeezed out round its outer edge, some smears scraped anew by an unseen knife. */
export default class PaletteFrame extends PortraitFrame {
  override readonly description = 'A painter’s palette laid round the work: a broad face of oiled walnut, caked with old crusts and with knife smears of two paints dragged together, streaked without mixing through, ridged at their sides and heaped where the knife lifted off, a row of fresh dollops of cadmium yellow, vermilion, titanium white, ultramarine and viridian squeezed out round its outer edge, each ending in a soft peak. Every few seconds an unseen palette knife scrapes one of the smears anew, dragging fresh paint over the old, glossy and wet until it dries. Its back is the bare walnut of the palette, paint run over its edge in drips and smudged by the painter’s thumbs.'
  override readonly front = faceAt(dollop.reach) + dollop.height * 1.1
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#7a5034'
  override readonly title = 'Palette'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const moulding = withOpening(sweepProfile(profile, halfWidth, halfHeight), back, halfWidth, halfHeight)
    // As many dollops as the triangles the moulding leaves.
    const left = frameTriangleBudget - moulding.values().reduce((sum, part) => sum + part.getAttribute('position').count / 3, 0)
    const spots = along(halfWidth, halfHeight, dollop.reach, faceAt(dollop.reach) - 0.0012, {
      spacing: dollop.spacing,
      inset: dollop.inset,
      limit: Math.floor(left / dollopTriangles),
    })
    // The paints follow each other round the frame in the order they are squeezed out, every dollop a size and a turn of its own.
    const byPaint = Map.groupBy(spots.map((spot, index): Placement => ({
      ...spot,
      angle: (spot.angle ?? 0) + scatter(index) * Math.PI * 2,
      scale: 0.75 + scatter(index + 0.5) * 0.45,
    })), (_, index) => index % paintOrder.length)
    return assembleFrame([...moulding, ...[...byPaint].map(([paint, placements]) => [palette, place(squeezed(paint), placements)] as const)])
  }

  protected override createMaterials() {
    return [new PaletteMaterial, new PaletteBackMaterial]
  }
}

/**
 * The palette: oiled walnut caked with old dried crusts of mixed paint, overlaid by knife smears of two paints streaked together, the newest on top, ridged at their sides and heaped where the knife lifted off; the smears an unseen knife scrapes anew are wet and glossy right behind it and dull as they dry. The dollops round the edge are fresh paint, lumpy, glossy and just skinning over, each of its own paint.
 */
class PaletteMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.7,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('paletteFootprint')
    // The wood: walnut, oiled, its grain running along the members.
    const grain = mx_noise_float(vec3(surface.along.mul(4), surface.reach.mul(240), surface.member)).mul(0.5).add(0.5)
    const lines = grain.mul(9).fract().smoothstep(0.75, 0.95).mul(visibleDetail(footprint, 0.0015))
    const wood = mix(mix(color('#6a4126'), color('#8a5a34'), grain), color('#3a2214'), lines.mul(0.5))
    // The smears, in this stretch and the ones on either side, which may reach into it, those further along lying on top, the newer layer over the old one; they thin out toward the lip and the outer edge.
    const onFace = surface.reach.smoothstep(face.from + 0.004, face.from + 0.01).mul(surface.reach.smoothstep(face.to + 0.004, face.to - 0.008))
    let surfaceColor: Vec3 = wood
    let height: Float = float(0)
    let wet: Float = float(0)
    let painted: Float = float(0)
    for (const layer of layers) {
      const cell = surface.along.div(layer.cell).floor()
      for (const shift of [-1, 0, 1]) {
        const {color: smearColor, cover, height: smearHeight, wet: smearWet} = smear(surface, cell.add(shift), footprint, layer)
        const shown = cover.mul(onFace)
        surfaceColor = mix(surfaceColor, smearColor, shown)
        height = mix(height, height.mul(0.6).add(smearHeight), shown)
        wet = mix(wet, smearWet, shown)
        painted = painted.max(shown)
      }
    }
    // The dollops: fresh paint of their own color, lumpy where it coiled out of the tube.
    const isDollop = surface.isOrnament
    const dollopPaint = surface.member.sub(4).round()
    const lumpy = mx_noise_float(p.mul(900)).mul(0.00004).add(mx_noise_float(p.mul(260)).mul(0.00008)).mul(visibleDetail(footprint, 0.001))
    const fresh = mix(paintColor(dollopPaint), paintColor(dollopPaint).mul(0.82), mx_noise_float(p.mul(160)).mul(0.5).add(0.5).mul(0.3))
    this.colorNode = mix(surfaceColor, fresh, isDollop)
    const dry = mix(float(0.55), float(0.4), painted)
    this.roughnessNode = mix(mix(dry, float(0.12), wet), float(0.2), isDollop)
    this.clearcoatNode = mix(wet.mul(0.8), float(0.5), isDollop)
    this.clearcoatRoughnessNode = mix(float(0.12), float(0.2), isDollop)
    this.normalNode = heightNormal(mix(height, lumpy, isDollop))
  }
}
/**
 * The palette’s back: the same walnut, bare and dry, paint run over its outer edge in drips of every paint, the painter’s thumbprints smudged on it in paint here and there, and the hanging wire across it.
 */
class PaletteBackMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.5,
    })
    const surface = backSurface()
    const {footprint, opening, point} = surface
    const grain = mx_noise_float(vec3(point.x.mul(3), point.y.mul(3), 0.4)).add(mx_noise_float(vec3(point.x.mul(240), point.y.mul(4), 1.9)).mul(0.6)).mul(0.5).add(0.5)
    const wood = mix(color('#5a3820'), color('#7e5230'), grain)
    // How far in from the outer edge, along the nearest edge.
    const outer = opening.add(profile.reach)
    const inset = outer.sub(point.abs())
    const onSide = inset.x.lessThan(inset.y)
    const fromEdge = inset.x.min(inset.y)
    const run = select(onSide, point.y, point.x)
    const edge = select(onSide, point.x.sign(), point.y.sign().mul(2))
    // Drips run in from the edge where paint ran over it, each down to its own length.
    const lane = run.div(0.012).floor()
    const random = (k: number) => mx_cell_noise_float(vec3(lane, edge, k))
    const isDrip = random(0).lessThan(0.3)
    const length = random(1).pow(2).mul(0.035).add(0.004)
    const middle = lane.add(random(2).mul(0.5).add(0.25)).mul(0.012)
    const width = random(3).mul(0.0012).add(0.0012).mul(fromEdge.div(length).clamp(0, 1).mul(-0.5).add(1))
    const drip = select(isDrip, insideBy(max(run.sub(middle).abs().sub(width), fromEdge.sub(length)), footprint).max(insideBy(vec2(run.sub(middle), fromEdge.sub(length)).length().sub(width.mul(1.5)), footprint)), float(0))
    const dripPaint = paintColor(random(4).mul(paintOrder.length).floor())
    // Thumbprints near the edges where the palette was held, smudged in paint, their ridges whorled.
    const thumbCell = point.div(0.09).floor()
    const thumbRandom = (k: number) => mx_cell_noise_float(vec3(thumbCell, k))
    const thumbAt = thumbCell.add(vec2(thumbRandom(0), thumbRandom(1)).mul(0.6).add(0.2)).mul(0.09)
    const toThumb = point.sub(thumbAt).mul(vec2(1, 0.75))
    const isThumb = thumbRandom(2).lessThan(0.3)
    const print = select(isThumb, insideBy(toThumb.length().sub(0.009), footprint), float(0))
    const ridges = toThumb.length().mul(2600).sin().mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.0008))
    const thumbPaint = paintColor(thumbRandom(3).mul(paintOrder.length).floor())
    const smudged = mix(wood, mix(thumbPaint, wood, 0.45), print.mul(ridges.mul(0.6).add(0.4)))
    const painted = mix(smudged, dripPaint, drip)
    const hanger = hangingWire(surface)
    this.colorNode = mix(painted, hanger.color, hanger.cover)
    this.metalnessNode = hanger.cover
    this.roughnessNode = mix(mix(float(0.6), float(0.3), drip), float(0.35), hanger.cover)
    this.normalNode = heightNormal(drip.mul(0.0006).add(print.mul(ridges).mul(0.00004)).add(hanger.height).add(grain.mul(0.00003)))
  }
}
