import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, time} from 'three/tsl'

import {cellNoiseVec3} from './cellNoiseVec3.ts'

/** Compact stars with per-cell tint and restrained twinkle; unresolved stars fade out. */
export function starfield(direction: Node<'vec3'>, scale: number, threshold: number) {
  const q = direction.mul(scale)
  const rnd = cellNoiseVec3(q)
  const rnd2 = cellNoiseVec3(q.add(31.7))
  const centre = rnd.mul(0.6).add(0.2)
  const dist = q.fract().sub(centre).length()
  const footprint = q.fwidth().length().max(0.001)
  const radius = footprint.mul(0.9).max(0.06)
  const core = dist.smoothstep(0, radius).oneMinus()
  const gate = rnd2.x.smoothstep(threshold, threshold + 0.01)
  const twinkle = time.mul(rnd2.y.mul(4).add(1.5)).add(rnd2.z.mul(30)).sin().mul(0.35).add(0.75)
  const tint = mix(color(hsl.integer(68, 99, 89)), color(hsl.integer(259, 100, 84)), rnd2.z)
  const energy = footprint.smoothstep(0.3, 1.2).oneMinus()
  return tint.mul(core.abs().pow(2)).mul(gate).mul(twinkle).mul(energy)
}
