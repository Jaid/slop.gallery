import hsl from 'okhsl'
import {color, float, max, mix, mx_noise_float, positionLocal, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from './filters.ts'

/** The dry, woody stem of a cut pumpkin: dull green going gray and brown, corky toward its cut end, with fibers running up it. */
export default class PumpkinStemMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      roughness: 0.85,
      envMapIntensity: 0.25,
    })
    this.name = 'Pumpkin stem'
    const p = positionLocal
    const fibers = mx_noise_float(vec3(p.x.mul(420), p.y.mul(18), p.z.mul(420))).mul(0.5).add(0.5)
    const patches = mx_noise_float(p.mul(60)).mul(0.5).add(0.5)
    const footprint = max(p.x.fwidth(), p.y.fwidth())
    this.colorNode = mix(mix(color(hsl.integer(123, 50, 30)), color(hsl.integer(102, 32, 43)), patches), color(hsl.integer(108, 36, 18)), fibers.mul(0.35))
    this.roughnessNode = float(0.78).add(fibers.mul(0.12))
    this.normalNode = heightNormal(fibers.mul(0.0004).mul(visibleDetail(footprint, 0.003)))
  }
}
