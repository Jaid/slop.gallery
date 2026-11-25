import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, screenUV, time, vec2, vec3} from 'three/tsl'

import {surfaceFrame, torusDomain, tubeSpace} from '../../candidates/claude_opus/lib/knotSpace.ts'
import {voronoiCells} from '../../candidates/claude_opus/lib/voronoi3.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Chromatophore organs per object unit, in two interleaved layers. */
const organScale = 105
/** One layer of chromatophores: elastic pigment sacs whose radius follows the nervous signal `expansion` in [0, 1]. Returns the pigment coverage and color. Unresolved sacs fade to their mean coverage so distant skin keeps its tone. */
function chromatophores(position: Node<'vec3'>, expansion: Node<'float'>, seed: number) {
  const cells = voronoiCells(position.add(seed), 0.85)
  const identity = cellNoiseVec3(cells.cell.add(seed * 3.1))
// Each sac answers the signal with its own threshold, so the skin ripples rather than switching.
  const response = expansion.sub(identity.x.mul(0.3)).div(0.7).clamp()
// Radial coordinate that is 0 at the organ and 1 at its cell wall, so fully expanded sacs tile the skin like real ones.
  const radial = cells.center.div(cells.center.add(cells.border.max(0)).max(0.0001))
  const radius = response.mul(0.84).add(0.1)
  const footprint = radial.fwidth().max(0.0001)
  const resolved = radius.sub(radial).div(footprint).add(0.5).clamp()
  const mean = radius.pow2()
  const coverage = mix(resolved, mean, cells.center.fwidth().smoothstep(0.12, 0.4))
// The pigment thins toward a stretched sac’s rim.
  const density = radial.div(radius.max(0.001)).clamp().pow2().oneMinus().mul(0.35).add(0.65)
  const pigment = identity.y.lessThan(0.42).select(vec3(0.69, 0.37, 0.016), identity.y.lessThan(0.78).select(vec3(0.43, 0.042, 0.006), vec3(0.023, 0.006, 0.002)))
  return {
    coverage,
    pigment: pigment.mul(density.mul(response.mul(0.3).add(0.7))),
  }
}
/** Cuttlefish skin, a living display. Thousands of pigment organs expand and contract under nervous control: dark “passing cloud” bands sweep along the knot while slow mottling drifts beneath. Where the viewer’s gaze rests – the middle of their view – the organs relax and the iridophores beneath surface as a sheet of shifting blue-green and rose. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {along, around} = tubeSpace()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const {normal} = surfaceFrame()
    const domain = torusDomain(along, around, 7.1772 * 3, 0.82 * 3)
// The nervous signal: traveling cloud bands, a slow mottle, and a pale dorsal stripe pattern.
    const warp = mx_fractal_noise_float(domain.mul(0.8).add(vec3(0, 0, time.mul(0.05))), 2, 2, 0.5)
    const cloudPhase = along.mul(9).add(around.mul(1)).add(warp.mul(0.5)).sub(time.mul(0.32))
    const clouds = cloudPhase.fract().sub(0.5).abs().mul(2).smoothstep(0.35, 0.95).oneMinus().pow(1.5)
    const mottle = mx_fractal_noise_float(domain.mul(1.6).add(vec3(time.mul(0.03), time.mul(-0.02), 0)), 3, 2, 0.5).mul(0.5).add(0.5)
    const stripes = around.mul(6.2832).add(along.mul(48).sin().mul(0.6)).sin().smoothstep(0.55, 0.95)
// The gaze: the middle of the viewer’s frame, softly, more when close. The organs relax there.
    const gaze = screenUV.sub(vec2(0.5)).length().smoothstep(0.04, 0.26).oneMinus().mul(near.mul(0.45).add(0.55))
    const breathing = time.mul(0.9).sin().mul(0.04)
    const signal = float(0.42).add(clouds.mul(0.6)).add(mottle.sub(0.5).mul(0.7)).sub(stripes.mul(0.28)).add(breathing).sub(gaze.mul(0.62)).clamp()
    const q = p.mul(organScale)
    const deep = chromatophores(q, signal.mul(0.9).add(0.05), 0)
    const shallow = chromatophores(q.mul(1.37), signal, 17.3)
// Beneath the pigment: leucophores scatter white; iridophores interfere in sheets whose spacing drifts.
    const leucophore = vec3(0.34, 0.3, 0.24)
    const sheet = mx_noise_float(p.mul(14).add(vec3(0, time.mul(0.04), 0))).mul(0.5).add(0.5)
    let skin: Node<'vec3'> = leucophore
    skin = mix(skin, deep.pigment, deep.coverage)
    skin = mix(skin, shallow.pigment, shallow.coverage)
    const exposed = deep.coverage.oneMinus().mul(shallow.coverage.oneMinus())
// Iridophore platelets reflect a structural color whose hue slides with the viewing angle.
    const structural = spectralColor(view.dot(normal).mul(5.5).add(sheet.mul(3.2)).add(time.mul(0.12))).mul(vec3(0.55, 0.75, 0.85))
    this.colorNode = mix(skin, structural, exposed.mul(gaze.mul(0.45).add(0.15)))
    this.metalness = 0
    this.roughnessNode = float(0.42).sub(exposed.mul(0.12))
// Iridophores: thin-film reflectors appear where the pigment parts, strongest under the viewer’s gaze.
    this.iridescenceNode = exposed.mul(gaze.mul(0.7).add(0.3))
    this.iridescenceIOR = 1.83
    this.iridescenceThicknessNode = sheet.mul(260).add(gaze.mul(120)).add(280)
// A thin film of mucus over everything: wet highlights that ride the papillae.
    this.clearcoat = 0.7
    this.clearcoatRoughness = 0.12
    const papillae = cellularPoints(p.mul(38).add(2.2), 0.02, 0.22, 0.55)
    const ridges = mx_noise_float(p.mul(24)).mul(0.5).add(0.5)
    const height = papillae.mul(0.0007).mul(signal.mul(0.7).add(0.3)).add(ridges.mul(0.00025)).add(shallow.coverage.mul(0.00005))
    this.normalNode = proceduralNormal(height, 1)
    this.sheen = 0.4
    this.sheenColor.set(hsl.integer(238, 24, 73))
    this.sheenRoughness = 0.4
// The skin’s own sheen under the gaze: a cool shimmer, never a glow.
    const shimmer = exposed.mul(gaze).mul(facing.mul(0.6).add(0.4)).mul(sheet.mul(0.5).add(0.5)).mul(intimate.mul(0.6).add(0.4))
    this.emissiveNode = color(hsl.integer(190, 78, 66)).mul(shimmer).mul(0.06).add(color(hsl.integer(47, 51, 22)).mul(grazing.pow(3)).mul(0.04))
  }
}
