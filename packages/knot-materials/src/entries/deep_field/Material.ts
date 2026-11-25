import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {starfield} from '../../lib/starfield.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A rare meteor crossing the volume, brilliant at the head and thinning along its trail. */
function meteorStreak(position: Node<'vec3'>, clock: Node<'float'>) {
  const phase = clock.mul(0.075).add(0.12).fract()
  const motion = vec3(1.6, -1.15, -0.45)
  const trail = motion.normalize()
  const head = vec3(-0.78, 0.6, 0.32).add(motion.mul(phase))
  const rel = position.sub(head)
  const along = rel.dot(trail)
  const across = rel.sub(trail.mul(along)).length()
  const core = across.smoothstep(0.002, 0.016).oneMinus()
  const wake = along.div(0.38).add(1).clamp().mul(along.div(0.02).oneMinus().clamp())
  const appear = phase.div(0.05).clamp()
  const vanish = phase.sub(0.3).div(0.14).oneMinus().clamp()
  return core.mul(wake).mul(appear).mul(vanish)
}

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.4)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
// Four sheets of sky at rising depth, sampled behind the glass along the view ray so they slide with the walk.
    const drift = vec3(time.mul(0.01), time.mul(0.006), time.mul(0.012))
    const dust = starfield(p.sub(view.mul(0.05)).add(drift), 34, 0.76).mul(intimate).mul(2.2)
    const closeStars = starfield(p.sub(view.mul(0.16)).add(drift), 17, 0.73).mul(near).mul(1.9)
    const midStars = starfield(p.sub(view.mul(0.34)).add(drift.mul(2)), 9, 0.7).mul(1.2)
    const farStars = starfield(p.sub(view.mul(0.6)).add(drift.mul(3)), 5, 0.66)
    const nebulaQ = p.sub(view.mul(0.34)).mul(3.4).add(vec3(0, time.mul(0.015), 0))
    const nebulaField = mx_fractal_noise_float(nebulaQ, 4, 2.05, 0.5).mul(0.5).add(0.5)
// Two nebula families: wine-magenta clouds and cold teal wisps, divided by dust lanes.
    const rose = cosinePalette(nebulaField.mul(1.2), [0.05, 0.01, 0.05], [0.14, 0.03, 0.12], [1, 1.4, 0.8], [0.05, 0.25, 0.5])
    const teal = cosinePalette(nebulaField.mul(1.1), [0.01, 0.05, 0.06], [0.03, 0.12, 0.13], [0.8, 1, 1.2], [0.45, 0.15, 0.6])
    const nebulaMix = mx_noise_float(p.sub(view.mul(0.45)).mul(2.2)).mul(0.5).add(0.5)
    const lane = mx_fractal_noise_float(p.sub(view.mul(0.5)).mul(5).add(vec3(3.7, 0, 0)), 3, 2, 0.5).mul(0.5).add(0.5).smoothstep(0.42, 0.72)
    const nebula = mix(rose, teal, nebulaMix).mul(lane.mul(0.7).add(0.3))
    const emberField = mx_noise_float(p.sub(view.mul(0.6)).mul(1.4).add(vec3(time.mul(0.01), 0, 0)))
    const ember = color(hsl.integer(52, 99, 71)).mul(emberField.smoothstep(0.66, 0.95)).mul(0.5)
    const meteor = meteorStreak(p, time).mul(color(hsl.integer(247, 100, 92.3))).mul(2.8)
// Looking through more glass at grazing angles, the deep field burns brighter.
    const depthLight = grazing.pow(1.6).mul(0.9).add(0.35)
    this.colorNode = mix(color(hsl.integer(270, 42, 3)), color(hsl.integer(263, 45, 7)), facing)
    this.metalness = 0
    this.roughnessNode = mx_noise_float(p.mul(3.2)).mul(0.07).add(0.12)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.05
    this.envMapIntensity = 0.35
    this.transmission = 0.22
    this.thickness = 0.5
    this.ior = 1.45
    this.attenuationColor.set(hsl.integer(262, 58, 9))
    this.attenuationDistance = 1.6
    this.emissiveNode = nebula.mul(depthLight).mul(1.3).add(farStars).add(midStars).add(closeStars).add(dust).add(ember.mul(depthLight)).add(meteor).add(color(hsl.integer(293, 55, 30)).mul(grazing.pow(2.4)).mul(0.5))
  }
}
