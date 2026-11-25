import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, time} from 'three/tsl'

import {beads} from '../../lib/beads.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A temple stone the forest reclaimed. Moss thickens on its lit shoulders, dew beads gather in the crevices and catch the lamps, and amber spores breathe awake only for visitors who step close. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {p, near, intimate} = viewerFrame()
    // Derivative-free tuft relief for the vertex stage.
    const tuftRaw = mx_noise_float(p.mul(9)).mul(0.5).add(0.5)
    const tuftVertex = tuftRaw.pow(2).mul(0.02).add(mx_noise_float(p.mul(23)).mul(0.004))
    this.positionNode = p.add(normalLocal.normalize().mul(tuftVertex))
    const growth = mx_fractal_noise_float(p.mul(5), 3, 2, 0.5).mul(0.5).add(0.5)
    const fineGrowth = mx_noise_float(p.mul(21)).mul(0.5).add(0.5)
    const upward = normalLocal.normalize().y.mul(0.5).add(0.5)
    const moss = growth.mul(0.65).add(upward.mul(0.3)).add(fineGrowth.mul(0.15)).smoothstep(0.54, 0.82)
    const dew = beads(p.mul(29), 11.3)
    const lichen = cellularPoints(p.mul(17), 0.05, 0.2, 0.78)
    const stone = mix(color(hsl.integer(114, 10, 23)), color(hsl.integer(107, 11, 44)), fineGrowth)
    const mossColor = mix(color(hsl.integer(139, 85, 18)), color(hsl.integer(129, 80, 62)), fineGrowth.mul(0.7).add(growth.mul(0.3)))
    const living = mix(stone, mossColor, moss)
    this.colorNode = mix(mix(living, color(hsl.integer(120, 35, 77)), lichen.mul(0.5)), color(hsl.integer(251, 100, 93.4)), dew.mask.mul(0.3))
    this.metalness = 0
    this.roughnessNode = float(0.88).sub(moss.mul(0.12)).sub(dew.mask.mul(0.8)).clamp(0.05, 0.95)
    this.clearcoatNode = dew.mask.mul(0.9)
    this.clearcoatRoughness = 0.05
    this.sheen = 0.35
    this.sheenColor.set(hsl.integer(128, 64, 73))
    this.sheenRoughness = 0.65
    const relicNormal = proceduralNormal(tuftRaw.mul(0.6).add(dew.cap.mul(dew.core).mul(0.5)), 0.95)
    this.normalNode = relicNormal
    const sporePulse = time.mul(Math.PI).add(fineGrowth.mul(18)).sin().mul(0.5).add(0.5)
    const spores = cellularPoints(p.mul(38), 0.03, 0.17, 0.72)
    this.emissiveNode = color(hsl.integer(246, 100, 90.7))
      .mul(glints(relicNormal, 150))
      .mul(dew.mask)
      .mul(near.mul(1.5).add(0.15))
      .add(color(hsl.integer(72, 100, 79.1)).mul(spores).mul(sporePulse.pow(3)).mul(intimate).mul(0.9))
      .add(color(hsl.integer(135, 76, 53)).mul(moss).mul(0.03))
  }
}
