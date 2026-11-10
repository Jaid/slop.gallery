import {color, float, mix, select, smoothstep, time, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {frameSurface} from '../lib/materials/frameAttributes.ts'
import FrameMetalMaterial, {blackAnodized} from '../lib/materials/FrameMetalMaterial.ts'
import FramePaintMaterial from '../lib/materials/FramePaintMaterial.ts'
import frameStudio from '../lib/materials/frameStudio.ts'

const imageDepth = -0.064
const casing = 0
const light = 1
const hazard = 2
/** the hazard band on the casing’s outer slope */
const band = {
  from: 0.06,
  to: 0.098,
}
/** a heavy black casing stepping up from the work, a channel holding a strip of light round it, and an outer slope striped with hazard chevrons */
const profile = FrameProfile.from([-0.005, imageDepth], casing)
  .line(-0.005, -0.05)
  .line(0.008, -0.05)
  .line(0.008, -0.056, {material: light})
  .line(0.02, -0.056)
  .line(0.02, -0.03, {material: casing})
  .line(0.056, -0.03)
  .line(band.from, -0.034, {material: hazard})
  .line(band.to, -0.06)
  .line(0.102, -0.06, {material: casing})
  .line(0.102, frameBack)
  .line(-0.005, frameBack)
/** The Exhibition’s: a containment casing for a work that may not be safe to look at, black and heavy, a strip of red light swept by a scan and a band of hazard chevrons. */
export default class ContainmentFrame extends PortraitFrame {
  override readonly description = 'Sealed, as if the work might get out: a heavy casing of black anodized metal stepping up from the work, a channel round it holding a strip of dim red light that a bright scan sweeps round every few seconds, its outer slope striped in yellow and black hazard chevrons.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'heavy'
  override readonly reach = profile.reach
  override readonly tint = '#1a1a1a'
  override readonly title = 'Containment casing'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [
      new FrameMetalMaterial({metal: blackAnodized}),
      new ScanMaterial,
      new FramePaintMaterial({
        color: '#e2b414',
        roughness: 0.5,
        clearcoat: 0.3,
        wear: 0.4,
        under: '#2a2a2a',
        grime: 0.5,
        layers: surface => {
          // Chevrons pointing toward the middle of every member, black on yellow.
          const t = surface.reach.sub(band.from).div(band.to - band.from)
          const stripe = surface.along.abs().add(t.mul(0.03)).div(0.03).fract()
          const black = select(stripe.lessThan(0.5), float(1), float(0))
          return [{
            mask: black,
            color: vec3(0.02, 0.02, 0.02),
            roughness: 0.55,
          }]
        },
      }),
    ]
  }
}

/** The strip of light in the channel round the work: a dim red glow, swept every few seconds by a bright white scan running round the frame. */
class ScanMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.3,
      envMap: frameStudio,
      color: '#200404',
    })
    const surface = frameSurface()
    const around = surface.member.round().add(surface.along.div(surface.halfLength).mul(0.5).add(0.5)).div(4)
    const scan = time.mul(0.12).fract()
    const behind = around.sub(scan).add(1).fract()
    const sweep = smoothstep(0.08, 0, behind.oneMinus().min(behind))
    const pulse = time.mul(1.7).sin().mul(0.2).add(0.8)
    this.emissiveNode = mix(color('#ff2a1a').mul(pulse.mul(0.9)), vec3(1, 0.95, 0.9).mul(3), sweep)
  }
}
