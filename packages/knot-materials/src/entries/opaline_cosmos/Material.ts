import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, mx_noise_vec3, normalViewGeometry, positionGeometry, positionView, positionViewDirection, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.pow(2)
    // Camera position transformed into object space.
    //
    // All internal layers below are displaced along the actual camera ray
    // rather than screen UVs, so details remain anchored inside the sculpture
    // while walking around it.
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    // Two distance gates.
    //
    // Major structures can be read from across the gallery. Fine structures
    // emerge continuously on approach instead of popping into existence.
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const intimate = positionView.length().smoothstep(0.8, 2.7).oneMinus()
    const inner = p.sub(view.mul(0.16))
    const deep = p.sub(view.mul(0.28))
    const abyss = p.sub(view.mul(0.42))
    // Milky black opal.
    //
    // From across the room it is restrained and almost geological. Orbiting
    // around it turns the buried fire through the spectrum. Close inspection
    // reveals another layer of impossibly fine glowing fissures.
    const macro = mx_noise_float(inner.mul(5.5))
    const micro = mx_noise_float(inner.mul(15).add(mx_noise_vec3(inner.mul(4)).mul(0.55)))
    const fire = macro.add(micro.mul(0.35)).mul(0.37).add(0.5).clamp()
    const fissures = opticalLine(mx_noise_float(deep.mul(20).add(mx_noise_vec3(deep.mul(7)).mul(0.42))), 0.028).mul(near)
    const buried = opticalLine(mx_noise_float(abyss.mul(38)), 0.019).mul(intimate)
    const phase = macro.mul(8.5).add(micro.mul(2.5)).add(view.x.mul(9)).add(view.y.mul(5)).sub(view.z.mul(4))
    const prism = spectralColor(phase)
    const ghostPrism = spectralColor(phase.add(2.35))
    this.colorNode = mix(color(hsl.integer(91, 9, 86)), color(hsl.integer(256, 17, 61)), fire.mul(0.48)).add(prism.mul(fire.pow(3)).mul(0.08))
    this.transmissionNode = fire.oneMinus().mul(0.16).add(0.28)
    this.thickness = 0.32
    this.ior = 1.47
    this.roughnessNode = fire.mul(-0.07).add(0.22)
    this.iridescenceNode = grazing.mul(0.8).add(near.mul(0.3)).clamp()
    this.iridescenceIOR = 1.33
    this.iridescenceThicknessNode = fire.mul(430).add(110)
    this.sheen = 0.7
    this.sheenNode = mix(color(hsl.integer(292, 100, 91.5)), prism, grazing.mul(0.8).clamp())
    this.sheenRoughness = 0.45
    this.clearcoat = 0.72
    this.clearcoatRoughness = 0.075
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(22)), 0.0007)
    this.emissiveNode = prism.mul(fissures).mul(near.mul(0.85).add(0.22)).add(ghostPrism.mul(buried).mul(0.72)).add(prism.mul(rim).mul(fire).mul(0.13))
  }
}
