import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {ramp} from '../../candidates/deepseek/lib/ramp.ts'
import {knotCircumference, knotLength, tubeMetric} from '../../candidates/deepseek/lib/tubeMetric.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Bessel-like plate modes, written with travelling phases so the figure breathes instead of ticking between integers. */
const chladni = (u: Node<'float'>, v: Node<'float'>, n: number, m: number, phase: Node<'float'>, offset: number) => {
  const a = u.mul(TAU * n).add(phase).add(offset).cos().mul(v.mul(TAU * m).cos())
  const b = u.mul(TAU * m).add(phase.mul(0.73)).add(offset * 1.9).cos().mul(v.mul(TAU * n).cos())
  return a.sub(b)
}
/**
 * A singing bronze plate dusted with sand. Four periodic Chladni modes drift
 * through one another; sand gathers on the quiet nodal lines, individual grains
 * catch the studio lights, and the metal under the dust is engine-turned bronze.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.2)
    this.name = knotData.id
    const {grazing, near, intimate} = viewerFrame()
    const metric = tubeMetric(uv())
    const u = metric.x.div(knotLength)
    const v = metric.y.div(knotCircumference)
    const phase = time.mul(0.105)
    const modeA = chladni(u, v, 7, 3, phase, 0)
    const modeB = chladni(u, v, 9, 2, phase.mul(0.87), 1.7)
    const modeC = chladni(u, v, 5, 4, phase.mul(1.13), 3.4)
    const modeD = chladni(u, v, 11, 3, phase.mul(0.71), 5.1)
    const blend = phase.mul(0.11).sin().mul(0.5).add(0.5)
    const field = mix(modeA, modeB, blend).add(modeC.mul(0.11)).add(modeD.mul(0.055))
    const footprint = field.fwidth().max(0.0002)
// Sand is a powder, not paint: a wide soft halo, a dense ridge, then gaps between grains.
// Normalize the field by its screen-space gradient: this measures the
// distance to the nodal line in pixels, so the sand ridge keeps a readable
// width whether the line is steep or shallow.
    const pixelDistance = field.abs().div(footprint)
    const ridge = ramp(pixelDistance, 7, 0.4)
    const halo = ramp(pixelDistance, 34, 5).mul(0.12)
    const lineResolved = footprint.smoothstep(0.035, 0.09).oneMinus()
    const grainScale = metric.mul(220)
    const grainNoise = mx_noise_float(vec3(grainScale, 6.2)).mul(0.5).add(0.5)
    const microGrain = mx_noise_float(vec3(metric.mul(520), 9.1)).mul(0.5).add(0.5)
    const resolved = footprint.smoothstep(0.006, 0.024).oneMinus()
    const grain = grainNoise.mul(0.55).add(microGrain.mul(0.45)).mul(resolved.mul(0.8).add(0.2))
    const sandCoverage = mx_noise_float(vec3(metric.x.mul(2.2), metric.y.mul(4.7), time.mul(0.03))).mul(0.14).add(0.92)
    const sand = mix(float(0.18), ridge.mul(grain.smoothstep(0.08, 0.62)).add(halo), lineResolved).mul(sandCoverage).clamp(0, 1)
// The plate itself: dark oxidized bronze, circular lathe marks and a faint green patina.
    const patinaNoise = mx_noise_float(vec3(metric.x.mul(3.1), metric.y.mul(7.3), 2.4)).mul(0.5).add(0.5)
    const lathe = metric.y.div(0.13).mul(310).add(mx_noise_float(vec3(metric.mul(9), 3.7)).mul(2)).sin().mul(0.5).add(0.5)
    const latheResolved = footprint.mul(6).smoothstep(0.02, 0.11).oneMinus()
    const patina = patinaNoise.smoothstep(0.55, 0.9).mul(0.55)
    const bronze = mix(color(hsl.integer(62, 57, 30)), color(hsl.integer(73, 55, 67)), patinaNoise.mul(0.55).add(0.2))
    const oxidized = mix(bronze, color(hsl.integer(180, 44, 30)), patina.mul(0.55))
    const plateColor = oxidized.mul(lathe.mul(latheResolved).mul(0.12).add(0.9))
    const sandColor = mix(color(hsl.integer(84, 35, 69)), color(hsl.integer(91, 64, 93.5)), grain)
    const surface = mix(plateColor, sandColor, sand.mul(0.92))
    this.colorNode = surface
    this.metalnessNode = mix(float(0.88), float(0), sand)
    this.roughnessNode = mix(float(0.21).add(patina.mul(0.25)).add(lathe.mul(latheResolved).mul(0.04)), float(0.86), sand)
// A slow shiver of the plate: the sand ridges breathe with the standing wave.
    const shiver = field.mul(0.00024).mul(time.mul(2.1).sin())
    const height = sand.mul(0.00135).add(lathe.mul(latheResolved).mul(0.00018)).add(shiver)
    this.normalNode = detailNormal(normalViewGeometry, height, 1)
    this.anisotropy = 0.42
    this.anisotropyNode = vec2(1, 0).mul(mix(float(0.7), float(0.1), sand))
    this.clearcoat = 0.18
    this.clearcoatRoughness = 0.12
    this.aoNode = sand.mul(0.08).add(0.92)
    const grainGlint = glints(normalViewGeometry, 1500).mul(sand).mul(near.mul(0.7).add(0.3)).mul(0.65)
    const sandGlow = color(hsl.integer(86, 100, 92)).mul(sand).mul(0.12).mul(near.mul(0.4).add(0.6))
    const resonance = color(hsl.integer(79, 100, 88)).mul(ridge).mul(0.06).mul(intimate.mul(0.6).add(0.2)).mul(phase.mul(1.7).sin().mul(0.35).add(0.65))
    const edgeGlow = color(hsl.integer(77, 100, 85)).mul(grazing.pow(3)).mul(0.08)
    this.emissiveNode = color(hsl.integer(91, 100, 95.3)).mul(grainGlint).add(sandGlow).add(resonance).add(edgeGlow)
  }
}
