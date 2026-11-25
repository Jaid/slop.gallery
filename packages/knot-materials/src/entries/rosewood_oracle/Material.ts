import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, positionViewDirection, tangentView, time, uv, vec2} from 'three/tsl'

import {enamel, etch, filteredCos, ornamentCell} from '../../candidates/gpt_sol/lib/ornamentAtlas.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Quarter-sawn rosewood with localized burl eyes, open vessels, cross rays and moving chatoyance. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = data.id
    const tube = uv()
    const {p, grazing, near, intimate} = viewerFrame()
    const lowNoise = mx_noise_float(p.mul(4)).mul(0.5).add(0.5)
    const warp = mx_noise_float(p.mul(11)).mul(1.6)
    const longGrain = tube.y.mul(TAU * 32).add(tube.x.mul(TAU * 5).sin().mul(3.2)).add(warp)
    const eyeCell = ornamentCell(tube, 9, 2, 37)
    const eyeQ = eyeCell.q.sub(eyeCell.random.xy.sub(0.5).mul(0.12)).mul(vec2(1.4, 1))
    const eyeRadius = eyeQ.length()
    const eyeInfluence = eyeRadius.smoothstep(0.1, 0.43).oneMinus().mul(eyeCell.random.z.smoothstep(0.3, 0.58))
    const burl = eyeRadius.mul(145).add(mx_noise_float(p.mul(18)).mul(1.3)).add(eyeCell.random.y.mul(TAU))
    // Blend periodic signals, not wrapped phases: annual rings meet smoothly around every burl eye.
    const grain = mix(filteredCos(longGrain), filteredCos(burl), eyeInfluence).mul(0.5).add(0.5)
    const fiber = filteredCos(longGrain.mul(7).add(warp.mul(2))).mul(0.5).add(0.5)
    const darkRing = grain.pow(4)
    const sapwood = lowNoise.smoothstep(0.41, 0.66)
    const redHeart = mix(color(hsl.integer(15, 63, 13)), color(hsl.integer(36, 73, 39)), lowNoise)
    const warmWood = mix(redHeart, color(hsl.integer(65, 66, 64)), sapwood.mul(0.62))
    const growthColor = mix(warmWood, color(hsl.integer(32, 65, 15)), darkRing.mul(0.71))
    const vessels = ornamentCell(tube, 420, 90, 85)
    const vesselQ = vessels.q.sub(vessels.random.xy.sub(0.5).mul(0.32))
    const poreShape = vesselQ.div(vec2(0.32, 0.041)).length().sub(1)
    const pores = enamel(poreShape).mul(vessels.random.z.smoothstep(0.5, 0.7))
      .mul(vessels.grid.fwidth().length().smoothstep(0.25, 1.4).oneMinus())
    const rayPhase = tube.x.mul(TAU * 180).add(tube.y.mul(TAU * 3).sin().mul(2))
    const crossRay = filteredCos(rayPhase).mul(0.5).add(0.5).pow(12)
      .mul(lowNoise.smoothstep(0.45, 0.65)).mul(intimate)
    const viewAlong = positionViewDirection.dot(tangentView.normalize()).abs()
    const catEye = viewAlong.oneMinus().pow(7).mul(eyeInfluence.mul(0.6).add(0.2))
      .mul(grain.mul(0.55).add(0.45))
    const silkReflection = mix(color(hsl.integer(73, 65, 74)), color(hsl.integer(76, 59, 81)), sapwood)
    const sapPulse = tube.x.mul(TAU * 4).sub(time.mul(0.24)).add(warp).cos().mul(0.5).add(0.5).pow(8)
    const warmth = near.mul(0.5).add(0.5).mul(sapPulse)
    const polished = mix(growthColor, silkReflection, catEye.mul(warmth.mul(0.14).add(0.5)))
      .add(color(hsl.integer(52, 68, 46)).mul(warmth).mul(sapwood.mul(0.6).add(0.25)).mul(0.075))
    const detailed = polished.mul(fiber.mul(0.07).add(0.93)).mul(pores.mul(-0.62).add(1))
      .add(color(hsl.integer(80, 45, 68)).mul(crossRay).mul(0.05))
    const sapChannel = etch(grain.sub(0.72), 0.011).mul(sapwood).mul(eyeInfluence.oneMinus())
    this.colorNode = detailed
    this.metalness = 0
    this.roughnessNode = float(0.26).add(pores.mul(0.14)).add(darkRing.mul(0.045)).sub(catEye.mul(0.045))
    this.ior = 1.52
    this.clearcoat = 1
    this.clearcoatRoughness = 0.075
    this.anisotropy = 0.78
    this.anisotropyNode = vec2(1, warp.mul(0.06)).normalize().mul(0.78)
    this.sheen = 0.12
    this.sheenNode = color(hsl.integer(65, 63, 62)).mul(0.12)
    this.sheenRoughness = 0.4
    const grainHeight = darkRing.mul(-0.00022).add(fiber.mul(0.000028)).sub(pores.mul(0.0002))
    this.normalNode = proceduralNormal(grainHeight, 0.75)
    // Varnish bridges the pores: its normal is intentionally smoother than the wood underneath.
    this.clearcoatNormalNode = proceduralNormal(lowNoise.mul(0.0003).add(grain.mul(0.000055)), 0.65)
    this.emissiveNode = color(hsl.integer(74, 75, 75)).mul(sapChannel).mul(sapPulse).mul(near).mul(0.16)
      .add(color(hsl.integer(41, 80, 39)).mul(grazing.pow(3)).mul(0.013))
  }
}
