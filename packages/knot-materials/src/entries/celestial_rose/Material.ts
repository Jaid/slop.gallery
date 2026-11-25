import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, vec3, vec4} from 'three/tsl'

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
    // Finale: a high-IOR diamond containing recursive rose-window caustics.
    //
    // Three large structures exist at separate depths. At intimate viewing
    // distance, a fourth hairline scale begins to appear through their overlap.
    const rose = (q: Node<'vec3'>) => {
      const a = q.dot(vec3(18, 2.5, 0)).sin()
      const b = q.dot(vec3(-9, 2.5, 15.59)).sin()
      const c = q.dot(vec3(-9, 2.5, -15.59)).sin()
      return a.add(b).add(c)
    }
    const roseAField = rose(inner)
    const roseBField = rose(deep.mul(1.11).add(vec3(0.13, -0.05, 0.08)))
    const roseCField = rose(abyss.mul(1.24).add(vec3(-0.09, 0.12, -0.07)))
    const roseA = opticalLine(roseAField, 0.078)
    const roseB = opticalLine(roseBField, 0.062).mul(near)
    const roseC = opticalLine(roseCField, 0.049).mul(intimate)
    const halo = opticalLine(inner.xz.length().mul(34).add(inner.y.mul(8)).add(view.x.mul(2.2)).sin(), 0.072)
    const phase = roseAField.mul(2.1).add(view.x.mul(10)).add(view.y.mul(6)).sub(view.z.mul(5))
    const rainbow = spectralColor(phase)
    const rainbowDeep = spectralColor(phase.add(2.45))
    const sanctum = view.dot(vec3(-0.35, 0.88, 0.31).normalize()).abs().pow(12)
    this.colorNode = mix(color(hsl.integer(252, 100, 93)), color(hsl.integer(90, 100, 96)), facing.mul(0.36).add(0.25)).add(rainbow.mul(rim).mul(0.045))
    this.transmission = 0.9
    this.thickness = 0.56
    this.ior = 2.08
    this.dispersion = 0.68
    this.attenuationColor.set(hsl.integer(252, 100, 93))
    this.attenuationDistance = 2.4
    this.roughness = 0.022
    this.clearcoat = 1
    this.clearcoatRoughness = 0.018
    this.iridescenceNode = grazing.mul(0.32).add(0.06)
    this.iridescenceIOR = 1.28
    this.iridescenceThicknessNode = roseAField.abs().mul(210).add(160)
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(31)).mul(intimate), 0.00018)
    this.emissiveNode = rainbow.mul(roseA).mul(near.mul(0.45).add(0.34)).add(rainbowDeep.mul(roseB).mul(0.72)).add(color(hsl.integer(97, 100, 94)).mul(roseC).mul(1.3)).add(color(hsl.integer(95, 100, 97)).mul(halo).mul(sanctum.mul(1.1).add(0.22))).add(color(hsl.integer(0, 0, 100)).mul(rim.pow(2)).mul(sanctum).mul(0.35))
  }
}
