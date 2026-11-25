import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, If, mix, mx_noise_float, positionGeometry, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

const aggregatePeriods = [84, 18] as const
// Periodic jittered Voronoi: return squared-distance gap and nearest chip identity.
// Integer seed wrapping closes both UV seams without repeating a visible square stamp.
//
const aggregateField = Fn(([tube]: [Node<'vec2'>]) => {
  const grid = tube.mul(vec2(...aggregatePeriods))
  const cell = grid.floor()
  const local = grid.fract()
  const first = float(10).toVar()
  const second = float(10).toVar()
  const identity = vec3(0).toVar()
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      const offset = vec2(x, y)
      const wrapped = cell.add(offset).mod(vec2(...aggregatePeriods))
      const seed = cellNoiseVec3(vec3(wrapped, 17))
      const delta = offset.add(seed.xy.mul(0.6).add(0.2)).sub(local)
      const distance = delta.dot(delta)
      If(distance.lessThan(first), () => {
        second.assign(first)
        first.assign(distance)
        identity.assign(seed)
      }).Else(() => {
        second.assign(second.min(distance))
      })
    }
  }
  return vec3(second.sub(first), identity.x, identity.z)
})

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const tube = uv()
    const field = aggregateField(tube)
    const footprint = tube.mul(vec2(...aggregatePeriods)).fwidth().length()
    const detail = footprint.smoothstep(0.35, 1.2).oneMinus()
    // The second-neighbor gap cuts angular chips, not circular pebbles or glowing cells.
    const inset = field.z.mul(0.09).add(0.055)
    const chip = field.x.smoothstep(inset, inset.add(footprint.mul(0.65).max(0.012)))
      .mul(field.y.smoothstep(0.09, 0.14))
    const pigment = mix(color(hsl.integer(32, 79, 47.6)), color(hsl.integer(195, 67, 44)), field.y.step(0.4))
    const aggregate = mix(pigment, color(hsl.integer(82, 79, 74)), field.y.step(0.66))
    const stone = mix(aggregate, color(hsl.integer(251, 38, 26)), field.y.step(0.84))
    const cement = color(hsl.integer(80, 41, 89))
    const specklePoint = positionGeometry.mul(230)
    const speckle = mx_noise_float(specklePoint)
      .mul(specklePoint.fwidth().length().smoothstep(0.3, 1.4).oneMinus())
    const surface = mix(cement, stone, chip)
    // Resolve distant aggregate to a warm material average, not unstable single-chip colors.
    this.colorNode = mix(color(hsl.integer(81, 24, 66)), surface, detail).mul(speckle.mul(0.035).add(1))
    this.metalness = 0
    this.roughnessNode = float(0.48).sub(chip.mul(detail).mul(0.15)).add(speckle.mul(0.025))
    this.clearcoat = 0.18
    this.clearcoatRoughness = 0.3
    this.specularIntensity = 0.55
    this.normalNode = proceduralNormal(chip.mul(detail).mul(0.00014).add(speckle.mul(0.000035)), 1)
  }
}
