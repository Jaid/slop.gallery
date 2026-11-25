import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, smoothstep, time, uv, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import fireColor from './fireColor.ts'

/**
 * A bed of glowing coals under the logs, for a plane of the given size in meters.
 *
 * Lumps of charcoal glow from within, brightest in the middle of the bed and breathing slowly as the draft shifts. Toward the rim the coals go dark, gray ash takes over and a ragged ring of soot fades out onto the hearth instead of ending in a hard rectangle.
 */
export default class EmberBedMaterial extends MeshStandardNodeMaterial {
  constructor(size: readonly [number, number]) {
    super({
      roughness: 0.95,
      envMapIntensity: 0,
      transparent: true,
      depthWrite: false,
    })
    this.name = 'lodge-ember-bed'
    const half = vec2(size[0] / 2, size[1] / 2)
    const p = uv().sub(0.5).mul(half.mul(2))
    // 0 in the middle of the bed, 1 on the ellipse touching each edge
    const rim = p.div(half).length()
    const cells = mx_worley_noise_float(p.mul(16))
    const lump = smoothstep(0.15, 0.6, cells).oneMinus()
    const draft = mx_fractal_noise_float(vec3(p.mul(2.6), time.mul(0.22)), 3).mul(0.5).add(0.5)
    const flicker = mx_noise_float(vec3(p.mul(9), time.mul(1.4))).mul(0.5).add(0.5)
    const core = smoothstep(0.45, 0.9, rim).oneMinus()
    const heat = lump.mul(core).mul(draft.mul(0.7).add(0.45)).mul(flicker.mul(0.35).add(0.75))
    const ash = smoothstep(0.5, 0.8, rim).mul(lump.mul(0.4).add(0.6))
    // Beyond the ash, soot darkens the hearth and fades out raggedly.
    const ragged = rim.add(mx_noise_float(p.mul(7)).mul(0.05))
    const soot = smoothstep(0.72, 0.9, ragged)
    this.colorNode = mix(mix(mix(color(hsl.integer(51, 24, 7)), color(hsl.integer(51, 32, 14)), lump), color(hsl.integer(67, 8, 35)), ash), color(hsl.integer(59, 11, 11)), soot)
    this.emissiveNode = fireColor(heat).mul(2.2)
    this.opacityNode = smoothstep(0.78, 0.98, ragged).oneMinus().mul(soot.mul(-0.35).add(1))
  }
}
