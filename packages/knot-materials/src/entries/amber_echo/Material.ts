import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Golden resin with a quiet fossil current suspended below its glassy skin. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.65)
    this.name = knotData.id
    const {p, view, facing, near, intimate} = viewerFrame()
    const resin = mx_fractal_noise_float(p.mul(1.8).add(vec3(time.mul(0.006), time.mul(-0.004), 0)), 4, 2.05, 0.54).mul(0.5).add(0.5)
    const amber = mix(color(hsl.integer(38, 88, 18)), color(hsl.integer(64, 91, 66)), resin.clamp().pow(1.2))
    const inner = p.add(view.negate().mul(facing.mul(0.1).add(0.018)))
    const flow = mx_fractal_noise_float(inner.mul(4.6).add(vec3(time.mul(0.009), time.mul(-0.007), time.mul(0.004))), 4, 2.15, 0.55)
    const veins = flow.abs().mul(2.5).oneMinus().clamp().pow(4)
    const fossil = veins.mul(0.32).add(resin.mul(0.1))
    const bubbleField = p.mul(16).add(time.mul(0.006))
    const bubbleCell = cellNoiseVec3(bubbleField.floor())
    const bubbleDistance = bubbleField.fract().sub(bubbleCell.mul(0.5).add(0.25)).length()
    const bubbleRadius = bubbleCell.z.mul(0.075).add(0.03)
    const bubbleAA = bubbleField.fwidth().length().max(0.001)
    // Light the bubble interior, with filter support contained inside its cell.
    const bubbleOuter = bubbleRadius.add(bubbleAA).min(0.24)
    const bubble = bubbleDistance.smoothstep(bubbleRadius.mul(0.2), bubbleOuter).oneMinus().mul(bubbleCell.x.smoothstep(0.76, 0.94))
    const bubbleMask = bubble.mul(bubbleAA.smoothstep(0.08, 0.32).oneMinus())
    const angle = view.dot(vec3(0.71, 0.24, -0.66)).mul(0.5).add(0.5)
    const transmissionTint = mix(color(hsl.integer(34, 97, 24)), color(hsl.integer(79, 100, 83)), angle)
    const surface = proceduralNormal(resin.mul(0.07).add(veins.mul(0.015)), 0.0018)
    const glint = glints(surface, 72).mul(near).mul(0.16)
    this.colorNode = amber.add(transmissionTint.mul(fossil.mul(0.52))).add(color(hsl.integer(96, 100, 94.4)).mul(bubbleMask.mul(0.35)))
    this.metalness = 0.02
    this.roughnessNode = float(0.1).add(resin.mul(0.1)).sub(facing.mul(0.02)).clamp(0.05, 0.25)
    this.clearcoat = 0.92
    this.clearcoatRoughness = 0.03
    this.transmission = 0.26
    this.thickness = 0.5
    this.ior = 1.54
    this.dispersion = 0.18
    this.attenuationColor.set(hsl.integer(49, 94, 50))
    this.attenuationDistance = 1.05
    this.normalNode = surface
    this.clearcoatNormalNode = surface
    this.emissiveNode = color(hsl.integer(57, 100, 71.2)).mul(fossil.mul(intimate).mul(0.3)).add(color(hsl.integer(91, 100, 92.4)).mul(glint.mul(0.08))).add(color(hsl.integer(84, 100, 85.5)).mul(bubbleMask.mul(intimate).mul(0.1)))
  }
}
