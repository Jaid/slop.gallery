import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

type OpalDomain = {
  fire: Node<'vec3'>
  flare: Node<'float'>
  seam: Node<'float'>
  thickness: Node<'float'>
}

/** Precious opal, polished into a knot. The white milk of the stone is real body color; the fire is not painted on it but lives in two deeper strata of microscopic domains, each with its own crystal axis. A domain sleeps milky, then – as your eye crosses its axis – sweeps the spectrum and flares. Because the strata sit at different depths, the fires drift against the surface and against each other while you walk. Only up close does the fine pinfire grain between the large harlequin patches wake up. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, near, intimate} = viewerFrame()
    const domain = (depth: number, scale: number, seed: number): OpalDomain => {
      const q = p.sub(view.mul(depth)).mul(scale).add(vec3(seed, seed * 1.7, seed * 0.6))
      const identity = cellNoiseVec3(q)
      const axis = identity.sub(0.5).normalize()
      const alignment = view.dot(axis)
      // Each domain sweeps hue continuously with viewing angle, but only
      // spends its light in a narrow band around its own crossing angle.
      const sweep = alignment.mul(7).add(identity.y.mul(6.4)).add(seed)
      const flare = sweep.sin().mul(0.5).add(0.5).pow(3)
      const hue = spectralColor(alignment.mul(4.2).add(identity.x.mul(5.1)).add(seed * 0.7).add(time.mul(0.015))).mul(1.45).sub(0.24).clamp()
      // Seams where one crystal domain ends and the next begins.
      const cellEdge = q.fract().sub(0.5).abs()
      const seam = cellEdge.x.max(cellEdge.y).max(cellEdge.z).smoothstep(0.44, 0.5)
      const resolved = q.fwidth().length().smoothstep(0.6, 1.6).oneMinus()
      return {
        fire: hue.mul(flare.mul(1.25).add(0.1)),
        flare: flare.mul(resolved),
        seam: seam.mul(resolved),
        thickness: identity.z.mul(280).add(160),
      }
    }
    const harlequin = domain(0.085, 6.5, 3.1)
    const pinfire = domain(0.04, 21, 8.7)
    const pinfireFire = pinfire.fire.mul(intimate)
    const fireIntensity = harlequin.flare.mul(0.85).add(pinfire.flare.mul(intimate).mul(0.7)).clamp()
    const fireColor = harlequin.fire.add(pinfireFire)
    // The milk: faint warm-to-cool clouds suspended in the stone, so even the
    // sleeping areas have weather rather than flat white.
    const milkNoise = mx_fractal_noise_float(p.mul(3.8), 3, 2, 0.5).mul(0.5).add(0.5)
    const milkCool = mx_noise_float(p.mul(2.2).add(vec3(5.4, 9.2, 1.8))).mul(0.5).add(0.5)
    const milk = mix(color(hsl.integer(85, 37, 89)), color(hsl.integer(85, 32, 82)), milkNoise)
    const coolMilk = mix(milk, color(hsl.integer(175, 19, 80)), milkCool.mul(0.5))
    const blushed = mix(coolMilk, color(hsl.integer(42, 32, 79)), milkNoise.smoothstep(0.68, 0.95).mul(0.45))
    const seamShadow = harlequin.seam.mul(0.5).add(pinfire.seam.mul(intimate).mul(0.35)).clamp()
    const body = mix(blushed, color(hsl.integer(129, 10, 76)), seamShadow.mul(0.5))
    this.colorNode = mix(body, fireColor, fireIntensity.mul(0.68))
    this.metalness = 0
    this.roughnessNode = float(0.19).sub(fireIntensity.mul(0.06)).clamp(0.1, 0.24)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.07
    this.sheen = 0.55
    this.sheenColor.set(hsl.integer(80, 100, 96.6))
    this.sheenRoughness = 0.5
    this.iridescence = 0.85
    this.iridescenceNode = fireIntensity.mul(0.75).add(0.2).clamp()
    this.iridescenceIOR = 1.42
    this.iridescenceThicknessNode = harlequin.thickness
    // Hand-polished, never machined: a long, soft undulation, the domain seams
    // pressed a breath below the surface, and nothing else.
    const undulation = mx_noise_float(p.mul(2.3)).mul(0.5).add(milkNoise.mul(0.2)).sub(seamShadow.mul(0.25))
    const opalNormal = proceduralNormal(undulation, 0.0009)
    this.normalNode = opalNormal
    this.clearcoatNormalNode = opalNormal
    const sparkle = glints(opalNormal, 170).mul(intimate)
    this.emissiveNode = fireColor
      .mul(float(1.15).add(near.mul(0.65)))
      .add(color(hsl.integer(82, 100, 97.2)).mul(sparkle).mul(0.35))
      .add(color(hsl.integer(81, 100, 93.3)).mul(harlequin.flare).mul(harlequin.flare).mul(0.35))
  }
}
