import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, time} from 'three/tsl'

import {cellNoiseVec3} from './cellNoiseVec3.ts'

/**
 * Point lights in a volume, seen along a ray: a star lights the ray when the ray passes within `radius` of it,
 * measured perpendicular to the ray. Unlike slicing a 3D cell lattice with the surface, this keeps every star visible
 * from every angle while its apparent position shifts with depth – true parallax for interiors of glass.
 */
export function volumeStars(position: Node<'vec3'>, direction: Node<'vec3'>, scale: number, threshold: number, warm = hsl.integer(68, 99, 89), cool = hsl.integer(259, 100, 84)) {
  const q = position.mul(scale)
  const cell = q.floor()
  const random = cellNoiseVec3(cell)
  const random2 = cellNoiseVec3(cell.add(31.7))
  const center = random.mul(0.7).add(0.15)
  const offset = q.fract().sub(center)
  const perpendicular = offset.sub(direction.mul(offset.dot(direction)))
  const distance = perpendicular.length()
  const footprint = q.fwidth().length().max(0.001)
  const radius = footprint.mul(1.1).max(0.05)
  const core = distance.div(radius).pow2().mul(-3).exp()
// A halo around the bright ones.
  const halo = distance.div(radius).add(1).pow(-2.5).mul(random2.y.smoothstep(0.7, 0.95))
  const gate = random2.x.smoothstep(threshold, threshold + 0.01)
  const twinkle = time.mul(random2.y.mul(3).add(1)).add(random2.z.mul(30)).sin().mul(0.25).add(0.8)
  const tint = mix(color(warm), color(cool), random2.z)
  const magnitude = random.x.pow(3).mul(3).add(0.7)
  const resolved = footprint.smoothstep(0.3, 1.2).oneMinus()
  return tint.mul(core.add(halo.mul(0.35))).mul(gate).mul(twinkle).mul(magnitude).mul(resolved)
}
