import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentView, color, float, mix, mx_cell_noise_float, mx_noise_float, mx_worley_noise_float, normalViewGeometry, positionViewDirection, tangentView, vec3} from 'three/tsl'

import {glitter} from '../../candidates/deepseek/lib/glitter.ts'
import {loopWave} from '../../candidates/deepseek/lib/loopClock.ts'
import {studioLightsView} from '../../candidates/deepseek/lib/studioLights.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Mirror shards bound in gold. Every Voronoi cell is a flat facet with its own tilt, so each shard reflects a different part of the gallery and the knot keeps rearranging the room as you walk. The facets sway on their own phase, the seams are polished gold with a dark gap at their core, and up close each shard resolves into a second generation of crushed facets. Pinpoint flashes come from the real studio lamps, not from an invented light rig. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.72)
    this.name = knotData.id
    const {p, grazing, intimate} = viewerFrame()
    const scale = p.mul(10)
    const seam = cellularBoundary(scale)
    const filter = scale.fwidth().length().mul(0.7)
    const domain = mx_worley_noise_float(scale, 1, 1)
    const cell = vec3(domain.mul(65_536), 7, 19)
    const shardMask = seam.smoothstep(0.05, filter.add(0.1))
    const rnd = cellNoiseVec3(cell)
    const identity = mx_cell_noise_float(cell.add(11.3))
    const sway = loopWave(1, identity.mul(TAU).add(p.dot(vec3(3.1, 1.7, -2.3)))).mul(0.7)
    const angle = rnd.z.mul(TAU).add(sway)
    const tilt = tangentView.mul(angle.cos()).add(vec3(bitangentView as unknown as Node<'vec3'>).mul(angle.sin())).mul(rnd.x.mul(0.2).add(0.09))
    const facet = normalViewGeometry.add(tilt.mul(shardMask)).normalize()
    const fineCoord = scale.mul(3).add(vec3(5.5, 2.5, 8.5))
    const fineDomain = mx_worley_noise_float(fineCoord, 1, 1)
    const fineRnd = cellNoiseVec3(vec3(fineDomain.mul(65_536), 31, 43))
    const fineMask = cellularBoundary(fineCoord).smoothstep(0.025, fineCoord.fwidth().length().add(0.12)).mul(shardMask)
    const fineAngle = fineRnd.z.mul(TAU).add(loopWave(1, fineRnd.y.mul(TAU).add(p.dot(vec3(-2.2, 3.3, 1.4)))).mul(0.6))
    const fineTilt = tangentView.mul(fineAngle.cos()).add(vec3(bitangentView as unknown as Node<'vec3'>).mul(fineAngle.sin())).mul(fineRnd.x.mul(0.14).add(0.04)).mul(intimate.mul(0.75)).mul(fineMask)
    const shard = facet.add(fineTilt).normalize()
    const gapMask = seam.smoothstep(0, filter.add(0.012)).oneMinus()
    const goldMask = seam.smoothstep(0.012, filter.add(0.05)).oneMinus()
    const chasingCoord = p.mul(vec3(180, 70, 120))
    const chasingVisibility = chasingCoord.fwidth().length().smoothstep(0.25, 1).oneMinus()
    const chasing = mix(float(0.5), mx_noise_float(chasingCoord).mul(0.5).add(0.5), chasingVisibility)
    const speck = glitter(p, 0.0062, 64, 0.7)
    const speckCoord = p.div(0.0062)
    const speckCenter = cellNoiseVec3(speckCoord.floor()).mul(0.5).add(0.25)
    const speckOuter = speckCoord.fwidth().length().add(0.18).min(0.24)
    const speckMask = speckCoord.fract().sub(speckCenter).length().smoothstep(0.06, speckOuter).oneMinus()
    const sparkle = speck.sparkle.mul(speckMask)
    let flash: Node<'float'> = float(0)
    for (const lamp of studioLightsView) {
      const half = lamp.add(positionViewDirection).normalize()
      flash = flash.add(shard.dot(half).clamp().pow(150))
    }
    const mirror = mix(color(hsl.integer(261, 22, 77)), color(hsl.integer(261, 48, 93)), mix(float(0.5), rnd.y, shardMask).mul(0.55).add(0.25))
    const bead = seam.smoothstep(0.012, filter.add(0.038)).oneMinus()
    const relief = bead.mul(0.02).add(chasing.mul(goldMask).mul(0.012)).add(speck.resolved.mul(speckMask).mul(0.004))
    this.colorNode = mix(mix(mirror, color(hsl.integer(79, 100, 84)), goldMask), color(hsl.integer(272, 70, 9)), gapMask.mul(goldMask.oneMinus().mul(0.8).add(goldMask.mul(0.55))))
    this.metalness = 1
    this.roughnessNode = mix(float(0.045), float(0.26), goldMask.mul(0.85)).add(chasing.mul(goldMask).mul(0.04)).add(sparkle.mul(0.02)).clamp(0.03, 0.4)
    this.normalNode = proceduralNormal(relief, 0.0006).add(tilt.mul(shardMask)).add(fineTilt).add(speck.lean.mul(speckMask).mul(0.12)).normalize()
    this.iridescence = 0.34
    this.iridescenceThicknessNode = mix(float(0.5), rnd.z, shardMask).mul(430).add(190)
    this.emissiveNode = color(hsl.integer(84, 100, 92.2)).mul(flash.mul(1))
      .add(color(hsl.integer(77, 100, 86.5)).mul(goldMask.mul(chasing.mul(0.6).add(0.5)).mul(grazing.pow(2)).mul(0.42)))
      .add(color(hsl.integer(266, 100, 92)).mul(sparkle).mul(intimate).mul(0.55))
      .add(color(hsl.integer(264, 100, 73.5)).mul(grazing.pow(7)).mul(0.06))
  }
}
