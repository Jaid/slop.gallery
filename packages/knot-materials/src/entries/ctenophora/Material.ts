import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, normalLocal, time, uv, vec3} from 'three/tsl'

import {filteredBox} from '../../candidates/claude_opus/lib/filteredBox.ts'
import {knotFrame} from '../../candidates/claude_opus/lib/knotFrameSurface.ts'
import {knotLength, tubeMetric, tubeTurns} from '../../candidates/claude_opus/lib/tubeMetric.ts'
import {wavelengthColor} from '../../candidates/claude_opus/lib/wavelengthColorLobes.ts'
import {wrap} from '../../candidates/claude_opus/lib/wrap.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Comb rows around the tube, like the eight meridians of a real comb jelly. */
const rows = 8
/** Ctenes per row along the whole knot; a whole number keeps the seam invisible. */
const plates = 260
/** Plates per metachronal wave; divides `plates` so waves also wrap seamlessly. */
const waveLength = 13
/** Diffraction of a beating ctene: a grating tilted by the stroke, seen in first and second order. */
function cteneSpectrum(view: Node<'vec3'>, along: Node<'vec3'>, normal: Node<'vec3'>, tilt: Node<'float'>) {
  const grating = along.mul(tilt.cos()).add(normal.mul(tilt.sin()))
  const path = view.dot(grating).mul(0.5).add(0.5).mul(820).add(300)
  return wavelengthColor(path).add(wavelengthColor(path.mul(0.5)).mul(0.6))
}
/** A living comb jelly: a near-invisible gel whose comb rows sweep rainbows in metachronal waves, with gastrovascular canals that flare blue-green when a visitor leans in. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const n = normalLocal.normalize()
    const {along} = knotFrame(tube)
    const s = tubeMetric(tube).x.div(knotLength)
    const turns = tubeTurns(tube)
// Rows: `across` is 0 on a row’s midline and ±0.5 halfway to the next.
    const rowCoord = turns.mul(rows)
    const rowIndex = wrap(rowCoord.floor(), rows)
    const across = rowCoord.fract().sub(0.5)
    const rowSeed = rowIndex.mul(0.618034).fract()
    const rowFootprint = rowCoord.fwidth()
    const plateCoord = s.mul(plates)
    const plateIndex = plateCoord.floor()
    const plateFootprint = plateCoord.fwidth()
// Metachronal beat: each ctene strokes slightly after its neighbor, so waves of light run along every row.
    const beat = plateIndex.mul(TAU / waveLength).sub(time.mul(TAU * 0.9)).add(rowSeed.mul(TAU))
    const stroke = beat.sin()
    const power = beat.cos().mul(0.5).add(0.5).pow(3)
    const plateMask = filteredBox(plateCoord.fract().sub(0.5), 0.3, plateFootprint).mul(filteredBox(across, 0.115, rowFootprint))
    const spectrum = cteneSpectrum(view, along, n, stroke.mul(0.85))
    const shimmer = power.mul(3.4).add(0.22).mul(facing.mul(0.6).add(0.4))
    const combs = spectrum.mul(plateMask).mul(shimmer).add(color(hsl.integer(239, 100, 83.3)).mul(plateMask).mul(0.04))
// Each row also leaves a faint diffuse halo of scattered rainbow in the gel around it.
    const halo = across.div(0.17).pow2().negate().exp().mul(power.mul(0.5).add(0.15))
    const combHalo = spectrum.mul(halo).mul(0.16)
// Meridional canals beneath the rows, seen a little deeper so they slide beneath the combs as you circle.
    const ray = tubeRay()
    const deepTurns = turns.sub(ray.y.mul(0.035))
    const deepAcross = deepTurns.mul(rows).fract().sub(0.5)
    const canal = deepAcross.div(0.06).pow2().negate().exp()
// Bioluminescent pulses run along the canals. A startle response wakes them as a visitor approaches.
    const pulseCoord = s.mul(3).sub(time.mul(0.32)).add(rowSeed.mul(3)).fract().sub(0.5)
    const pulse = pulseCoord.div(0.045).pow2().negate().exp()
    const startle = intimate.mul(1.4).add(near.mul(0.35)).add(0.12)
    const lumen = mix(color(hsl.integer(259, 100, 54.5)), color(hsl.integer(172, 100, 87.85)), pulse)
    const canals = lumen.mul(canal).mul(pulse.mul(2.4).add(0.18)).mul(startle)
// Interior lobes of the gel, refracted deeper still, drift slowly like a body breathing.
    const lobeP = p.sub(view.mul(0.075))
    const breath = time.mul(0.6).sin().mul(0.04)
    const lobes = mx_fractal_noise_float(lobeP.mul(7.5).add(vec3(0, time.mul(0.05), breath)), 3, 2, 0.5).mul(0.5).add(0.5).smoothstep(0.45, 0.85)
    const lobeTint = mix(color(hsl.integer(289, 82, 18)), color(hsl.integer(257, 89, 27)), lobeP.y.mul(3).sin().mul(0.5).add(0.5))
    const interior = lobeTint.mul(lobes).mul(facing.mul(0.6).add(0.2)).mul(0.32)
// Gel reads by its edges: the longer path through grazing glass glows pale cyan.
    const edge = color(hsl.integer(247, 100, 71)).mul(grazing.pow(2.6)).mul(0.32).add(color(hsl.integer(229, 100, 93.7)).mul(grazing.pow(7)).mul(0.55))
// Marine snow suspended in and around the body.
    const snow = cellularPoints(p.sub(view.mul(0.04)).mul(46).add(vec3(0, time.mul(0.08), 0)), 0.02, 0.12, 0.86).mul(near.mul(0.6).add(0.2))
    this.colorNode = color(hsl.integer(252, 60, 3))
    this.metalness = 0
    this.roughness = 0.1
    this.clearcoat = 1
    this.clearcoatRoughness = 0.025
    this.normalNode = liquidNormal(intimate, 0.45)
    const emission: Node<'vec3'> = combs.add(combHalo).add(canals).add(interior).add(edge).add(color(hsl.integer(246, 100, 90.7)).mul(snow).mul(0.5))
    this.emissiveNode = emission
  }
}
