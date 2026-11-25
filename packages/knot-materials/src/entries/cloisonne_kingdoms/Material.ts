import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_worley_noise_vec3, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Jewel-like enamel compartments separated by hand-finished gold wire. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const {p, view, facing, near} = viewerFrame()
    const warp = mx_fractal_noise_float(p.mul(1.65).add(vec3(time.mul(0.008), 0, time.mul(-0.006))), 3, 2, 0.5)
    const cells = mx_worley_noise_vec3(p.mul(2.35).add(warp.mul(0.32)), 1, 0)
    const edge = cells.y.sub(cells.x)
    const wire = edge.abs().smoothstep(0.015, 0.045).oneMinus()
    const wireFoot = edge.fwidth().max(0.001)
    const wireResolved = wireFoot.smoothstep(0.14, 0.62).oneMinus()
    const wireMask = wire.mul(wireResolved)
    const enamelField = cells.x.mul(0.62).add(warp.mul(0.18)).add(0.5)
    const jewel = mix(color(hsl.integer(263, 86, 13)), color(hsl.integer(199, 96, 47)), enamelField.smoothstep(0.18, 0.46))
    const jewel2 = mix(jewel, color(hsl.integer(358, 76, 40)), enamelField.smoothstep(0.52, 0.76))
    const enamel = mix(jewel2, color(hsl.integer(66, 86, 65)), enamelField.smoothstep(0.78, 0.96))
    const fleckPosition = p.mul(24)
    const fleckRandom = cellNoiseVec3(fleckPosition.floor())
    const fleckCenter = fleckRandom.mul(0.5).add(0.25)
    const fleckFootprint = fleckPosition.fwidth().length()
    const fleckRadius = fleckFootprint.add(0.18).min(0.24)
    // Keep random tint, relief and roughness inside isolated inclusions, not whole cells.
    const fleckMask = fleckPosition.fract().sub(fleckCenter).length().smoothstep(0.06, fleckRadius).oneMinus()
      .mul(fleckFootprint.smoothstep(0.25, 1).oneMinus())
    const fleck = fleckRandom.z.mul(fleckMask)
    const fired = fleckRandom.z.smoothstep(0.8, 0.95).mul(fleckMask).mul(wireMask.oneMinus()).mul(near)
    const height = wireMask.mul(0.26).add(fleck.mul(near).mul(0.014))
    const enamelNormal = proceduralNormal(height, 0.0038)
    const glass = glints(enamelNormal, 92).mul(near).mul(0.24)
    const warmSweep = view.dot(vec3(0.62, 0.3, -0.72)).mul(0.5).add(0.5)
    const gold = mix(color(hsl.integer(53, 89, 34)), color(hsl.integer(85, 100, 90.4)), wireMask.mul(0.58).add(facing.mul(0.42)))
    this.colorNode = mix(enamel, gold, wireMask).add(color(hsl.integer(94, 100, 95)).mul(fired.mul(0.18))).add(mix(color(hsl.integer(65, 78, 66)), color(hsl.integer(195, 76, 70)), warmSweep).mul(glass.mul(0.16)))
    this.metalnessNode = wireMask.mul(0.95)
    this.roughnessNode = float(0.13).add(wireMask.mul(0.1)).sub(fleck.mul(near).mul(0.025)).clamp(0.07, 0.28)
    this.clearcoat = 0.98
    this.clearcoatRoughness = 0.035
    this.normalNode = enamelNormal
    this.clearcoatNormalNode = enamelNormal
    this.iridescence = 0.18
    this.iridescenceIOR = 1.48
    this.emissiveNode = color(hsl.integer(82, 100, 84.6)).mul(fired.mul(0.12)).add(color(hsl.integer(183, 100, 92.5)).mul(glass.mul(0.06)))
  }
}
