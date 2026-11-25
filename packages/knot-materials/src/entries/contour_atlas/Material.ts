import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, vec3} from 'three/tsl'

import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

/** A continuous object-space map: no UV seam and no time-dependent geography. */
function atlasElevation(position: Node<'vec3'>) {
  const broad = mx_noise_float(position.mul(3.8).add(vec3(8, 2, 5)))
  const tributaries = mx_noise_float(position.mul(10).add(vec3(3, 9, 1)))
  return broad.mul(0.76).add(tributaries.mul(0.24)).mul(0.5).add(0.5).clamp()
}
/** The signed relief stays within the metadata bound even at noise extrema. */
function atlasRelief(elevation: Node<'float'>) {
  return elevation.sub(0.5).mul(0.016)
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.65)
    this.name = knotData.id
    const p = positionGeometry
    const elevation = atlasElevation(p)
    const relief = atlasRelief(elevation)
    this.positionNode = p.add(normalLocal.mul(relief))
    // Fine contours dissolve before they become subpixel interference. Every fourth
    // contour is a heavier index line; both use the same continuous height field.
    const phase = elevation.mul(TAU * 24)
    const visibility = phase.fwidth().smoothstep(0.5, 2.5).oneMinus()
    const contours = hairline(phase.sin(), 0.065).mul(visibility)
    const index = hairline(phase.mul(0.25).sin(), 0.05)
      .mul(phase.mul(0.25).fwidth().smoothstep(0.5, 2.5).oneMinus())
    const highlands = mix(color(hsl.integer(149, 33, 82)), color(hsl.integer(97, 42, 93.5)), elevation.smoothstep(0.43, 0.68))
    const lowlands = mix(color(hsl.integer(80, 61, 66)), color(hsl.integer(190, 46, 66)), elevation.smoothstep(0.3, 0.42))
    const map = mix(lowlands, highlands, elevation.smoothstep(0.42, 0.49))
    const ink = contours.mul(0.52).max(index.mul(0.8))
    const grainPoint = p.mul(190)
    const grain = mx_noise_float(grainPoint)
      .mul(grainPoint.fwidth().length().smoothstep(0.3, 1.3).oneMinus())
    this.colorNode = mix(map, color(hsl.integer(183, 50, 29)), ink).mul(grain.mul(0.035).add(1))
    this.metalness = 0
    this.roughnessNode = float(0.79).add(grain.mul(0.025)).sub(ink.mul(0.1))
    this.specularIntensity = 0.32
    this.normalNode = proceduralNormal(relief.add(grain.mul(0.00006)), 1)
  }
}
