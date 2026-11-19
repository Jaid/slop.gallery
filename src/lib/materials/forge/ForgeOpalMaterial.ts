import {uniform, vec3} from 'three/tsl'
import {Color, MeshStandardNodeMaterial} from 'three/webgpu'

import {lampLight} from '#src/lib/rendering/lamps.ts'

/** Opal glass whose glow follows its fixture’s actual lamp intensity, including presets and light edits. */
export default class ForgeOpalMaterial extends MeshStandardNodeMaterial {
  constructor(lampId: string) {
    super({
      color: '#ebcfaa',
      roughness: 0.34,
    })
    this.name = 'Forge opal glass'
    const glow = uniform(0).onRenderUpdate(() => Math.min(2.2, (lampLight(lampId)?.intensity ?? 0) / 24))
    this.emissiveNode = vec3(...new Color('#ffe2b3')).mul(glow)
  }
}
