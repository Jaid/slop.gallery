import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, normalWorld, reflectVector, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {starfield} from '../../lib/starfield.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A void that swallows the room. Stars from the reflection direction are dragged into a lensing halo around the silhouette, a photon ring tightens as you approach, and the ring is Doppler-shifted: the side orbiting toward you burns blue-white, the side receding smoulders red. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    this.envMapIntensity = 0.2
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const lensed = reflectVector.add(normalWorld.mul(grazing.pow(3).mul(0.8))).normalize()
    const stars = starfield(lensed, 46, 0.958)
    const halo = facing.smoothstep(0.22, 0.68).oneMinus()
    const ringCentre = near.mul(-0.05).add(0.17)
    const ringWidth = near.mul(-0.045).add(0.085)
    const photonRing = facing.sub(ringCentre).div(ringWidth).abs().pow(2).negate().exp()
    const secondRing = facing.sub(ringCentre.mul(0.5)).div(ringWidth.mul(0.35)).abs().pow(2).negate().exp().mul(intimate)
    const doppler = vec3(0, 1, 0).cross(p).normalize().dot(view).mul(0.5).add(0.5)
    const plasma = mix(color(hsl.integer(32.6, 100, 59.5)), color(hsl.integer(250, 100, 90)), doppler.pow(1.5))
    const beaming = doppler.mul(1.8).add(0.3)
    const turbulence = mx_noise_float(vec3(p.x.mul(6), p.y.mul(40).add(time.mul(1.3)), p.z.mul(6))).mul(0.3).add(0.85)
    this.colorNode = color(hsl.integer(0, 0, 0))
    this.metalness = 0.25
    this.roughness = 0.9
    this.clearcoat = 0.6
    this.clearcoatRoughness = 0.15
    this.emissiveNode = stars.mul(halo).mul(near.mul(0.7).add(0.6)).add(plasma.mul(photonRing).mul(beaming).mul(turbulence).mul(intimate.mul(0.9).add(0.8))).add(color(hsl.integer(69, 100, 93.7)).mul(secondRing).mul(beaming).mul(0.9)).add(plasma.mul(grazing.pow(7)).mul(beaming).mul(0.18))
  }
}
