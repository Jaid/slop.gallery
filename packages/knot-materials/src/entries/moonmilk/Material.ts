import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Brick-bond aragonite tablets: near-flat plates with hairline mortar, per-tablet jitter and flow striations. */
function tablets(tile: Node<'vec2'>, tiles: Node<'vec2'>, seed: Node<'float'> | number) {
  const s = typeof seed === 'number' ? float(seed) : seed
  const q = tile.mul(tiles)
  const row = q.y.floor()
  const shifted = vec2(q.x.add(row.mod(2).mul(0.5)), q.y)
  const id = wrapCell(shifted.floor(), tiles)
  const local = shifted.fract().sub(0.5)
  const random = cellNoiseVec3(vec3(id, s))
  const footprint = shifted.fwidth().length().max(0.00001)
  const aa = footprint.mul(1.5).add(0.003)
  const wobble = vec2(mx_noise_float(vec3(id, s.add(9.1))), mx_noise_float(vec3(id, s.add(17.3)))).sub(0.5).mul(0.08)
  const shape = local.add(wobble).abs().div(vec2(0.49, 0.47))
  const edge = shape.x.max(shape.y)
  const face = edge.smoothstep(float(0.97).sub(aa), float(1).add(aa)).oneMinus()
  const striation = local.y.mul(7).add(random.y.mul(TAU)).sin().mul(0.5).add(0.5).pow(2)
  return {
    face,
    local,
    random,
    striation,
  }
}

/** The inner shell of a giant pearl oyster: aragonite tablets mortared in conchiolin, each tablet a thin-film lens. Circling the knot sweeps the interference tide across every plate in turn; stepping closer reveals the growth striations on the tablets and the older, deeper plates beneath the mortar. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const slope = tubeRay()
    const top = tablets(tube, vec2(420, 48), 0)
    const deep = tablets(tube.sub(slope.mul(0.012)), vec2(420, 48), 37)
    const tide = time.mul(0.09)
// Interference is driven mostly by the continuous view term so color flows across tablets instead of
// freezing one hue per cell; the per-tablet jitter only stirs the tide.
    const flow = mx_noise_float(p.mul(3).add(tide)).mul(TAU)
    const topPhase = facing.mul(6.5).add(grazing.mul(2)).add(flow).add(p.z.mul(3)).add(p.x.mul(2)).add(top.random.y.mul(1.2))
    const topFilm = spectralColor(topPhase)
    const deepFilm = spectralColor(topPhase.add(2.2).add(grazing.mul(3)))
    const pearl = color(hsl.integer(81, 28, 89))
    const topTablet = pearl.mul(top.random.x.mul(0.08).add(0.96)).mul(topFilm.mul(0.9).add(0.1))
    const deepTablet = color(hsl.integer(72, 24, 69)).mul(deep.random.x.mul(0.12).add(0.94)).mul(deepFilm.mul(0.85).add(0.15))
    const mortar = color(hsl.integer(54, 39, 24)).mul(top.random.z.mul(0.15).add(0.92))
    const gap = top.face.oneMinus()
    this.colorNode = mix(mix(mortar, deepTablet, deep.face.mul(0.65).add(0.35)), topTablet, top.face)
    this.metalness = 0
    this.roughnessNode = gap.mul(0.25).add(0.12).add(top.random.z.mul(0.02))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.07
    this.iridescenceNode = top.face.mul(0.9).add(0.08)
    this.iridescenceIOR = 1.35
    this.iridescenceThicknessNode = float(120).add(top.random.x.mul(120)).add(facing.mul(240)).add(time.mul(7).sin().mul(18))
    this.aoNode = gap.mul(0.25).oneMinus()
    const relief = top.face.mul(0.05).add(top.striation.mul(intimate.mul(0.2))).add(gap.mul(-0.18)).add(deep.face.mul(gap).mul(0.06))
    this.normalNode = proceduralNormal(relief, 0.08).add(top.random.sub(0.5).mul(grazing.pow(2).mul(0.05))).normalize()
    const jitter = vec3(mx_noise_float(p.mul(30)), mx_noise_float(p.mul(30).add(9)), mx_noise_float(p.mul(30).add(17))).sub(0.5)
    const grainNormal = normalViewGeometry.add(jitter.mul(0.2)).normalize()
    const sparkle = glints(grainNormal, 140).mul(top.face).mul(near).mul(0.18)
    this.emissiveNode = color(hsl.integer(72, 100, 94.8)).mul(grazing.pow(4).mul(0.04)).add(topFilm.mul(sparkle.mul(0.5)))
  }
}
