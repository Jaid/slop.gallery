import {color, float, max, mix, mx_noise_float, mx_worley_noise_vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {frameSurface} from '../lib/materials/frameAttributes.ts'
import FrameMetalMaterial from '../lib/materials/FrameMetalMaterial.ts'
import frameStudio from '../lib/materials/frameStudio.ts'

const imageDepth = -0.06
const copper = 0
const char = 1
/** a slim copper fillet round the work, then a broad, softly rounded board charred black */
const profile = FrameProfile.from([-0.005, imageDepth], copper)
  .line(-0.005, -0.052)
  .arc(0.007, -0.052, 0.5)
  .line(0.009, -0.056)
  .line(0.012, -0.05, {material: char})
  .arc(0.105, -0.05, 0.12, {steps: 14})
  .arc(0.112, -0.07, 0.4, {steps: 4})
  .line(0.112, frameBack)
  .line(-0.005, frameBack)
/** The Lodge’s: a board of charred, wire-brushed wood split into alligator scales, round a slim copper fillet. */
export default class CharredFrame extends PortraitFrame {
  override readonly description = 'Wood that went through the Lodge’s fire, as Japanese carpenters char it: a broad, softly rounded board burned until it split into alligator scales of charcoal, black in their cracks and silvery where the light skims them, wire-brushed along the grain, round a slim fillet of rubbed copper.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#1a1716'
  override readonly title = 'Shou sugi ban'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [
      new FrameMetalMaterial({metal: {
        bright: '#d1885a',
        dull: '#6e3a22',
        roughness: 0.3,
        patina: {
          amount: 0.4,
          color: '#4f7f6a',
        },
      }}),
      new CharredWoodMaterial,
    ]
  }
}

/**
 * Shou sugi ban: wood burned until its surface splits into the alligator scales of charcoal, deep black in the cracks between them and silvery where light skims the glassy char, wire-brushed along the grain until the hard latewood stands out in ridges.
 */
class CharredWoodMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.7,
      envMap: frameStudio,
      envMapIntensity: 0.9,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth())
    // Scales stretched along the grain, as the char splits across the fibers.
    const point = vec3(surface.along.mul(30), surface.reach.add(p.z).mul(60), surface.member.mul(3))
    // The cracks run where two scales meet, where the nearest two cell centers are about as far.
    const cells = mx_worley_noise_vec2(point).toVar('charCells')
    const edge = cells.y.sub(cells.x)
    const cracks = edge.smoothstep(0.02, 0.09).oneMinus().mul(visibleDetail(footprint, 0.006))
    // Each scale domes up toward its middle.
    const scale = edge.smoothstep(0.05, 0.6)
    const grain = surface.reach.add(p.z.mul(0.6)).mul(380).add(mx_noise_float(vec3(surface.along.mul(3), surface.reach.mul(40), surface.member)).mul(6)).sin().mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.003))
    const sheen = mx_noise_float(p.mul(30)).mul(0.5).add(0.5)
    this.colorNode = mix(color('#020101'), mix(color('#1a1817'), color('#3a3633'), sheen.mul(0.5).add(grain.mul(0.4))), scale.mul(cracks.oneMinus()))
    this.roughnessNode = mix(float(0.9), float(0.45), sheen.mul(scale).mul(0.7)).add(cracks.mul(0.1))
    this.normalNode = heightNormal(scale.mul(0.0025).sub(cracks.mul(0.002)).add(grain.mul(0.0004)))
  }
}
