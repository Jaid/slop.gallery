import type {Node, Texture} from 'three/webgpu'

import {float, mx_fractal_noise_float, mx_noise_float, normalLocal, time, vec3} from 'three/tsl'

import {cosinePalette} from '../../candidates/claude_fable/lib/cosinePalette.ts'
import {environmentHighlight} from '../../candidates/claude_fable/lib/environmentHighlight.ts'
import {fresnel, interiorRay} from '../../candidates/claude_fable/lib/interiorRay.ts'
import {rgb} from '../../candidates/claude_fable/lib/rgb.ts'
import {viewerFrame} from '../../candidates/claude_fable/lib/viewerFrame.ts'
import {volumeStars} from '../../candidates/claude_fable/lib/volumeStars.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import knotData from './data.ts'

const glassIndex = 1.52
/** A night sky sealed in black glass. Star layers and nebula clouds are sampled along the refracted line of sight at increasing depths, so the interior has genuine parallax: near stars slide quickly across the surface as the viewer moves, distant ones barely at all, and the whole volume seems to be looked into rather than painted on. Toward the tube's axis the stars thicken into a galactic core that a viewer only reaches at normal incidence. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {facing, grazing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const ray = interiorRay(glassIndex, n)
    const drift = time.mul(0.006)
// Stars: six depth layers from just under the surface down to the axis; deeper layers are denser and brighter.
    let stars: Node<'vec3'> = vec3(0)
    const layers: Array<[depth: number, scale: number, threshold: number, gain: number]> = [[0.006, 230, 0.9, 0.3], [0.015, 120, 0.93, 0.55], [0.04, 80, 0.9, 0.7], [0.08, 52, 0.86, 0.85], [0.14, 34, 0.8, 1], [0.24, 22, 0.7, 1.2]]
    for (const [depth, scale, threshold, gain] of layers) {
      const position = ray.at(depth).add(vec3(drift.mul(depth * 4), 0, depth * 53))
      stars = stars.add(volumeStars(position, ray.refracted, scale, threshold).mul(gain))
    }
// Nebula: three drifting cloud layers, each with its own palette, lit from within.
    let nebula: Node<'vec3'> = vec3(0)
    const clouds: Array<[depth: number, scale: number, hue: number, gain: number]> = [[0.03, 6, 0.05, 0.35], [0.09, 4.2, 0.42, 0.6], [0.2, 3, 0.72, 0.9]]
    for (const [depth, scale, hue, gain] of clouds) {
      const position = ray.at(depth).mul(scale).add(vec3(drift.mul(3), drift.mul(-2), depth * 17))
      const density = mx_fractal_noise_float(position, 4, 2.1, 0.5).mul(0.5).add(0.5)
      const wisps = mx_noise_float(position.mul(3.1).add(density.mul(1.5))).abs()
      const body = density.smoothstep(0.42, 0.95).pow(1.6).mul(wisps.mul(0.6).add(0.4))
      const palette = cosinePalette(density.mul(0.9).add(hue), [0.4, 0.32, 0.5], [0.5, 0.45, 0.5], [1, 1, 1], [0, 0.25, 0.5]).max(0)
      nebula = nebula.add(palette.mul(body).mul(gain))
    }
// The galactic core: a dense glow around the axis that only opens up when the eye looks straight in.
    const coreReach = ray.cosRefracted.pow(3)
    const coreNoise = mx_fractal_noise_float(ray.at(0.3).mul(5).add(vec3(0, drift.mul(2), 0)), 3, 2, 0.55).mul(0.5).add(0.5)
    const core = rgb('#ffd7a8').mul(coreReach).mul(coreNoise.smoothstep(0.35, 0.9)).mul(0.035)
// Black glass shell with a faint violet cast at the limb and the room's lamps in its polish.
    const transmit = fresnel(facing, 0.04).oneMinus()
    this.colorNode = vec3(0.004, 0.003, 0.008)
    this.metalness = 0
    this.ior = glassIndex
    this.roughness = 0.04
    const highlight = environmentHighlight(environment, n, 0.03).mul(fresnel(facing, 0.04)).mul(0.7)
    const limb = rgb('#3a2a70').mul(grazing.pow(4)).mul(0.08)
    const interior = stars.mul(near.mul(0.5).add(1.1)).add(nebula.mul(0.045)).add(core)
    this.emissiveNode = interior.mul(transmit).mul(intimate.mul(0.2).add(1)).add(highlight).add(limb)
    this.roughnessNode = float(0.04).add(grazing.mul(0.02))
  }
}
