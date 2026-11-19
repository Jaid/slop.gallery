import {color, float, mix, uv} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal} from './filters.ts'

/** The colors of a velvet rope, as sRGB hex strings. */
export type VelvetRopeStyle = {
  /** the pile deep between the strands */
  deep: string
  /** the pile on the strands’ crowns */
  pile: string
  /** the soft light the pile scatters */
  sheen: string
}

/**
 * Braided velvet in the colors of `style` for the museum barrier rope.
 *
 * The pile scatters a soft sheen instead of a mirror highlight. Tube UVs wind eight strands around the rope; u counts whole braid repeats along the loop, so the relief stays the same size on different barriers and meets at the seam. Fine braiding fades before it can shimmer.
 */
export default class VelvetRopeMaterial extends MeshPhysicalNodeMaterial {
  constructor(style: VelvetRopeStyle) {
    super({
      roughness: 0.9,
      metalness: 0,
      // The pile scatters light instead of mirroring it; a plain specular lobe would make the rope read as rubber.
      specularIntensity: 0,
      envMapIntensity: 0.25,
      sheen: 1,
      sheenRoughness: 0.5,
    })
    this.name = 'Braided velvet'
    const weave = uv().x.add(uv().y.mul(8)).mul(Math.PI * 2)
    const braid = mix(weave.sin().mul(0.5).add(0.5), float(0.5), weave.fwidth().smoothstep(0.8, 2.5))
    this.colorNode = mix(color(style.deep), color(style.pile), braid.mul(0.6).add(0.15))
    this.sheenNode = color(style.sheen)
    this.normalNode = heightNormal(braid.mul(0.0007))
  }
}
