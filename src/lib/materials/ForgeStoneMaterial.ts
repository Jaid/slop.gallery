import type {Node} from 'three/webgpu'

import {color, float, max, mix, mx_fractal_noise_float, mx_noise_float, positionWorld, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from './filters.ts'

const unit = (node: Node<'float'>) => node.mul(0.5).add(0.5)

/**
 * Dressed architectural Belgian bluestone for the Forge’s baseboards, arch surrounds, window casing, pilasters, cornice and ceiling curbs: mid-dark charcoal-slate clouded by fine sedimentary bedding and honed to a crisp satin sheen so molded profiles and arrises catch clean highlights rather than crushing to flat black.
 */
export default class ForgeStoneMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      metalness: 0,
      roughness: 0.52,
      envMapIntensity: 0.65,
    })
    this.name = 'Forge bluestone'
    const p = positionWorld
    const footprint = max(p.x.fwidth(), max(p.y.fwidth(), p.z.fwidth()))
    const detail = visibleDetail(footprint, 0.01)
    // Broad sedimentary clouding and fine horizontal quarry bedding
    const cloud = unit(mx_fractal_noise_float(p.mul(vec3(0.85, 1.7, 0.85)), 3, 2.1, 0.5))
    const bedding = unit(mx_noise_float(p.mul(vec3(1.5, 11, 1.5)).add(vec3(3.2, 0, 7.1))))
    const grain = mix(float(0.5), unit(mx_noise_float(p.mul(85))), detail)
    // Subtle mineral quartz micro-flecks typical of honed Belgian bluestone (no noisy contour veins)
    const flecks = unit(mx_noise_float(p.mul(170).add(5.3))).smoothstep(0.85, 0.96).mul(detail).mul(0.18)
    const base = mix(color('#525250'), color('#6a6863'), cloud).mul(bedding.sub(0.5).mul(0.08).add(grain.sub(0.5).mul(0.06)).add(1))
    this.colorNode = mix(base, color('#8e8b84'), flecks)
    this.roughnessNode = float(0.5).add(cloud.sub(0.5).mul(0.08)).add(grain.sub(0.5).mul(0.05))
    // Fine honed mason’s surface tooth
    this.normalNode = heightNormal(grain.mul(0.00022).add(bedding.mul(0.00014)).mul(detail))
  }
}
