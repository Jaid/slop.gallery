import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_vec3, mx_fractal_noise_float, mx_worley_noise_vec3, normalLocal, time, transformNormalToView, uv, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {environmentHighlight, studioSheen} from '../../candidates/deepseek/lib/environment.ts'
import {knotCircumference, knotLength, tubeTurns} from '../../candidates/deepseek/lib/tubeMetric.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** One family of Widmanstätten lamellae, defined by whole cycles along the knot and around the tube. */
const lamella = (tube: Node<'vec2'>, warp: Node<'float'>, along: number, around: number, frequency: number, offset: number) => {
  const phase = tube.x.mul(TAU * along).add(tubeTurns(tube).mul(TAU * around)).add(warp.mul(0.65)).add(offset)
  const local = phase.fract()
  const footprint = phase.fwidth().max(0.0001)
  const edge = footprint.mul(1.3).add(0.012)
  const plate = local.smoothstep(edge, edge.mul(2).add(frequency)).mul(local.oneMinus().smoothstep(edge, edge.mul(2).add(frequency)))
  return {
    id: phase.floor(),
    phase,
    plate,
  }
}
/** A slice of iron meteorite: etched Widmanstätten lamellae, dark taenite borders, Neumann lines, troilite flecks and patches of thumbprinted fusion crust. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const n = normalLocal.normalize()
    const baseNormal = transformNormalToView(n).normalize()
// A slow domain warp bends the lamella boundaries, as the crystal front did while it grew.
    const warp = mx_fractal_noise_float(p.mul(2.35).add(11.7), 3, 2.02, 0.51).mul(0.34)
    const fineWarp = mx_fractal_noise_float(p.mul(7.4).add(41.2), 2, 2.1, 0.5).mul(0.08)
    const a = lamella(tube, warp.add(fineWarp), 9, 4, 0.16, 0.3)
    const b = lamella(tube, warp.sub(fineWarp.mul(0.7)), 14, -5, 0.12, 2.7)
    const c = lamella(tube, warp.mul(0.8).add(fineWarp), 7, 7, 0.1, 5.1)
    const d = lamella(tube, warp.mul(0.6).sub(fineWarp), 23, -3, 0.065, 1.4)
// Etched walls belong to every orientation at once, even where two plates meet.
    const etched = float(1).sub(a.plate).mul(0.9).max(float(1).sub(b.plate).mul(0.72)).max(float(1).sub(c.plate).mul(0.62)).max(float(1).sub(d.plate).mul(0.38))
    const plates = a.plate.mul(0.92).max(b.plate.mul(0.88)).max(c.plate.mul(0.82)).max(d.plate.mul(0.7))
    const kamacite = plates.mul(etched.mul(0.92).oneMinus()).mul(0.92).add(0.08)
    const shadeA = mx_cell_noise_vec3(vec3(a.id, 3.2, 7.4)).x
    const shadeB = mx_cell_noise_vec3(vec3(b.id, 8.1, -2.3)).x
    const shadeC = mx_cell_noise_vec3(vec3(c.id, -4.7, 5.9)).x
    const shadeD = mx_cell_noise_vec3(vec3(d.id, 1.9, 12.2)).x
    const silverA = mix(color(hsl.integer(252, 8, 50)), color(hsl.integer(248, 11, 78)), shadeA)
    const silverB = mix(color(hsl.integer(252, 9, 43)), color(hsl.integer(251, 11, 70)), shadeB)
    const silverC = mix(color(hsl.integer(81, 5, 51)), color(hsl.integer(78, 16, 76)), shadeC)
    const silverD = mix(color(hsl.integer(256, 11, 45)), color(hsl.integer(251, 14, 67)), shadeD)
    const metalColor = a.plate.greaterThan(0.55).select(silverA, b.plate.greaterThan(0.55).select(silverB, c.plate.greaterThan(0.55).select(silverC, silverD)))
    const plateRough = a.plate.greaterThan(0.55).select(shadeA, b.plate.greaterThan(0.55).select(shadeB, c.plate.greaterThan(0.55).select(shadeC, shadeD)))
    const border = color(hsl.integer(261, 10, 16)).mul(0.45).add(color(hsl.integer(260, 9, 34)).mul(0.55))
    const etchRim = etched.mul(etched.oneMinus()).mul(4).clamp()
    const etchedMetal = mix(metalColor, border, etched.mul(0.84)).add(color(hsl.integer(251, 34, 91.5)).mul(etchRim).mul(0.16))
// Neumann lines: fine parallel deformation twins inside the kamacite, only legible up close.
    const neumannPhase = a.phase.mul(22)
    const neumann = neumannPhase.sin().abs().pow(9).mul(neumannPhase.fwidth().smoothstep(0.25, 0.8).oneMinus())
    const neumannFade = intimate.mul(0.8).add(0.2)
    const etchedDetail = etchedMetal.mul(neumann.mul(kamacite).mul(neumannFade).mul(0.15).oneMinus())
// Fusion crust: a dark, pitted rind that survived the atmosphere in islands.
    const crustField = mx_fractal_noise_float(p.mul(3.35).add(vec3(4.1, -7.7, 2.6)), 3, 2.03, 0.52).mul(0.5).add(0.5)
    const crust = crustField.smoothstep(0.55, 0.66)
    const pitField = mx_worley_noise_vec3(p.mul(8.4).add(3.3), 1, 0)
    const pits = pitField.x.smoothstep(0.12, 0.48).oneMinus().mul(crust)
    const pitRims = pitField.x.smoothstep(0.48, 0.58).mul(pitField.x.smoothstep(0.68, 0.9).oneMinus()).mul(crust)
    const crustColor = mix(color(hsl.integer(67, 15, 9)), color(hsl.integer(57, 23, 24)), mx_fractal_noise_float(p.mul(11).add(9.2), 2, 2.2, 0.5).mul(0.5).add(0.5))
    const oxide = crustField.smoothstep(0.66, 0.72).mul(crustField.smoothstep(0.8, 0.9).oneMinus())
// Troilite and schreibersite: rare, small, and almost black against the silver.
    const inclusions = mx_worley_noise_vec3(p.mul(26).add(7.7), 1, 0).x
    const inclusionMask = inclusions.smoothstep(0.045, 0.09).oneMinus().mul(mx_cell_noise_vec3(vec3(p.mul(26).floor())).y.smoothstep(0.45, 0.8)).mul(0.8)
    const inclusionColor = mix(color(hsl.integer(63, 26, 13)), color(hsl.integer(62, 53, 36)), mx_fractal_noise_float(p.mul(44), 2, 2.1, 0.5).mul(0.5).add(0.5))
    let surfaceColor: Node<'vec3'> = mix(etchedDetail, crustColor, crust)
    surfaceColor = mix(surfaceColor, inclusionColor, inclusionMask.mul(crust.oneMinus()).mul(0.7))
    this.colorNode = surfaceColor
    this.metalnessNode = mix(float(1).sub(inclusionMask.mul(0.55)), float(0.12), crust).clamp(0, 1)
    this.roughnessNode = mix(float(0.13).add(etched.mul(0.1)).add(neumann.mul(0.02)).add(plateRough.mul(0.06)), float(0.82).add(pits.mul(0.1)).sub(pitRims.mul(0.06)), crust).clamp(0.04, 0.98)
    this.anisotropy = 0.42
    const anisotropyAngle = Math.atan2(4 / knotCircumference, 9 / knotLength)
    this.anisotropyNode = vec2(Math.cos(anisotropyAngle), Math.sin(anisotropyAngle)).mul(0.42)
    this.clearcoatNode = crust.oneMinus().mul(0.18)
    this.clearcoatRoughness = 0.2
    this.iridescenceNode = oxide.mul(0.45)
    this.iridescenceIOR = 1.7
    this.iridescenceThicknessNode = oxide.mul(260).add(180)
    this.normalNode = detailNormal(baseNormal, etched.mul(0.0013).add(neumann.mul(0.00012).mul(neumannFade)).add(pits.mul(0.0032)).add(pitRims.mul(0.0011)).add(crust.mul(0.0007)), 1.15)
    this.aoNode = float(1).sub(etched.mul(0.34)).sub(pits.mul(0.5)).sub(inclusionMask.mul(0.15))
    const crisp = environmentHighlight(environment, n, 0.055)
    const edgeGlint = crisp.mul(etched.mul(0.45).add(neumann.mul(0.12))).mul(near.mul(0.65).add(0.35)).mul(time.mul(0.21).add(shadeA.mul(9)).sin().mul(0.06).add(0.94))
    const stripSpot = view.negate().reflect(n).dot(vec3(0.6, 0.55, 0.58).normalize()).clamp().pow(180)
    const sheen = studioSheen(n).mul(kamacite.mul(crust.oneMinus())).mul(0.07).add(color(hsl.integer(253, 38, 91)).mul(stripSpot).mul(etched.mul(0.5).add(0.2)).mul(0.12))
    const frost = color(hsl.integer(262, 100, 80)).mul(grazing.pow(4)).mul(kamacite.mul(0.05)).mul(crust.oneMinus())
    this.emissiveNode = edgeGlint.add(sheen).add(frost).add(color(hsl.integer(70, 31, 26)).mul(pitRims).mul(0.08)).add(color(hsl.integer(254, 51, 67)).mul(crust.mul(crust.oneMinus()).mul(4)).mul(0.04))
  }
}
