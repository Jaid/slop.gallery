import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, mix, mx_fractal_noise_float, mx_fractal_noise_vec3, mx_noise_float, normalLocal, normalViewGeometry, tangentLocal, time, transformNormalToView, vec2, vec3} from 'three/tsl'

import {below} from '../../candidates/claude_opus/lib/below.ts'
import {rgb} from '../../candidates/claude_opus/lib/rgb.ts'
import {knotLength, tubeCircumference, tubeCoordinates} from '../../candidates/claude_opus/lib/tubeCoordinates.ts'
import {voronoi} from '../../candidates/claude_opus/lib/voronoi3dStruct.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Scales around the tube; rows along the knot are chosen so each scale is nearly round. The row count is a multiple of four, so both the half-scale stagger and the wash's four-row rhythm meet seamlessly where the knot closes. */
const scalesAround = 6
const rowsAlong = 4 * Math.round(knotLength / (tubeCircumference / scalesAround) / 2)
const glazeIndex = 1.5
/** Seigaiha: overlapping fans of concentric arcs. Each row is laid over the one above it, so only the fans' crowns show. */
function seigaiha(x: Node<'float'>, y: Node<'float'>) {
// x in scale widths around the tube, y in half-scale rows along it; fans have radius 0.5 scale widths.
  const base = y.floor()
  let row: Node<'float'> = float(0)
  let radial: Node<'float'> = float(1)
  let local: Node<'vec2'> = vec2(0)
// Later assignments win, so walk from the back row to the front row.
  for (const offset of [1, 0, -1]) {
    const j = base.add(offset)
    const shift = j.mod(2).mul(0.5)
    const dx = x.sub(shift).sub(x.sub(shift).round())
    const dy = y.sub(j).mul(0.5)
    const d = vec2(dx, dy).length().div(0.5)
    const inside = d.lessThan(1).and(dy.greaterThanEqual(-0.02))
    row = inside.select(j, row)
    radial = inside.select(d, radial)
    local = inside.select(vec2(dx, dy), local)
  }
  return {
    row,
    radial,
    local,
  }
}
/** Blue-and-white porcelain with a seigaiha sea, cobalt brushed under a thick glaze, crackled by age – and once shattered. The shards were rejoined with gold lacquer, slightly out of register as real mends are. The painted waves still roll slowly along the knot, a molten glimmer travels the scars, and the gold warms when a visitor comes close. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const {along, around} = tubeCoordinates()
// Shards: large Voronoi cells, with jagged meandering walls.
    const jag = mx_fractal_noise_vec3(p.mul(9), 3, 2.2, 0.5).mul(0.09).add(mx_fractal_noise_vec3(p.mul(34), 2, 2, 0.5).mul(0.02))
    const shards = voronoi(p.mul(2.3).add(jag), 0.85)
    const shardShift = shards.random.sub(0.5)
// Not every Voronoi wall broke: a slow field decides which walls are real fractures, tapering them to hairline ends.
    const breakField = mx_noise_float(p.mul(1.6).add(11.3)).mul(0.5).add(0.5)
    const fracture = breakField.smoothstep(0.34, 0.52)
// Where the break chipped, the lacquer widened into small gold islands.
    const chip = mx_noise_float(p.mul(26).add(4.2)).smoothstep(0.35, 0.75).mul(0.018)
    const crackWidth = fracture.mul(mx_noise_float(p.mul(14)).mul(0.3).add(0.8).mul(0.017).add(chip))
    const crackFootprint = shards.border.fwidth().max(0.0001)
    const gold = shards.border.smoothstep(crackWidth, crackWidth.add(crackFootprint.mul(1.2))).oneMinus().mul(fracture.smoothstep(0.02, 0.25))
// A hairline of shadow along the gold's edge, where lacquer meets glaze.
    const lip = shards.border.smoothstep(crackWidth.add(0.004), crackWidth.add(0.02).add(crackFootprint)).oneMinus().sub(gold).max(0).mul(fracture)
// Cobalt lies under the glaze: refract the view through it, then read the painting in tube space.
    const alongDirection = tangentLocal.xyz.normalize()
    const aroundDirection = n.cross(alongDirection).normalize()
    const cosIncident = n.dot(view).clamp(0, 1)
    const lateral = view.sub(n.mul(cosIncident))
    const refractedCos = lateral.dot(lateral).div(glazeIndex ** 2).oneMinus().max(0.05).sqrt()
    const underGlaze = lateral.div(glazeIndex).div(refractedCos).mul(0.004)
    const tide = time.mul(0.18)
    const x = around.sub(underGlaze.dot(aroundDirection).div(tubeCircumference)).mul(scalesAround).add(shardShift.x.mul(0.22))
    const y = along.sub(underGlaze.dot(alongDirection).div(knotLength)).mul(rowsAlong).add(tide).add(shardShift.y.mul(0.5))
    const fan = seigaiha(x, y)
// Brushwork: arcs of uneven weight, a heavier outer stroke, cobalt pooling at stroke edges, and pale wash between lines.
    const brushNoise = mx_fractal_noise_float(p.mul(38), 3, 2, 0.5)
    const rings = fan.radial.mul(4).add(brushNoise.mul(0.12))
    const ringDistance = rings.fract().sub(0.5).abs()
    const ringFootprint = rings.fwidth().max(0.001)
    const strokeWidth = float(0.16).add(brushNoise.mul(0.06)).add(fan.radial.smoothstep(0.7, 1).mul(0.1))
    const stroke = ringDistance.smoothstep(strokeWidth.sub(ringFootprint), strokeWidth.add(ringFootprint)).oneMinus()
    const pooling = ringDistance.smoothstep(strokeWidth.mul(0.4), strokeWidth).mul(stroke)
    const heart = fan.radial.smoothstep(0.2, 0.26).oneMinus()
    const crownGap = fan.radial.smoothstep(0.95, 0.99)
    const wash = fan.radial.smoothstep(0.25, 0.75).mul(0.22).mul(fan.row.mod(4).lessThan(2).select(float(1), float(0.45)))
// Heaping and piling: dark specks where cobalt crystallized in the firing.
    const speckCells = voronoi(p.mul(160), 0.8)
    const speck = speckCells.distance.smoothstep(0.12, 0.2).oneMinus().mul(below(speckCells.random.x, 0.12)).mul(p.mul(160).fwidth().length().smoothstep(0.4, 1).oneMinus())
    const cobaltDensity = stroke.mul(brushNoise.mul(0.25).add(0.8)).max(heart).max(wash).mul(crownGap.oneMinus()).add(speck.mul(stroke.max(0.3))).clamp()
// Cobalt as an absorbing pigment: thin washes stay a clear sky blue and thick strokes sink to ink, never lavender.
    const pigment = cobaltDensity.add(pooling.mul(0.35)).mul(2.4)
// Crackle: a fine web of age lines in the glaze, tea-stained, fading before they would alias.
    const crackleScale = p.mul(17).add(jag.mul(3))
    const crackle = voronoi(crackleScale, 0.9)
    const crackleWidth = mx_noise_float(p.mul(8)).mul(0.008).add(0.012)
    const crackleLine = crackle.border.smoothstep(0, crackle.border.fwidth().mul(1.2).add(crackleWidth)).oneMinus().mul(crackleScale.fwidth().length().smoothstep(0.25, 0.6).oneMinus())
    const porcelain = mix(rgb(hsl.integer(90, 27, 95)), rgb(hsl.integer(256, 36, 94)), mx_noise_float(p.mul(3)).mul(0.5).add(0.5))
    const painted = porcelain.mul(vec3(-1.9, -1.25, -0.32).mul(pigment).exp())
    const glazed = mix(painted, painted.mul(rgb(hsl.integer(64, 47, 37))), crackleLine.mul(0.75)).mul(lip.mul(0.5).oneMinus())
// Gold lacquer: a rounded bead of powdered gold with its own tiny flakes.
    const beadOffset = shards.border.div(crackWidth.add(0.002)).clamp()
    const bead = beadOffset.pow2().oneMinus().sqrt().mul(gold)
// Analytic bead normal: tilt away from the seam's spine along the direction to the fracture wall.
    const awayFromSpine = shards.borderDirection.negate().sub(n.mul(shards.borderDirection.negate().dot(n))).normalize()
    const beadNormal = n.add(awayFromSpine.mul(beadOffset.mul(0.85).div(beadOffset.mul(0.85).pow2().oneMinus().sqrt()))).normalize()
    const powder = cellNoiseVec3(p.mul(900))
    const goldColor = mix(rgb(hsl.integer(68, 86, 47)), rgb(hsl.integer(83, 80, 77)), powder.x.mul(0.5).add(bead.mul(0.5)))
    this.colorNode = mix(glazed, goldColor, gold)
    this.metalnessNode = gold
    this.roughnessNode = mix(float(0.42), float(0.07).add(powder.y.mul(0.12)), gold)
    this.clearcoatNode = gold.oneMinus()
    this.clearcoatRoughness = 0.04
    this.clearcoatNormalNode = normalViewGeometry
// Relief: a raised gold bead, faint brush ridges under the glaze, and the crackle's hairline valleys.
    const glazeNormal = proceduralNormal(stroke.mul(0.03).sub(crackleLine.mul(0.08)).sub(lip.mul(0.2)), 0.004)
    const beadView = transformNormalToView(beadNormal)
    this.normalNode = mix(glazeNormal, beadView, gold).normalize()
// A slow tide of molten light runs through the scars, and the gold warms when a visitor leans in.
    const flowPhase = p.dot(vec3(0.6, 0.5, 0.62)).mul(5).add(mx_noise_float(p.mul(3)).mul(1.5)).sub(time.mul(0.45))
    const flow = flowPhase.sin().mul(0.5).add(0.5).pow(10)
    const sparkle = glints(beadView.add(powder.sub(0.5).mul(0.5)).normalize(), 260).mul(below(powder.z, 0.05))
// Gallery spotlights running along the rounded crest of each bead.
    const crestLight = glints(beadView, 110)
    this.emissiveNode = rgb(hsl.integer(72, 100, 79.1)).mul(gold).mul(flow.mul(0.55).add(intimate.mul(0.18)).add(0.02))
      .add(rgb(hsl.integer(92, 100, 95)).mul(sparkle).mul(gold).mul(near.mul(0.5).add(0.15)))
      .add(rgb(hsl.integer(85, 100, 88.5)).mul(crestLight).mul(gold).mul(1.3))
      .add(rgb(hsl.integer(266, 100, 92)).mul(grazing.pow(4)).mul(gold.oneMinus()).mul(0.05).mul(facing.add(0.5)))
  }
}
