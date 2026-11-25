import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, float, mix, mx_noise_float, mx_noise_vec3, normalLocal, normalViewGeometry, normalWorldGeometry, positionGeometry, positionWorld, time, uv, vec2, vec3} from 'three/tsl'

import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

// One draped harmonic: `ku` cycles along the knot, `kv` around the tube, a phase, an amplitude and
// a drift rate. Integer cycle counts keep the cloth seamless across both UV wraps.
type Harmonic = readonly [ku: number, kv: number, phase: number, amplitude: number, rate: number]
const drapeHarmonics: ReadonlyArray<Harmonic> = [[2, 1, 5.6, 0.34, 0.031], [3, 1, 0.4, 0.5, -0.019], [5, 2, 2.1, 0.28, 0.013], [7, 3, 4.2, 0.15, -0.008]]
const wrinkleHarmonics: ReadonlyArray<Harmonic> = [[13, 4, 1.1, 0.42, 0.024], [19, 6, 3.3, 0.3, -0.015], [23, 7, 5.5, 0.2, 0.009], [29, 8, 0.9, 0.14, -0.006]]
/** The nap runs around the tube, so its harmonics climb far faster along the knot than around it. */
const pileHarmonics: ReadonlyArray<Harmonic> = [[200, 8, 0.7, 0.5, 0.05], [264, 12, 2.9, 0.3, -0.03], [332, 16, 4.1, 0.2, 0.02]]
function weave(u: Node<'float'>, v: Node<'float'>, clock: Node<'float'>, harmonics: ReadonlyArray<Harmonic>, filtered = false) {
  let value: Node<'float'> = float(0)
  let slopeU: Node<'float'> = float(0)
  let slopeV: Node<'float'> = float(0)
  let norm = 0
  for (const [ku, kv, phase, amplitude, rate] of harmonics) {
    const angle = u.mul(TAU * ku).add(v.mul(TAU * kv)).add(phase).add(clock.mul(rate))
    const weight = filtered ? angle.fwidth().smoothstep(0.6, 3).oneMinus().mul(amplitude) : float(amplitude)
    value = value.add(angle.sin().mul(weight))
    slopeU = slopeU.add(angle.cos().mul(weight).mul(TAU * ku))
    slopeV = slopeV.add(angle.cos().mul(weight).mul(TAU * kv))
    norm += Math.abs(amplitude)
  }
  return {
    slopeU: slopeU.div(norm),
    slopeV: slopeV.div(norm),
    value: value.div(norm),
  }
}
/** Circular coordinates make the textile noise agree at both UV wraps. */
function clothCoordinate(u: Node<'float'>, v: Node<'float'>, along: number, around: number) {
  const a = u.mul(TAU)
  const b = v.mul(TAU)
  return vec3(a.cos().mul(along), a.sin().mul(along).add(b.cos().mul(around)), b.sin().mul(around)).div(TAU)
}
// The exhibition key light, in world space. The pile sheen is tied to it, not to the screen, so it
// sweeps across the folds as the viewer circles instead of sticking to the camera.
const keyLight = vec3(-3, 9, -16).normalize()
/** Velvet. A silk pile standing on end: head on, almost every ray is swallowed by the fibres and the cloth reads as near black. At a grazing glance the pile tips light up along their length and the whole surface blooms into oxblood. The folds are real geometry, so the silhouette scallops, and the sheen slides across them as you walk. Gold thread is sewn along the highest crests only. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const tube = uv()
    const u = tube.x
    const v = tube.y
    const {grazing, rim, near, intimate} = viewerFrame()
    const drape = weave(u, v, time, drapeHarmonics)
    const wrinkle = weave(u, v, time, wrinkleHarmonics)
    const pile = weave(u, v, time, pileHarmonics, true)
// Real folds: geometry moves, and the shading normal is the first
// order normal of exactly that displaced surface.
    const foldHeight: Node<'float'> = drape.value.mul(0.023).add(wrinkle.value.mul(0.0072))
    const pileHeight: Node<'float'> = pile.value.mul(0.0017).mul(near.mul(0.75).add(0.25))
    this.positionNode = positionGeometry.add(normalLocal.mul(foldHeight))
    this.normalNode = proceduralNormal(foldHeight.add(pileHeight), 1)
    const crest = drape.value.smoothstep(0.3, 0.95)
    const patina = mx_noise_float(clothCoordinate(u, v, 17, 5)).mul(0.5).add(0.5)
    const worn = mx_noise_float(clothCoordinate(u, v, 3.4, 2.1).add(9.3)).mul(0.5).add(0.5)
// Head on the cloth is a tomb; the color only arrives as the pile tips
// turn edge-on and scatter the light back out again.
    const dye = mix(color(hsl.integer(0, 74, 8)), color(hsl.integer(14, 83, 17)), worn.mul(0.6).add(0.1))
    const bloom = grazing.pow(1.05).add(crest.mul(0.07)).clamp()
    const clothColor: Node<'vec3'> = mix(dye, mix(color(hsl.integer(20, 94, 32)), color(hsl.integer(18, 86, 57)), crest.mul(0.4).add(0.1)), bloom)
// Gold thread follows the crest of the drape and only where the cloth
// was embroidered at all, so the pattern reads as needlework.
    const ridgeField = filteredRibbon(drape.slopeU, 0.05)
    const threadGate = crest.pow(2).mul(mx_noise_float(clothCoordinate(u, v, 7, 3).add(21.7)).mul(0.5).add(0.5).smoothstep(0.45, 0.8))
    const thread = ridgeField.mul(threadGate)
    const threadTwist = mx_noise_float(clothCoordinate(u, v, 220, 20)).mul(0.5).add(0.5)
    this.colorNode = mix(clothColor, mix(color(hsl.integer(75, 85, 56)), color(hsl.integer(94, 100, 95.3)), threadTwist), thread)
    this.metalnessNode = thread.mul(0.95)
    this.roughnessNode = mix(float(0.5).add(patina.mul(0.14)).sub(crest.mul(0.06)), float(0.32).add(threadTwist.mul(0.2)), thread)
    this.specularIntensityNode = float(0.3)
    this.sheenNode = mix(color(hsl.integer(22, 93, 50.6)), color(hsl.integer(13, 100, 87)), crest.mul(0.35).add(0.25))
    this.sheenRoughnessNode = float(0.7).add(wrinkle.value.abs().mul(0.12))
// The nap leans around the tube, which is exactly the bitangent.
    this.anisotropyNode = vec2(0, mix(float(0.45), float(0.85), crest).mul(near.mul(0.3).add(0.7)))
// ---------------------------------------------------------------
// The pile sheen itself. A real Charlie lobe is far too narrow for a
// fibre forest, so the broad lobe of the exhibition key light is
// evaluated against the *world* normal: the crimson core of the sheen
// goes white-hot where the fibres stand almost edge-on.
// ---------------------------------------------------------------
    const toEye = cameraPosition.sub(positionWorld).normalize()
    const half = keyLight.add(toEye).normalize()
    const lobe = normalWorldGeometry.dot(half).clamp()
    const sheenLobe = lobe.pow(7).mul(0.62).add(lobe.pow(2.2).mul(0.38)).mul(grazing.pow(1.35).mul(0.7).add(0.3))
    const sheenTint = mix(color(hsl.integer(22.6, 100, 58.4)), color(hsl.integer(38, 100, 96.5)), grazing.pow(2.2))
    const sheen = sheenTint.mul(sheenLobe).mul(2.3)
// Lint and dust caught in the pile, visible only once the fibres resolve.
    const lintCoordinate = clothCoordinate(u, v, 900, 60)
    const lintVisibility = lintCoordinate.fwidth().length().smoothstep(0.25, 1).oneMinus()
    const lintNormal = normalViewGeometry.add(mx_noise_vec3(lintCoordinate).mul(0.8)).normalize()
    const lint = glints(lintNormal, 120).mul(lintVisibility).mul(near).mul(0.5)
    const glow: Node<'vec3'> = sheen
      .add(color(hsl.integer(49, 100, 89)).mul(lint).mul(0.7))
      .add(color(hsl.integer(24, 97.6, 51)).mul(bloom.pow(2)).mul(rim).mul(0.16))
      .add(color(hsl.integer(75, 100, 86)).mul(thread).mul(grazing.pow(2)).mul(intimate.mul(0.4).add(0.12)))
    this.emissiveNode = glow
  }
}
