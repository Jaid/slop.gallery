import type {Node} from 'three/webgpu'

import {color, float, max, mix, mx_fractal_noise_float, mx_noise_float, positionWorld, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from './filters.ts'

type Float = Node<'float'>

const unit = (node: Float) => node.mul(0.5).add(0.5)

/**
 * Hand-troweled chalky limewash plaster for the Forge’s vaulted foundry roof bays and its ribbed vestibule cupola: warm pale stone-cream clouded by broad mineral limewash mottling and subtle trowel ripples, using smooth world-space noise with no sharp coordinate seams across curved domes or hipped slopes.
 *
 * Uses `bounce` (driven by `daylight`) so downward-facing vault bays scatter the clerestory’s sky light and warm workshop glow cleanly without turning muddy khaki.
 */
export default class ForgeVaultMaterial extends MeshStandardNodeMaterial {
  constructor({bounce, heavy}: {
    /** daylight bounced onto the vault from the clerestory and floor */
    bounce?: Node<'vec3'>
    heavy: boolean
  }) {
    super({
      color: '#e5dac8',
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0.45,
    })
    this.name = 'Forge limewashed vault'
    const p = positionWorld
    const footprint = max(p.x.fwidth(), max(p.y.fwidth(), p.z.fwidth()))
    const detail = visibleDetail(footprint, 0.04)
    const fine = visibleDetail(footprint, 0.015)
    // Broad chalky limewash clouds, medium plaster mottling and subtle trowel tooth.
    const wash = unit(mx_fractal_noise_float(p.mul(0.42).add(vec3(1.7, 3.1, 5.2)), 3, 2.1, 0.5))
    const mottle = unit(mx_noise_float(p.mul(2.1).add(vec3(6.4, 1.3, 2.8))))
    const grain = mix(float(0.5), unit(mx_noise_float(p.mul(18).add(vec3(0, 2.4, 0)))), fine)
    const surface = mix(color('#d2c5b2'), color('#eee5d7'), wash)
      .mul(mottle.sub(0.5).mul(0.08).add(grain.sub(0.5).mul(0.05)).add(1))
    this.colorNode = surface
    this.roughnessNode = float(0.86).add(wash.sub(0.5).mul(0.08)).add(mottle.sub(0.5).mul(0.04)).clamp(0.76, 0.96)
    if (heavy) {
      const trowel = mottle.mul(0.0014).add(grain.mul(0.00045)).mul(detail)
      this.normalNode = heightNormal(trowel)
    }
    if (bounce) {
      this.emissiveNode = surface.mul(bounce)
    }
  }
}
