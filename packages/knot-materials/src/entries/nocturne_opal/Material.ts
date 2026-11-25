import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Black opal with true parallax fire - pockets swim opposite to view */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, rim, near} = viewerFrame()
    const inner = p.sub(view.mul(0.21))
    const deep = p.sub(view.mul(0.44))
    const deeper = p.sub(view.mul(0.62))
    const drift = vec3(time.mul(0.02), time.mul(-0.015), time.mul(0.011))
    const pocketA = mx_noise_float(inner.mul(3.1).add(drift))
    const pocketB = mx_noise_float(deep.mul(4.2).sub(drift.mul(1.3)))
    const pocketC = mx_fractal_noise_float(deeper.mul(2.8).add(drift.mul(0.7)), 2, 2, 0.5)
    const fireField = pocketA.add(pocketB.mul(0.7)).add(pocketC.mul(0.5))
    const fireMask = fireField.smoothstep(0.2, 0.85)
    const hue = fireField.mul(1.4).add(view.x.mul(0.4)).add(time.mul(0.03))
    const opalTint = cosinePalette(hue, [0.55, 0.45, 0.6], [0.45, 0.35, 0.45], [1, 1, 1], [0.02, 0.15, 0.33])
    const flecks = cellularPoints(p.mul(42), 0.08, 0.24, 0.15)
    const fleckMask = flecks.mul(fireMask).mul(near.mul(0.6).add(0.4))
    const parallax = facing.pow(0.8)
    this.colorNode = color(hsl.integer(274, 22, 4.6))
    this.metalness = 0.05
    this.roughness = 0.12
    this.transmission = 0.28
    this.thickness = 0.65
    this.ior = 1.45
    this.attenuationColor.set(hsl.integer(282, 47, 6))
    this.attenuationDistance = 0.7
    this.iridescence = 1
    this.iridescenceIOR = 2.2
    this.iridescenceThicknessNode = fireField.mul(180).add(280).add(facing.mul(120))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.06
    this.normalNode = proceduralNormal(fireField.mul(0.6).add(flecks.mul(0.3)), 0.0012)
    this.emissiveNode = opalTint.mul(fireMask).mul(parallax.mul(1.2).add(0.2)).mul(near.mul(0.6).add(0.5))
      .add(opalTint.mul(fleckMask).mul(2.2))
      .add(color(hsl.integer(276, 100, 71.6)).mul(rim).mul(0.12))
    this.envMapIntensity = 0.6
  }
}
