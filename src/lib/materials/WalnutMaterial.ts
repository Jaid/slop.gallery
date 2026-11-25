import hsl from 'okhsl'

import GrainedWoodMaterial from './GrainedWoodMaterial.ts'

/**
 * Satin-oiled black walnut joinery.
 *
 * Geometry supplies the grain through the `woodGrain` attribute, see {@link GrainedWoodMaterial}.
 */
export default class WalnutMaterial extends GrainedWoodMaterial {
  constructor() {
    super({
      heartwood: [hsl.integer(49, 40, 13), hsl.integer(52, 46, 25)],
      latewood: hsl.integer(47, 38, 8),
    })
  }
}
