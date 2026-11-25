import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {ramp} from '../../candidates/claude_opus/lib/ramp.ts'
import {knotLength, tubeCells, tubeMetric} from '../../candidates/claude_opus/lib/tubeMetric.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const neighbors = [-1, 0, 1].flatMap(j => [-1, 0, 1].map(i => [i, j] as const))
type SacLayer = {
  along: number
  around: number
/** Activation offset: yellow sacs open first, dark ones last. */
  bias: number
  closed: number
  open: number
  seed: number
}
/**
 * One layer of chromatophores: elastic pigment sacs on a jittered lattice, each pulled open by radial muscles when the
 * activation field passes its own threshold. Returns pigment coverage, filtered to its mean when the sacs shrink below
 * a pixel, and a soft dome height for the skin relief.
 */
function chromatophores(tube: Node<'vec2'>, activation: Node<'float'>, layer: SacLayer) {
  const period = vec2(layer.along, layer.around)
  const cells = tubeCells(tube, layer.along, layer.around)
  const base = cells.floor()
  const local = cells.fract()
  const footprint = cells.fwidth().length().max(0.0005)
  let coverage: Node<'float'> = float(0)
  let dome: Node<'float'> = float(0)
  let mean: Node<'float'> = float(0)
  for (const [i, j] of neighbors) {
    const offset = vec2(i, j)
    const id = wrapCell(base.add(offset), period)
    const random = cellNoiseVec3(vec3(id, layer.seed))
    const center = offset.add(random.xy.mul(0.5).add(0.25))
    const distance = local.sub(center).length()
    const opening = activation.add(layer.bias).sub(random.z.mul(0.35)).smoothstep(0.15, 0.65)
// Sacs pulse faintly on their own clock even at rest.
    const tremor = time.mul(random.x.mul(2).add(1.5)).add(random.y.mul(TAU)).sin().mul(0.025)
    const radius = mix(float(layer.closed), float(layer.open), opening).add(tremor.mul(opening))
    const edge = footprint.mul(0.75)
    coverage = coverage.max(distance.smoothstep(radius.sub(edge), radius.add(edge)).oneMinus())
    dome = dome.max(distance.div(radius.max(0.01)).pow2().oneMinus().max(0))
    if (i === 0 && j === 0) {
      mean = radius.pow2().mul(Math.PI).min(1)
    }
  }
  const resolved = footprint.smoothstep(0.35, 0.8).oneMinus()
  return {
    coverage: mix(mean, coverage, resolved),
    dome: dome.mul(resolved),
  }
}
/**
 * Cuttlefish skin. Three layers of chromatophores – yellow, orange-red and dark brown – sit over iridophores that flash
 * blue and green at an angle and over patches of chalk-white leucophores. A neural field drives them: dark “passing
 * clouds” stream along the knot while it idles, a mottle drifts underneath, and a visitor who comes close is met with
 * the high-contrast zebra display, aimed at them, with the papillae raised.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const tube = uv()
    const {p, facing, grazing, distance, objectDistance} = viewerFrame()
    const s = tubeMetric(tube).x
// The visitor’s effect: the whole animal grows alert as you approach; the side facing you displays hardest.
    const alert = ramp(objectDistance, 3.4, 1.3)
    const display = ramp(distance, 1.6, 0.6).mul(facing.mul(0.6).add(0.4)).max(alert.mul(0.35))
// Passing clouds: dark fronts that stream along the knot, bent by a slow warp.
    const warp = mx_fractal_noise_float(p.mul(1.6).add(vec3(0, 0, time.mul(0.05))), 2, 2, 0.5).mul(2.2)
    const cloudPhase = s.mul(TAU * 7 / knotLength).sub(time.mul(1.7)).add(warp)
    const clouds = cloudPhase.sin().mul(0.5).add(0.5).pow(1.6)
    const mottle = mx_fractal_noise_float(p.mul(9).add(vec3(time.mul(0.04), 0, 0)), 3, 2, 0.5).mul(0.5).add(0.5)
// Zebra display: crisp bands across the body, wobbling as the animal breathes.
    const zebraPhase = s.mul(TAU * 46 / knotLength).add(mx_noise_float(p.mul(4)).mul(2.4)).add(time.mul(0.4).sin().mul(0.3))
    const zebra = zebraPhase.sin().smoothstep(-0.15, 0.25)
    const field = mix(clouds.mul(0.8).add(mottle.mul(0.45)).add(0.04), zebra.mul(1.1).add(mottle.mul(0.12)).sub(0.04), display)
    const dark = chromatophores(tube, field, {
      along: 300,
      around: 40,
      bias: -0.1,
      closed: 0.07,
      open: 0.47,
      seed: 1,
    })
    const red = chromatophores(tube, field, {
      along: 390,
      around: 52,
      bias: 0.12,
      closed: 0.06,
      open: 0.42,
      seed: 2,
    })
    const yellow = chromatophores(tube, field, {
      along: 470,
      around: 63,
      bias: 0.3,
      closed: 0.05,
      open: 0.38,
      seed: 3,
    })
// Beneath the pigment: chalk-white leucophore patches and iridophores that flash blue-green at an angle.
    const leucophore = mx_fractal_noise_float(p.mul(5.5).add(11.3), 2, 2, 0.5).smoothstep(0.08, 0.24)
    const iridescence = spectralColor(facing.mul(5.2).add(mx_noise_float(p.mul(14)).mul(1.2)).add(3.4)).mul(grazing.mul(0.6).add(0.2))
    const skin = mix(color(hsl.integer(70, 20, 59)), color(hsl.integer(81, 30, 92)), leucophore)
    const underlayer = skin.mul(0.7).add(iridescence.mul(mix(float(0.45), float(0.12), leucophore)))
    const withYellow = mix(underlayer, color(hsl.integer(83, 92, 70)), yellow.coverage.mul(0.85))
    const withRed = mix(withYellow, color(hsl.integer(37, 91, 39)), red.coverage.mul(0.9))
    const pigment = mix(withRed, color(hsl.integer(43, 46, 8)), dark.coverage.mul(0.95))
// Papillae: small cones of skin that rise when the animal is roused.
    const papillaCells = tubeCells(tube, 150, 20)
    const papillaId = wrapCell(papillaCells.floor(), vec2(150, 20))
    const papillaRandom = cellNoiseVec3(vec3(papillaId, 9))
    const papilla = papillaCells.fract().sub(papillaRandom.xy.mul(0.4).add(0.3)).length().smoothstep(0, 0.32).oneMinus().pow(1.5).mul(papillaRandom.z.smoothstep(0.55, 0.75))
    const raised = display.mul(0.8).add(clouds.mul(0.2))
    const height = dark.dome.mul(0.0006).add(red.dome.mul(0.0003)).add(papilla.mul(raised).mul(0.004))
    this.normalNode = proceduralNormal(height, 1)
    this.colorNode = pigment
    this.metalness = 0
    this.roughnessNode = mix(float(0.48), float(0.34), dark.coverage)
    this.clearcoat = 0.7
    this.clearcoatRoughness = 0.12
    this.sheenNode = color(hsl.integer(217, 64, 41)).mul(dark.coverage.oneMinus())
    this.sheenRoughness = 0.5
// The iridophores carry a faint light of their own; the leucophores glow chalky in shade.
    this.emissiveNode = iridescence.mul(dark.coverage.oneMinus()).mul(yellow.coverage.oneMinus()).mul(0.12).add(color(hsl.integer(83, 37, 92)).mul(leucophore).mul(dark.coverage.oneMinus()).mul(0.04))
  }
}
