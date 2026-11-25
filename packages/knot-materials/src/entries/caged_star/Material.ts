import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, time, vec3} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A stowaway star: boiling granulation, drifting sunspots, and rim-fire at the limb. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.25
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const qA = p.mul(17).add(vec3(0, time.mul(0.22), time.mul(-0.09)))
    const domeA = mx_worley_noise_float(qA, 1, 0).smoothstep(0.16, 0.6).oneMinus().mul(mx_noise_float(qA.mul(0.7)).mul(0.25).add(1))
    const qB = p.mul(11).add(vec3(time.mul(-0.06), 0, time.mul(0.13)))
    const domeB = mx_worley_noise_float(qB, 1, 0).smoothstep(0.2, 0.66).oneMinus()
    const gran = domeA.mul(0.62).add(domeB.mul(0.38))
    const spotField = mx_fractal_noise_float(p.mul(2.1), 2, 2, 0.5)
    const umbra = spotField.negate().smoothstep(0.42, 0.72)
    const penumbra = spotField.negate().smoothstep(0.14, 0.45)
    const cooled = umbra.mul(0.8).add(penumbra.mul(0.3))
    const temp = facing.mul(0.62).add(gran.mul(0.38)).sub(cooled).clamp()
    const disk = mix(mix(color(hsl.integer(37, 100, 39)), color(hsl.integer(72, 100, 79.1)), temp), color(hsl.integer(94, 100, 97)), temp.pow(3))
    const flameNoise = mx_noise_float(vec3(p.x.mul(4), p.y.mul(4).sub(time.mul(1.5)), p.z.mul(4)))
    const flames = flameNoise.smoothstep(0.2, 0.7).mul(grazing.pow(2.2))
    const flameColor = mix(color(hsl.integer(32.8, 100, 59)), color(hsl.integer(75, 100, 83)), flameNoise.smoothstep(0.3, 0.8))
    const flareTick = time.mul(0.23).floor()
    const flare = mx_cell_noise_float(vec3(flareTick, 4.7, 9.2)).smoothstep(0.68, 0.9).mul(time.mul(0.23).fract().mul(-3).exp())
    const surface = gran.mul(0.5).add(0.7).mul(cooled.oneMinus().clamp())
    this.colorNode = color(hsl.integer(52, 100, 7))
    this.metalness = 0
    this.roughness = 0.55
    this.clearcoat = 0.2
    this.clearcoatRoughness = 0.4
    this.normalNode = proceduralNormal(gran, 0.002)
    this.emissiveNode = disk.mul(surface).mul(1.9).mul(flare.mul(0.8).add(1)).mul(near.mul(0.25).add(0.85)).add(flameColor.mul(flames).mul(intimate.mul(0.9).add(0.9)).mul(1.5)).add(color(hsl.integer(32, 100, 58.5)).mul(grazing.pow(3)).mul(0.8)).add(color(hsl.integer(63, 100, 79.6)).mul(grazing.pow(4)).mul(near.oneMinus().mul(0.5).add(0.4)).mul(0.5))
  }
}
