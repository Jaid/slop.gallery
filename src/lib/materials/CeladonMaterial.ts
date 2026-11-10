import {color, float, mix, mx_noise_float, mx_worley_noise_vec2, positionGeometry} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, line, visibleDetail} from './filters.ts'

/** Pooled celadon glaze with fine dark crazing beneath a soft clearcoat, mapped through the pot’s own frame. */
export default class CeladonMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.13,
      envMapIntensity: 0.7,
    })
    this.name = 'Crackle celadon'
    const p = positionGeometry
    const footprint = p.x.fwidth().max(p.y.fwidth()).max(p.z.fwidth())
    const cells = mx_worley_noise_vec2(p.mul(40).add(mx_noise_float(p.mul(9)).mul(0.6)))
    const cracks = line(cells.y.sub(cells.x), 0.018).mul(visibleDetail(footprint, 0.018))
    const pooling = mx_noise_float(p.mul(6)).mul(0.5).add(0.5)
    const grain = mx_noise_float(p.mul(90)).mul(0.5).add(0.5)
    this.colorNode = mix(mix(color('#385e55'), color('#a4c9ae'), pooling), color('#304339'), cracks.mul(0.7))
    this.normalNode = heightNormal(grain.mul(0.00006).sub(cracks.mul(0.00012)))
    this.roughnessNode = float(0.19).add(cracks.mul(0.22)).add(pooling.mul(0.1))
  }
}
