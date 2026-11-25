import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_noise_vec3, normalLocal, positionGeometry, time} from 'three/tsl'

import {colorRamp} from '../../candidates/deepseek/lib/colorRamp.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Irregular mineral grains. A noise-warped cubic lattice keeps every grain's identity stable in object space, so a grain keeps flashing the same color no matter where the viewer stands. The warp runs at roughly the grain frequency, which bends the cell walls into organic shapes instead of leaving a visible grid. */
function mineralGrains(position: Node<'vec3'>, scale: number, warp: number, seed: number) {
  const q = position.mul(scale).add(mx_noise_vec3(position.mul(scale * 0.9).add(seed)).mul(warp))
  const cell = q.floor()
  const local = q.fract().sub(0.5)
  const identity = cellNoiseVec3(cell.add(seed))
  const secondary = cellNoiseVec3(cell.add(seed + 41.7))
// Unit lamella normal: the direction the grain's internal planes face.
  const lamella = identity.mul(2).sub(1).normalize()
// Distance to the nearest grain wall, normalized so 1 sits on the wall.
  const wall = local.abs().x.max(local.abs().y).max(local.abs().z).mul(2).clamp(0, 1)
  return {
    q,
    local,
    identity,
    secondary,
    lamella,
    wall,
  }
}

/** Labradorite: a dark feldspar whose internal twinning planes interfere with the light. Each grain owns one lamella orientation, so the whole grain ignites in a single saturated hue only while the viewer stands inside a narrow cone of directions – walk around the knot and the stone rearranges itself into a different constellation of blue, cyan, green and gold. The grains are sampled a little way beneath the surface, so the flashes slide across the stone as the viewer moves, exactly like a real inclusion. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {p, view, grazing, intimate} = viewerFrame()
    const coarse = mineralGrains(p.add(view.mul(0.05)), 5.5, 0.62, 0)
    const fine = mineralGrains(p.add(view.mul(0.02)), 17, 0.5, 13.3)
// A slow drift of the lamella orientation softens the grain walls, so the
// flash never ends on a hard geometric edge.
    const drift = mx_noise_vec3(p.mul(2.6)).normalize()
    const coarseLamella = coarse.lamella.mul(0.72).add(drift.mul(0.28)).normalize()
    const fineLamella = fine.lamella.mul(0.8).add(drift.mul(0.2)).normalize()
// Schiller lobes: a grain is either dark or blazing, never in between.
    const coarseAlign = view.dot(coarseLamella).abs()
    const fineAlign = view.dot(fineLamella).abs()
    const coarseLobe = coarseAlign.smoothstep(0.5, 0.96)
    const fineLobe = fineAlign.smoothstep(0.62, 0.99).mul(intimate)
// Light that scatters sideways through the host mineral, so the flash sits in
// a faint halo instead of being pasted flat onto the surface.
    const coarseHalo = coarseAlign.smoothstep(0.12, 0.85).mul(0.22)
    const fineHalo = fineAlign.smoothstep(0.2, 0.9).mul(0.12).mul(intimate)
// Squaring the identity biases the stone towards its signature peacock blue,
// leaving the lime and gold flashes as rare events.
    const coarseHue = colorRamp(coarse.secondary.x.pow(2), [hsl.integer(264.1, 100, 40.4), hsl.integer(258, 100, 53), hsl.integer(230, 100, 72), hsl.integer(160, 100, 86), hsl.integer(90, 100, 84)])
    const fineHue = colorRamp(fine.secondary.z.pow(2), [hsl.integer(219, 100, 77.4), hsl.integer(155, 100, 87), hsl.integer(95, 100, 89.5), hsl.integer(340, 100, 68.4), hsl.integer(280, 100, 52)])
// Some grains are simply richer than others.
    const coarsePower = coarse.secondary.y.smoothstep(0.1, 0.9).mul(0.7).add(0.3)
    const finePower = fine.secondary.y.smoothstep(0.2, 0.9).mul(0.5).add(0.25)
// Smoky plagioclase matrix with ilmenite flecks.
    const smoky = mx_noise_float(p.mul(3.2)).mul(0.5).add(0.5)
    const cloudy = mx_noise_float(p.mul(11)).mul(0.5).add(0.5)
    const speck = mx_noise_float(p.mul(150)).mul(0.5).add(0.5)
    const fleck = speck.smoothstep(0.72, 0.8)
    const body = mix(color(hsl.integer(268, 62, 2.5)), color(hsl.integer(259, 31, 6.5)), smoky.mul(0.5).add(cloudy.mul(0.3)).add(speck.mul(0.16))).mul(fleck.mul(0.4).oneMinus())
// A slow shimmer keeps the stone from feeling like a still photograph.
    const shimmer = time.mul(0.35).add(coarse.secondary.z.mul(6.283)).sin().mul(0.06).add(0.94)
// Twin lamellae: fine parallel sheets inside every grain. They settle to their
// mean near the grain walls and once they fall below the pixel grid, so the
// stone never shows a dashed seam or an aliased sparkle.
    const bandPhase = p.dot(coarseLamella).mul(72)
    const bandFade = bandPhase.fwidth().max(0.001).smoothstep(0.5, 2.5).oneMinus().mul(coarse.wall.smoothstep(0.55, 0.95).oneMinus())
    const band = bandPhase.sin().mul(0.5).add(0.5).mul(bandFade).add(bandFade.oneMinus().mul(0.5))
// A faint internal veil keeps every flash from reading as a flat swatch.
    const veil = mx_noise_float(p.mul(46)).mul(0.5).add(0.5).mul(0.35).add(0.72)
    const flash = coarseHue.mul(coarseLobe).mul(coarsePower).mul(shimmer).mul(band.mul(0.6).add(0.4)).mul(veil)
    const fineFlash = fineHue.mul(fineLobe).mul(finePower).mul(veil)
    const halo = coarseHue.mul(coarseHalo).add(fineHue.mul(fineHalo))
    this.colorNode = body.add(flash.mul(0.16)).add(fineFlash.mul(0.12)).add(halo.mul(0.1))
    this.metalness = 0.04
    this.roughnessNode = float(0.12).sub(flash.max(fineFlash).mul(0.06)).clamp(0.05, 0.16)
    this.clearcoat = 0.6
    this.clearcoatRoughness = 0.04
    this.iridescence = 0.25
    this.iridescenceIOR = 1.42
    this.iridescenceThicknessNode = coarse.secondary.y.mul(200).add(200)
    const relief = smoky.mul(0.35).add(cloudy.mul(0.25)).add(speck.mul(0.2))
    this.normalNode = proceduralNormal(relief, 0.0003)
    this.clearcoatNormalNode = this.normalNode
    this.emissiveNode = flash.mul(1.35).add(fineFlash.mul(0.7)).add(halo.mul(0.35)).add(color(hsl.integer(266, 100, 61)).mul(grazing.pow(3)).mul(0.02))
    this.aoNode = float(0.9)
    this.positionNode = positionGeometry.add(normalLocal.mul(coarse.wall.smoothstep(0.9, 1).mul(-0.0006)))
  }
}
