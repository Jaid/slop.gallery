import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, Fn, Loop, mix, mx_noise_float, normalLocal, pmremTexture, positionGeometry, vec3, vec4} from 'three/tsl'

import {toWorldDirection} from '../../candidates/claude_sonnet/lib/environmentHighlight.ts'
import {loopPhase, loopTurn} from '../../candidates/claude_sonnet/lib/loopClock.ts'
import {rgb} from '../../candidates/claude_sonnet/lib/rgb.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const steps = 34
/** Tube radius of the knot; a ray entering at grazing incidence crosses much less resin than one going through the axis. */
const tubeRadius = 0.13
/** Per-channel absorption of the resin per object unit: red survives, blue is eaten within a hand's width. */
const absorption = vec3(3.6, 9.2, 22)
const sun = vec3(0.42, 0.78, 0.46).normalize()
/** A sparse 3D lattice of bubbles. Returns `x` = luminous rim, `y` = specular pip, `z` = clear interior. Each bubble wanders on a small closed orbit. */
function bubbles(q: Node<'vec3'>, size: number, seed: number, keep: number) {
  const scaled = q.div(size)
  const cell = scaled.floor()
  const random = cellNoiseVec3(cell.add(seed))
  const random2 = cellNoiseVec3(cell.add(seed + 19.19))
  const phase = loopPhase.add(random.z.mul(TAU))
  const wander = vec3(phase.sin(), phase.add(random2.x.mul(TAU)).cos(), phase.mul(-1).add(random2.y.mul(TAU)).sin()).mul(0.07)
  const center = random.mul(0.4).add(0.3).add(wander)
  const offset = scaled.fract().sub(center)
  const radius = random2.z.pow(2.2).mul(0.24).add(0.075)
  const gate = random2.x.smoothstep(keep, keep + 0.04)
  const unit = offset.length().div(radius)
  const inside = unit.smoothstep(0.94, 1.06).oneMinus().mul(gate)
  const rim = unit.pow(7).mul(inside)
  const pip = offset.div(radius).dot(sun).max(0).pow(18).mul(unit.pow(2)).mul(inside)
  return vec3(rim, pip, inside.mul(unit.pow(7).oneMinus()))
}
/** Emission–absorption march through the resin: the ray is refracted at the surface, then walks the chord of the tube, being eaten by honey-colored absorption, brightened by scattered sunlight, and interrupted by bubbles, dust and cloudy flow layers. Everything is anchored in object space, so inclusions have true parallax against the polished surface. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const p = positionGeometry
    const {view, facing, grazing, near, intimate} = viewerFrame()
    const inward = normalLocal.normalize().negate()
    const incident = view.negate()
    const direction = incident.refract(normalLocal.normalize(), float(1 / 1.55)).normalize()
    const chord = direction.dot(inward).max(0.1).mul(tubeRadius * 2)
    const detail = near.mul(0.6).add(0.4)
    const interior = Fn(() => {
      const radiance = vec3(0).toVar()
      const sparks = vec3(0).toVar()
      const transmittance = vec3(1).toVar()
      const step = chord.div(steps)
      Loop(steps, ({i}) => {
        const t = float(i).add(0.5).div(steps)
        const q = p.add(direction.mul(t.mul(chord)))
// Stress layers: the resin flowed in sheets, so density and cloudiness fold in slow bands.
        const flow = q.dot(vec3(2.1, 5.3, 1.4)).add(mx_noise_float(q.mul(3.1)).mul(2.2)).mul(3.1)
        const layer = flow.sin().mul(0.5).add(0.5)
        const cloud = mx_noise_float(q.mul(5.7).add(9.4)).mul(0.5).add(0.5).smoothstep(0.55, 0.85).mul(layer)
        const density = layer.mul(0.6).add(0.62)
        const big = bubbles(q, 0.085, 0, 0.7)
        const tiny = bubbles(q.add(3.7), 0.034, 41, 0.78).mul(detail)
        const dustCoordinate = q.div(0.014)
        const dust = cellNoiseVec3(dustCoordinate.floor().add(13))
        const dustCenter = cellNoiseVec3(dustCoordinate.floor().add(37)).mul(0.5).add(0.25)
        const dustDistance = dustCoordinate.fract().sub(dustCenter).length()
        const dustFootprint = dustCoordinate.fwidth().length().max(0.001)
        // Dust is a small grain, not an illuminated voxel. Keep its filtered support inside its owning cell.
        const dustGrain = dustDistance.smoothstep(0.1, dustFootprint.add(0.14).min(0.24)).oneMinus()
          .mul(dustFootprint.smoothstep(0.15, 0.6).oneMinus())
        const speck = dustGrain.mul(dust.x.smoothstep(0.985, 1)).mul(dust.y.add(loopPhase.add(dust.z.mul(TAU)).sin().mul(0.5).add(0.5)).mul(0.5))
// A slow shaft of light that sweeps through the resin, once per loop.
        const beam = q.dot(sun).mul(TAU * 1.6).sub(loopTurn.mul(TAU)).cos().mul(0.5).add(0.5).pow(6)
        const scatter = rgb(hsl.integer(62, 100, 74)).mul(density.mul(0.5).add(beam.mul(1.9))).add(rgb(hsl.integer(76, 100, 88.6)).mul(cloud).mul(1.3))
        const bubbleLight = rgb(hsl.integer(81, 100, 91.2)).mul(big.x.mul(1.6).add(big.y.mul(4))).add(rgb(hsl.integer(86, 100, 96.4)).mul(tiny.x.mul(1.3).add(tiny.y.mul(3))))
        const inclusion = bubbleLight.add(rgb(hsl.integer(90, 100, 95)).mul(speck).mul(4))
        radiance.addAssign(transmittance.mul(scatter.mul(step).mul(0.62)))
        sparks.addAssign(transmittance.mul(inclusion.mul(0.16)))
        const clear = big.z.max(tiny.z).mul(0.7)
        transmittance.mulAssign(absorption.mul(density).mul(step).mul(float(1).sub(clear)).negate().exp())
      })
      const behind = pmremTexture(environment, toWorldDirection(direction), float(0.22)).rgb
      return vec4(radiance.add(transmittance.mul(behind).mul(rgb(hsl.integer(75, 100, 88.4))).mul(0.3)).mul(0.42).add(sparks), transmittance.y)
    })()
    const inner = interior.xyz
    const clarity = interior.w
    this.colorNode = mix(rgb(hsl.integer(66, 100, 3)), rgb(hsl.integer(58, 100, 7)), grazing)
    this.metalness = 0
    this.roughness = 0.05
    this.ior = 1.55
    this.clearcoat = 1
    this.clearcoatRoughness = 0.01
    this.iridescence = 0.12
    this.iridescenceIOR = 1.3
    this.iridescenceThicknessMinimum = 200
    this.iridescenceThicknessMaximum = 380
    this.emissiveNode = inner.mul(facing.mul(0.18).add(0.88)).mul(intimate.mul(0.15).add(1))
      .add(rgb(hsl.integer(50, 100, 68)).mul(grazing.pow(3)).mul(clarity.add(0.3)).mul(0.07))
  }
}
