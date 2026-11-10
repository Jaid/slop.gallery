import {color, mix, mx_noise_float, positionGeometry} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal} from './filters.ts'

const noise = (scale: number) => mx_noise_float(positionGeometry.mul(scale)).mul(0.5).add(0.5)

/** Warm ivory porcelain with a pearl glaze and tiny fired-surface ripples, for the fluted planters. */
export default class PorcelainMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.21,
      clearcoat: 1,
      clearcoatRoughness: 0.11,
      iridescence: 0.75,
      iridescenceIOR: 1.5,
      iridescenceThicknessMinimum: 200,
      iridescenceThicknessMaximum: 420,
      envMapIntensity: 0.7,
    })
    this.name = 'Pearl-glazed porcelain'
    this.colorNode = mix(color('#d7dbd1'), color('#f4ece0'), noise(8))
    this.iridescenceThicknessNode = noise(6).mul(220).add(200)
    this.normalNode = heightNormal(noise(95).mul(0.00005))
  }
}
