import type {BufferGeometry} from 'three/webgpu'

import hsl from 'okhsl'
import {attribute, color, float, mix, mx_noise_float, normalView, positionGeometry, positionViewDirection, smoothstep, time, vec3} from 'three/tsl'
import {AdditiveBlending, Float32BufferAttribute, MeshBasicNodeMaterial, SphereGeometry} from 'three/webgpu'

/**
 * A candle flame’s ellipsoid, `radius` wide and `stretch` times as tall, standing on its wick at `x`, `y`, `z`, with the attributes {@link CandleFlameMaterial} animates it by: where its wick is, how tall it is and a seed of its own.
 */
export function candleFlame({radius, stretch, x, y, z, seed, segments = [16, 14]}: {
  radius: number
  /** a per-flame number, so neighbors flicker out of step */
  seed: number
  segments?: readonly [width: number, height: number]
  stretch: number
  x: number
  y: number
  z: number
}): BufferGeometry {
  const flame = new SphereGeometry(radius, ...segments)
  flame.scale(1, stretch, 1).translate(x, y + radius * stretch, z)
  // The flame shades from its wick and normals alone.
  flame.deleteAttribute('uv')
  const count = flame.getAttribute('position').count
  flame.setAttribute('flameWick', new Float32BufferAttribute(Array.from({length: count}, () => [x, y, z]).flat(), 3))
  flame.setAttribute('flameHeight', new Float32BufferAttribute(Array.from({length: count}, () => radius * stretch * 2), 1))
  flame.setAttribute('flameSeed', new Float32BufferAttribute(Array.from({length: count}, () => seed * 0.618034 % 1), 1))
  return flame
}

/**
 * A living candle flame for ellipsoids made by {@link candleFlame}.
 *
 * The vertex shader pulls each ellipsoid into a teardrop that narrows to a tip, stretches and shrinks it as it flickers and lets the tip sway in drafts, more the higher up. Seen through, the flame is light: a faint blue at the wick, a white-hot core low down, yellow above and an orange rim fading toward its edges and tip. It blends additively and writes no depth.
 */
export default class CandleFlameMaterial extends MeshBasicNodeMaterial {
  constructor({intensity = 4}: {intensity?: number} = {}) {
    super({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
      toneMapped: false,
    })
    this.name = 'candle-flame'
    const wick = attribute<'vec3'>('flameWick', 'vec3')
    const height = attribute<'float'>('flameHeight', 'float')
    const seed = attribute<'float'>('flameSeed', 'float').mul(41)
    const local = positionGeometry.sub(wick)
    const up = local.y.div(height).clamp(0, 1)
    // Flicker: a quick stretch and squash, with now and then a deeper dip.
    const flicker = mx_noise_float(vec3(time.mul(9).add(seed), seed, 0)).mul(0.1).add(mx_noise_float(vec3(time.mul(2.3).sub(seed), 0, seed)).mul(0.08))
    const stretch = flicker.add(1)
    // Teardrop: full width low down, narrowing to a tip.
    const taper = smoothstep(0.25, 1, up).mul(0.8).oneMinus()
    // Drafts push the upper flame aside on slow noise, by about a tenth of its height.
    const sway = vec3(mx_noise_float(vec3(time.mul(1.3).add(seed), 3, seed)), 0, mx_noise_float(vec3(time.mul(1.1).sub(seed), 7, seed))).mul(up.pow(2)).mul(height.mul(0.09))
    this.positionNode = wick.add(vec3(local.x.mul(taper), local.y.mul(stretch), local.z.mul(taper))).add(sway)
    // Facing ratio of the ellipsoid: the middle of the flame is dense, its silhouette thin.
    const facing = normalView.dot(positionViewDirection.negate()).abs().clamp()
    const core = smoothstep(0.55, 0.15, up).mul(facing.pow(2))
    const blue = smoothstep(0.18, 0.02, up)
    let tint = mix(color(hsl.integer(48.5, 100, 67.9)), color(hsl.integer(81, 100, 83.5)), facing.smoothstep(0.1, 0.7))
    tint = mix(tint, color(hsl.integer(88, 100, 96)), core)
    tint = mix(tint, color(hsl.integer(269, 100, 57)).mul(0.35), blue.mul(0.8))
    const fade = facing.smoothstep(0, 0.45).mul(smoothstep(1, 0.75, up))
    this.colorNode = tint.mul(fade).mul(float(intensity).mul(flicker.mul(1.5).add(1)))
    this.opacityNode = float(1)
  }
}
