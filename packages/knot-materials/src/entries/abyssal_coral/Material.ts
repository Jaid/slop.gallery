import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A deep-water mineral garden: chalky coral, ink-blue hollows and living cyan polyps. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.42)
    this.name = knotData.id
    const {p, grazing, intimate} = viewerFrame()
    const current = p.mul(2.35).add(vec3(time.mul(0.01), time.mul(-0.007), time.mul(0.005)))
    const coralField = mx_fractal_noise_float(current, 4, 2.08, 0.56)
    const ridgeField = mx_fractal_noise_float(current.mul(1.7).add(4.2), 3, 2.2, 0.5)
    const branches = ridgeField.abs().oneMinus().clamp().pow(3.2)
    const pores = mx_noise_float(p.mul(8.2)).mul(0.5).add(0.5).smoothstep(0.52, 0.78)
    const cupDistance = mx_worley_noise_float(p.mul(5.4), 1, 0)
    const cup = cupDistance.smoothstep(0.045, 0.16).oneMinus()
    const rim = cupDistance.sub(0.15).abs().smoothstep(0.012, 0.045).oneMinus()
    const polypLight = cup.mul(mx_noise_float(p.mul(2.1).add(8.4)).mul(0.5).add(0.5).smoothstep(0.18, 0.42))
    const polypFoot = cupDistance.fwidth().max(0.001)
    const resolvedPolyps = polypFoot.smoothstep(0.18, 0.65).oneMinus()
    const light = polypLight.mul(resolvedPolyps).mul(0.62).add(polypLight.mul(intimate).mul(0.38))
    const pulse = time.mul(1.25).add(p.dot(vec3(1.7, 2.3, -1.1))).sin().mul(0.5).add(0.5).pow(5)
    // Fractal octaves are summed, not normalized; keep fractional powers and color mixing in range.
    const chalk = coralField.mul(0.5).add(0.5).clamp().pow(1.45)
    const shell = mix(color(hsl.integer(222, 72, 19)), color(hsl.integer(183, 56, 69)), chalk)
    const body = mix(color(hsl.integer(242, 67, 7)), shell, branches.mul(0.76).add(0.12)).add(color(hsl.integer(232, 51, 13)).mul(rim.mul(0.5)))
    const height = branches.mul(0.16).add(pores.mul(-0.05)).add(rim.mul(0.09)).add(cup.mul(-0.035))
    const coralNormal = proceduralNormal(height, 0.004)
    const coralGlint = glints(coralNormal, 48).mul(light)
    const movingLight = color(hsl.integer(178, 95, 83)).mul(light.mul(pulse.mul(0.52).add(0.28)))
    this.colorNode = body.add(movingLight.mul(0.86)).add(color(hsl.integer(219, 82, 43)).mul(grazing.mul(0.24)))
    this.metalness = 0.01
    this.roughnessNode = float(0.76).sub(branches.mul(0.16)).add(pores.mul(0.1)).add(rim.mul(0.06)).clamp(0.48, 0.9)
    this.clearcoat = 0.08
    this.clearcoatRoughness = 0.32
    this.sheen = 0.2
    this.sheenColor.set(hsl.integer(185, 64, 73))
    this.sheenRoughness = 0.6
    this.normalNode = coralNormal
    this.positionNode = positionGeometry.add(normalLocal.mul(rim.mul(0.0022).add(cup.mul(-0.0008))))
    this.emissiveNode = movingLight.mul(0.7).add(color(hsl.integer(180, 100, 94)).mul(coralGlint.mul(0.12)))
  }
}
