import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, mix, mx_noise_float, mx_noise_vec3, mx_worley_noise_float, normalLocal, positionGeometry, tangentLocal, time, vec3} from 'three/tsl'

import {rgb} from '../../candidates/claude_fable/lib/rgb.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Seconds of one frost cycle: crystals grow outward from scattered seeds, hold, then thaw back. */
const cycleSeconds = 90
/** The exhibition opens mid-winter: at t = 0 the ferns already cover half the pane and are still spreading. */
const cycleOffset = 24.75
/** Thin bright lines where a noise field crosses zero; the caller stretches `q` for a fern-like directional grain. */
function veins(q: Node<'vec3'>, scale: number, width: number) {
  const field = mx_noise_float(q.mul(scale))
  const footprint = field.fwidth().max(1e-4)
  return field.abs().smoothstep(width, footprint.mul(1.3).add(width)).oneMinus().mul(footprint.smoothstep(width * 6, width * 1.5))
}
/** Dark winter glass, with frost ferns crystallizing across it and the viewer's breath fogging the pane. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const {facing, grazing, near, intimate} = viewerFrame()
    const p = positionGeometry
    const n = normalLocal.normalize()
    const t = tangentLocal.normalize()
    const b = n.cross(t).normalize()
// Surface-aligned coordinates: the ferns grow along the tube's grain, with a slow curl added by low-frequency flow.
    const flow = mx_noise_vec3(p.mul(2.3).add(vec3(5.1, -2.2, 8.4))).mul(0.35)
    const q = p.add(flow)
    const grain = vec3(q.dot(t), q.dot(b), q.dot(n))
    const stem = veins(grain.mul(vec3(1, 3.2, 1)), 14, 0.024)
    const branch = veins(grain.mul(vec3(3.4, 1, 1)).add(vec3(13.7, 0, 0)), 26, 0.016)
    const twig = veins(grain.mul(vec3(2.5, 2.5, 1)).add(vec3(0, 9.1, 0)), 52, 0.011)
// Feathery hoarfrost between the veins: soft ridged noise, strongest where the ferns are.
    const feather = mx_noise_float(grain.mul(vec3(6, 24, 6)).add(vec3(3.3, 1.1, 0))).abs().mul(4).oneMinus().max(0)
    const dendrite = stem.mul(0.9).add(branch.mul(0.75)).add(twig.mul(0.55).mul(near.mul(0.7).add(0.3))).add(feather.mul(0.2)).clamp()
// Fine crystalline sugar between the ferns, sparkling under the light.
    const sugar = mx_noise_float(p.mul(90)).mul(0.5).add(0.5)
    const crystals = cellNoiseVec3(p.mul(140)).x.smoothstep(0.86, 0.9)
// Growth: every seed sends a front outward, then the whole pane thaws before the next winter.
    const cycle = time.add(cycleOffset).div(cycleSeconds).fract()
    const season = cycle.smoothstep(0, 0.55).sub(cycle.smoothstep(0.78, 1))
    const seedDistance = mx_worley_noise_float(p.mul(3.4).add(vec3(2, 7, 1)))
    const frontier = season.mul(1.35).sub(seedDistance.add(mx_noise_float(p.mul(12)).mul(0.12)))
    const covered = frontier.smoothstep(-0.08, 0.08)
// At the advancing edge the ferns are thin and sharp; deep inside they fill in with opaque rime.
    const edge = frontier.abs().smoothstep(0.1, 0).mul(0.5)
    const rime = frontier.smoothstep(0, 0.5)
// Breath: whoever leans in fogs the glass right in front of them, in slow breathing pulses.
    const breathPulse = time.mul(0.8).sin().mul(0.5).add(0.5).pow(1.5)
    const breathSpot = facing.pow(5).mul(intimate)
    const condensation = breathSpot.mul(breathPulse.mul(0.7).add(0.3))
    const frost = covered.mul(dendrite.mul(0.85).add(rime.mul(sugar.pow(2)).mul(0.3)).add(edge)).clamp().mul(condensation.mul(0.55).oneMinus())
    const frostHeight = frost.mul(0.02).add(rime.mul(covered).mul(sugar).mul(0.004))
    const surfaceNormal = proceduralNormal(frostHeight, 1.2)
    this.normalNode = surfaceNormal
    const glass = mix(rgb(hsl.integer(243, 46, 8)), rgb(hsl.integer(241, 57, 14)), grazing.pow(2))
    const frostColor = mix(rgb(hsl.integer(230, 31, 86)), rgb(hsl.integer(242, 38, 96.6)), rime)
    this.colorNode = mix(glass, frostColor, frost.pow(1.4).mul(0.92))
    this.metalness = 0
    this.roughnessNode = mix(float(0.05), float(0.55), frost).add(condensation.mul(0.5)).clamp(0.04, 0.95)
    this.clearcoat = 1
    this.clearcoatRoughnessNode = frost.mul(0.35).add(condensation.mul(0.6)).clamp(0.02, 0.9)
    this.sheenNode = frostColor.mul(frost.pow(2).mul(0.7).add(condensation.mul(0.35)))
    this.sheenRoughness = 0.55
    const sparkle = glints(surfaceNormal, 500).mul(crystals).mul(covered).mul(near.mul(1.3).add(0.3))
    const interior = rgb(hsl.integer(238, 74, 19)).mul(facing.pow(1.5)).mul(frost.oneMinus()).mul(0.08)
    const fog = rgb(hsl.integer(233, 31, 88)).mul(condensation).mul(0.08)
    this.emissiveNode = rgb(hsl.integer(0, 0, 100)).mul(sparkle).mul(0.8).add(interior).add(fog).add(rgb(hsl.integer(248, 100, 81.4)).mul(edge).mul(covered).mul(0.06))
  }
}
