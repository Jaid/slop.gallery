import type {Timber} from '#src/lib/materials/frames/FrameWoodMaterial.ts'

import {color, float, mix, mx_noise_float, select, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal} from '#src/lib/materials/filters.ts'
import {legible} from '#src/lib/materials/frames/carving.ts'
import {backSurface, hangingWire, scribble} from '#src/lib/materials/frames/frameBacks.ts'
import frameStudio from '#src/lib/materials/frames/frameStudio.ts'
import FrameWoodMaterial from '#src/lib/materials/frames/FrameWoodMaterial.ts'

import PortraitFrame, {frameBack} from './base/PortraitFrame.ts'
import {withOpening} from './frameBack.ts'
import {assembleFrame, corners, place, sweepProfile} from './frameGeometry.ts'
import FrameProfile from './FrameProfile.ts'
import {block, turned} from './ornaments.ts'

const imageDepth = -0.052
/** the material of the back */
const back = 1
/** the casing’s face, five flutes between fillets */
const face = -0.038
const flutes = {
  from: 0.013,
  count: 5,
  width: 0.0115,
  fillet: 0.0035,
}
/** a small bead at the sight edge, a flat casing run with five flutes, and a back band rounded over to the wall */
const profile = (() => {
  const section = FrameProfile.from([-0.005, imageDepth])
    .line(-0.005, -0.042)
    .arc(0.005, -0.042, 0.5, {steps: 6})
    .line(0.007, face)
    .line(flutes.from, face)
  let r = flutes.from
  for (let index = 0; index < flutes.count; index++) {
    section.arc(r + flutes.width, face, -0.42, {steps: 5})
    r += flutes.width
    if (!(index < flutes.count - 1)) {
      continue
    }
    section.line(r + flutes.fillet, face)
    r += flutes.fillet
  }
  return section
    .line(r + 0.005, face)
    .line(r + 0.007, -0.034)
    .arc(r + 0.013, -0.04, 0.5, {steps: 6})
    .line(r + 0.013, frameBack)
    .line(-0.005, frameBack, {material: back})
})()
/** the square corner blocks over the miters, standing proud of the casing, and the turned bull’s-eye rosette on each */
const cornerBlock = {
  size: 0.1,
  back: -0.05,
  front: -0.03,
}
const rosetteHeight = 0.0095
/** a varnished chestnut, honey brown and open in the grain */
const chestnut: Timber = {
  light: '#b07a42',
  dark: '#7e5129',
  ring: '#4f3017',
  rings: 95,
  pores: 0.75,
}

/** The Corridor’s: a fluted Victorian door casing in varnished chestnut, the miters hidden under square corner blocks, each turned with a bull’s-eye rosette. */
export default class CorridorCasingFrame extends PortraitFrame {
  override readonly description = 'For a passage of doorways: a Victorian door casing in varnished chestnut, its face run with five flutes between fillets, the miters hidden under square corner blocks, each turned on the lathe into a bull’s-eye rosette of rings stepping in to a domed button, as the carpenters of the long way round trimmed every door. Its back is primed in red oxide, as carpenters back-prime trim against the damp of a wall, the chestnut showing through the thin strokes.'
  override readonly front = cornerBlock.front + rosetteHeight
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = Math.max(profile.reach, cornerBlock.size / 2 + (profile.reach - 0.005) / 2)
  override readonly tint = '#8a5a30'
  override readonly title = 'Bull’s-eye casing'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const middle = (profile.reach - 0.005) / 2
    const rosette = turned([[0.036, 0], [0.036, 0.0025], [0.031, 0.004], [0.027, 0.0025], [0.023, 0.0025], [0.02, 0.0055], [0.015, 0.0065], [0.011, 0.004], [0.007, 0.0065], [0.003, 0.009], [0, rosetteHeight]], 16, {kind: 2})
    return assembleFrame([
      ...withOpening(sweepProfile(profile, halfWidth, halfHeight), back, halfWidth, halfHeight),
      [0, place(block(cornerBlock.size, cornerBlock.size, cornerBlock.front - cornerBlock.back, {kind: 1}), corners(halfWidth, halfHeight, middle, cornerBlock.back))],
      [0, place(rosette, corners(halfWidth, halfHeight, middle, cornerBlock.front))],
    ])
  }

  protected override createMaterials() {
    return [new FrameWoodMaterial({
      timber: chestnut,
      gloss: 0.4,
      roughness: 0.45,
      grime: 0.4,
      // The lathe’s fine rings on the rosettes.
      relief: surface => {
        const p = vec2(surface.along, surface.across)
        const rings = p.length().mul(2400).sin().mul(0.5).add(0.5)
        return select(surface.member.round().equal(6), legible(surface, rings, 0.002).mul(0.00003), float(0))
      },
    }), new CasingBackMaterial]
  }
}
/** The back, primed in red oxide as carpenters back-prime trim against the damp of a wall, in streaky strokes the chestnut shows through where they ran thin, a pencilled note on which wall it is for, and the hanging wire across it. */
class CasingBackMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.4,
      roughness: 0.75,
    })
    const surface = backSurface()
    const {opening, point} = surface
    const grain = mx_noise_float(vec3(point.x.mul(3), point.y.mul(180), 5.5)).mul(0.5).add(0.5)
    const wood = mix(color('#7e5129'), color('#b07a42'), grain)
    const strokes = mx_noise_float(vec3(point.x.mul(260), point.y.mul(6), 2.4)).mul(0.5).add(0.5)
    const thin = strokes.smoothstep(0.62, 0.85)
    const primer = mix(color('#4a1c12'), color('#62271a'), strokes)
    const note = scribble(surface, vec2(opening.x.mul(-0.2), opening.y.mul(-0.25)), 0.2, 0.035, 2.2)
    const hanger = hangingWire(surface)
    this.colorNode = mix(mix(mix(primer, wood, thin.mul(0.6)), color('#d8d0c0'), note.mul(0.7)), hanger.color, hanger.cover)
    this.metalnessNode = hanger.cover
    this.roughnessNode = mix(float(0.7), float(0.35), hanger.cover)
    this.normalNode = heightNormal(strokes.mul(0.00006).add(grain.mul(0.00003)).add(hanger.height))
  }
}
