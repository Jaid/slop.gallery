import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_noise_float, normalLocal, positionGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {detail, fill, stroke, wave} from '../../candidates/gpt_astra/lib/exhibition/pattern.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Nested, six-lobed paper cuts. The dark undersides are narrow shadows, never emissive contour lines. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.65)
    this.name = knotData.id
    const {p, grazing, intimate} = viewerFrame()
    const tube = uv()
    const q = tube.mul(vec2(16, 2))
    const rnd = cellNoiseVec3(vec3(wrapCell(q.floor(), vec2(16, 2)), 31.4))
    const local = q.fract().sub(0.5)
    const r = local.length()
    const theta = mx_atan2(local.y, local.x.add(0.00001)) as unknown as Node<'float'>
    const opening = time.mul(0.36).add(rnd.x.mul(TAU)).sin().mul(0.07)
    const lobes = theta.mul(6).add(r.mul(3.2)).add(rnd.y.mul(TAU)).cos()
    const radius = lobes.mul(0.065).add(0.35).add(opening.mul(r.smoothstep(0.02, 0.2)))
    const contour = r.div(radius)
    const fw = q.fwidth().length().max(0.0001)
    const bloom = fill(r.sub(radius), fw)
    const tiers = contour.mul(6.5)
    const layerAA = tiers.fwidth().max(0.0001)
    const edge = stroke(tiers.fract().sub(0.07), 0.036, layerAA)
      .mul(layerAA.smoothstep(0.18, 0.75).oneMinus()).mul(bloom)
    const turn = wave(tiers.mul(TAU)).mul(0.5).add(0.5)
    const pinkness = contour.clamp().mul(0.72).add(rnd.z.mul(0.2)).add(lobes.mul(0.08))
    const paper = mix(color(hsl.integer(82, 50, 90.4)), color(hsl.integer(11, 62, 55.6)), pinkness)
    const underside = mix(color(hsl.integer(7, 36, 31)), color(hsl.integer(20, 48, 54)), contour.clamp())
    const fiberQ = p.mul(vec3(300, 120, 300))
    const fiber = mx_noise_float(fiberQ).mul(detail(fiberQ)).mul(intimate)
    let surface = mix(color(hsl.integer(77, 29, 82)), paper.mul(turn.mul(0.17).add(0.82)), bloom)
    surface = mix(surface, underside, edge.mul(0.72))
    const rim = stroke(r.sub(radius), 0.004, fw)
    const gilding = rim.mul(rnd.x.smoothstep(0.4, 0.8))
    surface = mix(surface, color(hsl.integer(70, 57, 62)), gilding)
    this.colorNode = surface.mul(fiber.mul(0.09).add(1))
    this.metalnessNode = gilding.mul(0.65)
    this.roughnessNode = mix(float(0.88), float(0.38), gilding)
    const fold = lobes.mul(r.smoothstep(0.015, 0.13)).mul(bloom)
    this.normalNode = proceduralNormal(turn.mul(bloom).mul(0.0016).add(fold.mul(0.001)).add(fiber.mul(0.00016)), 1)
    // The low-frequency, derivative-free displacement is independent of the paper’s fine cuts.
    const breathing = tube.x.mul(TAU * 8).add(tube.y.mul(TAU * 2)).sub(time.mul(0.36)).sin()
    this.positionNode = positionGeometry.add(normalLocal.mul(breathing.mul(0.0018)))
    this.sheenNode = color(hsl.integer(48, 54, 84)).mul(0.3)
    this.sheenRoughness = 0.8
    this.aoNode = edge.mul(-0.22).add(1)
    this.emissiveNode = paper.mul(grazing.pow(3)).mul(bloom).mul(0.045)
  }
}
