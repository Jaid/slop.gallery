import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, float, max, mix, modelWorldMatrix, modelWorldMatrixInverse, mx_fractal_noise_float, mx_noise_float, normalLocal, pmremTexture, positionGeometry, positionWorld, refract, transformDirection, vec3} from 'three/tsl'

import {refractedParallax} from '../../candidates/space_bunny/lib/refractedParallax.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {filament} from '../../lib/filament.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const iceIndex = 1.309
const frostTint = vec3(0.81, 0.9, 0.95)
const glacierBlue = vec3(0.03, 0.26, 0.34)
type Bubble = {
  core: Node<'float'>
  glint: Node<'float'>
  ring: Node<'float'>
}
/** A pocket of air frozen inside the glass. Every bubble is a tiny diverging lens, so it reads as a bright total-internal-reflection rim around a dark heart, with one hard glint where the room lands on its upper cap. The lattice lives in the ice rather than on its surface, so bubbles slide across the crystal as a visitor walks around and never stay welded to the outline. */
const bubbles = (p: Node<'vec3'>, scale: number, seed: number): Bubble => {
  const cell = p.mul(scale).floor()
  const random = cellNoiseVec3(cell.add(vec3(seed, seed * 1.3, seed * 0.7)))
  const nucleus = cell.add(0.5).add(random.sub(0.5).mul(0.8)).div(scale)
  const radius = random.x.mul(0.16).add(0.19).div(scale)
  const distance = p.sub(nucleus).length()
  const foot = distance.fwidth().max(1e-5)
// Once a bubble is smaller than the pixel that covers it, it is a diffuse speckle, not an object.
  const visible = foot.smoothstep(radius.mul(0.9), radius.mul(2.1)).oneMinus()
  const live = random.y.smoothstep(0.4, 0.54)
  const core = live.mul(distance.smoothstep(radius.mul(0.5).sub(foot.mul(0.5)), radius.mul(0.85)).oneMinus()).mul(visible)
  const ring = live.mul(distance.smoothstep(radius.mul(0.5).sub(foot.mul(0.5)), radius.mul(0.85))).mul(distance.smoothstep(radius.mul(1.1), radius.mul(0.86))).mul(visible)
  const glint = live.mul(distance.smoothstep(radius.mul(0.3), radius.mul(0.1).sub(foot.mul(0.4)))).mul(visible)
  return {
    core,
    ring,
    glint,
  }
}
/** Blue ice: nine centuries of snow, compressed until the air had nowhere left to go. Light that enters is refracted into the crystal, absorbed over the length of its path into a deep glacier blue and returned to the eye; trapped bubbles and healed fractures interrupt it, and patches of surface rime frost over the whole thing like breath on a window. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, near, intimate, rim} = viewerFrame()
    const N = normalLocal.normalize()
    const incident = transformDirection(positionWorld.sub(cameraPosition).normalize(), modelWorldMatrixInverse)
    const rimeNoise = mx_fractal_noise_float(p.mul(5.2).add(vec3(3.1, 7.7, 1.4)), 4, 2.12, 0.55).mul(0.5).add(0.5)
    const rimeEdge = mx_noise_float(p.mul(46)).mul(0.5).add(0.5)
    const rime = rimeNoise.add(rimeEdge.mul(0.2)).smoothstep(0.66, 0.82)
// At the critical angle Snell's law collapses to a zero vector; biasing along the normal keeps the
// sampled direction well defined instead of leaving a black hole that swims as the visitor moves.
    const refraction = refract(incident, N, 1 / iceIndex).add(N.mul(0.03)).normalize()
    const blur = mix(float(0.05), float(0.3), rime).sub(intimate.mul(0.02))
    const room = pmremTexture(environment, transformDirection(refraction, modelWorldMatrix), blur)
    const path = float(1.7).div(N.dot(incident.negate()).abs().max(0.22))
// Beer–Lambert by hand: three's own attenuation only applies to a transmissive material, and here the
// crystal returns its light through the emissive path, not through a refraction pass.
    const absorption = vec3(3.6, 1.35, 0.62).mul(path.mul(0.2).add(0.3))
    const tint = absorption.negate().exp()
    const deep = mx_fractal_noise_float(p.mul(9).add(vec3(1.7, 4.3, 8.1)), 3, 2.2, 0.5).mul(0.5).add(0.5)
    const milk = deep.mul(0.5).add(0.5).mul(path.mul(0.06))
    const scatter = float(0.5).sub(rime.mul(0.34))
    const body = room.mul(tint).mul(scatter).add(glacierBlue.mul(milk.mul(0.9).add(0.09)))
    const inside = refractedParallax(p, N, view, 0.055, iceIndex)
    const large = bubbles(inside, 13, 3.7)
    const small = bubbles(refractedParallax(p, N, view, 0.03, iceIndex), 34, 17.3)
    const core = max(large.core, small.core.mul(near.mul(0.9).add(0.1)))
    const ring = max(large.ring, small.ring.mul(0.85))
    const sparkle = max(large.glint, small.glint.mul(0.8))
    const fractureField = mx_fractal_noise_float(inside.mul(1.7).add(vec3(6.1, 2.3, 4.8)), 2, 2.2, 0.5)
    const crackGate = mx_noise_float(inside.mul(2.9).add(vec3(0.7, 5.3, 2.1))).mul(0.5).add(0.5).smoothstep(0.56, 0.68)
    const fracture = filament(fractureField, 0.0045).mul(crackGate).mul(fractureField.fwidth().smoothstep(0.08, 0.32).oneMinus())
    const glaze = mix(body, room.mul(0.1).add(0.09).mul(frostTint), rime.mul(0.8))
    const lit = glaze.mul(core.oneMinus()).add(ring.mul(0.55)).add(sparkle.mul(0.8)).add(fracture.mul(0.22))
    this.colorNode = mix(vec3(0.008, 0.024, 0.032), frostTint.mul(0.46), rime.mul(0.92))
    this.metalness = 0
    this.roughnessNode = mix(float(0.08), float(0.62), rime).add(fracture.mul(0.2)).add(ring.mul(0.3)).clamp(0.03, 0.8)
    this.clearcoatNode = rime.oneMinus().mul(0.4)
    this.clearcoatRoughnessNode = mix(float(0.08), float(0.5), rime)
    this.ior = iceIndex
    this.specularIntensityNode = rime.oneMinus().mul(0.6)
    this.sheenNode = rime.mul(0.55)
    this.sheenColor.set(hsl.integer(243, 100, 93.4))
    this.sheenRoughness = 0.55
    const relief = rime.mul(0.0016).add(fracture.mul(0.0007)).sub(ring.mul(0.0009))
    const bump = proceduralNormal(relief, 1)
    this.normalNode = bump
    this.positionNode = positionGeometry.add(normalLocal.mul(rimeNoise.mul(0.4).sub(0.1).mul(0.0035)))
    const glint = glints(bump, 150).mul(sparkle.mul(0.8).add(rime.mul(0.3))).mul(1.1)
    this.emissiveNode = lit.mul(0.9).add(color(hsl.integer(0, 0, 100)).mul(glint.mul(0.4))).add(color(hsl.integer(222, 74, 63)).mul(rim.mul(0.1)))
  }
}
