import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {blackbodyColor} from '../../candidates/claude_opus/lib/blackbody.ts'
import {ramp} from '../../candidates/claude_opus/lib/ramp.ts'
import {tubeCells} from '../../candidates/claude_opus/lib/tubeMetric.ts'
import {voronoiBorder} from '../../candidates/claude_opus/lib/voronoiBorder.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Alligator crackle of charred wood: blocks a little longer along the grain than across it. */
const blocks: [number, number] = [80, 13]
const fissures: [number, number] = [240, 39]
/** Glow of a black body: chromaticity from Planck’s law, brightness on a perceptual curve from dull red to yellow-white. */
const incandescence = (heat: Node<'float'>) => {
  const t = heat.clamp(0, 1.3)
  return blackbodyColor(t.mul(1000).add(650)).mul(t.pow(3).mul(2.2))
}
/**
 * Charred wood banked under its own ash. The fire lives in the cracks between blackened blocks: deep fissures glow
 * hotter the further you can see into them, a slow convective breath rolls through the coals, and little pockets of gas
 * pop into bright flares. The coals answer the visitor – step close and they flare up around you, the heat creeping out
 * of the cracks across the faces of the blocks.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.4)
    this.name = knotData.id
    const tube = uv()
    const {p, facing, distance, objectDistance} = viewerFrame()
    const cells = tubeCells(tube, ...blocks)
    const crackle = voronoiBorder(cells, blocks, 7, 0.8)
    const fine = voronoiBorder(tubeCells(tube, ...fissures), fissures, 13, 0.9)
    const footprint = cells.fwidth().length().max(0.0005)
    const fineFootprint = footprint.mul(3)
// Crack widths wander along each fissure; blocks whose wood shrank more pull further apart.
    const wander = mx_noise_float(p.mul(22)).mul(0.5).add(0.5)
    const width = wander.mul(0.035).add(0.018).add(crackle.random.x.mul(0.02))
    const crack = crackle.border.smoothstep(width.sub(footprint), width.add(footprint)).oneMinus()
    const crackCore = crackle.border.div(width.max(footprint)).clamp().oneMinus().pow(2)
    const fineWidth = float(0.035)
    const fissure = fine.border.smoothstep(fineWidth.sub(fineFootprint), fineWidth.add(fineFootprint)).oneMinus().mul(crackle.border.smoothstep(0.06, 0.12))
      .mul(fineFootprint.smoothstep(0.08, 0.25).oneMinus())
// Convection: a slow breath swells and ebbs through the coals in drifting waves.
    const draft = mx_fractal_noise_float(p.mul(2.6).add(vec3(0, time.mul(-0.12), time.mul(0.05))), 3, 2, 0.5)
    const breath = time.mul(0.8).add(draft.mul(4)).sin().mul(0.5).add(0.5)
    const ember = mx_noise_float(p.mul(9).add(vec3(time.mul(0.07), 0, 0))).mul(0.5).add(0.5)
// The visitor’s presence: the whole bed wakes as you approach and the coals nearest you flare.
    const awake = ramp(objectDistance, 3.2, 1)
    const flare = ramp(distance, 1.5, 0.35).mul(facing.mul(0.6).add(0.4))
    const heat = float(0.16).add(breath.mul(0.18)).add(ember.mul(0.1)).add(awake.mul(0.2)).add(flare.mul(0.55))
// Hot gas pockets pop and fade at random spots along the cracks.
    const popCells = cells.mul(vec2(2, 2))
    const popId = popCells.floor()
    const popRandom = cellNoiseVec3(vec3(popId, 31))
    const popClock = time.mul(popRandom.y.mul(0.3).add(0.12)).add(popRandom.x.mul(9))
    const popLife = popClock.fract()
    const popGate = cellNoiseVec3(vec3(popId, popClock.floor())).x.smoothstep(0.72, 0.8)
    const pop = popLife.mul(-7).exp().mul(popLife.smoothstep(0, 0.02)).mul(popGate)
    const popSpot = popCells.fract().sub(popRandom.xz.mul(0.6).add(0.2)).length().smoothstep(0, 0.35).oneMinus().mul(pop)
// Looking straight into a fissure reveals its white-hot root; at a glancing angle only the dull red walls show.
    const depthView = facing.smoothstep(0.15, 0.85)
    const crackHeat = heat.add(crackCore.mul(depthView).mul(0.32)).add(popSpot.mul(0.6)).add(crackle.random.z.sub(0.5).mul(0.12))
    const crackGlow = incandescence(crackHeat).mul(crack).mul(crackCore.mul(0.7).add(0.3))
    const fissureGlow = incandescence(heat.sub(0.08)).mul(fissure).mul(0.6)
// When the coals flare, heat creeps out of the cracks over the faces of the blocks.
    const faceHeat = heat.sub(crackle.border.mul(mix(float(9), float(3.5), flare.add(awake.mul(0.2)).clamp()))).sub(0.12)
    const ash = mx_fractal_noise_float(p.mul(14).add(vec3(3.1, 0, 0)), 3, 2.2, 0.55).add(crackle.random.y.sub(0.5).mul(0.6)).smoothstep(0.05, 0.32)
    const faceGlow = incandescence(faceHeat).mul(crack.oneMinus()).mul(mix(float(0.7), float(1.25), ash))
// Blocks are domed, split by fissures and furred with charcoal grain; ash lies in drifts on top.
    const dome = crackle.border.smoothstep(0, 0.3).pow(0.6)
    const grain = mx_fractal_noise_float(vec3(cells.x.mul(2), cells.y.mul(14), crackle.random.x.mul(10)), 3, 2, 0.5)
    const grainResolved = footprint.smoothstep(0.02, 0.08).oneMinus()
    const height = dome.mul(0.006).sub(fissure.mul(0.0012)).add(grain.mul(0.0006).mul(grainResolved)).add(ash.mul(0.0008))
    this.normalNode = proceduralNormal(height, 1)
    const charcoal = mix(color(hsl.integer(18, 6, 4)), color(hsl.integer(43, 13, 8)), crackle.random.y.mul(0.6).add(grain.mul(0.4)).clamp())
    const ashColor = mix(color(hsl.integer(59, 6, 24)), color(hsl.integer(68, 7, 45)), mx_noise_float(p.mul(60)).mul(0.5).add(0.5))
    this.colorNode = mix(mix(charcoal, ashColor, ash.mul(0.75)), color(hsl.integer(42, 100, 6)), crack)
    this.metalnessNode = mix(float(0.25), float(0), ash.max(crack))
    this.roughnessNode = mix(float(0.42), float(0.95), ash).add(grain.mul(0.08))
// Charcoal has a silky, silvery luster that skims across the grain.
    this.sheenNode = color(hsl.integer(264, 17, 28)).mul(ash.oneMinus()).mul(crack.oneMinus())
    this.sheenRoughness = 0.45
// Faint heat shimmer over the hottest coals.
    const shimmer = mx_noise_float(p.mul(30).add(vec3(0, time.mul(-1.4), 0))).mul(0.06).mul(heat.smoothstep(0.6, 1)).add(1)
    const flicker = time.mul(TAU * 0.9).add(p.x.mul(13)).sin().mul(0.04).add(1)
    this.emissiveNode = crackGlow.add(fissureGlow).add(faceGlow).mul(shimmer).mul(flicker)
  }
}
