import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, time, vec2, vec3} from 'three/tsl'

import {parallaxOffset, surfaceFrame} from '../../candidates/claude_opus/lib/knotSpace.ts'
import {voronoiCells} from '../../candidates/claude_opus/lib/voronoi3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** The tree’s axis through the block the knot was carved from, and two directions across it. */
const grainAxis = vec3(0.94, 0.3, 0.16).normalize()
const acrossA = vec3(-0.3, 0.95, 0).normalize()
const acrossB = grainAxis.cross(acrossA).normalize()
/** The pith lies outside the carving, so growth rings cross it as broad arcs. */
const pith = vec2(1.7, -0.55)
const ringsPerUnit = 44
/** Curl stripes per unit along the grain, and the fibers’ maximum dive into the surface. */
const curlPerUnit = 150
const curlDive = 0.62
/** Lacquer: amber absorption per unit of light path, and the coat’s thickness. */
const amberAbsorption = vec3(0.9, 2.6, 10)
const lacquerThickness = 0.02
/** The gallery’s lights, in object space: overhead, the key light, a low fill. */
const lamps: Array<[[number, number, number], number]> = [[[0, 1, 0.15], 1], [[-0.17, 0.49, -0.86], 0.75], [[0.62, 0.25, 0.74], 0.5]]
/** Figured maple under amber lacquer. Growth rings, pores and bird’s-eye swirls come from one continuous 3D block of wood, so the figure flows through the knot as if carved. The curl is physical chatoyance: the fibers dive in and out of the surface, and each lamp’s fiber highlight lights the stripes leaning toward the viewer – step sideways and the bright and dark flames trade places. Dappled light, as if through leaves, drifts slowly across the piece. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const {normal} = surfaceFrame()
// The figure lies just under the lacquer, so it sits a hair behind the reflections.
    const q = p.add(parallaxOffset(view, normal, lacquerThickness * 0.5))
    const along = q.dot(grainAxis)
    const across = vec2(q.dot(acrossA), q.dot(acrossB))
// Bird’s-eye: small conical dimples in the growth layers, scattered through the block.
    const eyeCells = voronoiCells(q.mul(26), 0.9)
    const eyeGate = mx_cell_noise_float(eyeCells.cell.add(3.3)).smoothstep(0.78, 0.8)
    const eye = eyeCells.center.div(0.22).pow2().negate().exp().mul(eyeGate)
// Growth rings, warped by the tree’s irregular growth.
    const warp = mx_fractal_noise_float(q.mul(vec3(1.3, 2.6, 2.6)), 3, 2, 0.5).mul(0.07)
    const radius = across.sub(pith).length().add(warp).add(along.mul(0.04)).sub(eye.mul(0.012))
    const ringPhase = radius.mul(ringsPerUnit)
    const ringFootprint = ringPhase.fwidth()
    const ringResolved = ringFootprint.smoothstep(0.3, 0.9).oneMinus()
    const ringFraction = ringPhase.fract()
    const latewood = mix(float(0.28), ringFraction.smoothstep(0.62, 0.9).mul(ringFraction.smoothstep(0.985, 1).oneMinus()), ringResolved)
// Pores: fine streaks along the grain, visible close up.
    const poreCoordinate = vec3(along.mul(9), across.mul(420))
    const pores = mx_noise_float(poreCoordinate).smoothstep(0.45, 0.75).mul(poreCoordinate.y.fwidth().smoothstep(0.4, 1.2).oneMinus())
// The curl: fibers rippling across the grain; their dive angle sets which stripes catch the light.
    const curlPhase = along.mul(curlPerUnit).add(mx_fractal_noise_float(q.mul(vec3(0.8, 3.5, 3.5)), 2, 2, 0.5).mul(3.2)).add(eye.mul(5))
    const curlResolved = curlPhase.fwidth().smoothstep(0.6, 2).oneMinus()
    const dive = curlPhase.sin().mul(curlDive).mul(curlResolved).add(eye.mul(0.4))
// Where the carving cuts across the grain, the fibers end at the surface: there is no direction to shimmer along.
    const planarGrain = grainAxis.sub(normal.mul(grainAxis.dot(normal)))
    const sideGrain = planarGrain.length()
    const grainOnSurface = planarGrain.div(sideGrain.max(0.0001))
    const fiber = grainOnSurface.mul(dive.cos()).add(normal.mul(dive.sin())).normalize()
// Dappled forest light: slow drifting patches modulating the lamps.
    const dappleField = mx_fractal_noise_float(p.mul(2.2).add(vec3(time.mul(0.045), time.mul(-0.02), time.mul(0.03))), 2, 2, 0.5)
    const dapple = dappleField.smoothstep(-0.1, 0.3).mul(0.65).add(0.35)
// Kajiya–Kay fiber scattering inside the wood: bright where the half vector is perpendicular to the fibers.
    const inside = view.add(normal.mul(view.dot(normal).mul(0.5))).normalize()
    let chatoyance: Node<'float'> = float(0)
    for (const [index, [direction, strength]] of lamps.entries()) {
      const lamp = vec3(...direction).normalize()
      const half = inside.add(lamp).normalize()
      const perpendicular = half.dot(fiber).pow2().oneMinus().max(0)
      const lit = lamp.dot(normal).max(0).add(0.15).min(1)
      chatoyance = chatoyance.add(perpendicular.pow(26).mul(lit).mul(strength).mul(index === 0 ? dapple : 1))
    }
    chatoyance = chatoyance.mul(sideGrain.smoothstep(0.05, 0.35))
// Amber lacquer: the path through it lengthens as the eye slants, deepening the honey into cognac.
    const cosine = view.dot(normal).clamp(0.08, 1)
    const amber = amberAbsorption.mul(lacquerThickness * 2).div(cosine).negate().exp()
    const earlywood = color(hsl.integer(78, 65, 76))
    const late = color(hsl.integer(58, 72, 46))
    const wood = mix(earlywood, late, latewood.mul(0.55)).mul(pores.mul(0.35).oneMinus()).mul(eye.mul(0.25).oneMinus())
    const flame = color(hsl.integer(79, 99, 87))
    this.colorNode = amber.mul(wood).mul(0.5)
    this.metalness = 0
    this.roughnessNode = float(0.5).add(pores.mul(0.2))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.035
// The lacquer is poured, not carved: only a faint orange peel ripples its surface.
    const peel = mx_noise_float(p.mul(70)).mul(0.00008)
    this.clearcoatNormalNode = proceduralNormal(peel, 1)
    this.normalNode = proceduralNormal(pores.mul(-0.00012).add(latewood.mul(0.00004)).add(peel), 1)
    this.sheen = 0.3
    this.sheenColor.set(hsl.integer(68, 99, 79.4))
    this.sheenRoughness = 0.45
    this.emissiveNode = amber.mul(flame).mul(chatoyance).mul(wood.mul(0.9).add(0.25)).mul(near.mul(0.3).add(1.25))
      .add(amber.mul(color(hsl.integer(60, 99, 74))).mul(grazing.pow(3)).mul(0.05))
      .add(color(hsl.integer(85, 100, 95)).mul(eye.mul(chatoyance)).mul(intimate).mul(facing).mul(0.1))
  }
}
