import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, positionViewDirection, tangentView, time, uv, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const p = positionGeometry
    const tube = uv()
    const {grazing, near, intimate} = viewerFrame()
    // The broad nap follows the knot’s sweep. A second, much finer weave only resolves when the
    // visitor comes close enough to feel the material rather than merely see its silhouette.
    const drift = vec3(time.mul(0.018), time.mul(-0.011), time.mul(0.014))
    const warp = mx_noise_float(p.mul(2.6).add(drift)).mul(0.18)
    const napPhase = tube.x.mul(TAU * 8).add(tube.y.mul(TAU * 3)).add(warp.mul(9)).add(time.mul(0.035))
    const nap = napPhase.sin().mul(0.5).add(0.5)
    const weavePhase = tube.x.mul(TAU * 86).add(tube.y.mul(TAU * 29)).add(warp.mul(21))
    const weave = opticalBands(weavePhase).mul(0.5).add(0.5)
    const fiber = mx_noise_float(p.mul(68).add(drift.mul(4))).mul(0.5).add(0.5)
    // Velvet is brightest when the directional nap turns across the viewer, not when it faces them.
    const tangentFacing = tangentView.normalize().dot(positionViewDirection).abs().clamp()
    const directionalSheen = tangentFacing.pow(1.7).mul(grazing.pow(0.65).mul(0.8).add(0.2))
    const nocturne = time.mul(0.075).sin().mul(0.5).add(0.5)
    const wine = mix(color(hsl.integer(282, 46, 3)), color(hsl.integer(313, 71, 11)), nap.mul(0.65).add(nocturne.mul(0.2)))
    const blue = mix(color(hsl.integer(255, 59, 4.4)), color(hsl.integer(255, 75, 18)), weave.mul(0.5).add(nocturne.mul(0.25)))
    const body = mix(wine, blue, grazing.mul(0.3).add(weave.mul(0.1)).clamp())
    const sheenColor = mix(color(hsl.integer(345, 85, 52.4)), color(hsl.integer(209, 91, 73)), directionalSheen.mul(0.7).add(nocturne.mul(0.2)).clamp())
    const highlight = directionalSheen.mul(0.68).add(grazing.pow(2.8).mul(0.32)).mul(near.mul(0.55).add(0.45))
    const surface = mix(body, sheenColor, highlight.clamp())
    this.colorNode = surface
    this.metalness = 0
    this.roughnessNode = float(0.68).sub(directionalSheen.mul(0.16)).sub(near.mul(0.06)).add(fiber.mul(0.04)).clamp(0.38, 0.76)
    this.sheen = 0.96
    this.sheenColor.set(hsl.integer(323, 83, 57))
    this.sheenRoughness = 0.42
    this.clearcoat = 0.06
    this.clearcoatRoughness = 0.18
    this.anisotropy = 0.45
    this.transmission = 0
    const relief = nap.mul(0.00055).add(fiber.mul(near).mul(0.00018))
    this.positionNode = p.add(normalLocal.mul(relief))
    this.normalNode = proceduralNormal(relief, 1)
    this.emissiveNode = color(hsl.integer(306, 84, 43.4)).mul(grazing.pow(1.75).mul(0.19).add(intimate.mul(0.022))).mul(near.mul(0.5).add(0.5)).add(color(hsl.integer(315, 100, 69.5)).mul(grazing.pow(5).mul(0.08)))
  }
}
