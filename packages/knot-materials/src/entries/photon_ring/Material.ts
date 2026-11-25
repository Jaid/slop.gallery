import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_fractal_noise_float, mx_noise_float, select, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {starfield} from '../../lib/starfield.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

// The accretion disk is evaluated by actually intersecting the escaping ray with the equatorial
// plane, so it has a real inner edge, a real Keplerian temperature gradient, and a real Doppler
// asymmetry. The turbulence is sampled in the co-rotating frame with omega ∝ r^-3/2, which shears
// the inner rings away from the outer ones exactly as a real disk does.
function accretionDisk(origin: Node<'vec3'>, ray: Node<'vec3'>, toEye: Node<'vec3'>, detail: Node<'float'>) {
  const denom = ray.y
  const travel = origin.y.negate().div(select(denom.abs().lessThan(0.006), float(0.006), denom))
  const hit = origin.add(ray.mul(travel))
  const radius = hit.length()
  const front = travel.smoothstep(0, 0.03)
  const annulus = radius.smoothstep(0.3, 0.42).mul(radius.smoothstep(2.3, 1.45))
  const azimuth = mx_atan2(hit.z, hit.x.add(0.000001)) as unknown as Node<'float'>
  const omega = float(1.25).div(radius.pow(1.5).max(0.3))
  const shear = azimuth.sub(time.mul(omega))
  const swirl = vec3(shear.cos().mul(radius), shear.sin().mul(radius), 0).mul(5.4)
  const coarse = mx_fractal_noise_float(swirl, 4, 2.1, 0.55).mul(0.5).add(0.5)
  const fine = mx_fractal_noise_float(swirl.mul(3.2).add(vec3(11.3, 0, 4.7)), 3, 2.2, 0.5).mul(0.5).add(0.5)
  const turbulence = coarse.mul(0.62).add(fine.mul(detail.mul(0.6).add(0.4)).mul(0.38))
  const temperature = radius.reciprocal().pow(0.72)
  const hue = mix(color(hsl.integer(32.7, 100, 59.2)), mix(color(hsl.integer(73, 100, 83)), color(hsl.integer(247, 100, 92.3)), temperature.smoothstep(0.8, 1.7)), temperature.smoothstep(0.28, 1.05))
// Relativistic beaming: the side of the disk sweeping toward the eye is far brighter and bluer.
  const orbit = vec3(hit.z, 0, hit.x.negate()).normalize()
  const beta = float(0.44).div(radius.sqrt().max(0.52))
  const doppler = float(1).add(beta.mul(orbit.dot(toEye))).max(0.16)
  const tint = hue.add(color(hsl.integer(242, 100, 84)).mul(doppler.sub(1).max(0).mul(0.5)))
  const density = annulus.mul(front).mul(turbulence.mul(0.55).add(0.55))
  const halo = radius.smoothstep(0.24, 0.55).mul(radius.smoothstep(3.6, 0.9)).mul(front).mul(0.16)
  return {
    density,
    emission: tint.mul(density).mul(doppler.pow(2.7)).mul(3),
    halo: tint.mul(halo),
  }
}

/** A knot of curved spacetime. The surface is a black mirror, but the sky it shows is bent: rays that pass close to the center are dragged sideways, so the background wraps into a ring and the accretion disk is smeared into an arc that no straight line of sight could produce. The disk is intersected analytically, spins at Keplerian speed, and blazes on the side sweeping toward you. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const {p, view, facing, rim, near, intimate} = viewerFrame()
    const toEye = view
    const escape = view.negate()
// Impact parameter of the escaping ray: how close it passes to the
// singularity. Zero means it goes straight through the shadow.
    const offset = p.sub(escape.mul(p.dot(escape)))
    const b = offset.length()
    const radial = offset.div(b.max(0.0001))
    const pull = float(0.15).div(b.max(0.07))
    const sky = escape.add(radial.mul(pull)).normalize()
    const disk = accretionDisk(p, sky, toEye, intimate)
// The lensed background: sparse stars, and a faint violet haze that
// thickens toward the shadow where the sky is compressed.
    const stars = starfield(sky, 190, 0.86)
    // Fractal octaves can exceed [-1, 1]; bound the remap before fractional powers.
    const haze = mx_fractal_noise_float(sky.mul(4.2), 4, 2.1, 0.55).mul(0.5).add(0.5).clamp()
    const hazeColor = mix(color(hsl.integer(296, 76, 19)), color(hsl.integer(290, 100, 58)), haze.pow(1.5))
    const compression = float(0.35).div(b.max(0.08)).min(2.6)
// The photon ring: light that orbited the singularity before leaving.
    const ring = facing.div(0.13).clamp(0, 1).oneMinus().pow(1.3)
    const ringGrain = mx_noise_float(sky.mul(9)).mul(0.5).add(0.5)
    const photon = color(hsl.integer(260, 100, 95)).mul(ring).mul(ringGrain.mul(0.5).add(0.6)).mul(2.6)
// The mirror body itself: a black glass that only shows the studio.
    const body = mix(color(hsl.integer(301, 41, 3)), color(hsl.integer(288, 68, 13)), mx_noise_float(p.mul(6)).mul(0.5).add(0.5))
// Frame dragging: the mirror itself is slowly wound around the axis.
    const azimuth = mx_atan2(p.z, p.x.add(0.000001)) as unknown as Node<'float'>
    const drag = azimuth.add(p.y.mul(7)).add(time.mul(0.12)).sin().mul(0.5).add(0.5)
    this.colorNode = mix(mix(body, color(hsl.integer(289, 76, 24)), drag.mul(0.35)), color(hsl.integer(288, 74, 19)), disk.density.mul(0.35).add(ring.mul(0.25)))
    this.metalness = 1
    this.roughnessNode = float(0.035).add(haze.mul(0.03)).add(disk.density.mul(0.04))
    this.clearcoat = 0.4
    this.clearcoatRoughness = 0.02
    const glow: Node<'vec3'> = disk.emission
      .add(disk.halo.mul(0.7))
      .add(stars.mul(color(hsl.integer(256, 100, 79.4))).mul(compression.mul(0.5).add(0.5)).mul(2.4))
      .add(hazeColor.mul(haze.mul(0.5)).mul(compression.mul(0.45).add(0.3)))
      .add(photon)
      .add(color(hsl.integer(286, 99, 53)).mul(rim).mul(0.07))
      .add(color(hsl.integer(261, 100, 92)).mul(ring).mul(near).mul(0.35))
    this.emissiveNode = glow
  }
}
