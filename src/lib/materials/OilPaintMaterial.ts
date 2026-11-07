import {float, max, mx_noise_float, positionGeometry, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from './filters.ts'

/**
 * Fresh oil paint squeezed out of the tube and worked with a knife: glossy and buttery, in the colors its geometry carries as vertex colors, with fine ridges and pits pulled up by the knife and the bristles.
 * The ridges are mapped in the mesh’s own frame, so they travel with whatever carries the paint, and flatten before they could shimmer.
 */
export default class OilPaintMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      vertexColors: true,
      roughness: 0.24,
      envMapIntensity: 0.7,
    })
    this.name = 'Oil paint'
    const p = positionGeometry
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth())
    const ridges = mx_noise_float(p.mul(vec3(260, 520, 260))).mul(visibleDetail(footprint, 0.004))
    const pits = mx_noise_float(p.mul(1400)).mul(visibleDetail(footprint, 0.0008))
    this.roughnessNode = float(0.22).add(pits.abs().mul(0.12))
    this.normalNode = heightNormal(ridges.mul(0.00035).add(pits.mul(0.00006)))
  }
}
