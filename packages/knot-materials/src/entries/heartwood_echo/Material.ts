import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, positionViewDirection, time, uv, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.02)
    this.name = knotData.id
    const p = positionGeometry
    const {view, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const q = p.sub(view.mul(0.028))
    const warp = mx_fractal_noise_float(q.mul(3.1).add(vec3(2.4, -4.8, 7.1)), 3, 2.1, 0.55)
    // UV length carries the grain around the knot while the circumference supplies annual-ring variation.
    const growthPhase = tube.x.mul(TAU * 18).add(tube.y.mul(TAU * 1.7)).add(warp.mul(4)).add(time.mul(0.012))
    const rings = opticalBands(growthPhase)
    const ringLines = opticalLine(growthPhase.sin(), 0.12)
    const grainPhase = tube.y.mul(TAU * 22).add(tube.x.mul(TAU * 4)).add(warp.mul(12)).add(time.mul(-0.008))
    const grain = opticalBands(grainPhase).mul(0.5).add(0.5)
    const poreNoise = mx_noise_float(p.mul(34).add(vec3(time.mul(0.004), 0, 0))).mul(0.5).add(0.5)
    const finePores = mx_noise_float(p.sub(view.mul(0.13)).mul(78)).mul(0.5).add(0.5).mul(near)
    const sapField = mx_noise_float(q.mul(8.7).add(vec3(-5.3, 6.4, 1.8))).add(q.dot(vec3(1.3, -2.7, 4.1)).sin().mul(0.28))
    const sap = opticalLine(sapField, 0.03).mul(near.mul(0.72).add(0.28))
    const rayField = q.dot(vec3(2.8, 1.1, -3.6)).mul(5.8).add(warp.mul(2.5))
    const rays = opticalLine(rayField.sin(), 0.045).mul(near.mul(0.75).add(0.25))
    const sapWide = opticalLine(sapField, 0.09).mul(0.38)
    const direction = positionViewDirection.dot(vec3(0.64, -0.18, 0.75).normalize()).abs().clamp()
    const glaze = direction.pow(1.6).mul(grazing.pow(0.8).mul(0.7).add(0.3))
    const heartbeat = p.dot(vec3(4.2, -3.5, 5.8)).mul(2.2).add(time.mul(0.31)).sin().mul(0.5).add(0.5)
    const wood = mix(color(hsl.integer(20, 34, 4)), color(hsl.integer(28, 69, 15)), rings.mul(0.62).add(grain.mul(0.23)))
    const redHeart = mix(color(hsl.integer(29, 66, 12)), color(hsl.integer(35, 88, 39)), rings.mul(0.55).add(warp.mul(0.2).add(0.3)))
    const body = mix(wood, redHeart, ringLines.mul(0.38).add(grain.mul(0.13)))
    const sapColor = mix(color(hsl.integer(43, 83, 31)), color(hsl.integer(73, 84, 78)), heartbeat.mul(0.48).add(grazing.mul(0.52)).clamp())
    const surface = mix(body, sapColor, sap.mul(0.86).add(sapWide.mul(0.16)).clamp())
    const rayColor = mix(color(hsl.integer(35, 79, 28)), color(hsl.integer(55, 75, 61)), grain.mul(0.6).add(grazing.mul(0.4)))
    const surfaced = mix(surface, rayColor, rays.mul(0.22))
    const polished = mix(surfaced, color(hsl.integer(64, 60, 64)), glaze.mul(ringLines.mul(0.26).add(0.04)).clamp())
    const relief = ringLines.mul(0.0012).add(sap.mul(0.0013)).add(rays.mul(0.00045)).add(finePores.mul(0.00025))
    const ringHeight = growthPhase.sin().abs().smoothstep(0.22, 0.045).oneMinus()
    this.colorNode = polished
    this.metalness = 0
    this.roughnessNode = float(0.52).sub(glaze.mul(0.2)).sub(sap.mul(0.16)).sub(rays.mul(0.05)).add(poreNoise.mul(0.06)).clamp(0.12, 0.66)
    this.clearcoat = 0.58
    this.clearcoatRoughness = 0.075
    this.sheen = 0.24
    this.sheenColor.set(hsl.integer(54, 70, 67))
    this.sheenRoughness = 0.42
    this.anisotropy = 0.72
    this.normalNode = proceduralNormal(relief.add(finePores.mul(0.0004)), 0.68)
    this.positionNode = p.add(normalLocal.mul(ringHeight.mul(0.0018)))
    this.emissiveNode = sapColor.mul(sap).mul(heartbeat.mul(0.12).add(intimate.mul(0.035))).add(color(hsl.integer(52, 100, 71)).mul(sapWide).mul(grazing.pow(3)).mul(0.08))
  }
}
