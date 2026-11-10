import type {Node} from 'three/webgpu'

import {abs, float, length, max, mix, mx_noise_float, normalGeometry, positionGeometry, sin, smoothstep, time} from 'three/tsl'

import LimestoneMaterial from '#src/lib/materials/LimestoneMaterial.ts'

import fountain from './config.ts'

const below = (value: Node<'float'>, edge: number, softness = 0.004) => float(1).sub(smoothstep(edge - softness, edge + softness, value))
const within = (value: Node<'float'>, edge: number, softness = 0.006) => float(1).sub(smoothstep(edge - softness, edge + softness, value))

/**
 * The fountain’s limestone, darkened and polished wherever water covers it, with the light’s caustics crawling over the submerged stone.
 *
 * The wet mask follows the water itself: inside the octagonal basin below its surface and inside every bowl below its pool, but only on surfaces that face up, so the undersides of the bowls stay dry. Caustics fade with depth below the surface, like real light focused through moving water, and stay far below the bloom threshold.
 */
export default class LimestoneFountainStoneMaterial extends LimestoneMaterial {
  constructor() {
    super()
    const {basinPoolRadius, bowls, pools} = fountain
    const p = positionGeometry
    const radius = length(p.xz)
    // Distance to the axis measured like an octagon’s apothem, for the basin’s flat inner walls.
    const octagon = max(max(abs(p.x), abs(p.z)), abs(p.x).add(abs(p.z)).mul(Math.SQRT1_2))
    // A bowl’s inside faces up; its dry underside faces down.
    const up = smoothstep(-0.12, 0.22, normalGeometry.y)
    const bowlWet = (pool: number, lip: number) => below(p.y, pool).mul(within(radius, lip + 0.01)).mul(up)
    const wet = max(
      below(p.y, pools.basin).mul(within(octagon, basinPoolRadius)),
      max(bowlWet(pools.lower, bowls.lower.lip), max(bowlWet(pools.middle, bowls.middle.lip), bowlWet(pools.cup, bowls.cup.lip))),
    )
    const depth = float(pools.basin).sub(p.y).max(0)
    // Two crossing wave trains drifting apart: the bright ridges where the water focuses light onto the stone.
    const drift = time.mul(0.42)
    const caustic = sin(p.x.mul(6.2).add(drift)).mul(sin(p.z.mul(5.4).sub(drift.mul(1.4)))).add(sin(p.x.mul(3.1).sub(drift.mul(0.8)).add(p.z.mul(2.6))))
      .mul(0.5).add(0.5)
    const focused = mx_noise_float(p.mul(9)).mul(0.5).add(0.5)
    const shimmer = smoothstep(0.5, 0.92, caustic.mul(0.7).add(focused.mul(0.3))).mul(wet).mul(depth.mul(-1.6).exp()).mul(0.16)
    // LimestoneMaterial assigns both nodes as floats and colors.
    const stone = (this.colorNode as Node<'color'>).mul(mix(float(1), float(0.76), wet))
    this.colorNode = mix(stone, stone.mul(float(1.16)), shimmer)
    this.roughnessNode = mix(mix(this.roughnessNode as Node<'float'>, float(0.34), wet), float(0.28), shimmer)
  }
}
