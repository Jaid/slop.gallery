import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec3} from 'three/tsl'

import {tubeRay} from '../../lib/atelier.ts'
import {beads} from '../../lib/beads.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Several parallax layers of lacquered ink make one slow calligraphic current. Gold is not a crack in the surface: it is leaf caught at the river's most deliberate turns. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.82)
    this.name = knotData.id
    const {grazing, intimate, near, p, rim} = viewerFrame()
    const tube = uv()
    const ray = tubeRay()
    const front = tube.sub(ray.mul(0.024))
    const middle = tube.sub(ray.mul(0.085))
    const deep = tube.sub(ray.mul(0.15))
    const fluidA = mx_noise_float(p.mul(2.15).add(vec3(time.mul(0.018), time.mul(-0.011), 0))).mul(0.5).add(0.5)
    const fluidB = mx_noise_float(p.mul(5.7).sub(vec3(0, time.mul(0.024), 0))).mul(0.5).add(0.5)
    // Whole cycles let all three parallax layers meet at both UV wraps.
    const frontPhase = front.y.mul(TAU * 5).add(front.x.mul(TAU)).add(fluidA.mul(8.2)).sub(fluidB.mul(3.1))
    const middlePhase = middle.y.mul(TAU * 7).sub(middle.x.mul(TAU * 3)).add(fluidA.mul(5.7))
    const deepPhase = deep.y.mul(TAU * 3).add(deep.x.mul(TAU * 5)).sub(fluidB.mul(6.8))
    const frontRiver = frontPhase.sin().mul(0.5).add(0.5).smoothstep(0.54, 0.78)
    const middleRiver = middlePhase.sin().mul(0.5).add(0.5).smoothstep(0.6, 0.82)
    const deepRiver = deepPhase.sin().mul(0.5).add(0.5).smoothstep(0.62, 0.85)
    const edge = filteredRibbon(frontPhase.sin(), 0.07)
    const fineEdge = filteredRibbon(middlePhase.sin(), 0.035).mul(intimate)
    const leaf = beads(p.mul(19).add(vec3(5.3, 1.7, 9.2)), 2.8)
    const leafGate = leaf.random.y.smoothstep(0.72, 0.83)
    const goldLeaf = leaf.core.mul(leafGate).mul(intimate)
    const current = frontRiver.mul(0.56).add(middleRiver.mul(0.31)).add(deepRiver.mul(0.13))
    const lacquer = mix(color(hsl.integer(256, 37, 2)), color(hsl.integer(272, 60, 8.6)), fluidA.mul(0.24).add(grazing.mul(0.08)))
    const ink = mix(color(hsl.integer(213, 87, 31)), color(hsl.integer(20, 94, 41.5)), middleRiver.mul(0.56).add(fluidB.mul(0.14)))
    const riverColor = mix(color(hsl.integer(259, 89, 20)), ink, frontRiver.mul(0.78).add(deepRiver.mul(0.1)))
    // Random leaf tint must not leak onto the continuous gold river edges.
    const goldVariation = mix(mx_noise_float(p.mul(19)).mul(0.5).add(0.5), leaf.random.x, goldLeaf)
    const gold = mix(color(hsl.integer(54, 91, 47)), color(hsl.integer(97, 100, 94.4)), goldVariation.mul(0.72).add(edge.mul(0.2)))
    const relief = current.mul(0.36).add(edge.mul(0.46)).add(fineEdge.mul(0.18)).add(goldLeaf.mul(0.28))
    const flowingLacquer = mix(lacquer, riverColor, current.mul(0.8))
    this.colorNode = mix(flowingLacquer, gold, edge.mul(0.64).add(goldLeaf).clamp())
    this.metalnessNode = float(0.1).add(edge.mul(0.26)).add(goldLeaf.mul(0.68)).clamp(0.05, 0.86)
    this.roughnessNode = float(0.115).add(current.oneMinus().mul(0.07)).sub(edge.mul(0.055)).add(goldLeaf.mul(0.08)).clamp(0.045, 0.3)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.032
    this.normalNode = proceduralNormal(relief, 0.00115)
    this.emissiveNode = gold.mul(edge).mul(near.mul(0.1).add(0.012))
      .add(color(hsl.integer(53, 75, 62.4)).mul(goldLeaf).mul(intimate).mul(0.13))
      .add(color(hsl.integer(259, 55, 46)).mul(rim).mul(grazing).mul(0.045))
  }
}
