import type {Node} from 'three/webgpu'

import {color, float, max, mix, mx_noise_float, positionGeometry, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from './filters.ts'

const unit = (node: Node<'float'>) => node.mul(0.5).add(0.5)

/**
 * Buff sandstone dressings, as Victorian brick buildings had round their openings, at their plinths and along their string courses: a fine, warm sandstone rubbed smooth, with faint bedding, the odd darker iron-stained cloud and a sandy grain, a little grimy toward its arrises.
 * Mapped in object space, so every molding carries its own stone; grain fades to its average before it could shimmer.
 */
export default class DressedSandstoneMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      roughness: 0.86,
      metalness: 0,
      envMapIntensity: 0.5,
    })
    this.name = 'Dressed sandstone'
    const p = positionGeometry
    const footprint = max(p.x.fwidth(), p.y.fwidth(), p.z.fwidth())
    const fine = visibleDetail(footprint, 0.005)
    const cloud = unit(mx_noise_float(p.mul(1.6))).mul(0.6).add(unit(mx_noise_float(p.mul(6.5).add(3))).mul(0.4))
    // Bedding planes lie level in the quarry and on the building.
    const bedding = unit(mx_noise_float(vec3(p.x.mul(0.8), p.y.mul(38), p.z.mul(0.8)))).smoothstep(0.3, 0.75)
    const iron = unit(mx_noise_float(p.mul(2.4).add(11))).smoothstep(0.62, 0.85)
    const grain = mix(float(0.5), unit(mx_noise_float(p.mul(260))), fine)
    const stone = mix(color('#d0b991'), color('#bea47a'), cloud).mul(bedding.mul(0.07).add(0.965)).mul(grain.sub(0.5).mul(0.24).add(1))
    // Speckled with darker grains of mica and iron, and stained where iron seeped through.
    const speckle = unit(mx_noise_float(p.mul(420).add(5))).smoothstep(0.72, 0.8).mul(fine)
    this.colorNode = mix(stone, color('#a98257'), iron.mul(0.22)).mul(speckle.mul(-0.25).add(1))
    this.roughnessNode = grain.mul(0.08).add(0.82)
    this.normalNode = heightNormal(grain.mul(0.0004).add(bedding.mul(0.00025)).sub(speckle.mul(0.0002)).mul(fine))
  }
}
