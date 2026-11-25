import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec3} from 'three/tsl'

import {panelSky, proceduralEnvironment} from '../../candidates/claude_sonnet/lib/environment.ts'
import {knotFrame} from '../../candidates/claude_sonnet/lib/knotFrame.ts'
import {tubeParallax} from '../../candidates/claude_sonnet/lib/tubeParallax.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const orbit = (direction: Node<'vec3'>, angle: Node<'float'>) => {
  const c = angle.cos()
  const s = angle.sin()
  return vec3(direction.x.mul(c).add(direction.z.mul(s)), direction.y, direction.z.mul(c).sub(direction.x.mul(s)))
}
/** A polished tiger’s-eye cabochon. Parallel fibers turn each lamp into one thin bright line perpendicular to them, and the line slides along the knot as you move. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const tube = uv()
    const frame = knotFrame(tube)
    const {p, view, facing, grazing, near} = viewerFrame()
// Color layers sit at three depths and drift against one another, so the stone seems to have a lit interior.
    const layer = (depth: number, frequency: number, seed: number) => {
      const at = tube.add(tubeParallax(frame, view, depth))
      const wander = mx_noise_float(p.mul(1.7).add(seed)).mul(2.4).add(mx_noise_float(p.mul(5.2).add(seed * 2)).mul(0.8))
      return at.x.mul(frequency).add(wander).add(at.y.mul(2).mul(TAU).sin().mul(0.2))
    }
    const banding = layer(0.02, 46, 1)
    const midBand = layer(0.06, 31, 7)
    const deepBand = layer(0.14, 19, 13)
    const gold = banding.mul(TAU).sin().mul(0.5).add(0.5).smoothstep(0.52, 0.86)
    const honey = midBand.mul(TAU).sin().mul(0.5).add(0.5).smoothstep(0.35, 0.85)
    const hawk = deepBand.mul(TAU).sin().mul(0.5).add(0.5).smoothstep(0.86, 0.99).mul(mx_noise_float(p.mul(3.4).add(4)).mul(0.5).add(0.5).smoothstep(0.35, 0.7))
// Fibers run down the tube; their fine texture is what makes the light look woven.
    const across = tube.y.mul(TAU * 90).add(mx_noise_float(p.mul(9)).mul(3))
    const fiberNoise = across.sin().mul(0.5).add(0.5).mul(0.55).add(tube.y.mul(TAU * 230).add(tube.x.mul(TAU * 9).add(tube.y.mul(TAU * 3)).sin().mul(3)).sin().mul(0.5).add(0.5).mul(0.45))
    const fibers = mix(float(0.62), fiberNoise, across.fwidth().smoothstep(0.9, 3).oneMinus())
    const body = mix(mix(color(hsl.integer(46, 46, 4)), color(hsl.integer(50, 77, 20)), honey), color(hsl.integer(68, 90, 56)), gold.mul(0.92))
    const albedo = mix(body, color(hsl.integer(250, 34, 29)), hawk.mul(0.75))
    const brightness = gold.mul(0.65).add(honey.mul(0.25)).add(0.18).add(hawk.mul(0.2))
// Chatoyance: every lamp contributes a band wherever the half vector is perpendicular to the fibers.
    const angle = time.mul(0.055)
    const lamps = [vec3(0.35, 0.78, 0.52), vec3(-0.62, 0.28, 0.73), vec3(0.86, 0.1, 0.5), vec3(0.1, -0.35, 0.93)]
    let sharp: Node<'float'> = float(0)
    let soft: Node<'float'> = float(0)
    for (const lamp of lamps) {
      const half = orbit(lamp.normalize(), angle).add(view).normalize()
      const alongFibers = half.dot(frame.axis)
      const facingLamp = frame.normal.dot(half).max(0).pow(2.4)
      sharp = sharp.add(alongFibers.pow2().div(-0.0026).exp().mul(facingLamp))
      soft = soft.add(alongFibers.pow2().div(-0.09).exp().mul(facingLamp))
    }
    const chatoyance = sharp.mul(fibers.mul(0.8).add(0.35)).mul(brightness.mul(0.8).add(0.35))
    const sheenBand = soft.mul(0.16).mul(fibers).mul(brightness)
    const dusk = panelSky({
      zenith: [0.03, 0.04, 0.14],
      horizon: [0.16, 0.075, 0.03],
      nadir: [0.03, 0.018, 0.012],
      glow: {
        color: [1, 0.5, 0.14],
        intensity: 0.5,
        width: 0.1,
      },
      panels: [{
        azimuth: 0.9,
        elevation: 0.08,
        halfWidth: 0.16,
        halfHeight: 0.09,
        color: [1, 0.72, 0.42],
        intensity: 26,
      }, {
        azimuth: -0.7,
        elevation: 0.55,
        halfWidth: 0.05,
        halfHeight: 0.5,
        color: [0.55, 0.62, 1],
        intensity: 5,
      }, {
        azimuth: 2.7,
        elevation: 0.3,
        halfWidth: 0.5,
        halfHeight: 0.07,
        color: [1, 0.4, 0.25],
        intensity: 3,
      }, {
        azimuth: 0,
        elevation: 1.2,
        halfWidth: 0.8,
        halfHeight: 0.3,
        color: [0.7, 0.6, 1],
        intensity: 1.2,
        softness: 0.5,
      }],
    })
    this.envNode = proceduralEnvironment(dusk)
    this.colorNode = albedo
    this.metalness = 0
    this.roughnessNode = float(0.11).add(hawk.mul(0.05))
    this.ior = 1.55
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.anisotropy = 0.7
    this.anisotropyRotation = Math.PI / 2
    this.emissiveNode = mix(color(hsl.integer(64, 100, 74)), color(hsl.integer(90, 100, 95)), sharp.mul(0.6).clamp().pow(2)).mul(chatoyance).mul(2.1).add(color(hsl.integer(74, 100, 79)).mul(sheenBand)).add(albedo.mul(brightness).mul(0.1)).add(color(hsl.integer(81, 100, 86)).mul(grazing.pow(3)).mul(0.05).mul(near.mul(0.5).add(0.5))).add(color(hsl.integer(263, 100, 55.4)).mul(hawk).mul(facing.pow(3)).mul(0.14))
  }
}
