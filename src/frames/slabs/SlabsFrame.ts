import type {Node} from 'three/webgpu'

import {color, exp, float, max, mix, mx_cell_noise_float, mx_noise_float, select, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, insideBy, visibleDetail} from '#src/lib/materials/filters.ts'
import {paintColor, paintOrder} from '#src/lib/materials/oilPaints.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {withOpening} from '../lib/frameBack.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {aroundLoop, aroundOpening, frameSurface} from '../lib/materials/frameAttributes.ts'
import {backSurface, galleryLabel, hangingWire} from '../lib/materials/frameBacks.ts'
import frameStudio from '../lib/materials/frameStudio.ts'
import GiltMaterial from '../lib/materials/GiltMaterial.ts'

type Float = Node<'float'>
type Vec2 = Node<'vec2'>
type Vec3 = Node<'vec3'>

const imageDepth = -0.056
const gilt = 0
const slabs = 1
const back = 2
const cushion = {
  from: 0.008,
  to: 0.092,
}
/** a slim gilt fillet round the work, then a broad caked face of sculpted palette-knife impasto slabs sloping down to a dark walnut rim */
const profile = FrameProfile.from([-0.005, imageDepth], gilt)
  .line(-0.005, -0.045)
  .arc(0.006, -0.044, 0.5, {steps: 6})
  .line(cushion.from, -0.044, {material: slabs})
  .arc(cushion.to, -0.046, 0.14, {steps: 10})
  .arc(0.106, -0.064, 0.35, {steps: 5})
  .line(0.106, frameBack)
  .line(-0.005, frameBack, {material: back})
/** how wide each palette-knife slab cell is around the loop, in meters */
const slabCell = 0.042
/** the two staggered lanes across the face, inner and outer */
const lanes = [
  {
    vCenter: 0.025,
    seed: 1,
    offset: 0,
  },
  {
    vCenter: 0.058,
    seed: 29,
    offset: 0.5,
  },
] as const
/** One palette-knife slab of heavy oil paint laid across the frame in `cell` (`wrapped` around the loop so the ends meet without a seam): thick, ragged-edged, streaked with two unmixed paints and piled into a crisp trowel ridge where the knife lifted off. */
function knifeSlab(loopPoint: Vec2, cell: Float, wrapped: Float, vCenter: number, footprint: Float, layerSeed: number) {
  const random = (k: number) => mx_cell_noise_float(vec3(wrapped, layerSeed, k))
  const centerU = cell.add(random(0).mul(0.5).add(0.25)).mul(slabCell)
  const centerV = random(1).sub(0.5).mul(0.012).add(vCenter)
  const angle = random(2).sub(0.5).mul(1.7).add(select(random(3).lessThan(0.5), float(0.35), float(-0.35)))
  const direction = vec2(angle.cos(), angle.sin())
  const offset = loopPoint.sub(vec2(centerU, centerV))
  const ahead = offset.dot(direction)
  const aside = offset.dot(vec2(direction.y.negate(), direction.x))
  const halfLength = random(4).mul(0.014).add(0.022)
  const halfWidth = random(5).mul(0.008).add(0.015)
  const seed = wrapped.mul(1.73).add(layerSeed)
  const ragged = mx_noise_float(vec3(ahead.mul(55), aside.mul(35), seed)).mul(0.2).add(1)
  const widthEdge = halfWidth.mul(ragged)
  const lengthEdge = halfLength.mul(ragged)
  // Rounded-trowel slab rather than a sharp tape rectangle.
  const shape = vec2(ahead.div(lengthEdge), aside.div(widthEdge)).length().sub(1).mul(halfWidth)
  const cover = insideBy(shape, footprint)
  // Two unmixed paints dragged together by the knife, enriched with warm ivory or ochre.
  const pick = (k: number) => paintColor(random(k).mul(paintOrder.length).floor())
  const streak = mx_noise_float(vec3(ahead.mul(16), aside.mul(120), seed.add(2.3))).add(aside.div(halfWidth).mul(0.42))
  const loaded = mix(pick(6), pick(7), streak.smoothstep(-0.14, 0.14))
  const pigment = mix(loaded, select(random(8).lessThan(0.5), color('#f6efe0'), color('#c78226')), random(9).mul(0.22))
  // Thick flat body, beveled sides, a sharp piled-up lip where the trowel lifted off and fine blade striations.
  const acrossNorm = aside.abs().div(widthEdge).clamp(0, 1)
  const alongNorm = ahead.div(lengthEdge).clamp(-1, 1)
  // Cambered trowel slope + directional knife-tilt so each slab tilts reflections in its own angle instead of mirroring the moulding cylinder.
  const tilt = alongNorm.mul(0.45).add(0.55)
  const body = float(1).sub(acrossNorm.pow2().mul(0.6)).max(0).mul(float(1).sub(alongNorm.pow2().mul(0.45)).max(0)).mul(tilt).mul(0.0022)
  const ridge = exp(alongNorm.sub(0.72).div(0.14).pow2().negate()).mul(0.0032).mul(acrossNorm.oneMinus().pow2())
  const sideBead = exp(acrossNorm.sub(0.82).div(0.11).pow2().negate()).mul(0.0014)
  const scored = mx_noise_float(vec3(ahead.mul(22), aside.mul(420), seed)).mul(0.00026).mul(visibleDetail(footprint, 0.002))
  const bevel = acrossNorm.oneMinus().mul(0.3).add(0.7).mul(alongNorm.abs().oneMinus().mul(0.24).add(0.76))
  return {
    color: pigment.mul(bevel),
    cover,
    height: body.add(ridge).add(sideBead).mul(visibleDetail(footprint, 0.004)).add(scored),
  }
}

