import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, normalLocal, time, transformNormalToView, uv, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {environmentHighlight} from '../../candidates/deepseek/lib/environment.ts'
import {panelSky, proceduralEnvironment} from '../../candidates/deepseek/lib/sky.ts'
import {knotCircumference, knotLength} from '../../candidates/deepseek/lib/tubeMetric.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A radial fern of ice, its branches drawn in the physical plane of the tube. */
const frond = (tube: Node<'vec2'>, p: Node<'vec3'>, cu: number, cv: number, arms: number, scale: number, seed: number) => {
  const du = tube.x.sub(cu).add(0.5).fract().sub(0.5).mul(knotLength)
  const dv = tube.y.sub(cv).add(0.5).fract().sub(0.5).mul(knotCircumference)
  const radius = vec2(du, dv).length()
  const angle = dv.atan(du)
  const wobble = mx_fractal_noise_float(p.mul(9.5).add(seed), 2, 2.12, 0.5)
  const phase = angle.mul(arms).add(radius.mul(scale)).add(wobble.mul(3.6))
  const sidePhase = angle.mul(arms * 3).add(radius.mul(scale * 0.41)).add(wobble.mul(7.4))
  const branch = phase.sin().abs().pow(7)
  const side = sidePhase.sin().abs().pow(13).mul(0.44)
  const envelope = radius.mul(5.8).negate().exp()
  const resolved = phase.fwidth().smoothstep(0.35, 1.4).oneMinus()
  return branch.mul(resolved).add(branch.oneMinus().mul(0.16)).add(side).mul(envelope).clamp()
}
/**
 * Midnight lacquer on a freezing window. Fern frost grows from four seeds, a fine crystalline web
 * fills the dark, and every needle waits for the angle at which it can return the moon.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const n = normalLocal.normalize()
    const baseNormal = transformNormalToView(n).normalize()
    const fern = frond(tube, p, 0.16, 0.3, 5, 54, 3.1)
      .max(frond(tube, p, 0.54, 0.63, 6, 47, 17.4))
      .max(frond(tube, p, 0.83, 0.22, 4, 61, -8.2))
      .max(frond(tube, p, 0.34, 0.83, 7, 43, 29.7))
    const warp = mx_fractal_noise_float(p.mul(3.4).add(4.2), 3, 2.03, 0.52)
    const webA = p.dot(vec3(31, 17, 23)).add(warp.mul(7.2)).sin().abs()
    const webB = p.dot(vec3(-13, 41, 7)).add(warp.mul(5.3)).sin().abs()
    const webC = p.dot(vec3(19, -11, 37)).sub(warp.mul(4.1)).sin().abs()
    const web = webA.mul(webB).add(webB.mul(webC)).add(webC.mul(webA)).smoothstep(0.02, 0.14).oneMinus()
    const webFootprint = warp.fwidth().mul(0.5).add(0.001)
    const webResolved = webFootprint.smoothstep(0.03, 0.12).oneMinus()
    const needles = p.dot(vec3(86, 24, 64)).add(warp.mul(15)).sin().abs().pow(25)
    const needleResolved = p.dot(vec3(86, 24, 64)).fwidth().smoothstep(0.35, 1.2).oneMinus()
    const frost = fern.mul(1.35).add(web.mul(webResolved).mul(0.44)).add(needles.mul(needleResolved).mul(fern).mul(0.38)).clamp()
    const frostHalo = fern.mul(0.52).add(web.mul(webResolved).mul(0.13)).clamp()
// The lacquer is nearly black, with a cold blue bloom where the ice has begun to cloud it.
    const mottle = mx_fractal_noise_float(p.mul(2.6).add(19.4), 3, 2.02, 0.5).mul(0.5).add(0.5)
    const lacquer = mix(color(hsl.integer(259, 46, 6)), mix(color(hsl.integer(258, 61, 13)), color(hsl.integer(293, 56, 11)), mottle.mul(0.8)), mottle.mul(0.7).add(facing.mul(0.3)))
    const frostColor = mix(mix(color(hsl.integer(242, 65, 77)), color(hsl.integer(175, 59, 90)), mottle.mul(0.5)), color(hsl.integer(233, 100, 97)), frost.mul(0.55).add(mottle.mul(0.2)))
    const frostShade = mix(color(hsl.integer(246, 50, 42)), frostColor, facing.mul(0.4).add(0.55))
    const ice = mix(frostShade, color(hsl.integer(0, 0, 100)), frost.pow(2).mul(0.8))
    this.colorNode = mix(lacquer, ice, frost.add(frostHalo.mul(0.34)).clamp().mul(near.mul(0.12).add(0.9)))
    this.metalness = 0
    this.roughnessNode = mix(float(0.055), float(0.28).sub(frost.mul(0.12)), frost)
    this.clearcoatNode = float(1).sub(frost.mul(0.32))
    this.clearcoatRoughnessNode = mix(float(0.025), float(0.16), frost)
    this.sheen = 0.5
    this.sheenColor.set(hsl.integer(240, 100, 88.5))
    this.sheenRoughness = 0.24
    this.iridescenceNode = frost.mul(0.22)
    this.iridescenceIOR = 1.31
    this.iridescenceThicknessNode = frost.mul(240).add(mottle.mul(160)).add(260)
    this.normalNode = detailNormal(baseNormal, frost.mul(0.00055).add(needles.mul(0.00028).mul(needleResolved)).add(web.mul(0.00016)), 1.1)
    this.aoNode = float(1).sub(frost.mul(0.12))
    const moonGlint = environmentHighlight(environment, n, 0.03, {threshold: 1.4}).mul(frost).mul(near.mul(0.6).add(0.4))
    const sparkle = glints(baseNormal, 180).mul(frost.pow(1.5)).mul(needleResolved).mul(intimate.mul(0.9).add(0.1)).mul(1.2)
    const sparkleTint = mix(color(hsl.integer(230, 100, 95)), color(hsl.integer(262, 100, 80)), mottle)
    const moonSpot = view.negate().reflect(n).dot(vec3(0.35, 0.72, -0.6).normalize()).clamp().pow(760)
    const moonFlare = color(hsl.integer(236, 100, 96)).mul(moonSpot).mul(frost.mul(0.7).add(frostHalo.mul(0.3))).mul(3.2)
    const breathing = frost.mul(0.026).mul(time.mul(0.15).sin().mul(0.4).add(0.8))
    this.emissiveNode = moonGlint.mul(1.1).add(sparkleTint.mul(sparkle).mul(1.5)).add(moonFlare).add(color(hsl.integer(247, 64, 72)).mul(frostHalo).mul(near.oneMinus().mul(0.12).add(0.28))).add(color(hsl.integer(235, 100, 89)).mul(frost.pow(0.7)).mul(0.07)).add(color(hsl.integer(243, 100, 89.6)).mul(grazing.pow(2.2)).mul(frost).mul(0.15)).add(color(hsl.integer(234, 100, 96.4)).mul(frost).mul(0.05)).add(breathing)
    this.envNode = proceduralEnvironment(panelSky({
      zenith: [0.003, 0.01, 0.03],
      horizon: [0.02, 0.05, 0.1],
      nadir: [0.001, 0.003, 0.008],
      glow: {
        color: [0.08, 0.18, 0.36],
        intensity: 0.24,
        width: 0.13,
      },
      panels: [{
        azimuth: 0.9,
        elevation: 0.55,
        halfWidth: 0.07,
        halfHeight: 0.07,
        color: [0.68, 0.82, 1],
        intensity: 12,
        softness: 0.06,
      }, {
        azimuth: -1.2,
        elevation: 0.3,
        halfWidth: 0.7,
        halfHeight: 0.1,
        color: [0.12, 0.25, 0.5],
        intensity: 0.7,
      }],
    }))
  }
}
