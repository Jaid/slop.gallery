import type {OrbGlassOptions} from '../base/OrbGlassMaterial.ts'

import Orb from '../base/Orb.ts'
import ClearOrbMaterial from './ClearOrbMaterial.ts'

/**
 * A ball of clear crystal with nothing inside, an ingredient without any contribution: no instruction, no image and no frame. Thrown into a portrait, it leaves the hung portrait’s own image as the fusion’s only contribution, so no image model is asked and the portrait comes back out of the portal as it went in, framed by the room it arrives in.
 * It is for trying the fusion’s animation and for resetting a portrait’s frame to its room’s, and it is what a themed orb leaves of itself once a fusion emptied it of its scene.
 */
export default class TransparentOrb extends Orb {
  readonly id = 'transparent'
  readonly title = 'Transparent Orb'

  createMaterial(options: OrbGlassOptions) {
    return new ClearOrbMaterial(options)
  }
}

/** the one Transparent Orb, which every themed orb leaves of itself */
export const transparentOrb = new TransparentOrb
