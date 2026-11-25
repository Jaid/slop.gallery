import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, uv} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import {filament} from '../../lib/filament.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 2. IRIDESCENT SCARAB Jewel-beetle carapace. Ridged chitin with structural colour that slides across the surface as you orbit; every edge gilded, every ridge burnished, every pore a soft amber pit. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, grazing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    // Longitudinal carapace ridges running with the knot.
    const ridgeFreq = tube.x.mul(Math.PI * 2 * 42)
    const ridgeWobble = mx_noise_float(p.mul(2.3)).mul(1.8)
    const ridgeField = ridgeFreq.add(ridgeWobble).sin()
    const ridge = filament(ridgeField, 0.42)
    // Transverse segment lines around the cross-section.
    const segment = filament(tube.y.mul(Math.PI * 2 * 5).fract().sub(0.5), 0.055)
    const segmentFine = filament(tube.y.mul(Math.PI * 2 * 15).fract().sub(0.5), 0.045).mul(intimate)
    // Micro-pits using cellular noise.
    const pitQ = p.mul(90)
    const pitRnd = cellNoiseVec3(pitQ)
    const pitD = pitQ.fract().sub(pitRnd.mul(0.5).add(0.25)).length()
    const pitFp = pitQ.fwidth().length().max(0.002)
    const pit = pitD.smoothstep(0.12, pitFp.add(0.2)).oneMinus()
    const pitColor = mix(color(hsl.integer(89, 81, 82)), color(hsl.integer(70, 86, 29)), pitRnd.y)
    // Structural colour — view-locked hue sweep.
    const viewHue = facing.mul(0.72)
      .add(tube.x.mul(0.55))
      .add(grazing.mul(0.35))
      .add(mx_noise_float(p.mul(1.8)).mul(0.08))
    const irid = cosinePalette(viewHue, [0.42, 0.48, 0.38], [0.42, 0.42, 0.5], [1, 1, 1], [0.12, 0.32, 0.62])
    // Deep emerald body, amber flank, gold crease.
    const emerald = mix(color(hsl.integer(149, 90, 15)), color(hsl.integer(148, 94, 38)), facing.mul(0.4).add(0.3))
    const goldFlank = color(hsl.integer(90, 86, 68))
    const gildedEdge = grazing.pow(2.4)
    const body = mix(emerald, goldFlank, gildedEdge.mul(0.85))
    const withIrid = mix(body, irid.mul(1.05), facing.pow(0.7).mul(0.55).add(0.25))
    const withPit = mix(withIrid, pitColor, pit.mul(0.55).mul(ridge.oneMinus().mul(0.6).add(0.4)))
    const ridgeHighlight = ridge.mul(0.4)
    this.colorNode = withPit
    this.metalnessNode = float(0.68).add(ridgeHighlight.mul(0.2)).add(gildedEdge.mul(0.25))
    this.roughnessNode = float(0.14)
      .add(ridge.mul(0.07))
      .add(pit.mul(0.22))
      .add(segment.mul(0.06))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.035
    this.iridescence = 1
    this.iridescenceIOR = 1.85
    this.iridescenceThicknessNode = viewHue.mul(180).add(210)
    this.normalNode = proceduralNormal(ridge.mul(0.85)
      .add(pit.mul(0.35))
      .add(segment.mul(0.5))
      .add(segmentFine.mul(0.25)), 0.0035)
    this.emissiveNode
      = color(hsl.integer(96, 100, 91.2)).mul(gildedEdge.pow(1.6)).mul(near.mul(0.55).add(0.08)).mul(0.55)
        .add(color(hsl.integer(133, 99, 93)).mul(ridgeHighlight).mul(intimate).mul(0.12))
        .add(color(hsl.integer(90, 84, 82)).mul(rim).mul(0.08))
  }
}
