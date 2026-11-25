import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_worley_noise_vec3, time, vec3} from 'three/tsl'

import {stroke} from '../../candidates/gpt_sol/lib/exhibition/coverage.ts'
import {filteredCos, resolved, softNoise} from '../../candidates/gpt_sol/lib/exhibition/fields.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Lapidary agate: continuous cellular geodes, translucent-looking band depths and tiny quartz inclusions. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = data.id
    const {p, view, grazing, near, intimate} = viewerFrame()
    const warp = vec3(softNoise(p.mul(3.2)), softNoise(p.mul(3.2).add(11)), softNoise(p.mul(3.2).add(29))).mul(0.72).toVar()
    const q = p.mul(4.8).add(warp).toVar()
    const cell = mx_worley_noise_vec3(q, 0.82, 0).toVar()
    const pulse = time.mul(0.18).sin().mul(0.08)
    const geode = cell.x.add(mx_noise_float(q.mul(1.4)).mul(0.045)).toVar()
    const phase = geode.mul(67).add(q.y.mul(2.5)).add(pulse).toVar()
    const finePhase = phase.mul(3).add(mx_noise_float(q.mul(7)).mul(0.75))
    const broad = filteredCos(phase).mul(0.5).add(0.5).toVar()
    const lace = filteredCos(finePhase).mul(0.5).add(0.5).toVar()
    const milk = broad.smoothstep(0.48, 0.78).toVar()
    const jade = softNoise(q.mul(0.63).add(6)).smoothstep(-0.03, 0.24).toVar()
    const iron = mix(color(hsl.integer(39, 71, 30)), color(hsl.integer(63, 80, 66)), broad.mul(0.6).add(lace.mul(0.4)))
    const malachite = mix(color(hsl.integer(182, 81, 28)), color(hsl.integer(167, 49, 68)), broad.mul(0.7).add(lace.mul(0.3)))
    const substrate = mix(iron, malachite, jade).toVar()
    const ivory = mix(color(hsl.integer(70, 57, 82)), color(hsl.integer(85, 100, 95.6)), lace)
    const ribbon = mix(substrate, ivory, milk.mul(0.88)).toVar()
    const crack = stroke(cell.y.sub(cell.x).sub(0.021), 0.004, q.fwidth().length()).mul(0.45)
    // A second, offset optical stratum drifts against the milky bands as the viewer moves.
    const deepQ = p.sub(view.mul(0.023)).mul(4.8).add(warp)
    const deepPhase = mx_worley_noise_vec3(deepQ, 0.82, 0).x.mul(67).add(deepQ.y.mul(2.5)).add(pulse).toVar()
    const inner = filteredCos(deepPhase).mul(0.5).add(0.5).toVar()
    const translucent = milk.oneMinus().mul(grazing.mul(0.3).add(0.12))
    const mineral = mx_noise_float(p.mul(190)).mul(0.5).add(0.5)
    const crystal = mineral.smoothstep(0.76, 0.91).mul(resolved(p.mul(190).fwidth().length(), 0.3, 1.5)).toVar()
    this.colorNode = ribbon.mul(inner.mul(translucent).mul(0.35).add(translucent.mul(-0.2)).add(1)).mul(crack.oneMinus())
    this.metalness = 0.04
    this.roughnessNode = float(0.19).add(milk.mul(0.11)).sub(crystal.mul(0.07))
    this.normalNode = proceduralNormal(broad.mul(0.00065).add(lace.mul(0.00017)).add(crystal.mul(0.00014)).sub(crack.mul(0.00055)), 0.7)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.07
    this.ior = 1.54
    this.iridescenceNode = crystal.mul(0.33).mul(intimate)
    this.iridescenceThicknessNode = crystal.mul(170).add(320)
    this.emissiveNode = substrate.mul(translucent).mul(near.mul(0.04).add(0.025)).add(color(hsl.integer(77, 100, 92.6)).mul(crystal).mul(grazing.pow(4)).mul(0.1))
  }
}
