import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {studioEnvironment} from './metal.ts'

/** The green slime of the gallery’s icon, which the Sloperator wears in front of his face and leaves behind as Slop: wet and glossy, with a faint glow of its own, so it reads as slime in the dark too. */
export default class SlimeMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      color: '#6fbf2a',
      emissive: '#3c8a12',
      emissiveIntensity: 0.18,
      envMap: studioEnvironment,
      envMapIntensity: 0.7,
      roughness: 0.22,
    })
    this.name = 'slime'
  }
}
