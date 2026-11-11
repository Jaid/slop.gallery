import type {Node} from 'three/webgpu'

import {color, float, max, mix, mx_fractal_noise_float, mx_noise_float, positionGeometry, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, line, visibleDetail} from './filters.ts'

const unit = (node: Node<'float'>) => node.mul(0.5).add(0.5)

/**
 * Honed soapstone, as the tops of workbenches in old laboratories and smithies are cut from, since neither acid nor heat harms it: a dark, greenish charcoal, clouded lighter and darker, crossed by soft veins of pale talc and finer gray hairlines, its oiled hone dull but for a faint sheen where hands and tools have rubbed it smooth.
 * Mapped in the meters of its geometry, so a slab keeps its pattern wherever it stands; the `seed` cuts another part of the block.
 */
export default class SoapstoneMaterial extends MeshStandardNodeMaterial {
  constructor({seed = 0}: {seed?: number} = {}) {
    super({
      metalness: 0,
      roughness: 0.6,
      envMapIntensity: 0.55,
    })
    this.name = 'Soapstone'
    const position = positionGeometry.add(vec3(seed * 17.31, seed * 3.7, seed * -11.9)).toVar('soapstonePosition')
    const footprint = max(positionGeometry.x.fwidth(), max(positionGeometry.y.fwidth(), positionGeometry.z.fwidth()))
    const detail = visibleDetail(footprint, 0.004)
    // Broad clouds of lighter and darker stone, stretched a little along the bedding
    const cloud = unit(mx_fractal_noise_float(position.mul(vec3(1.1, 2.4, 1.8)), 4, 2.1, 0.5))
    const mottle = unit(mx_noise_float(position.mul(14))).mul(detail)
    // The talc veins wander through it in long, soft strands, only where a second field lets them run
    const strands = mx_noise_float(position.mul(vec3(0.9, 1.6, 2.2))).add(mx_noise_float(position.mul(6.5)).mul(0.12))
    const stretch = unit(mx_noise_float(position.mul(1.3).add(7))).smoothstep(0.35, 0.65)
    const veins = line(strands, 0.018).mul(stretch).toVar('soapstoneVeins')
    const hairlines = line(mx_noise_float(position.mul(vec3(3.1, 5, 4.2)).add(31)), 0.006).mul(detail).mul(0.55)
    // Rubbed smooth in broad patches by use
    const rubbed = unit(mx_noise_float(position.mul(2.2).add(53))).smoothstep(0.55, 0.85)
    const stone = mix(color('#232927'), color('#3b433f'), cloud).mul(mottle.sub(0.5).mul(0.1).add(1))
    const veined = mix(stone, color('#7d8a83'), veins.mul(0.5).add(hairlines.mul(0.35)))
    this.colorNode = mix(veined, veined.mul(0.86), rubbed)
    this.roughnessNode = float(0.62).add(veins.mul(0.1)).sub(rubbed.mul(0.2)).add(mottle.sub(0.5).mul(0.06))
    // The faint tooth of the hone
    this.normalNode = heightNormal(mx_noise_float(positionGeometry.mul(420)).mul(0.00003).mul(visibleDetail(footprint, 0.002)))
  }
}
