import type {FrameSurface} from '../lib/materials/frameAttributes.ts'
import type {Node} from 'three/webgpu'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band, legible, repeatPhase} from '../lib/materials/carving.ts'
import FrameWoodMaterial, {ebony} from '../lib/materials/FrameWoodMaterial.ts'

type Float = Node<'float'>

const imageDepth = -0.06
/** a rippled bead at the sight edge, a broad plain cove rising to a rippled torus, a flat of waves and a rippled bead at the outer edge, falling straight to the wall */
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.05)
  .arc(0.006, -0.05, 0.5)
  .line(0.012, -0.053)
  .arc(0.05, -0.029, -0.18, {steps: 10})
  .arc(0.066, -0.029, 0.42, {steps: 10})
  .line(0.069, -0.032)
  .line(0.092, -0.035)
  .arc(0.103, -0.035, 0.5)
  .line(0.106, -0.05)
  .line(0.106, frameBack)
  .line(-0.005, frameBack)
/** Ripples as a Dutch rippling machine cut them: fine ridges straight across a round, `period` meters apart. */
const ripples = (surface: FrameSurface, period: number, reach: number) => repeatPhase(surface, period, reach).mul(Math.PI * 2).sin().mul(0.5).add(0.5)
/** Waves along a flat: ridges that swing to and fro across it as they run along, like water. */
const waves = (surface: FrameSurface, t: Float) => repeatPhase(surface, 0.011, 0.08).add(t.mul(Math.PI).sin().mul(0.35)).mul(Math.PI * 2).sin().mul(0.5).add(0.5)

/** The Vesper’s: a Dutch Golden Age frame in polished ebony, its rounds rippled and its flat waved by the machine. */
export default class RippleFrame extends PortraitFrame {
  override readonly description = 'A Dutch Golden Age frame in French-polished ebony for the old masters: a broad plain cove between rounds cut into fine ripples by the rippling machine, and a flat of waves swinging to and fro, the way Rembrandt’s Amsterdam framed its burghers.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#16110e'
  override readonly title = 'Dutch ripple'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [new FrameWoodMaterial({
      timber: ebony,
      gloss: 0.9,
      roughness: 0.35,
      grime: 0.2,
      relief: surface => {
        const sight = band(surface, -0.005, 0.006)
        const torus = band(surface, 0.05, 0.066)
        const flat = band(surface, 0.069, 0.092)
        const outer = band(surface, 0.092, 0.103)
        return legible(surface, ripples(surface, 0.0045, 0), 0.003).mul(sight.inside).mul(0.0008)
          .add(legible(surface, ripples(surface, 0.006, 0.058), 0.004).mul(torus.inside).mul(0.0012))
          .add(legible(surface, waves(surface, flat.t), 0.006).mul(flat.inside).mul(0.0009))
          .add(legible(surface, ripples(surface, 0.0045, 0.097), 0.003).mul(outer.inside).mul(0.0008))
      },
    })]
  }
}
