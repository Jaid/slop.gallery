import {color, float, mix, mx_noise_float, positionGeometry, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from './filters.ts'

/** Oiled honey teak with solid lengthwise grain along local x, dark latewood and shallow pores. */
export default class TeakMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.4,
      clearcoat: 0.24,
      clearcoatRoughness: 0.35,
      envMapIntensity: 0.4,
    })
    this.name = 'Oiled honey teak'
    const p = positionGeometry
    const footprint = p.x.fwidth().max(p.y.fwidth()).max(p.z.fwidth())
    const warp = mx_noise_float(p.mul(vec3(1.2, 6, 4))).mul(6)
    const phase = p.z.add(p.y.mul(0.65)).mul(180).add(warp)
    const ring = mix(phase.sin().mul(0.5).add(0.5).pow(5), float(0.25), phase.fwidth().smoothstep(0.7, 2))
    const fiber = mx_noise_float(p.mul(vec3(4, 130, 180))).mul(visibleDetail(footprint, 0.008))
    const mottle = mx_noise_float(p.mul(4)).mul(0.5).add(0.5)
    this.colorNode = mix(color('#b67c3b'), color('#5b3016'), ring.mul(0.65)).mul(mottle.mul(0.25).add(0.86))
    this.normalNode = heightNormal(ring.mul(0.00018).add(fiber.mul(0.00008)))
    this.roughnessNode = float(0.34).add(ring.mul(0.15))
  }
}
