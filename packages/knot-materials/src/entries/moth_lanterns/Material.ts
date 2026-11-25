import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {disk, ring, segment} from '../../candidates/gpt_sol/lib/galleryMarks.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.63)
    this.name = knotData.id
    const tile = uv().mul(vec2(12, 3))
    const id = tile.floor()
    const random = cellNoiseVec3(vec3(id, 9.2))
    const {near, grazing} = viewerFrame()
    const q = tile.fract().sub(0.5).sub(tubeRay().mul(0.008))
    const aa = tile.fwidth().length().mul(0.6).max(0.0001)
    const flutter = time.mul(1.9).add(random.x.mul(6.28)).sin().mul(0.075)
    let wings: Node<'float'> = float(0)
    let markings: Node<'float'> = float(0)
    for (const side of [-1, 1]) {
      const p = vec2(q.x.mul(side), q.y)
      const upper = p.sub(vec2(0.19 + side * 0.012, 0.12)).x.div(0.17).pow2().add(p.sub(vec2(0.19, 0.12)).y.div(0.2).pow2())
      const lower = p.sub(vec2(0.15, -0.17)).x.div(0.14).pow2().add(p.sub(vec2(0.15, -0.17)).y.div(0.15).pow2())
      const tremor = flutter.mul(p.x)
      const upperWing = upper.add(tremor).smoothstep(0.77, 1.12).oneMinus()
      const lowerWing = lower.sub(tremor).smoothstep(0.77, 1.12).oneMinus()
      wings = wings.max(upperWing).max(lowerWing)
      markings = markings.max(ring(p.sub(vec2(0.235, 0.13)), 0.07, 0.009, aa).mul(upperWing)).max(disk(p.sub(vec2(0.235, 0.13)), 0.028, aa).mul(upperWing))
    }
    const body = segment(q, [0, -0.25], [0, 0.25], 0.018, aa)
    const feelers = segment(q, [0, 0.19], [-0.07, 0.35], 0.002, aa).max(segment(q, [0, 0.19], [0.07, 0.35], 0.002, aa))
    const glow = mx_noise_float(vec3(uv().mul(vec2(8, 10)), time.mul(0.09))).mul(0.5).add(0.5)
    this.colorNode = mix(color(hsl.integer(188, 86, 10)), color(hsl.integer(167, 77, 28)), glow.mul(0.52))
    this.colorNode = mix(this.colorNode, color(hsl.integer(139, 63, 58)), wings.mul(0.52))
    this.metalness = 0.22
    this.roughnessNode = wings.mul(0.17).add(0.24)
    this.transmission = 0.19
    this.thickness = 0.28
    this.attenuationColor.set(hsl.integer(163, 89, 50))
    this.attenuationDistance = 0.45
    this.clearcoat = 0.8
    this.clearcoatRoughness = 0.09
    const waking = time.mul(0.8).add(random.y.mul(6.28)).sin().mul(0.35).add(0.65)
    this.emissiveNode = color(hsl.integer(133, 75, 79)).mul(wings).mul(waking).mul(0.37)
      .add(color(hsl.integer(92, 100, 91)).mul(markings).mul(waking).mul(1.3))
      .add(color(hsl.integer(82, 79, 84)).mul(body.add(feelers)).mul(0.85))
      .add(color(hsl.integer(155, 81, 85)).mul(grazing.pow(3)).mul(0.17)).mul(near.mul(0.26).add(0.8))
  }
}
