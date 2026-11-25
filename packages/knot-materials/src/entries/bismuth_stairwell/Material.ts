import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalViewGeometry, time, vec2} from 'three/tsl'

import {bumpNormal} from '../../candidates/claude_sonnet/lib/bumpNormal.ts'
import {tangentViewFrame, tubeGrid} from '../../candidates/claude_sonnet/lib/tubeGrid.ts'
import {tubeVoronoi} from '../../candidates/claude_sonnet/lib/tubeVoronoiBorder.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Hopper crystals of bismuth: every Voronoi grain is its own rectangular spiral of terraces, hollow at the center. An oxide film of different thickness on each stair turns the metal magenta, gold, cyan and violet, and the film colors slide as the viewer walks around, so the stairs seem to light up one after another. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {near, intimate, grazing, facing} = viewerFrame()
    const cells = tubeGrid(7)
    const grain = tubeVoronoi(cells.period, 6.3, 0.75)(cells.grid)
    const view = tangentViewFrame()
  // Each grain has its own lattice rotation; terraces are concentric squares (Chebyshev distance).
    const angle = grain.id.x.mul(Math.PI * 0.5)
    const c = angle.cos()
    const s = angle.sin()
    const local = vec2(grain.offset.x.mul(c).add(grain.offset.y.mul(s)), grain.offset.y.mul(c).sub(grain.offset.x.mul(s)))
    const cheb = local.x.abs().max(local.y.abs())
    const q = cheb.mul(grain.id.y.mul(5).add(9))
    const resolved = q.fwidth().smoothstep(0.45, 1.2).oneMinus()
    const level = q.floor()
    const stepped = level.add(q.fract().smoothstep(0.72, 0.96))
    const terrace = stepped.mix(q, resolved.oneMinus())
  // Wall = the steep face between stairs; it is dark and does not carry the oxide color.
    const wall = q.fract().smoothstep(0.72, 0.84).mul(q.fract().smoothstep(0.9, 0.98).oneMinus()).mul(resolved)
    const seam = grain.edge.smoothstep(0.015, 0.07)
    const height = terrace.mul(0.0034).sub(seam.oneMinus().mul(0.0012))
    this.normalNode = bumpNormal(normalViewGeometry.normalize(), height)
  // Oxide color: thickness follows the stair index, the view angle slides the whole ladder through the spectrum.
    const sway = view.z.mul(0.9).add(view.x.mul(0.35)).add(view.y.mul(0.2))
    const filmPhase = level.mul(0.115).add(grain.id.z.mul(0.9)).add(sway).add(q.fract().mul(0.05)).add(time.mul(0.018))
    const oxide = spectralColor(filmPhase)
    const oxideBoost = oxide.mul(oxide).mul(1.5).add(oxide.mul(0.1))
    const silver = color(hsl.integer(303, 12, 39))
    const tint = mix(silver, oxideBoost, wall.oneMinus().mul(0.78).mul(seam.mul(0.4).add(0.6)))
    this.colorNode = tint.mul(wall.mul(0.6).oneMinus()).mul(seam.mul(0.55).add(0.45))
    this.metalness = 1
    this.roughnessNode = float(0.075).add(wall.mul(0.22)).add(seam.oneMinus().mul(0.25)).sub(near.mul(0.015))
    this.iridescence = 0.85
    this.iridescenceIOR = 1.9
    this.iridescenceThicknessNode = level.mul(38).add(grain.id.z.mul(160)).add(180)
    this.clearcoat = 0.25
    this.clearcoatRoughness = 0.04
    const glitter = glints(bumpNormal(normalViewGeometry.normalize(), height), 260).mul(wall.oneMinus()).mul(0.05)
  // A wave of warm light climbs each grain outward, stair by stair, at a rate unique to the grain.
    const climb = level.mul(0.55).sub(time.mul(grain.id.x.mul(0.5).add(0.6))).add(grain.id.y.mul(6.28)).sin().mul(0.5).add(0.5).pow(6).mul(wall.oneMinus()).mul(seam)
    this.emissiveNode = oxideBoost.mul(climb.mul(0.09).add(0.02))
      .add(oxideBoost.mul(wall.oneMinus()).mul(grazing.pow(2).mul(0.16).add(intimate.mul(0.035)).add(facing.mul(0.02)))
        .add(color(hsl.integer(326, 100, 97)).mul(glitter)))
  }
}
