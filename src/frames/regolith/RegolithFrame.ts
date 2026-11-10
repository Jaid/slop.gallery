import type {FrameSurface} from '../lib/materials/frameAttributes.ts'
import type {Node} from 'three/webgpu'

import {clamp, float, mx_fractal_noise_float, mx_worley_noise_float, vec3} from 'three/tsl'

import {visibleDetail} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import FrameMetalMaterial, {brass} from '../lib/materials/FrameMetalMaterial.ts'
import FrameStoneMaterial, {regolith} from '../lib/materials/FrameStoneMaterial.ts'

type Float = Node<'float'>

const imageDepth = -0.06
const stone = 0
const metal = 1
/** a slim gold fillet at the sight edge, like the crater’s rim, then a lumpy, rounded face of lunar stone falling away to the wall */
const profile = FrameProfile.from([-0.005, imageDepth], metal)
  .line(-0.005, -0.053)
  .arc(0.006, -0.053, 0.45)
  .line(0.008, -0.056, {material: stone})
  .arc(0.06, -0.026, -0.08, {steps: 8})
  .arc(0.12, -0.075, 0.3, {steps: 14})
  .line(0.12, frameBack)
  .line(-0.005, frameBack)
/** Craters of every size pocking the surface, each a bowl with a raised rim, the small ones scattered over the large: a height in meters. */
function craters(surface: FrameSurface) {
  const p = vec3(surface.along, surface.reach.add(surface.position.z), surface.member.mul(1.7))
  const footprint = surface.position.x.fwidth().max(surface.position.y.fwidth()).max(surface.position.z.fwidth())
  let height: Float = mx_fractal_noise_float(p.mul(30), 4).mul(0.0012)
  for (const [scale, depth] of [[18, 0.0035], [45, 0.0018], [110, 0.0008]] as const) {
    const d = mx_worley_noise_float(p.mul(scale)).div(0.5)
    const bowl = clamp(float(1).sub(d.div(0.55)), 0, 1).pow(2).negate()
    const rim = d.sub(0.6).div(0.12).pow(2).negate().exp().mul(0.35)
    height = height.add(bowl.add(rim).mul(depth).mul(visibleDetail(footprint, 1 / scale)))
  }
  return height
}

/** Moonfall’s: a frame of pale lunar stone pocked with craters of every size, glinting with glass beads, a gold fillet round the work like the crater’s rim. */
export default class RegolithFrame extends PortraitFrame {
  override readonly description = 'A piece of the crater itself: a heavy, lumpy round of pale gray lunar stone, pocked with craters of every size, each a bowl with a raised rim, the small ones scattered over the large, glinting with beads of impact glass, round a slim gold fillet like the crater’s rim on the floor.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'heavy'
  override readonly reach = profile.reach
  override readonly tint = '#a0a4a4'
  override readonly title = 'Lunar regolith'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [new FrameStoneMaterial({
      stone: regolith,
      relief: craters,
    }), new FrameMetalMaterial({metal: brass})]
  }
}