/** One of the Impasto Orb’s frames, from #236: a broad frame caked round its whole face in heavy, overlapping palette-knife slabs of unmixed oil paint, piled into crisp sculptural ridges inside a slim gilt fillet. */
export default class SlabsFrame extends PortraitFrame {
  override readonly description = 'A painter’s heavy frame buried under sculptural impasto: thick, ragged-edged palette-knife slabs of cadmium yellow, vermilion, titanium white, ultramarine and viridian piled side by side round the work without a miter seam, their lifted edges standing up in crisp glossy ridges around a slim gilt sight fillet and an oiled walnut outer bevel. On the back, bare walnut edged with dried paint crusts, a gallery label and the hanging wire.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#c98838'
  override readonly title = 'Knife slabs'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...withOpening(sweepProfile(profile, width / 2, height / 2), back, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [new GiltMaterial({wear: 0.14}), new SlabReliefMaterial, new SlabBackMaterial]
  }
}

/**
 * Overlapping palette-knife slabs laid seamlessly round the frame’s loop in two staggered lanes over a dark walnut underpainting, each ridge catching raking studio highlights on a glossy oil skin.
 */
class SlabReliefMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.7,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('slabsFrameFootprint')
    const at = aroundOpening(p.xy, surface.opening)
    const middle = (cushion.from + cushion.to) / 2
    const loop = surface.opening.x.add(surface.opening.y).add(middle * 2).mul(4).toVar('slabsFrameLoop')
    const count = loop.div(slabCell).round().max(4).toVar('slabsFrameCount')
    const u = at.distance.div(at.perimeter).mul(count).mul(slabCell)
    const v = at.reach.sub(cushion.from)
    const round = aroundLoop(at.distance, at.perimeter, loop)
    const underNoise = mx_noise_float(vec3(round.mul(18), v.mul(90))).mul(0.5).add(0.5)
    const walnut = mix(color('#3d2313'), color('#5b3820'), underNoise)
    let pigment: Vec3 = walnut
    let height: Float = underNoise.mul(0.0001)
    let painted: Float = float(0)
    const onFace = at.reach.smoothstep(cushion.from - 0.002, cushion.from + 0.006).mul(at.reach.smoothstep(cushion.to + 0.004, cushion.to - 0.008))
    for (const lane of lanes) {
      const shiftedU = u.add(lane.offset * slabCell)
      const shiftedPoint = vec2(shiftedU, v)
      const base = shiftedU.div(slabCell).floor()
      for (const dx of [-1, 0, 1]) {
        const cell = base.add(dx)
        const wrapped = cell.sub(count.mul(cell.div(count).floor()))
        const slab = knifeSlab(shiftedPoint, cell, wrapped, lane.vCenter, footprint, lane.seed)
        const shown = slab.cover.mul(onFace)
        pigment = mix(pigment, slab.color, shown)
        height = mix(height, height.mul(0.45).add(slab.height), shown)
        painted = painted.max(shown)
      }
    }
    const normal = heightNormal(height)
    this.colorNode = pigment
    this.roughnessNode = mix(float(0.58), float(0.32), painted)
    this.normalNode = normal
  }
}
/**
 * The back: dark walnut with dried impasto paint spilled around the outer bevel, a gallery label pasted on and the hanging wire across it.
 */
class SlabBackMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.45,
    })
    const surface = backSurface()
    const {footprint, opening, point} = surface
    const grain = mx_noise_float(vec3(point.x.mul(4), point.y.mul(220), 0.7)).mul(0.5).add(0.5)
    const walnut = mix(color('#3e2616'), color('#5e3b22'), grain)
    const outer = opening.add(profile.reach)
    const inset = outer.sub(point.abs()).min(outer.sub(point.abs()).yx).x
    const spill = mx_noise_float(vec3(point.mul(45), 3.4)).mul(0.008).sub(inset).smoothstep(-0.003, 0.002)
    const spillPaint = paintColor(mx_noise_float(vec3(point.mul(16), 9.1)).mul(0.5).add(0.5).mul(paintOrder.length).floor())
    const crusted = mix(walnut, spillPaint, spill.mul(0.85))
    const label = galleryLabel(surface, vec2(outer.x.mul(0.4), outer.y.mul(-0.48)), [0.1, 0.058])
    const hanger = hangingWire(surface)
    const labeled = mix(crusted, label.color, label.cover)
    this.colorNode = mix(labeled, hanger.color, hanger.cover)
    this.metalnessNode = hanger.cover
    this.roughnessNode = mix(mix(float(0.58), float(0.32), spill), float(0.35), hanger.cover)
    this.normalNode = heightNormal(spill.mul(0.0005).add(label.height).add(hanger.height).add(grain.mul(0.00003).mul(visibleDetail(footprint, 0.002))))
  }
}
