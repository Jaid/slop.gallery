import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, normalLocal, positionGeometry, time, transformNormalToView, uv, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {panelSky, proceduralEnvironment} from '../../candidates/deepseek/lib/sky.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {starfield} from '../../lib/starfield.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A single auroral sheet, sampled slightly below the visible shell so it parallaxes as the visitor moves. */
const auroraSheet = (position: Node<'vec3'>, view: Node<'vec3'>, tube: Node<'vec2'>, depth: number, shift: number, near: Node<'float'>) => {
  const q = position.sub(view.mul(depth))
  const flow = mx_fractal_noise_float(q.mul(2.45).add(vec3(shift, time.mul(0.011), -shift)), 3, 2.02, 0.52)
  const fine = mx_fractal_noise_float(q.mul(8.2).add(vec3(-shift, time.mul(-0.007), shift)), 2, 2.1, 0.5)
  const centerA = float(0.36).add(tube.x.mul(TAU * 2).add(flow.mul(2.2)).add(time.mul(0.045)).sin().mul(0.075)).add(view.dot(vec3(0.4, 0.7, 0.2)).mul(0.17))
  const centerB = float(0.74).add(tube.x.mul(TAU * 3).sub(flow.mul(1.7)).add(time.mul(0.037)).sin().mul(0.06)).add(view.dot(vec3(-0.3, 0.6, 0.7)).mul(0.13))
  const bandA = tube.y.sub(centerA).div(0.125).pow2().negate().exp()
  const bandB = tube.y.sub(centerB).div(0.085).pow2().negate().exp()
  const rayPhase = tube.x.mul(TAU * 44).add(flow.mul(10.5)).add(fine.mul(3.4)).add(time.mul(0.18))
  const rayPhase2 = tube.x.mul(TAU * 27).sub(flow.mul(7.2)).add(fine.mul(2.1)).add(time.mul(-0.12))
  const ray = rayPhase.sin().mul(0.5).add(0.5).pow(5)
  const ray2 = rayPhase2.sin().mul(0.5).add(0.5).pow(8)
  const resolved = rayPhase.fwidth().smoothstep(0.35, 1.4).oneMinus()
  const resolved2 = rayPhase2.fwidth().smoothstep(0.35, 1.4).oneMinus()
  const curtain = mix(float(0.34), ray, resolved).mul(0.68).add(mix(float(0.4), ray2, resolved2).mul(0.32))
  const green = color(hsl.integer(146, 100, 85.3))
  const teal = color(hsl.integer(172, 100, 88))
  const violet = color(hsl.integer(293, 100, 52.6))
  const magenta = color(hsl.integer(346, 100, 65.7))
  const violetPatch = flow.mul(0.5).add(0.5).smoothstep(0.38, 0.86)
  const tintA = mix(green, violet, flow.mul(0.5).add(0.5).smoothstep(0.05, 0.8).mul(0.34).add(violetPatch.mul(0.34)))
  const tintB = mix(mix(green, magenta, fine.mul(0.5).add(0.5).smoothstep(0.1, 0.85).mul(0.3)), teal, fine.smoothstep(0, 0.5).mul(0.15)).add(violet.mul(violetPatch.mul(0.12)))
  const veil = mix(green, violet, flow.mul(0.5).add(0.5)).mul(bandA.mul(0.05).add(bandB.mul(0.03)))
  const redFringe = bandA.mul(tube.y.sub(centerA).smoothstep(0.08, 0.2)).mul(0.1).add(bandB.mul(tube.y.sub(centerB).smoothstep(0.06, 0.14)).mul(0.06))
  const coreA = mix(tintA, magenta, curtain.pow(4).mul(0.32))
  const coreB = mix(tintB, violet, curtain.pow(3).mul(0.28))
  const foldPhase = tube.x.mul(TAU * 92).add(flow.mul(17)).add(fine.mul(6)).add(time.mul(0.23))
  const fold = foldPhase.sin().abs().pow(16).mul(foldPhase.fwidth().smoothstep(0.35, 1.6).oneMinus())
  const fineCurtain = bandA.add(bandB.mul(0.8)).mul(fold).mul(near.mul(1.4).add(0.15)).mul(0.22)
  const violetVeil = violet.mul(bandA.add(bandB).mul(0.07))
  return {
    light: bandA.mul(curtain).mul(coreA).add(bandB.mul(curtain.mul(0.82)).mul(coreB)).add(veil).add(violetVeil).add(mix(coreA, coreB, 0.5).mul(fineCurtain)).add(color(hsl.integer(24, 100, 63)).mul(redFringe)),
    mask: bandA.mul(curtain).add(bandB.mul(curtain.mul(0.82))).clamp(),
    flow,
  }
}
/** A black ionosphere wearing two auroral ovals, its curtains lifted off the surface by parallax and its dark latitudes salted with stars. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.34)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const n = normalLocal.normalize()
    const baseNormal = transformNormalToView(n).normalize()
    const low = auroraSheet(p, view, tube, 0.05, 0, near)
    const high = auroraSheet(p, view, tube, 0.14, 13.7, near)
    const aurora = low.light.add(high.light.mul(0.55))
    const auroraMask = low.mask.add(high.mask.mul(0.55)).clamp()
// A thin airglow hugs the limb, where a real atmosphere would be longest along the eye.
    const airglow = mix(color(hsl.integer(251, 78, 39)), color(hsl.integer(164, 100, 88)), grazing.mul(0.7)).mul(grazing.pow(3.4)).mul(0.13)
// The dark shell is not flat black: it carries the deep blue of the upper atmosphere and a faint magnetic grain.
    const mottle = mx_fractal_noise_float(p.mul(2.7).add(3.3), 3, 2.03, 0.5).mul(0.5).add(0.5)
    const shell = mix(color(hsl.integer(259, 59, 3)), color(hsl.integer(257, 62, 10)), mottle.mul(0.7).add(facing.mul(0.3)))
    const magneticGrain = mx_fractal_noise_float(p.mul(18).add(41), 2, 2.2, 0.5).mul(0.5).add(0.5).mul(intimate).mul(0.04)
    this.colorNode = shell.add(color(hsl.integer(255, 57, 12)).mul(magneticGrain))
    this.metalness = 0
    this.roughnessNode = float(0.16).add(magneticGrain.mul(0.2)).sub(auroraMask.mul(0.04)).clamp(0.06, 0.36)
    this.clearcoat = 0.9
    this.clearcoatRoughness = 0.045
    this.sheen = 0.42
    this.sheenColor.set(hsl.integer(176, 100, 90.5))
    this.sheenRoughness = 0.3
    this.iridescenceNode = grazing.mul(0.12).add(auroraMask.mul(0.05))
    this.iridescenceIOR = 1.4
    this.iridescenceThicknessNode = float(260).add(mottle.mul(120)).add(grazing.mul(180))
    const shellBreath = mx_fractal_noise_float(p.mul(4.6).add(vec3(time.mul(0.018), time.mul(-0.012), time.mul(0.009))), 2, 2.1, 0.5)
    this.positionNode = positionGeometry.add(normalLocal.normalize().mul(shellBreath.mul(0.0022)))
    this.normalNode = detailNormal(baseNormal, magneticGrain.mul(0.0004).add(low.flow.mul(0.0003)), 0.6)
    const nebula = mx_fractal_noise_float(p.mul(1.55).add(21.3), 3, 2.03, 0.52).mul(0.5).add(0.5)
    const violetBloom = mix(color(hsl.integer(279, 100, 45.6)), color(hsl.integer(338, 100, 67)), nebula).mul(nebula.smoothstep(0.56, 0.84)).mul(0.11).mul(auroraMask.mul(0.5).oneMinus()).mul(intimate.mul(0.5).add(0.5))
    const stars = starfield(p.normalize(), 38, 0.9).add(starfield(p.normalize().add(0.17), 67, 0.93).mul(0.55)).add(starfield(p.normalize().sub(0.23), 104, 0.95).mul(intimate).mul(0.7))
    const starMask = auroraMask.oneMinus().mul(intimate.mul(0.8).add(0.12)).mul(facing.mul(0.35).add(0.65))
    const curtainCore = aurora.mul(0.82).mul(near.mul(0.32).add(0.68)).mul(view.dot(vec3(0.35, 0.2, 0.9)).abs().mul(0.22).add(0.8))
    const hem = mix(color(hsl.integer(172, 100, 87.95)), color(hsl.integer(309, 100, 81)), high.flow.mul(0.5).add(0.5)).mul(auroraMask.pow(2)).mul(grazing.pow(1.4)).mul(0.5)
    this.emissiveNode = curtainCore.add(airglow).add(stars.mul(starMask).mul(1.1)).add(hem).add(violetBloom)
    this.aoNode = float(1).sub(auroraMask.mul(0.08)).sub(magneticGrain.mul(0.2))
    this.envNode = proceduralEnvironment(panelSky({
      zenith: [0.002, 0.006, 0.018],
      horizon: [0.012, 0.035, 0.07],
      nadir: [0.001, 0.002, 0.006],
      glow: {
        color: [0.05, 0.38, 0.28],
        intensity: 0.32,
        width: 0.16,
      },
      panels: [{
        azimuth: 1.15,
        elevation: 0.58,
        halfWidth: 0.055,
        halfHeight: 0.055,
        color: [0.72, 0.82, 1],
        intensity: 11,
        softness: 0.04,
      }, {
        azimuth: -0.85,
        elevation: 0.76,
        halfWidth: 0.55,
        halfHeight: 0.018,
        color: [0.16, 1, 0.66],
        intensity: 2.4,
      }, {
        azimuth: -0.55,
        elevation: 0.86,
        halfWidth: 0.5,
        halfHeight: 0.012,
        color: [0.6, 0.3, 1],
        intensity: 1.8,
      }],
    }))
  }
}
