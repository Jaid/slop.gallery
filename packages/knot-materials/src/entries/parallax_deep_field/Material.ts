import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, exp, float, mix, mx_fractal_noise_float, normalLocal, refract, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {starfield} from '../../lib/starfield.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const slices = 7
/** Volumetric slice of cosmic dust, lit from within. Returns the accumulated light and what is left of the background. */
const nebulaAlong = (origin: Node<'vec3'>, direction: Node<'vec3'>) => {
  let light: Node<'vec3'> = vec3(0)
  let clear: Node<'float'> = float(1)
  for (let i = 0;i < slices;i++) {
    const q = origin.add(direction.mul(0.03 + i * 0.105))
    const drift = vec3(time.mul(0.006), time.mul(-0.004), i * 3.7)
    const shape = mx_fractal_noise_float(q.mul(2.3).add(drift), 4, 2.1, 0.5).mul(0.5).add(0.5)
    const cloud = shape.smoothstep(0.5, 0.86)
    const heat = shape.smoothstep(0.66, 0.96)
    const hue = mx_fractal_noise_float(q.mul(1.1).add(vec3(9.1, 2.3, 5.7)), 2, 2, 0.5).mul(0.5).add(0.5)
    const dust = mix(mix(color(hsl.integer(283, 92, 27)), color(hsl.integer(358, 83, 53.4)), hue.smoothstep(0.25, 0.7)), color(hsl.integer(227, 100, 75)), hue.smoothstep(0.62, 0.95))
    const glow = dust.mul(cloud).mul(heat.mul(1.6).add(0.32)).add(color(hsl.integer(74, 99, 86)).mul(heat.pow(3)).mul(cloud).mul(0.9))
    light = light.add(glow.mul(clear).mul(0.34))
    clear = clear.mul(exp(cloud.mul(-0.26)))
  }
  return {
    light,
    clear,
  }
}
/** A dark glass window into deep space. The ray bends through the tube and travels through a lit nebula and three star layers, so nearby stars slide past distant ones as you move. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.6)
    this.name = knotData.id
    const {p, view, facing, near, intimate} = viewerFrame()
    const smooth = normalLocal.normalize()
    const ray = refract(view.negate(), smooth, float(1 / 1.75)).normalize()
    const {light, clear} = nebulaAlong(p, ray)
    const foreground = starfield(p.add(ray.mul(0.05)), 46, 0.9).mul(1.7)
    const middle = starfield(p.add(ray.mul(0.17)), 74, 0.88).mul(1.3)
    const deep = starfield(p.add(ray.mul(0.48)), 120, 0.86).mul(1)
    const distant = starfield(ray, 230, 0.82).mul(1.1)
// A galactic plane far behind everything, with dust lanes cut into it.
    const plane = vec3(0.32, 0.9, 0.27).normalize()
    const band = ray.dot(plane).div(0.26).pow2().negate().exp()
    const lanes = mx_fractal_noise_float(ray.mul(5.5).add(vec3(time.mul(0.004), 0, 0)), 4, 2.2, 0.55).mul(0.5).add(0.5)
    const galaxy = mix(color(hsl.integer(68, 99, 89)), color(hsl.integer(269, 100, 76)), lanes).mul(band).mul(lanes.smoothstep(0.32, 0.78)).mul(0.55)
    const stars = foreground.add(middle).add(deep).mul(clear.mul(0.6).add(0.4)).add(distant.mul(clear))
    const cosmos = light.add(stars).add(galaxy.mul(clear))
// The edge of the window carries a thin ring of gathered light, like the photon ring around a black hole.
    const shimmer = mx_fractal_noise_float(p.mul(9).add(vec3(0, 0, time.mul(0.12))), 2, 2, 0.5).mul(0.5).add(0.5)
    const ring = facing.smoothstep(0.015, 0.3).oneMinus().mul(shimmer.mul(0.5).add(0.6))
    const halo = facing.smoothstep(0.05, 0.62).oneMinus()
    this.colorNode = color(hsl.integer(264, 100, 1))
    this.metalness = 0
    this.roughness = 0.02
    this.ior = 1.75
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.emissiveNode = cosmos.mul(facing.smoothstep(0, 0.22).mul(0.55).add(0.45)).add(color(hsl.integer(64, 100, 80)).mul(ring).mul(2.4)).add(color(hsl.integer(81, 100, 93.3)).mul(ring.pow(3)).mul(2.4)).add(color(hsl.integer(278, 100, 48)).mul(halo).mul(0.16).mul(near.mul(0.6).add(0.4))).add(color(hsl.integer(275, 100, 76)).mul(intimate).mul(0.01))
  }
}
