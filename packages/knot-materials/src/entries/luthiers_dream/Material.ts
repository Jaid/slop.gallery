import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, modelViewMatrix, mx_atan2, mx_noise_float, negateOnBackSide, normalLocal, vec2, vec3, vec4} from 'three/tsl'

import {bumpNormal} from '../../candidates/gpt_astra/lib/bumpNormal.ts'
import {filteredWave} from '../../candidates/gpt_astra/lib/filteredWave.ts'
import {viewerFrame} from '../../candidates/gpt_astra/lib/viewerFrame.ts'
import {visibility} from '../../candidates/gpt_astra/lib/visibility.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import knotData from './data.ts'

/** Carved, figured timber with directional fibre reflection. The curl reverses from luminous to dark as the viewer moves; end grain, vessels and medullary rays emerge at close range. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const {p, view, V, T, B, near, grazing} = viewerFrame()
    const coarse = mx_noise_float(p.mul(vec3(3.4, 1.8, 3.4)))
    const curlPhase = p.y.mul(24)
      .add(mx_noise_float(p.mul(vec3(5, 1.5, 5))).mul(2.2))
    const growthPoint = vec2(p.x.add(curlPhase.sin().mul(0.055)), p.z.add(p.y.mul(11).sin().mul(0.04)))
    const radial = growthPoint.length()
    const grainPhase = radial.mul(140)
      .add(mx_noise_float(p.mul(vec3(8, 1.2, 8))).mul(2.6))
    const rawLatewood = grainPhase.cos()
      .mul(0.5)
      .add(0.5)
      .smoothstep(0.6, 0.93)
    const latewood = mix(float(0.3), rawLatewood, visibility(grainPhase.fwidth(), 0.7, 3))
    const fibreAxis = vec3(curlPhase.cos().mul(0.28).add(0.12), 1, p.y.mul(17).add(coarse.mul(2)).sin().mul(0.22)).normalize()
    const fibreView = modelViewMatrix
      .mul(vec4(fibreAxis, 0))
      .xyz
      .normalize()
    const fibreUV = vec2(fibreView.dot(T), fibreView.dot(B))
    const fibreLength = fibreUV.length()
    const chatoyance = fibreView.dot(V)
      .abs()
      .clamp()
      .oneMinus()
      .pow(7)
    // A shallow buried figure supplies real directional parallax,
    // independently of the surface's growth-ring pattern.
    const buried = p.sub(view.mul(grazing.mul(0.01).add(0.012)))
    const figure = mx_noise_float(buried.mul(vec3(7, 19, 7))).mul(0.5).add(0.5)
    const endGrain = normalLocal.normalize()
      .dot(fibreAxis)
      .abs()
      .clamp()
    const vesselQ = p.mul(vec3(200, 12, 200))
    const vesselVisibility = visibility(vesselQ.fwidth().length()).mul(near)
    const vessels = mx_noise_float(vesselQ)
      .smoothstep(0.24, 0.52)
      .mul(vesselVisibility)
    const rayAngle = mx_atan2(growthPoint.y, growthPoint.x.add(0.000001)) as unknown as Node<'float'>
    const rayPhase = rayAngle.mul(48).add(radial.mul(14))
    const rayVisibility = visibility(growthPoint.fwidth().length()
      .div(radial.max(0.03))
      .mul(48), 0.7, 3).mul(near)
    const rays = rayPhase.cos()
      .smoothstep(0.9, 0.99)
      .mul(rayVisibility)
    const timber = mix(color(hsl.integer(74, 65, 78)), color(hsl.integer(46, 70, 27)), latewood.mul(0.76).add(0.08))
    const figuredTimber = timber
      .mul(chatoyance.mul(0.55).add(0.7))
      .mul(figure.mul(0.18).add(0.91))
      .mul(endGrain.mul(-0.18).add(1))
    this.colorNode = mix(figuredTimber, color(hsl.integer(85, 71, 87)), rays.mul(0.24)).mul(vessels.mul(-0.3).add(1))
    this.metalness = 0
    this.ior = 1.47
    this.specularIntensity = 0.7
    this.specularColorNode = color(hsl.integer(88, 100, 95.4))
    this.roughnessNode = float(0.3)
      .add(endGrain.mul(0.08))
      .add(vessels.mul(0.1))
      .sub(chatoyance.mul(0.055))
    // r186 anisotropyNode is a tangent-space direction * strength.
    this.anisotropy = 0.72
    this.anisotropyNode = fibreUV
      .div(fibreLength.max(0.0001))
      .mul(fibreLength.smoothstep(0.08, 0.7))
      .mul(0.72)
    this.clearcoat = 0.15
    this.clearcoatRoughness = 0.24
    this.normalNode = negateOnBackSide(bumpNormal(filteredWave(grainPhase).mul(0.00016)
      .sub(vessels.mul(0.00028))
      .add(rays.mul(0.00008))))
  }
}
