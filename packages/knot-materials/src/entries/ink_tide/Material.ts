import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_vec3, vec3} from 'three/tsl'

import {loopDrift, loopPhase} from '../../candidates/space_bunny/lib/loopClock.ts'
import {microGlitter} from '../../candidates/space_bunny/lib/microGlitter.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Polynomial smooth minimum, so the floating rings can merge without a crease. */
function smoothMinimum(a: Node<'float'>, b: Node<'float'>, width: number) {
  const blend = a.smoothstep(b.sub(width), b.add(width))
  return mix(a, b, blend)
}
/** Suminagashi. A drop of ink touched still water, a second drop landed inside it, and every tremor of the brush pushed both rings outward; the whole nest was lifted onto paper at once and dried there, mid-tide. The ink was laid onto the sheet rather than printed into it, so the marbling rides a few microns above the fibre and slides against it when you move – and the varnish on top is still a half-step wet, so the lamps slide along the rings instead of sitting on them. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
// Three drops, gently merged: the tide of concentric rings they left behind.
    const distance = smoothMinimum(smoothMinimum(p.sub(vec3(0.42, 0.12, -0.24)).length(), p.sub(vec3(-0.38, 0.28, 0.31)).length(), 0.22), p.sub(vec3(0.06, -0.46, 0.44)).length(), 0.26)
    const current = mx_fractal_noise_float(loopDrift(p.mul(1.35), 0.16), 4, 2.1, 0.55)
    const rings = distance.mul(15).add(current.mul(6.2)).add(mx_fractal_noise_float(p.mul(3.1), 3, 2, 0.5).mul(1.2))
    const band = rings.fract()
// Once a ring is thinner than a pixel it settles into its own average instead of shimmering.
    const resolved = rings.fwidth().smoothstep(0.35, 1.1).oneMinus()
    const ink = band.smoothstep(0.24, 0.31).mul(band.smoothstep(0.74, 0.66)).oneMinus().mul(resolved.mul(0.5).add(0.5))
    const inkHeart = band.smoothstep(0.36, 0.48).mul(band.smoothstep(0.66, 0.56)).mul(resolved)
    const halo = filament(band.sub(0.5), 0.045).mul(near.mul(0.6).add(0.4))
// Which ink floats here: sumi in the shallows, indigo in the deep, cinnabar where the brush lingered.
    const family = mx_noise_float(p.mul(1.05).add(vec3(6.1, -2.7, 0.4))).mul(0.5).add(0.5)
    const wash = mix(color(hsl.integer(258, 17, 10)), color(hsl.integer(258, 72, 28)), family.smoothstep(0.4, 0.62))
    const cinnabar = color(hsl.integer(32, 86, 48))
    const pigment = mix(wash, cinnabar, family.smoothstep(0.62, 0.76)).mul(inkHeart.mul(0.32).oneMinus())
// The sheet under all of it: long fibres, a few flecks of pulp, and the tooth of cold-press paper.
// The ink was floated onto the sheet rather than pressed into it, so the fibre is sampled a fibre's
// depth below the film and slides against the rings as soon as you move your head.
    const sheetPoint = p.sub(view.mul(0.022))
    const fibre = mx_noise_float(vec3(sheetPoint.dot(vec3(97, 11, 131)), sheetPoint.dot(vec3(-59, 141, 37)), sheetPoint.dot(vec3(23, 167, -71)))).mul(0.5).add(0.5)
    const pulp = mx_worley_noise_vec3(sheetPoint.mul(38), 1, 0).x.smoothstep(0.05, 0.14).oneMinus()
    const sheet = mix(color(hsl.integer(86, 33, 88)), color(hsl.integer(91, 62, 97)), fibre.mul(0.6).add(0.3)).mul(pulp.mul(0.08).oneMinus().mul(0.12).add(0.88))
    const gold = microGlitter(p, 0.024, 110, 0.5)
    const flake = gold.sparkle.mul(mx_noise_float(p.mul(6.5)).smoothstep(0.24, 0.4)).mul(near.mul(0.7).add(0.3))
    this.colorNode = mix(mix(sheet, pigment.mul(0.82), ink.mul(0.94)), mix(pigment, color(hsl.integer(88, 52, 93)), halo.mul(0.35)), halo.mul(0.5))
    this.metalnessNode = flake.mul(0.85)
    this.roughnessNode = mix(float(0.86), float(0.13), ink).sub(flake.mul(0.05)).clamp(0.05, 1)
    this.ior = 1.46
    this.clearcoatNode = ink.mul(0.85)
    this.clearcoatRoughnessNode = float(0.035).add(halo.mul(0.05)).add(pulp.mul(0.02)).add(loopPhase.sin().mul(0.012))
// Ink pooled above the fibre: a shallow step, a bright meniscus, and the paper tooth underneath.
    const relief = ink.mul(0.35).add(halo.mul(0.12)).sub(pulp.mul(0.1)).sub(fibre.mul(near).mul(0.05))
    this.normalNode = proceduralNormal(relief, 0.0028)
    this.emissiveNode = color(hsl.integer(86, 100, 95)).mul(gold.sparkle.mul(flake).mul(intimate).mul(1.1))
      .add(color(hsl.integer(262, 100, 74)).mul(halo.mul(ink.oneMinus()).mul(grazing.mul(0.6).add(0.4)).mul(0.09)))
  }
}
