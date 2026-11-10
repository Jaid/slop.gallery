import type {Node, Texture} from 'three/webgpu'

import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_vec3, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {ramp} from '../../candidates/deepseek/lib/ramp.ts'
import {tubeMetric} from '../../candidates/deepseek/lib/tubeMetric.ts'
import {beads} from '../../lib/beads.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const rotate = (v: Node<'vec2'>, angle: number) => vec2(v.x.mul(Math.cos(angle)).add(v.y.mul(Math.sin(angle))), v.y.mul(Math.cos(angle)).sub(v.x.mul(Math.sin(angle))))
/**
 * Rime growing from a black glacial stone. Three hexagonal families of crystal
 * needles braid into frost ferns on top of polygonal ice plates; a warm visitor
 * melts it from the inside out, leaving a film of water, beaded droplets and a
 * wet mirror behind.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const metric = tubeMetric(uv())
    const drift = time.mul(0.03)
    const broadWarp = mx_fractal_noise_float(vec3(metric.mul(2.2).add(vec2(1.7, 4.3)), drift), 3, 2.1, 0.52)
    const fineWarp = mx_noise_float(vec3(metric.mul(7.5).sub(vec2(3.1, 1.4)), drift.mul(1.5)))
    const q = metric.add(vec2(broadWarp.mul(0.16), fineWarp.mul(0.045)))
// Ice grows in hexagonal families; each family is a long, softly warped needle field.
    const family = (angle: number, seed: number, spacing: number, width: number) => {
      const r = rotate(q, angle)
      const wobble = mx_noise_float(vec3(r.x.mul(1.3), r.y.mul(1.1), seed)).mul(1.7)
      const phase = r.y.div(spacing).mul(TAU).add(wobble).add(seed)
      const line = ramp(phase.sin().abs(), width, 0)
      const gate = mx_noise_float(vec3(r.x.mul(1.1).add(seed * 2.3), r.y.mul(3.3), seed + 2.7)).mul(0.5).add(0.5)
      return line.mul(gate.smoothstep(0.22, 0.58))
    }
    const trunks = family(0, 1.3, 0.2, 0.2).max(family(TAU / 3, 4.7, 0.17, 0.22)).max(family(-TAU / 3, 8.2, 0.23, 0.2))
    const branches = family(0.5, 2.9, 0.085, 0.24).max(family(TAU / 3 + 0.4, 6.1, 0.1, 0.24)).max(family(-TAU / 3 - 0.2, 9.8, 0.075, 0.22)).mul(trunks.mul(0.7).add(0.28))
    const twigs = family(-0.7, 3.7, 0.042, 0.26).max(family(TAU / 3 - 0.5, 7.3, 0.036, 0.26)).mul(branches.mul(0.7).add(0.18)).mul(near.mul(0.85).add(0.15))
// Polygonal plates: a milky pane with a clear, slightly raised rim.
    const plateQ = vec3(q.mul(6.4), 9.1)
    const plateCells = mx_worley_noise_vec3(plateQ, 1, 0)
    const plateRim = ramp(plateCells.y.sub(plateCells.x), 0.095, 0.012)
    const frostShape = trunks.add(branches.mul(0.8)).add(twigs.mul(0.55)).add(plateRim.mul(0.3)).clamp(0, 1)
// Warmth reaches through the closest surface first; the melt front is ragged and breathes.
    const meltField = mx_fractal_noise_float(vec3(metric.mul(5), time.mul(0.04)), 3, 2.2, 0.5)
    const warmth = near.mul(0.7).add(facing.mul(0.12)).add(meltField.mul(0.5)).add(time.mul(0.06).sin().mul(0.04)).sub(0.12)
    const melt = warmth.smoothstep(0.55, 0.9)
    const frost = frostShape.mul(melt.oneMinus())
    const edge = melt.mul(melt.oneMinus()).mul(4)
// Beaded water and a second, finer mist of droplets in the melted stone.
    const drops = beads(p.mul(60).add(vec3(0.3, 1.7, 0.9)), 2.1)
    const mist = beads(p.mul(150).add(vec3(4.2, 0.8, 2.6)), 5.7)
    const dropMask = drops.mask.mul(melt).mul(frostShape.mul(0.5).oneMinus().mul(0.58).add(0.42))
    const mistMask = mist.mask.mul(melt).mul(intimate).mul(0.5)
    const water = dropMask.add(mistMask).clamp(0, 1)
// Dark polished ice-stone, with a pale rime skin and a wet sheen where it has thawed.
    const stone = mix(color('#02070d'), color('#0a2030'), mx_noise_float(vec3(metric.mul(7.5), 1.3)).mul(0.5).add(0.5))
    const rime = mix(color('#6e98aa'), color('#f2fdff'), frostShape.mul(0.62).add(0.38))
    const wetStone = mix(stone, color('#103648'), 0.3)
    const surface = mix(wetStone, rime, frost.mul(0.94))
    this.colorNode = mix(surface, color('#e4faff'), water.mul(0.3))
    this.metalnessNode = mix(float(0.13), float(0), frost.mul(0.8).add(water.mul(0.4)).clamp(0, 1))
    this.roughnessNode = mix(float(0.075), float(0.74), frost.mul(0.88).clamp(0, 1)).add(water.mul(-0.025))
    this.clearcoatNode = mix(float(0.92), float(0.22), frost)
    this.clearcoatRoughnessNode = mix(float(0.018), float(0.5), frost)
    this.iridescence = 0.26
    this.iridescenceIOR = 1.31
    this.iridescenceThicknessNode = frost.mul(150).add(facing.mul(240)).add(205)
    const frostHeight = frost.mul(0.0024).add(drops.cap.mul(dropMask).mul(0.003)).add(mist.cap.mul(mistMask).mul(0.0009))
    this.normalNode = detailNormal(normalViewGeometry, frostHeight.add(mx_noise_float(vec3(metric.mul(150), time.mul(0.1))).mul(frost).mul(0.00012)), 1)
    this.aoNode = frost.mul(0.16).add(0.84).sub(water.mul(0.08))
    const iceGlow = color('#bdefff').mul(frost).mul(grazing.pow(2.2)).mul(0.4)
    const meltSheen = spectralColorBands(metric.x.mul(0.6).add(metric.y.mul(13)).add(facing.mul(1.4))).mul(edge).mul(intimate.mul(0.55).add(0.12)).mul(0.38)
    const dropGlint = glints(normalViewGeometry, 900).mul(water).mul(near.mul(0.8).add(0.2)).mul(0.8)
    const frostedSparkle = glints(normalViewGeometry, 1500).mul(frost).mul(grazing.mul(0.65).add(0.1)).mul(0.42)
    this.emissiveNode = iceGlow.add(meltSheen).add(color('#eaffff').mul(dropGlint)).add(color('#c6eeff').mul(frostedSparkle))
  }
}
/** A cold blue-violet interference sheen, without the green and amber of a full spectrum. */
function spectralColorBands(phase: Node<'float'>) {
  return vec3(phase.add(0.5).sin(), phase.add(2.2).sin(), phase.add(4).sin()).mul(0.5).add(0.5).mul(vec3(0.62, 0.82, 1.15))
}
