import type {Node, Texture} from 'three/webgpu'

import {float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionViewDirection, time, transformNormalToView, vec3} from 'three/tsl'

import {environmentHighlight} from '../../candidates/claude_fable/lib/environmentHighlight.ts'
import {fresnel, inclusions, interiorRay, interiorSheets, interiorSky} from '../../candidates/claude_fable/lib/interiorRay.ts'
import {proceduralNormal} from '../../candidates/claude_fable/lib/proceduralNormal.ts'
import {rgb} from '../../candidates/claude_fable/lib/rgb.ts'
import {viewerFrame} from '../../candidates/claude_fable/lib/viewerFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import knotData from './data.ts'

const iceIndex = 1.31
/** Ice absorbs red first; over the chord of the tube this leaves the deep blue of a crevasse. */
const absorption = vec3(14, 4.6, 1.7)
/** View-space studio lamps, matching the shared glint helper. */
const lamps = [vec3(0.35, 0.78, 0.52), vec3(-0.62, 0.28, 0.73), vec3(0.1, -0.35, 0.93)]
/** Beyond the critical angle of an ice–air gap (≈ 49.8°) a fracture becomes a perfect mirror. */
const criticalCosine = Math.sqrt(1 - 1 / (iceIndex * iceIndex))
/** Glacier ice. The eye's ray is refracted into the surface and interior layers are sampled along it, so trapped air bubbles and internal fracture planes have real parallax and slide against the surface as the viewer walks by. Fracture planes are thin ice–air gaps: they flash white when the refracted ray meets them beyond the critical angle, exactly like the sheets of light that wink inside real ice. Frost gathers on upward faces and at the limb; a warm pulse keeps time within. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const ray = interiorRay(iceIndex, n)
// The chord the light travels through the tube: long at normal incidence, short at the limb.
    const chord = ray.cosRefracted.mul(0.26).add(0.03)
    const bodyColor = absorption.mul(chord).negate().exp()
    const attenuate = (depth: number) => absorption.mul(depth * 2).negate().exp()
// Air bubbles: three depth layers, each with its own scale and absorption on the way back out.
    let bubbles: Node<'vec3'> = vec3(0)
    const bubbleLayers: Array<[depth: number, scale: number, radius: number]> = [[0.01, 58, 0.2], [0.03, 30, 0.22], [0.07, 17, 0.25]]
    for (const [depth, scale, radius] of bubbleLayers) {
      const q = ray.at(depth).mul(scale).add(depth * 91)
      const {mask, cap} = inclusions(q, radius)
// An air sphere in ice reflects at its rim and lets the light through its center.
      const rim = cap.oneMinus().pow(2)
      const body = mix(float(0.22), float(1), rim).mul(mask)
      const sparkle = cap.sub(0.55).abs().smoothstep(0.12, 0).mul(mask).mul(0.6)
      bubbles = bubbles.add(attenuate(depth).mul(body.add(sparkle)))
    }
// Fracture planes: sheets with true parallax, mirrored beyond the critical angle and lit by the lamps they reflect.
    let fractures: Node<'vec3'> = vec3(0)
    for (const [scale, depthRange, seed, keep] of [[9, [0.008, 0.05], 11, 0.14], [6, [0.03, 0.11], 17, 0.1]] as const) {
      const sheet = interiorSheets(ray, scale, [...depthRange], seed, keep)
      const mirror = sheet.cosIncidence.smoothstep(criticalCosine + 0.12, criticalCosine).mul(0.85).add(fresnel(sheet.cosIncidence, 0.02).mul(0.6))
      const planeView = transformNormalToView(sheet.planeNormal)
      let glint: Node<'float'> = float(0)
      for (const lamp of lamps) {
        const half = lamp.normalize().add(positionViewDirection).normalize()
        glint = glint.add(planeView.dot(half).abs().pow(32))
      }
      const reflected = ray.refracted.reflect(sheet.planeNormal)
      const light = interiorSky(reflected).mul(mirror).add(glint.mul(1.4))
      fractures = fractures.add(attenuate(depthRange[0]).mul(sheet.mask).mul(light))
    }
// Frost: rime on upward faces and where the surface turns away from the viewer.
    const frostNoise = mx_fractal_noise_float(p.mul(21), 3, 2.1, 0.55).mul(0.5).add(0.5)
    const upward = n.y.mul(0.5).add(0.5)
    const frostCoverage = upward.mul(0.3).add(grazing.pow(1.5).mul(0.5)).add(frostNoise.mul(0.4))
    const frost = frostCoverage.smoothstep(0.62, 0.9)
    const frostGrain = mx_noise_float(p.mul(140)).mul(0.5).add(0.5)
// Surface: slow meltwater ripples plus the fine grain of rime.
    const ripple = mx_noise_float(p.mul(9).add(vec3(0, 0, time.mul(0.02)))).mul(0.6).add(mx_noise_float(p.mul(27)).mul(0.25))
    const surfaceHeight = ripple.mul(0.0035).add(frostGrain.mul(frost).mul(0.0018))
    this.normalNode = proceduralNormal(surfaceHeight, 1)
    const frostColor = rgb('#eef6ff').mul(frostGrain.mul(0.3).add(0.7))
    this.colorNode = mix(bodyColor.mul(0.08), frostColor, frost.mul(0.9))
    this.metalness = 0
    this.ior = iceIndex
    this.roughnessNode = mix(float(0.06), float(0.55), frost).add(ripple.abs().mul(0.03))
    this.clearcoatNode = frost.oneMinus().mul(0.35)
    this.clearcoatRoughness = 0.05
// The heart: a slow warm pulse deep inside, felt only up close and through clear ice.
    const beat = time.mul(0.8).fract()
    const pulse = beat.mul(-5).exp().add(beat.sub(0.22).abs().mul(-9).exp().mul(0.5)).mul(0.6).add(0.15)
    const core = ray.cosRefracted.pow(2).mul(mx_noise_float(p.mul(3).add(vec3(0, time.mul(0.05), 0))).mul(0.5).add(0.5))
    const heart = rgb('#ffb070').mul(pulse).mul(core).mul(intimate.mul(0.8).add(near.mul(0.08))).mul(frost.oneMinus()).mul(0.3)
// Interior light must pass the surface: the Fresnel transmittance dims it at the limb where reflection takes over.
    const transmit = fresnel(facing, 0.02).oneMinus()
    const highlight = environmentHighlight(environment, n, 0.04).mul(fresnel(facing, 0.02)).mul(0.6)
// Light scattered deep in the body: an inner glow that stays saturated where the lights would wash a diffuse surface out.
    const innerGlow = bodyColor.mul(ray.cosRefracted.mul(0.5).add(0.5)).mul(0.04)
    this.emissiveNode = bubbles.add(fractures).add(heart).add(innerGlow).mul(transmit).mul(frost.oneMinus().mul(0.85).add(0.15)).mul(0.9)
      .add(highlight)
      .add(frostColor.mul(frost).mul(grazing.pow(2)).mul(0.06))
  }
}
