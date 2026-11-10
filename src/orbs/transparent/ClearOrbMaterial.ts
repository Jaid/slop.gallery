import type {OrbGlassOptions} from '../base/OrbGlassMaterial.ts'

import {float, vec3} from 'three/tsl'

import OrbGlassMaterial from '../base/OrbGlassMaterial.ts'

/** A ball of clear crystal with nothing inside, through which the room shows upside down and squeezed into the ball, sharp, untinted and bent as strongly as by solid glass. */
export default class ClearOrbMaterial extends OrbGlassMaterial {
  constructor(options: OrbGlassOptions) {
    super(options, {
      name: 'orb-clear',
      fillIor: 1.5,
    })
  }

  protected override fill() {
    return {
      radiance: vec3(0),
      transmittance: float(1),
    }
  }
}
