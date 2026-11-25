import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, negateOnBackSide, normalLocal, normalViewGeometry, transformNormalToView, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Layered value noise in the −1…1 range of `mx_noise_float`, normalized by total amplitude. */
const fbm = (position: Node<'vec3'>, octaves = 2) => {
  let sum: Node<'float'> = float(0)
  let amplitude = 1
  let frequency = 1
  let norm = 0
  for (let octave = 0; octave < octaves; octave++) {
    sum = sum.add(mx_noise_float(position.mul(frequency)).mul(amplitude))
    norm += amplitude
    amplitude *= 0.55
    frequency *= 2.07
  }
  return sum.div(norm)
}

/** Polished feldspar with a buried aurora. Every crystal grain tilts its lamella plane a little away from the surface, so a grain stays charcoal-black until the halfway direction between viewer and key light aligns with that plane — then the whole grain ignites, sweeps blue → teal → gold as the alignment tightens, and dies again. Twin lamellae stripe the flash, each grain breaks the polish with its own tiny tilt, and cleavage dust sparkles only at reading distance. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    const {p, view, facing, near} = viewerFrame()
    const surfaceNormal = normalLocal.normalize()
    // Crystal grains on a noise-warped lattice: one identity, tilt and hue family per grain.
    // The schiller plates sit a breath below the polish, so they drift as you move.
    const inner = p.sub(view.mul(0.025))
    const warp = vec3(mx_noise_float(inner.mul(2.6).add(31)), mx_noise_float(inner.mul(2.6).add(57)), mx_noise_float(inner.mul(2.6))).mul(1.3).add(vec3(mx_noise_float(inner.mul(7).add(71)), mx_noise_float(inner.mul(7).add(97)), mx_noise_float(inner.mul(7))).mul(0.18))
    const cellCoord = inner.mul(3.8).add(warp).add(vec3(mx_noise_float(inner.mul(16).add(3)), mx_noise_float(inner.mul(16).add(23)), mx_noise_float(inner.mul(16))).mul(0.07))
    const cell = cellCoord.floor()
    const identity = cellNoiseVec3(cell)
    const identity2 = cellNoiseVec3(cell.add(17.3))
    const lamellaNormal = surfaceNormal.add(identity.mul(2).sub(1).mul(0.7)).normalize()
    const stripeDir = lamellaNormal.cross(vec3(0.31, 0.87, 0.39)).normalize()
    // Schiller ignition under two gallery lights: a broad halo that warns first, then a
    // hot core as alignment peaks. Each grain keeps its own hue family while it burns.
    const stripePhase = inner.dot(stripeDir).mul(90).add(identity2.x.mul(40)).add(mx_noise_float(inner.mul(8)).mul(6))
    const bands = opticalBands(stripePhase)
    const twin = bands.mul(2).sub(1).mul(1.5).max(-1).min(1)
    const ramp = (t: Node<'float'>) => mix(
      mix(color(hsl.integer(264.5, 94.5, 36)), color(hsl.integer(180, 97, 68)), t.smoothstep(0.38, 0.64)),
      mix(color(hsl.integer(94, 82, 76)), color(hsl.integer(64, 100, 74.7)), t.smoothstep(0.86, 1)),
      t.smoothstep(0.64, 0.86),
    )
    const ignition = (lightDir: Node<'vec3'>, gateSeed: Node<'float'>, hueShift: number) => {
      const alignment = lamellaNormal.dot(view.add(lightDir).normalize()).clamp()
      const gate = gateSeed.smoothstep(0.1, 0.32)
      const flash = alignment.pow(20).mul(1.6).add(alignment.pow(5).mul(0.3)).mul(gate).mul(twin.mul(0.14).add(0.86)).mul(facing.mul(0.6).add(0.4)).clamp()
      const hueRun = identity2.y.mul(0.55).add(alignment.mul(0.2)).add(twin.mul(0.04)).add(hueShift)
      return {
        flash,
        tint: ramp(hueRun),
      }
    }
    const key = ignition(vec3(-0.18, 0.54, -0.97).normalize(), identity2.z, 0)
    const fill = ignition(vec3(0.55, -0.05, 0.82).normalize(), identity.z, 0.18)
    const crown = ignition(vec3(0.2, 0.9, 0.3).normalize(), identity.y, -0.08)
    // Charcoal-blue stone, clouded and darkened along the grain seams.
    const cloud = fbm(p.mul(2.3)).mul(0.5).add(0.5)
    const base = mix(mix(color(hsl.integer(262, 23, 8)), color(hsl.integer(257, 33, 14)), identity.x), color(hsl.integer(262, 38, 11)), cloud.mul(0.55))
    const fractCoord = cellCoord.fract()
    const toFace = fractCoord.min(fractCoord.oneMinus())
    const seamField = toFace.x.min(toFace.y).min(toFace.z)
    const seamAa = seamField.fwidth().min(0.035)
    const seam = seamField.smoothstep(seamAa.add(0.002), seamAa.add(0.02)).oneMinus()
    const fracture = filteredRibbon(cellularBoundary(inner.add(warp.mul(0.3)).mul(12.5)), 0.02).mul(near)
    let stone = mix(base, color(hsl.integer(264, 21, 6.5)), seam.mul(0.16))
    stone = mix(stone, key.tint, key.flash.mul(0.92))
    stone = mix(stone, fill.tint, fill.flash.mul(0.6))
    stone = mix(stone, crown.tint, crown.flash.mul(0.45))
    // Fractures cut through the buried flash, never the other way around.
    stone = mix(stone, color(hsl.integer(254, 19, 4)), fracture.mul(key.flash.mul(0.25).add(0.75)).mul(0.3))
    this.colorNode = stone
    this.metalness = 0
    this.roughnessNode = mix(float(0.08), float(0.38), seam).sub(key.flash.mul(0.04)).max(0.04)
    this.clearcoat = 0.9
    this.clearcoatRoughness = 0.05
    this.aoNode = float(1).sub(seam.mul(0.25)).sub(fracture.mul(0.2))
    // Each grain tilts the polish by its own few degrees, so highlights break at the seams.
    const grainTilt = identity2.mul(2).sub(1)
    const shadingNormal = surfaceNormal.add(grainTilt.sub(surfaceNormal.mul(grainTilt.dot(surfaceNormal))).mul(0.16)).normalize()
    this.normalNode = negateOnBackSide(transformNormalToView(shadingNormal))
    // The flash is reflected light, not fire: a strong lift so ignited grains burn through
    // shadow too, plus dry cleavage sparkle that resolves only at reading distance.
    const sparkle = glints(normalViewGeometry, 120).mul(near).mul(key.flash.mul(0.7).add(0.3))
    // Schiller platelets glitter inside the ignited grains at reading distance.
    const platelets = cellularPoints(inner.mul(70), 0.03, 0.14, 0.55).mul(key.flash.add(fill.flash)).mul(near)
    this.emissiveNode = key.tint.mul(key.flash).mul(1.15)
      .add(fill.tint.mul(fill.flash).mul(0.7))
      .add(crown.tint.mul(crown.flash).mul(0.5))
      .add(color(hsl.integer(255, 100, 90)).mul(sparkle).mul(facing).mul(1.1))
      .add(color(hsl.integer(258, 100, 92)).mul(platelets).mul(1.6))
  }
}
