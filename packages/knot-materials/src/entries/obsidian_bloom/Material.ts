import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, mx_fractal_noise_float, mx_noise_float, negateOnBackSide, positionViewDirection, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {crackNetwork} from '../../candidates/deepseek/lib/crackNetwork.ts'
import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {pixelFootprint} from '../../candidates/deepseek/lib/pixelFootprint.ts'
import {surfaceLine} from '../../candidates/deepseek/lib/surfaceLine.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A crust of blown volcanic glass: the silhouette swells where the melt pushes from below. */
const crustSurface = Fn(([tube]: [Node<'vec2'>]) => {
  const {position: p, normal} = knotFrame(tube)
  return p.add(normal.mul(mx_noise_float(p.mul(2.3).add(vec3(0.4, -1.1, 2.2))).mul(0.013)))
})
/** Volcanic glass over a magma chamber. Far away the knot is a black mirror – the crust has closed and only a dull rust haze hints at what moves below. Walking closer opens the fissures: the shells of the crust tilt apart, rivers with chilled scum and white-hot hearts become legible, the glass around every crack turns amber as heat climbs through it, and fine crazing spreads across the hottest plates. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.45)
    this.name = knotData.id
    const p = viewerFrame().p
    const {grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const t = time
// Slow tide of heat: a drifting field decides how molten each region currently is.
    const heat = mx_noise_float(p.mul(2.4).add(vec3(t.mul(0.05), t.mul(0.035), t.mul(-0.04)))).mul(0.5).add(0.5).mul(near.mul(0.6).add(0.55)).clamp()
    const pulse = t.mul(Math.PI).sin().mul(0.28).add(0.86)
    const pixel = pixelFootprint()
    const plates = crackNetwork(p, 13, 4)
    const fissure = surfaceLine(plates.edge, float(0.013).mix(0.024, near), pixel.mul(13))
// Conchoidal shells: every plate bows outward, so the studio breaks across the crust in facets.
    const dome = plates.heart.pow(2).mul(-1)
    const crazing = surfaceLine(crackNetwork(p, 46, 14, 0.4).edge, float(0.055), pixel.mul(46))
    const crazingMask = heat.smoothstep(0.68, 1.02).mul(near.mul(0.6).add(0.4))
// Melt sampled in its own drifting frame, so it slides under the crust instead of blinking.
    const meltPosition = p.add(vec3(t.mul(0.012).sin().mul(0.01), t.mul(0.02), t.mul(0.014).cos().mul(0.01)))
    const melt = mx_fractal_noise_float(meltPosition.mul(34), 3, 2.15, 0.5).mul(0.5).add(0.5)
    const scum = mx_noise_float(meltPosition.mul(96).add(vec3(0, t.mul(0.05), 0))).mul(0.5).add(0.5)
    const molten = melt.mul(0.62).add(scum.mul(0.18)).add(0.3)
    const vein = fissure.coverage.mul(fissure.energy.pow(0.7)).mul(heat).mul(pulse)
    const veinTemperature = vein.mul(molten).clamp()
    const veinColor = mix(color(hsl.integer(33, 100, 48.5)), color(hsl.integer(74, 100, 82)), veinTemperature.mul(0.85))
// Amber bleed: heat climbing through the glass, tight against the fissures and richer at grazing.
    const bleed = plates.edge.negate().div(0.06).exp().pow(1.6).mul(heat).mul(pulse).mul(mx_noise_float(p.mul(5.5)).mul(0.45).add(0.75)).clamp()
    const halo = plates.edge.negate().div(0.22).exp().mul(heat).mul(pulse).clamp()
    const crust = mix(color(hsl.integer(261, 33, 4)), color(hsl.integer(265, 33, 8)), mx_fractal_noise_float(p.mul(9), 3, 2, 0.5).mul(0.5).add(0.5))
    const crustMix = mix(crust, mix(color(hsl.integer(44, 74, 7)), color(hsl.integer(46, 90, 37)), bleed.mul(0.6).add(halo.mul(0.25))), bleed.mul(0.35).add(halo.mul(0.2)).clamp())
    this.colorNode = mix(crustMix, mix(color(hsl.integer(40, 81, 10)), veinColor, molten), fissure.coverage.mul(heat).clamp())
    const striae = mx_noise_float(p.mul(58).add(vec3(0, t.mul(0.03), 0))).abs()
    const relief = dome.mul(0.55)
      .add(fissure.coverage.mul(heat.mul(0.45).add(0.55)).mul(-1.15))
      .add(crazing.coverage.mul(crazingMask).mul(-0.22))
      .add(fissure.coverage.mul(striae).mul(-0.16))
      .add(mx_fractal_noise_float(p.mul(3.4), 3, 2, 0.5).mul(0.3))
    const crustNormal = varying(transformNormalToView(crustSurface(tube.add(vec2(0.0001, 0))).sub(crustSurface(tube.sub(vec2(0.0001, 0)))).cross(crustSurface(tube.add(vec2(0, 0.0001))).sub(crustSurface(tube.sub(vec2(0, 0.0001))))).normalize())).normalize()
    this.positionNode = crustSurface(tube)
    this.normalNode = detailNormal(negateOnBackSide(crustNormal), relief, float(0.005).mul(fissure.relief.mul(0.75).add(0.25)))
    this.metalnessNode = fissure.coverage.mul(heat).mul(-0.08).add(0.08)
    this.roughnessNode = mix(float(0.09), float(0.7), fissure.coverage.mul(heat).max(crazing.coverage.mul(crazingMask).mul(0.6))).add(mx_noise_float(p.mul(7)).mul(0.04))
    this.aoNode = fissure.coverage.mul(heat).mul(-0.72).add(1)
    this.clearcoat = 0.35
    this.specularColorNode = mix(color(hsl.integer(57, 26, 20)), color(hsl.integer(0, 0, 100)), grazing.mul(0.6))
    this.specularIntensityNode = mix(float(0.65), float(1), grazing.mul(0.8))
    this.clearcoatRoughness = 0.05
    const whiteHot = veinTemperature.pow(2.4).mul(4.5)
    const crazingGlow = crazing.coverage.mul(crazing.energy).mul(crazingMask).mul(0.45)
    const warmProfile = crustNormal.dot(positionViewDirection).abs().clamp().pow(3).oneMinus()
    this.emissiveNode = veinColor.mul(vein).mul(3.4)
      .add(color(hsl.integer(87, 100, 95.7)).mul(whiteHot))
      .add(color(hsl.integer(36, 100, 61.1)).mul(crazingGlow))
      .add(color(hsl.integer(43, 100, 65.4)).mul(bleed.pow(2.2)).mul(0.7))
      .add(color(hsl.integer(39, 100, 63)).mul(halo.pow(1.8)).mul(0.3))
      .add(color(hsl.integer(53, 100, 72)).mul(fissure.coverage.mul(heat)).mul(0.2))
      .add(color(hsl.integer(52, 99, 71)).mul(warmProfile).mul(heat).mul(intimate).mul(0.05))
  }
}
