import {color, float, mix, mx_noise_float, normalView, positionViewDirection, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {frameSurface} from '../lib/materials/frameAttributes.ts'
import frameStudio from '../lib/materials/frameStudio.ts'

const imageDepth = -0.06
const slab = 0
const edge = 1
/** a thick slab of acrylic, its flat face polished, every edge cut on a bevel that the light inside escapes through */
const profile = FrameProfile.from([-0.005, imageDepth], edge)
  .line(-0.005, -0.05)
  .line(0.006, -0.038, {material: slab})
  .line(0.09, -0.038)
  .line(0.1, -0.048, {material: edge})
  .line(0.1, frameBack, {material: slab})
  .line(-0.005, frameBack)
/** The Oculus’: a thick slab of edge-lit acrylic, dark and glassy on its face, glowing cool along every beveled edge with borrowed light. */
export default class AcrylicFrame extends PortraitFrame {
  override readonly description = 'Borrowed light, held in a slab: a thick frame of clear acrylic over a dark backing, black and glassy on its polished face and mirroring the room at grazing angles, the light caught inside it escaping as a cool cyan glow through every beveled edge.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'heavy'
  override readonly reach = profile.reach
  override readonly tint = '#1d3236'
  override readonly title = 'Edge-lit acrylic'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [new AcrylicMaterial, new EdgeLightMaterial]
  }
}
/** Clear acrylic seen against its dark backing: nearly black where you look straight into it, mirroring the room at grazing angles, faintly cyan in its depth. */
class AcrylicMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.02,
      envMap: frameStudio,
      envMapIntensity: 1.4,
      clearcoat: 1,
      clearcoatRoughness: 0.01,
      ior: 1.49,
      color: '#0b1416',
    })
    const facing = normalView.dot(positionViewDirection.negate()).clamp(0, 1)
    this.colorNode = mix(color('#0d2226'), color('#020506'), facing)
  }
}
/** Light trapped in the acrylic escaping through its beveled edges: a cool glow, brighter in drifting bands as if the light inside wandered. */
class EdgeLightMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.1,
      envMap: frameStudio,
    })
    const surface = frameSurface()
    const drift = mx_noise_float(vec3(surface.along.mul(3), surface.member, 1.3)).mul(0.5).add(0.5)
    this.colorNode = color('#0c1a1c')
    this.emissiveNode = mix(color('#8fe6ff'), vec3(1), drift.mul(0.4)).mul(drift.mul(0.8).add(0.6)).mul(float(1.6))
  }
}
