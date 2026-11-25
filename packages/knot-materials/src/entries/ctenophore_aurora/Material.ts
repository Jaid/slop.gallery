import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, normalLocal, positionGeometry, positionViewDirection, tangentView, time, uv, vec2, vec3} from 'three/tsl'

import {tubeInterior} from '../../candidates/claude_sonnet/lib/tubeInterior.ts'
import {knotCircumference, knotLength, tubeMetric, tubeTurns} from '../../candidates/claude_sonnet/lib/tubeMetric.ts'
import {wavelengthColor} from '../../candidates/claude_sonnet/lib/wavelengthColor.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const rows = 8
const plates = 256
const waves = 16
const bursts = 3
/** One comb row pitch measured in plate lengths, so plate cells stay square on the tube. */
const pitch = knotCircumference / rows / (knotLength / plates)
/** Eight comb rows of fused cilia. Plate `i` of a row is tilted by sin(φᵢ) with φᵢ = i·2π·waves/plates − ωt, a metachronal wave, and a grating reflects λ = 550 nm + 165 nm·(0.55·v·t̂ + 0.6·tilt): rainbows that run along the row and slide with your viewpoint. Plates melt into a solid line once they are narrower than a pixel. */
function combRows(arc: Node<'float'>, around: Node<'float'>) {
  const row = around.mul(rows).add(0.5)
  const rowId = row.floor().mod(rows)
  const across = row.fract().sub(0.5).mul(pitch)
  const along = arc.div(knotLength).mul(plates)
  const plate = along.floor()
  const local = along.fract().sub(0.5)
  const rowRandom = cellNoiseVec3(vec3(rowId, 4.4, 1.7))
  const resolved = along.fwidth().smoothstep(0.3, 0.9).oneMinus()
  const outside = vec2(local.abs().sub(0.3), across.abs().sub(0.42)).max(0).length()
  const plateMask = outside.smoothstep(0, 0.12).oneMinus().mul(resolved).add(resolved.oneMinus().mul(0.62))
  const band = across.abs().smoothstep(0.4, 0.7).oneMinus()
  const phase = plate.mul(TAU * waves / plates).sub(time.mul(5.2)).add(rowRandom.x.mul(TAU))
  const tilt = phase.sin()
  const hue = tangentView.normalize().dot(positionViewDirection).mul(0.55).add(tilt.mul(0.6)).clamp(-1, 1)
  const burst = arc.mul(TAU * bursts / knotLength).sub(time.mul(0.8)).add(rowRandom.y.mul(TAU)).sin().mul(0.5).add(0.5).smoothstep(0.05, 0.85).mul(0.75).add(0.25)
  const stroke = phase.add(1.2).sin().mul(0.5).add(0.5).pow(1.4).mul(0.8).add(0.2)
  const mask = plateMask.mul(band)
  return {
    fire: wavelengthColor(hue.mul(165).add(550)).mul(mask).mul(stroke).mul(burst),
    band,
    height: mask,
  }
}
/** Glass-clear comb jelly body: specks of plankton, canals that glow under each comb row and moving rainbows. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const metric = tubeMetric(tube)
    const turns = tubeTurns(tube)
    const front = combRows(metric.x, turns)
    const interior = tubeInterior()
    const back = combRows(metric.x.add(interior.shiftArc), turns.add(interior.shiftV))
// The body breathes: a slow peristaltic swell travels along the knot.
    const swell = metric.x.mul(TAU * 5 / knotLength).sub(time.mul(1.3)).sin().mul(0.0035)
    this.positionNode = positionGeometry.add(normalLocal.mul(swell))
    this.normalNode = proceduralNormal(front.height.mul(0.0011), 0.9)
    this.colorNode = color(hsl.integer(220, 74, 5))
    this.metalness = 0
    this.roughness = 0.05
    this.ior = 1.34
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.sheen = 0.22
    this.sheenColor.set(hsl.integer(219, 80, 69))
    this.sheenRoughness = 0.4
    const canals = front.band.mul(0.45).add(back.band.mul(0.2))
    const plankton = cellularPoints(p.mul(58).add(vec3(0, time.mul(0.35), time.mul(0.12))), 0.012, 0.1, 0.82)
    const twinkle = time.mul(3.1).add(p.x.mul(40)).sin().mul(0.3).add(0.7)
// The far wall is seen through the body: longer paths at glancing angles absorb more of it.
    const farWall = back.fire.mul(interior.thickness.mul(-4.5).exp().mul(2))
    this.emissiveNode = front.fire.mul(3.4).add(farWall)
      .add(color(hsl.integer(225, 93, 43)).mul(canals).mul(0.22).mul(near.mul(0.5).add(0.5)))
      .add(color(hsl.integer(211, 100, 89)).mul(plankton).mul(twinkle).mul(intimate).mul(1.3))
      .add(color(hsl.integer(234, 90, 47)).mul(grazing.pow(3)).mul(0.3))
  }
}
