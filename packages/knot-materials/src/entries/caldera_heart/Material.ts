import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, time, uv, vec3} from 'three/tsl'

import {parallaxOffset, surfaceFrame, tubeSpace} from '../../candidates/claude_opus/lib/knotSpace.ts'
import {blackbody} from '../../candidates/claude_opus/lib/spectrum.ts'
import {voronoiCells} from '../../candidates/claude_opus/lib/voronoi3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Crust plates per object unit; the tube carries roughly eight around its girth. */
const plateScale = 10
/** Depth of the molten surface below the crust, in object units – the fissures’ parallax. */
const magmaDepth = 0.016
/** Cooling lava. Basalt plates float on a molten core whose temperature – and therefore color and brightness, through Planck’s law – is a physical field. The fissures are real trenches: the magma lies below the crust, so walking around shifts it against the openings and the walls swallow it at grazing angles. A double heartbeat travels the knot, flushing every vein. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const tube = uv()
    const {along} = tubeSpace(tube)
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const {normal} = surfaceFrame()
// A lub-dub pulse, traveling along the knot three times per lap; both lobes stay clear of the phase wrap.
    const beatPhase = time.mul(0.62).sub(along.mul(3)).fract()
    const beat = beatPhase.sub(0.34).div(0.045).pow2().negate().exp().add(beatPhase.sub(0.5).div(0.06).pow2().negate().exp().mul(0.55))
// Fissure geometry: an opening in the crust, narrowing toward a molten floor seen through parallax.
    const widthField = mx_noise_float(p.mul(4.3).add(17.1)).mul(0.5).add(0.5).clamp()
    const halfWidth = widthField.pow(1.6).mul(0.13).add(0.022).add(beat.mul(0.014))
    const opening = voronoiCells(p.mul(plateScale), 0.92).border
    const openingFootprint = opening.fwidth().max(0.0001)
    const fissure = opening.smoothstep(halfWidth.sub(openingFootprint), halfWidth.add(openingFootprint)).oneMinus()
    const floor = voronoiCells(p.add(parallaxOffset(view, normal, magmaDepth)).mul(plateScale), 0.92).border
    const floorFootprint = floor.fwidth().max(0.0001)
    const floorWidth = halfWidth.mul(0.62)
    const molten = floor.smoothstep(floorWidth.sub(floorFootprint), floorWidth.add(floorFootprint)).oneMinus()
// Churning molten surface: slow convection cells streaked by a faster crust-skin flow.
    const churn = mx_fractal_noise_float(p.mul(26).add(vec3(time.mul(0.21), time.mul(-0.13), time.mul(0.17))), 3, 2.1, 0.55)
    const skin = mx_noise_float(p.mul(61).add(vec3(0, time.mul(0.45), 0))).mul(0.5).add(0.5)
// Hairline cracks in the crust: dim red threads, gated in patches and energy-preserving once sub-pixel.
    const hairField = voronoiCells(p.mul(plateScale * 2.7).add(3.1)).border
    const hairGate = mx_noise_float(p.mul(3.1).add(5.7)).smoothstep(-0.15, 0.35)
    const hairline = filteredRibbon(hairField, 0.022).mul(hairGate).mul(fissure.oneMinus())
// Temperature in kelvin: crust heated from its edges, glowing walls, a white-hot churning floor.
    const edgeDistance = opening.sub(halfWidth).max(0)
    const crustHeat = edgeDistance.div(0.032).negate().exp().mul(beat.mul(0.18).add(0.82))
    const crustKelvin = float(600).add(crustHeat.mul(600)).add(hairline.mul(beat.mul(70).add(560)))
    const wallKelvin = float(1120).add(beat.mul(90)).add(widthField.mul(60))
    const magmaKelvin = float(1340).add(churn.mul(150)).add(skin.mul(70)).add(beat.mul(190)).add(widthField.mul(110))
    const kelvin = mix(crustKelvin, mix(wallKelvin, magmaKelvin, molten), fissure)
    const incandescence = blackbody(kelvin).mul(0.85)
// Basalt crust: domed plates, ropy pāhoehoe folds, vesicles near the viewer, and a glassy quenched rind on the fissure lips.
    const plateDome = opening.smoothstep(0, 0.28)
    const ropes = along.mul(TAU * 260).add(mx_fractal_noise_float(p.mul(7), 2, 2, 0.5).mul(7)).sin()
    const vesicles = cellularPoints(p.mul(170), 0.04, 0.17, 0.55).mul(near)
    const height = plateDome.mul(0.0035).add(ropes.mul(0.00028).mul(plateDome)).sub(vesicles.mul(0.00025)).sub(fissure.mul(0.0045)).add(mx_noise_float(p.mul(95)).mul(0.00012))
    const rind = edgeDistance.smoothstep(0, 0.075).oneMinus().mul(fissure.oneMinus())
    const mottling = mx_fractal_noise_float(p.mul(14), 3, 2, 0.5).mul(0.5).add(0.5)
    const oxide = mx_noise_float(p.mul(2.4).add(41)).smoothstep(0.2, 0.6)
    const basalt = mix(color(hsl.integer(51, 9, 5)), color(hsl.integer(51, 20, 9)), mottling)
    const sulfur = mx_noise_float(p.mul(37).add(9)).smoothstep(0.45, 0.7).mul(rind).mul(mx_noise_float(p.mul(3.7).add(77)).smoothstep(0.3, 0.55))
    this.colorNode = mix(mix(mix(basalt, color(hsl.integer(38, 60, 11)), oxide.mul(0.45)), color(hsl.integer(18, 7, 3)), rind.mul(0.8)), color(hsl.integer(90, 75, 43)), sulfur.mul(0.6)).mul(fissure.oneMinus())
    this.metalness = 0
    this.roughnessNode = mix(float(0.86).sub(mottling.mul(0.08)), float(0.16), rind).add(vesicles.mul(0.1)).clamp(0.1, 1)
// Quenched glass flashes thin-film color, like Pele’s tears in the sun.
    this.iridescenceNode = rind.mul(0.75)
    this.iridescenceIOR = 1.5
    this.iridescenceThicknessNode = mx_noise_float(p.mul(21)).mul(160).add(380)
    const crustNormal = proceduralNormal(height, 1)
    this.normalNode = crustNormal
// Obsidian shards and flickering embers for whoever leans in close.
    const shards = cellularPoints(p.mul(95).add(2.3), 0.03, 0.14, 0.7).mul(glints(crustNormal, 240)).mul(near.mul(0.9).add(0.1))
    const emberCell = p.mul(64).add(11.3)
    const emberSeed = mx_cell_noise_float(emberCell.floor())
    const emberFlicker = time.mul(emberSeed.mul(2.5).add(0.7)).add(emberSeed.mul(40)).sin().mul(0.5).add(0.5).pow(14)
    const embers = cellularPoints(emberCell, 0.02, 0.16, 0.9).mul(emberFlicker).mul(intimate).mul(fissure.oneMinus())
// Shimmering air over the hot body, strongest where the veins run thick.
    const aura = grazing.pow(3).mul(widthField.mul(0.6).add(0.4)).mul(beat.mul(0.6).add(0.4))
    this.emissiveNode = incandescence.mul(facing.mul(0.25).add(0.75))
      .add(blackbody(float(1520)).mul(embers).mul(0.6))
      .add(color(hsl.integer(79, 100, 96)).mul(shards).mul(0.55))
      .add(color(hsl.integer(35, 100, 61)).mul(aura).mul(0.09))
  }
}
