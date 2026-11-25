import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, vec3, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
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
    // Four apparent physical depths.
    //
    // Walking sideways causes these layers to separate naturally through
    // parallax. Looking straight on compresses them back together.
    const depth = p.sub(view.mul(0.075))
    const inner = p.sub(view.mul(0.16))
    const deep = p.sub(view.mul(0.28))
    // Ruby crystal with inscriptions that do not sit on the surface.
    //
    // Separate glyph layers intersect and diverge as the viewer moves,
    // producing moments where hidden structures suddenly align.
    const q = inner.mul(vec3(13, 11, 13))
    const glyphField = q.x.sin().mul(q.y.cos()).add(q.z.sin().mul(0.72)).add(q.x.add(q.z).mul(0.73).sin().mul(0.5))
    const sigils = opticalLine(glyphField, 0.055)
    const halo = opticalLine(inner.xz.length().mul(54).add(inner.y.mul(11)).add(view.x.mul(2.5)).sin(), 0.07)
    const deepQ = deep.mul(vec3(17, 9, 15))
    const deepGlyph = opticalLine(deepQ.x.cos().add(deepQ.z.sin()).add(deepQ.y.mul(1.3).sin().mul(0.6)), 0.044).mul(near)
    const blood = mx_noise_float(depth.mul(7)).mul(0.5).add(0.5)
    const revelation = view.dot(vec3(0.41, 0.79, -0.45).normalize()).abs().pow(9)
    this.colorNode = mix(color(hsl.integer(11, 85, 5)), color(hsl.integer(24, 97, 28)), blood).add(color(hsl.integer(28, 94, 49.4)).mul(halo).mul(0.12))
    this.transmission = 0.5
    this.thickness = 0.48
    this.ior = 1.7
    this.dispersion = 0.2
    this.attenuationColor.set(hsl.integer(25, 99, 30))
    this.attenuationDistance = 0.5
    this.roughnessNode = sigils.mul(0.04).add(0.065)
    this.clearcoat = 0.93
    this.clearcoatRoughness = 0.035
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(13)), 0.0012)
    this.emissiveNode = color(hsl.integer(72.6, 100, 78.4)).mul(sigils).mul(near.mul(0.55).add(0.46)).add(color(hsl.integer(93, 100, 93.6)).mul(deepGlyph).mul(revelation.mul(1.4).add(0.35))).add(color(hsl.integer(24, 97.3, 52)).mul(halo).mul(grazing.mul(0.8).add(0.18))).add(color(hsl.integer(35, 100, 90)).mul(rim).mul(revelation).mul(0.5))
  }
}
