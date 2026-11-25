import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, normalLocal, time, transformNormalToView, uv} from 'three/tsl'

import {ramp} from '../../candidates/claude_sonnet/lib/ramp.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Chladni mode k: a standing wave whose nodal lines are closed under both UV periods. Nine cells per unit of u make the cells roughly square on the tube, and swapping the two wave numbers gives the classic symmetric figures. */
const mode = (tube: Node<'vec2'>, k: Node<'float'>) => {
  const x = tube.x.mul(TAU * 9)
  const y = tube.y.mul(TAU)
  const m = k.add(1)
  return x.mul(k).cos().mul(y.mul(m).cos()).sub(x.mul(m).cos().mul(y.mul(k).cos()))
}

/** A vibrating, heat-tinted plate strewn with sand. Proximity raises the pitch, so the figures grow finer as you approach. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, objectDistance, facing} = viewerFrame()
    const tube = uv()
    // pitch: walking toward the plate climbs the harmonic ladder, a slow drift keeps it breathing
    const near = ramp(objectDistance, 3.9, 1.2)
    const drift = time.mul(0.37).sin().mul(0.5).add(time.mul(0.113).add(1.7).sin().mul(0.3))
    const level = near.mul(3.8).add(1.5).add(drift).clamp(0.6, 6.8)
    const lower = level.floor()
    const blend = ramp(level.fract(), 0, 1)
    const field = mix(mode(tube, lower), mode(tube, lower.add(1)), blend)
    const amplitude = field.abs()
    // sand gathers where the plate stands still; lines thinner than a pixel dissolve into their mean coverage
    const halfWidth = level.add(1.2).mul(0.05)
    const edge = field.fwidth().mul(0.9).max(0.0001)
    const visible = halfWidth.div(edge).min(1)
    const sand = ramp(amplitude, halfWidth.add(edge), halfWidth.sub(edge).max(0)).mul(visible)
    const heap = ramp(amplitude, halfWidth.mul(2.2).add(edge), 0)
    const shadow = ramp(amplitude, halfWidth.mul(5).add(edge), halfWidth).sub(sand).max(0).mul(visible)
    // grains: resolved up close, averaged away at distance
    const grainSpace = p.mul(380)
    const resolved = ramp(grainSpace.fwidth().length(), 1.5, 0.6)
    const grain = cellNoiseVec3(grainSpace)
    const fiber = mx_noise_float(p.mul(5)).mul(0.5).add(0.5)
    const grainTone = mix(0.5, grain.x, resolved)
    const sandColor = mix(color(hsl.integer(78, 45, 49)), color(hsl.integer(90, 74, 95)), heap.pow(0.55).mul(0.5).add(grainTone.mul(0.5)))
    // heat tint: oxide thickness follows the vibration amplitude, so the plate reads as a contour map of its own motion
    const oxide = amplitude.mul(0.5).add(facing.oneMinus().mul(0.6)).add(fiber.mul(0.08)).add(level.mul(0.045))
    const tint = cosinePalette(oxide, [0.5, 0.5, 0.52], [0.5, 0.45, 0.5], [1, 1, 1], [0, 0.31, 0.66])
    const plate = mix(color(hsl.integer(67, 17, 8)), tint.mul(0.62), amplitude.smoothstep(0.02, 0.5).mul(0.85).add(0.15)).mul(shadow.mul(-0.7).add(1))
    // mica flecks: each grain tilts its own facet, so flashes travel across the sand as the viewer moves
    const facet = grain.mul(2).sub(1).mul(0.9).add(normalLocal).normalize()
    const twinkle = time.mul(grain.x.mul(2.5).add(0.8)).add(grain.y.mul(40)).sin().mul(0.35).add(0.65)
    const flecks = glints(transformNormalToView(facet), 220).mul(ramp(grain.z, 0.75, 0.8)).mul(twinkle).mul(resolved).mul(sand)
    // the plate rings in time with the note, and the sand shivers on its crest
    const ring = time.mul(6.3).sin()
    const height = field.mul(ring).mul(0.0018).add(heap.mul(0.0032)).add(grain.y.sub(0.5).mul(0.0006).mul(resolved).mul(sand))
    this.colorNode = mix(plate, sandColor, sand)
    this.metalnessNode = mix(0.95, 0, sand)
    this.roughnessNode = mix(0.24, 0.9, sand)
    this.anisotropy = 0.55
    this.anisotropyRotation = 0
    this.normalNode = proceduralNormal(height, 1)
    this.emissiveNode = tint.mul(amplitude.smoothstep(0.05, 0.8)).mul(ring.mul(0.5).add(0.5)).mul(0.07).mul(sand.oneMinus())
      .add(color(hsl.integer(75, 100, 86)).mul(heap).mul(ring.mul(0.5).add(0.5)).mul(0.03))
      .add(color(hsl.integer(88, 100, 96)).mul(flecks).mul(1.8))
  }
}
