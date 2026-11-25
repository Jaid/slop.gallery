import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_vec3, time, uv, vec2, vec3} from 'three/tsl'

import {inkFill, inkLine, tubeRay} from '../../lib/atelier.ts'
import {proceduralNormal, TAU, viewerFrame} from '../../lib/index.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import data from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = data.id
    const {view, near, facing} = viewerFrame()
    const q = uv().mul(vec2(32, 4))
    const aa = q.fwidth().length().mul(0.55)
    const c = q.fract().sub(0.5)
    const identity = mx_cell_noise_vec3(vec3(q.floor().mod(vec2(32, 4)), 9.4))
    const octagon = c.x.abs().max(c.y.abs()).max(c.x.abs().add(c.y.abs()).mul(0.72))
    const gem = inkFill(octagon.sub(0.448), aa)
    const girdle = inkLine(octagon.sub(0.441), 0.006, aa)
    const bevel = octagon.smoothstep(0.23, 0.445)
    const facets = c.x.abs().sub(c.y.abs()).smoothstep(-0.008, 0.008)
    const spectrum = mix(mix(color(hsl.integer(178, 96, 34)), color(hsl.integer(209, 92, 61.6)), identity.x), color(hsl.integer(308, 69, 36)), identity.y.smoothstep(0.5, 0.9))
    const tint = mix(spectrum, color(hsl.integer(141, 50, 83)), identity.z.smoothstep(0.78, 0.95).mul(0.58))
    const inner = c.sub(tubeRay().mul(vec2(32, 4)).mul(0.028))
    const internalFacet = inner.x.abs().add(inner.y.abs()).mul(26).add(identity.y.mul(TAU)).sub(view.x.mul(3)).sin().mul(0.5).add(0.5)
    const scintillation = internalFacet.pow(8).mul(facing).mul(near.mul(0.6).add(0.4))
    const foil = mix(tint.mul(0.4), tint.mul(1.3), facets.mul(0.4).add(internalFacet.mul(0.6)))
    const prong = inkFill(c.abs().sub(vec2(0.365)).length().sub(0.034), aa)
    this.colorNode = mix(mix(color(hsl.integer(223, 36, 17)), foil, gem), color(hsl.integer(89, 53, 81.5)), prong.max(girdle.mul(0.8)))
    this.metalnessNode = mix(float(0.8), float(0.25), gem).add(prong.mul(0.6)).clamp()
    this.roughnessNode = mix(float(0.3), float(0.115), gem).add(bevel.mul(0.025))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.035
    this.ior = 1.85
    this.iridescenceNode = gem.mul(bevel).mul(0.45)
    this.iridescenceThicknessNode = identity.y.mul(280).add(180)
    const height = float(0.448).sub(octagon).clamp(0, 0.21).mul(0.05).add(prong.mul(0.0018))
    this.normalNode = proceduralNormal(height, 1)
    this.clearcoatNormalNode = this.normalNode
    const pulse = time.mul(0.45).add(identity.x.mul(TAU)).sin().mul(0.2).add(0.8)
    this.emissiveNode = tint.mul(scintillation).mul(gem).mul(pulse).mul(0.42)
  }
}
