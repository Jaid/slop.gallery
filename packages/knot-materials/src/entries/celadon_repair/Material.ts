import type {Node, Texture} from 'three/webgpu'

import {color, float, mix, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, normalViewGeometry, time, vec3} from 'three/tsl'

import {parallaxOffset, surfaceFrame, tubeSpace} from '../../candidates/claude_opus/lib/knotSpace.ts'
import {voronoiCells} from '../../candidates/claude_opus/lib/voronoi3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const glazeIndex = 1.53
/** Celadon absorbs red and blue in the iron-bearing glaze; units are per object-space unit of light path. */
const glazeAbsorption = vec3(26, 9, 19)
/** Fracture network: a warped Voronoi border, so breaks wander like real ones instead of running straight. */
function fracture(position: Node<'vec3'>, scale: number, warp: number, seed: number) {
  const bend = mx_noise_vec3(position.mul(scale * 0.55).add(seed)).mul(warp)
  return voronoiCells(position.mul(scale).add(bend).add(seed), 0.9)
}
/** Celadon porcelain mended with gold. The glaze is a real absorbing layer: it deepens to jade where it pools and where the eye meets it at a slant, and the two crackle networks of Ge ware – iron threads and golden wires – lie inside it, shifting with parallax. The great fractures are filled with raised gold lacquer; a slow wave of light passes through them, as if the mending were still going on. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const {along} = tubeSpace()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const {normal} = surfaceFrame()
// The mend: a few great fractures, chosen from a coarse warped network, plus chips filled solid with gold.
    const breaks = fracture(p, 2.3, 0.55, 3.7)
    const seamWidth = mx_noise_float(p.mul(9).add(2.2)).mul(0.5).add(0.5).mul(0.012).add(0.007)
    const seamFootprint = breaks.border.fwidth().max(0.00001)
// Only some of the network is broken; a smooth regional fade lets each fracture taper out instead of ending abruptly.
    const seamSelect = mx_noise_float(p.mul(1.6).add(8.8)).smoothstep(-0.25, 0.05)
    const seam = breaks.border.smoothstep(seamWidth.sub(seamFootprint), seamWidth.add(seamFootprint)).oneMinus().mul(seamSelect)
// Gold hairlines branch off the main seams.
    const branches = fracture(p, 7.5, 0.35, 11.1)
    const nearSeam = breaks.border.smoothstep(0.02, 0.16).oneMinus().mul(seamSelect)
    const branchGate = mx_cell_noise_float(branches.cell.add(0.5)).smoothstep(0.35, 0.5)
    const branch = filteredRibbon(branches.border, 0.0045).mul(nearSeam).mul(branchGate)
// Chips: a few whole fragments of the branch network, lost and replaced with solid gold.
    const chip = mx_cell_noise_float(branches.cell.add(7.5)).smoothstep(0.93, 0.935).mul(nearSeam.smoothstep(0.2, 0.6)).mul(branches.border.smoothstep(0, branches.border.fwidth().mul(1.5).add(0.002)))
    const gold = seam.max(branch.mul(0.85)).max(chip)
// Crackle inside the glaze: coarse iron threads at depth, fine golden wires nearer the surface.
    const ironDepth = 0.0045
    const wireDepth = 0.0022
    const iron = filteredRibbon(fracture(p.add(parallaxOffset(view, normal, ironDepth)), 14, 0.18, 5.3).border, 0.012)
    const wireGate = mx_noise_float(p.mul(5).add(1.9)).smoothstep(-0.3, 0.2)
    const wire = filteredRibbon(fracture(p.add(parallaxOffset(view, normal, wireDepth)), 38, 0.12, 9.6).border, 0.014).mul(wireGate).mul(near.mul(0.5).add(0.5))
// Glaze: thickness pools and thins; light crosses it twice, refracted, so slants turn the celadon deeper.
    const pooling = mx_fractal_noise_float(p.mul(3.2), 3, 2, 0.5).mul(0.5).add(0.5)
    const thickness = pooling.mul(0.012).add(0.006)
    const cosRefracted = view.dot(normal).clamp(0, 1).pow2().oneMinus().div(glazeIndex ** 2).oneMinus().sqrt()
    const transmittance = glazeAbsorption.mul(thickness).mul(2).div(cosRefracted.max(0.25)).negate().exp()
    const porcelain = color('#d8d3c4')
    const celadon = transmittance.mul(porcelain).mul(iron.mul(0.82).oneMinus()).mul(wire.mul(0.45).oneMinus())
    const tinted = mix(celadon, transmittance.add(0.3).mul(color('#7a5426')), wire.mul(0.36))
// Gold: maki-e powder on the chips, burnished lacquer on the seams.
    const powder = cellularPoints(p.mul(900), 0.02, 0.2, 0.4).mul(intimate)
    const goldColor = mix(color('#ffcf6b'), color('#f0a93c'), mx_noise_float(p.mul(40)).mul(0.5).add(0.5))
    this.colorNode = mix(tinted, goldColor, gold)
    this.metalnessNode = gold
    this.roughnessNode = mix(float(0.06), mix(float(0.22), float(0.38), chip).sub(powder.mul(0.15)), gold)
    this.clearcoatNode = gold.oneMinus()
    this.clearcoatRoughness = 0.02
    this.ior = glazeIndex
// Relief: the lacquer stands proud of the glaze in a rounded bead; the glaze dips slightly into its cracks.
    const beadProfile = breaks.border.div(seamWidth).clamp().pow2().oneMinus().max(0).sqrt()
    const peel = mx_noise_float(p.mul(60)).mul(0.00005)
    const height = seam.mul(beadProfile).mul(0.0012).add(chip.mul(0.0006)).add(branch.mul(0.0003)).sub(iron.mul(0.00012)).add(peel)
    const surfaceNormal = proceduralNormal(height, 1)
    this.normalNode = surfaceNormal
    this.clearcoatNormalNode = normalViewGeometry
// The mending light: a slow tide running the length of the knot, catching only the gold.
    const tide = along.mul(TAU * 2).sub(time.mul(0.55)).sin().mul(0.5).add(0.5).pow(12)
    const sparkle = glints(surfaceNormal, 180).mul(powder.add(seam.mul(0.25)))
// Air bubbles caught in the glaze, for the close viewer.
    const bubbles = cellularPoints(p.add(parallaxOffset(view, normal, 0.003)).mul(220).add(4.4), 0.03, 0.11, 0.82).mul(intimate).mul(gold.oneMinus())
    this.emissiveNode = color('#ffb43c').mul(gold).mul(tide).mul(0.3)
      .add(color('#fff1c9').mul(sparkle).mul(0.25))
      .add(color('#eaf7ef').mul(bubbles).mul(facing).mul(0.08))
      .add(color('#0f2b1f').mul(grazing.pow(3)).mul(0.05).mul(gold.oneMinus()))
  }
}
