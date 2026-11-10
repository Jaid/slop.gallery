import type {GhostExpression} from '#src/lib/materials/ghost.ts'
import type {FillLayer, OrbGlassOptions, OrbRay} from '../base/OrbGlassMaterial.ts'
import type {Node} from 'three/webgpu'

import {color, cross, float, mix, mx_noise_float, smoothstep, time, vec2, vec3} from 'three/tsl'

import {ghostBlink, ghostColors, ghostShape} from '#src/lib/materials/ghost.ts'

import OrbGlassMaterial from '../base/OrbGlassMaterial.ts'
import {coverage, rgb, spinAroundY, turn} from '../lib/fill.ts'
import {orbNoise} from '../lib/noise.ts'

const steps = 40
/** Each ghost drifts around the middle at its own height, bobbing and swaying, its height in radii of the orb. */
const ghosts = [{
  radius: 0.48,
  height: 0.16,
  rate: 0.35,
  phase: 0,
  size: 0.3,
}, {
  radius: 0.52,
  height: -0.26,
  rate: 0.35,
  phase: 2.3,
  size: 0.27,
}, {
  radius: 0.4,
  height: -0.05,
  rate: 0.35,
  phase: 4.3,
  size: 0.25,
}, {
  radius: 0.15,
  height: 0.42,
  rate: -0.5,
  phase: 1.1,
  size: 0.22,
}, {
  radius: 0.2,
  height: -0.45,
  rate: -0.45,
  phase: 3.2,
  size: 0.2,
}]
const sheetColor = rgb(ghostColors.sheet)
const glowColor = rgb(ghostColors.glow)
const holeColor = rgb(ghostColors.hole)
const mistColor = color('#3fd98a')
const deepColor = color('#062417')

/** Pale ghosts under sheets drifting through green ectoplasmic mist, wailing, their hollow faces always turned toward whoever looks in. They blink, each at its own pace, glance around, and gape startled when someone leans in close; now and then one fades nearly out of sight and flickers back. */
export default class GhostsOrbMaterial extends OrbGlassMaterial {
  constructor(options: OrbGlassOptions) {
    super(options, {
      name: 'orb-ghosts',
      tint: '#4fd08e',
    })
  }

  protected override fill(ray: OrbRay) {
    const {origin, direction, eye} = ray
    const startle = smoothstep(7, 4, eye.length())
    // A ghost’s up is the orb’s, tilted toward the viewer so the face stays upright on screen.
    const up = vec3(0, 1, 0).sub(direction.mul(direction.y)).normalize()
    const right = cross(direction, up)
    const centers = ghosts.map(({radius, height, rate, phase}) => {
      const angle = time.mul(rate).add(phase)
      const bob = time.mul(1.3).add(phase * 1.7).sin().mul(0.06)
      return vec3(angle.cos().mul(radius), bob.add(height), angle.sin().mul(radius)).toVar()
    })
    const layers: Array<FillLayer> = ghosts.map(({size, phase}, index) => {
      const glanceAt = time.mul(0.35).add(phase * 5)
      const expression: GhostExpression = {
        blink: ghostBlink(phase, 3.2 + index * 0.9),
        glance: vec2(mx_noise_float(vec3(glanceAt, phase, 0.5)), mx_noise_float(vec3(glanceAt, phase, 3.5)).mul(0.5)).mul(0.07).mul(startle.oneMinus()),
        startle,
      }
      // Now and then a ghost fades nearly out of sight, flickering, and comes back.
      const fading = mx_noise_float(vec3(time.mul(0.15), phase * 3, 7.7)).smoothstep(0.35, 0.6)
      const flicker = time.mul(37).add(phase).sin().mul(time.mul(23).sin()).mul(0.5).add(0.5)
      const presence = float(1).sub(fading.mul(flicker.mul(0.3).add(0.6)))
      const center = centers[index]
      const depth = center.sub(origin).dot(direction)
      const offset = origin.add(direction.mul(depth)).sub(center)
      const sway = time.mul(1.1).add(phase).sin().mul(0.18)
      const point = turn(vec2(offset.dot(right), offset.dot(up)).div(size), sway)
      const {body, face} = ghostShape(point, phase, expression)
      // The sheet thins out toward its hem and frays into the mist.
      const fray = mx_noise_float(vec3(point.mul(3.5), time.mul(0.6).add(phase))).mul(0.5).add(0.5)
      const fade = point.y.add(0.75).div(0.75).clamp(0, 1).sub(fray.mul(0.35)).clamp(0, 1)
      const sheet = coverage(body).mul(fade.pow(0.7)).mul(presence)
      const hollow = coverage(face).mul(sheet)
      const shading = point.y.add(0.7).mul(0.7).clamp(0, 1)
      // A halo around the sheet that fades out within half its size.
      const halo = body.negate().max(0).mul(-7).exp().mul(float(1).sub(sheet))
      return {
        depth,
        coverage: sheet.mul(0.62).add(hollow.mul(0.35)),
        color: mix(mix(glowColor, sheetColor, shading).mul(4.5), holeColor, hollow.div(sheet.mul(0.62).add(hollow.mul(0.35)).max(0.001)).clamp(0, 1)),
        glow: glowColor.mul(halo).mul(0.6),
      }
    })
    return this.march(ray, steps, point => {
      // The ghosts light the mist around them.
      let light: Node<'float'> = float(0.04)
      for (const center of centers) {
        light = light.add(float(0.02).div(point.sub(center).lengthSq().add(0.02)))
      }
      const swirling = spinAroundY(point, time.mul(0.12)).mul(1.6).add(vec3(0, time.mul(0.1), 0))
      const q = swirling.add(orbNoise(swirling.mul(0.8).add(vec3(time.mul(0.03), 0, 0))).xyz.mul(0.6))
      const mist = orbNoise(q.mul(1.4)).x.mul(0.5).add(0.5).smoothstep(0.35, 0.8)
      const strands = float(1).sub(orbNoise(q.mul(4.2).add(3.3)).y.abs().mul(3)).max(0).pow(3)
      // Thicker toward the bottom, like mist over a grave.
      const settled = smoothstep(0.5, -0.8, point.y).mul(0.8).add(0.2)
      const wall = smoothstep(1, 0.86, point.length())
      const density = mist.mul(settled).add(strands.mul(0.5)).mul(3.5).mul(wall)
      return {
        absorption: float(1.6),
        density,
        color: mix(deepColor, mistColor, light.smoothstep(0, 1)).mul(light.mul(2.4).add(0.12)),
      }
    }, layers)
  }
}
