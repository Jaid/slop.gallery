import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, luminance, mix, time, uv, vec2, vec3} from 'three/tsl'

import {tubeCells} from '../../candidates/muse_wonder/lib/tubeMetric.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A wing folded into a knot: thousands of small, flat scales shingled along the tube in metric-corrected, half-staggered cells, so none of them stretch. Colour is structural, never pigment – a diffraction phase steered by grazing angle and shared along whole patches of the wing, running from deep indigo through electric blue and cyan to violet. A slow shiver travels the knot, tilting scale after scale into the light. Across the room it is one saturated flash; up close, grooved scale edges and micro-ridges resolve. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const tube = uv()
    const {view, grazing, near, intimate} = viewerFrame()
// Shingled scale lattice in true tube metric: rows along, scales around, half-offset per row.
    const cells = tubeCells(tube, 560, 64)
    const row = cells.x.floor()
    const shiftedY = cells.y.add(row.mul(0.5))
    const cell = vec2(row, shiftedY.floor())
    const local = vec2(cells.x.fract(), shiftedY.fract())
    const random = cellNoiseVec3(vec3(cell.x, cell.y, 17.31))
// A slow shiver runs the length of the wing, tilting every scale in turn.
    const shiver = tube.x.mul(TAU * 3).sub(time.mul(Math.PI)).add(random.z.mul(0.7)).sin()
// Diffraction phase: steered by view and shared along the wing, jittered per scale.
    const wave = grazing.mul(2).add(view.z.mul(0.7)).add(tube.x.mul(1.7)).add(random.x.sub(0.5).mul(0.55)).add(random.y.mul(0.3)).add(shiver.mul(0.13)).mul(TAU).sin().mul(0.5).add(0.5)
    const flash = wave.pow(4)
    let scaleColor = mix(color(hsl.integer(265, 98, 16)), color(hsl.integer(263.5, 100, 38)), wave.smoothstep(0.05, 0.45))
    scaleColor = mix(scaleColor, color(hsl.integer(224, 100, 75)), wave.smoothstep(0.45, 0.75))
    scaleColor = mix(scaleColor, color(hsl.integer(295, 100, 50.7)), wave.smoothstep(0.78, 0.98).mul(0.85))
    scaleColor = scaleColor.mul(local.x.mul(0.4).add(0.85)).mul(1.05)
// Push chroma hard so studio highlights gleam blue instead of washing to silver.
    scaleColor = mix(vec3(luminance(scaleColor)), scaleColor, 1.7).max(0)
// Grooves between scales, the shadow under each tip, and a bright tip arc.
    const groove = local.y.min(local.y.oneMinus()).smoothstep(0, 0.1)
    const tipArc = local.x.add(local.y.sub(0.5).pow(2).mul(0.6)).smoothstep(0.82, 0.9).mul(local.x.smoothstep(0.97, 1).oneMinus())
    this.colorNode = scaleColor.mul(groove.mul(0.35).add(0.65)).mul(local.x.smoothstep(0.92, 1).mul(0.35).add(0.85)).add(color(hsl.integer(232, 100, 84)).mul(tipArc).mul(0.05))
// Near-metallic tinted reflection keeps the structural colour saturated in the highlights.
    this.metalnessNode = float(0.78)
    this.roughnessNode = mix(float(0.32), float(0.2), flash)
// Flat tilted plates: a ramp along each scale, a shallow fall across it, fine ridges near.
    const ridges = local.y.mul(7).mul(TAU).sin().mul(0.025).mul(near)
    const height = local.x.mul(0.55).add(local.y.sub(0.5).abs().mul(-0.3)).add(ridges).add(shiver.mul(0.02))
    this.normalNode = proceduralNormal(height, 0.4)
    this.iridescenceNode = flash.mul(0.22)
    this.iridescenceIORNode = float(1.32)
    this.iridescenceThicknessNode = float(140).add(random.y.mul(230)).add(local.x.mul(150))
    this.anisotropyNode = vec2(0.55, 0.12)
    this.clearcoat = 0
    this.aoNode = groove.mul(0.45).add(0.55)
    this.emissiveNode = scaleColor.mul(flash).mul(grazing.mul(0.4).add(intimate.mul(0.3)).add(0.3)).mul(0.6).mul(shiver.mul(0.25).add(0.85))
  }
}
