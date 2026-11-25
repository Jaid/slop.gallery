import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, float, mix, mx_fractal_noise_float, mx_noise_vec3, normalWorld, pmremTexture, positionWorld, time, vec3} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function rotateY(v: Node<'vec3'>, angle: Node<'float'>) {
  const c = angle.cos()
  const s = angle.sin()
  return vec3(v.x.mul(c).sub(v.z.mul(s)), v.y, v.x.mul(s).add(v.z.mul(c)))
}

/** A chrome knot whose reflection is slightly wrong: the mirrored world drifts. Face it squarely and step closer, and the surface opens like a portal, showing the world *behind* the knot, split into faint spectral fringes, with a luminous threshold line crawling around the opening. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0
    const {p, facing, near, intimate} = viewerFrame()
    const toSurface = positionWorld.sub(cameraPosition).normalize()
    const wobble = mx_noise_vec3(p.mul(5).add(vec3(0, time.mul(0.12), 0)))
    const n = normalWorld.add(wobble.mul(0.035)).normalize()
    const reflected = rotateY(toSurface.reflect(n), time.mul(0.07))
    const mirror = pmremTexture(environment, reflected, facing.oneMinus().mul(0.06).add(0.02))
    const bend = near.mul(0.05).add(0.02)
    const through = (k: number) => pmremTexture(environment, rotateY(toSurface.refract(n, float(1).sub(bend.mul(k))), time.mul(-0.11)), float(0.02))
    const window = vec3(through(0.5).x, through(1).y, through(1.5).z).mul(vec3(0.85, 0.95, 1.1))
    const veilNoise = mx_fractal_noise_float(p.mul(3).add(vec3(time.mul(0.05), 0, 0)), 3, 2, 0.5).mul(0.12)
    const threshold = near.mul(0.42).add(0.22)
    const aperture = facing.add(veilNoise)
    const openness = aperture.smoothstep(threshold.sub(0.1), threshold.add(0.1))
    const edge = aperture.sub(threshold).div(0.035).pow(2).negate().exp()
    const edgeColor = mix(color(hsl.integer(202, 99, 89)), color(hsl.integer(0, 0, 100)), intimate)
    this.colorNode = color(hsl.integer(0, 0, 0))
    this.metalness = 1
    this.roughness = 1
    this.emissiveNode = mix(mirror, window, openness).add(edgeColor.mul(edge).mul(near.mul(0.6).add(0.4)).mul(1.2))
  }
}
