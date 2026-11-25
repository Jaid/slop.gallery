import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, mx_cell_noise_float, mx_fractal_noise_float, positionViewDirection, time, uv, vec2, vec3} from 'three/tsl'

import {tubeCells} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {inkFill, inkLine, tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const baysAlong = 28
const baysAround = 3
/** Chartres-inspired liturgical stained-glass palette in linear light. */
function cathedralGlassTint(id: Node<'float'>) {
  const c0 = color(hsl.integer(264.4, 97, 27.4)) // Deep Chartres cobalt
  const c1 = color(hsl.integer(25, 99.3, 44)) // Gold-ruby crimson
  const c2 = color(hsl.integer(64, 100, 67)) // Silver-stain liturgical amber
  const c3 = color(hsl.integer(150, 99.6, 43)) // Viridian emerald
  const c4 = color(hsl.integer(304, 96, 28)) // Imperial amethyst
  const t1 = id.smoothstep(0.12, 0.28)
  const t2 = id.smoothstep(0.34, 0.5)
  const t3 = id.smoothstep(0.56, 0.72)
  const t4 = id.smoothstep(0.78, 0.92)
  return mix(mix(mix(mix(c0, c1, t1), c2, t2), c3, t3), c4, t4)
}
/** Gothic rose-window tracery in hand-blown flashed glass and patinated lead cames, enclosing a deep parallax vaulted sanctuary where volumetric God-rays and dust motes drift. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const grid = vec2(baysAlong, baysAround)
    const cells = tubeCells(uv(), baysAlong, baysAround)
    const footprint = cells.fwidth().x.max(cells.fwidth().y).max(0.0003)
    const cellId = wrapCell(cells.floor(), grid)
    const cellRandom = cellNoiseVec3(vec3(cellId, 19.3))
    const local = cells.fract().sub(0.5)
    const r = local.length()
    const theta = atan(local.y, local.x.add(1e-6)).add(cellRandom.x.sub(0.5).mul(0.08))
// Multi-lobed Gothic rose window geometry: central boss, 12-petal inner rosette, 6-lobed trefoil outer wheel, and corner spandrel cusps
    const petal12 = theta.mul(12).cos()
    const lobe6 = theta.mul(6).cos()
    const cusp24 = theta.mul(24).cos()
    const bossRing = r.sub(0.095)
    const innerRosette = r.sub(petal12.mul(0.036).add(0.215))
    const outerWheel = r.sub(lobe6.abs().mul(0.048).add(0.365))
    const rimCircle = r.sub(0.455)
// Radial mullions in two concentric rings (6 inner spokes, 12 outer spokes)
    const spoke6Field = theta.mul(6 / TAU).fract().sub(0.5).abs().mul(TAU / 6).mul(r)
    const spoke12Field = theta.add(Math.PI / 6).mul(12 / TAU).fract().sub(0.5).abs().mul(TAU / 12).mul(r)
    const innerSpokes = spoke6Field.max(r.sub(0.24)).max(float(0.095).sub(r))
    const outerSpokes = spoke12Field.max(r.sub(0.455)).max(float(0.21).sub(r))
// Rectangular bay border cames and diagonal corner spandrel tracery
    const bayFrame = float(0.488).sub(local.x.abs().max(local.y.abs()))
    const cornerR = local.abs().sub(vec2(0.49, 0.49)).length()
    const cornerTrefoil = cornerR.sub(0.165)
// Combine distances into primary stone/iron armature and secondary soldered lead cames
    const stoneField = rimCircle.abs().min(bayFrame.abs()).min(cornerTrefoil.abs())
    const leadField = bossRing.abs()
      .min(innerRosette.abs())
      .min(outerWheel.abs())
      .min(innerSpokes.abs())
      .min(outerSpokes.abs())
    const stoneMask = inkLine(stoneField, 0.019, footprint)
    const leadMask = inkLine(leadField, 0.011, footprint)
    const armatureMask = stoneMask.max(leadMask)
// Delicate silver-stain / grisaille botanical filigree inside each glass petal (visible up close)
    const filigreeWave = r.mul(48).sub(cusp24.mul(1.8)).sin().abs()
    const filigreeMask = inkLine(filigreeWave.sub(0.35), 0.055, footprint.mul(14)).mul(armatureMask.oneMinus()).mul(near.mul(0.75).add(0.25))
// Assign every glass compartment a distinct jewel-tone identity
    const ringIndex = r.greaterThan(0.095).select(r.greaterThan(0.215).select(r.greaterThan(0.365).select(float(3), float(2)), float(1)), float(0))
    const sectorIndex = ringIndex.lessThan(1.5).select(theta.div(TAU).add(0.5).mul(6).floor(), theta.div(TAU).add(0.5).mul(12).floor())
    const paneSeed = vec3(cellId.x.mul(13).add(ringIndex.mul(5)), cellId.y.mul(17).add(sectorIndex), 73.1)
    const paneHash = mx_cell_noise_float(paneSeed)
    const glassBaseColor = cathedralGlassTint(paneHash)
// Hand-blown glass thickness variations, reamy striae swirls, and trapped seed bubbles
    const reamySwirl = mx_fractal_noise_float(vec3(cells.mul(3.4), paneHash.mul(9)), 3, 2.15, 0.52).mul(0.28)
    const bubbleCoord = p.sub(view.mul(0.008)).mul(68)
    const bubbleCell = cellNoiseVec3(bubbleCoord.floor())
    const bubbleDist = bubbleCoord.fract().sub(bubbleCell.mul(0.5).add(0.25)).length()
    const seedBubble = bubbleDist.smoothstep(0.09, 0.04).mul(bubbleCell.z.smoothstep(0.65, 0.75)).mul(intimate)
    const paneColor = mix(glassBaseColor.mul(reamySwirl.add(0.95)), color(hsl.integer(88, 100, 85)), filigreeMask.mul(0.65))
// Deep interior parallax: look through the stained-glass window into the Gothic vaulted nave
    const ray = tubeRay().mul(grid)
    const sunDir = vec3(0.42, 0.76, 0.49).normalize()
    const sunPulse = time.mul(0.32)
    const animatedSun = vec3(sunDir.x.mul(sunPulse.cos()).add(sunDir.z.mul(sunPulse.sin())), sunDir.y, sunDir.z.mul(sunPulse.cos()).sub(sunDir.x.mul(sunPulse.sin()))).normalize()
// Sample 3 volumetric depth planes inside the cathedral for Colored God-Rays + Ribbed Vaults + Altar Candlelight
    const sampleSanctuary = (depth: number, weight: number) => {
      const deepCells = cells.sub(ray.mul(depth))
      const deepLocal = deepCells.fract().sub(0.5)
      const deepId = wrapCell(deepCells.floor(), grid)
      const deepR = deepLocal.length()
      const deepTheta = atan(deepLocal.y, deepLocal.x.add(1e-6))
      const deepRing = deepR.greaterThan(0.1).select(deepR.greaterThan(0.23).select(float(2), float(1)), float(0))
      const deepSector = deepTheta.div(TAU).add(0.5).mul(12).floor()
      const deepHash = mx_cell_noise_float(vec3(deepId.x.mul(13).add(deepRing.mul(5)), deepId.y.mul(17).add(deepSector), 73.1))
      const projectedGlassColor = cathedralGlassTint(deepHash)
      const deepWindow = inkFill(deepR.sub(0.45), footprint.mul(1.8))
// Diagonal Gothic quadripartite stone vault ribs in the deep ceiling
      const vaultRib = deepLocal.x.abs().sub(deepLocal.y.abs()).abs().min(deepLocal.x.abs()).min(deepLocal.y.abs())
      const vaultArch = inkLine(vaultRib, 0.028, footprint.mul(2)).mul(0.35)
// Volumetric sunbeam intensity modulated by 3D incense smoke & golden dust motes
      const worldSample = p.sub(view.mul(depth * 0.65)).add(vec3(0, time.mul(-0.015), 0))
      const incense = mx_fractal_noise_float(worldSample.mul(14).add(vec3(time.mul(0.08), 0, 0)), 3, 2.1, 0.5).mul(0.5).add(0.5)
      const moteCoord = worldSample.mul(54)
      const moteRnd = cellNoiseVec3(moteCoord.floor())
      const moteDist = moteCoord.fract().sub(moteRnd.mul(0.5).add(0.25)).length()
      const dustMote = moteDist.smoothstep(0.11, 0.03).mul(moteRnd.x.smoothstep(0.76, 0.85)).mul(near.mul(0.7).add(0.3))
      return projectedGlassColor.mul(deepWindow).mul(incense.mul(0.75).add(0.45)).add(color(hsl.integer(83, 100, 93.4)).mul(dustMote.mul(2.2))).add(color(hsl.integer(300, 25, 12)).mul(vaultArch)).mul(weight)
    }
    const sanctuaryVolume = sampleSanctuary(0.022, 0.5)
      .add(sampleSanctuary(0.048, 0.34))
      .add(sampleSanctuary(0.078, 0.22))
// Warm flickering sanctuary candleglow deep in the nave core
    const flicker = time.mul(3.4).add(cellRandom.y.mul(TAU)).sin().mul(0.12).add(time.mul(7.9).add(cellRandom.z.mul(TAU)).sin().mul(0.06)).add(0.88)
    const naveCandles = color(hsl.integer(59, 100, 74)).mul(r.smoothstep(0.42, 0.04)).mul(flicker).mul(0.28)
// Forward Mie scattering when looking toward the cathedral sunbeams
    const forwardBeam = positionViewDirection.negate().dot(animatedSun).mul(0.5).add(0.5).pow(3.2).mul(0.85).add(0.45)
// Combine patinated lead/gilded bronze armature and stained-glass panes
// Keeping diffuse albedo of glass near-black ensures directional light doesn't wash out the rich jewel-toned transmission
    const leadAlbedo = mix(color(hsl.integer(273, 17, 10)), color(hsl.integer(77, 32, 24)), stoneMask.mul(0.72))
    const solderJoint = bossRing.abs().min(innerRosette.abs()).min(outerWheel.abs()).smoothstep(0.028, 0.004).mul(leadMask)
    const metalCoat = mix(leadAlbedo, color(hsl.integer(82, 45, 56)), solderJoint.mul(0.65))
    const glassSurface = paneColor.mul(0.18).add(sanctuaryVolume.mul(0.14))
    this.colorNode = mix(glassSurface, metalCoat, armatureMask)
    this.metalnessNode = armatureMask.mul(0.9).add(filigreeMask.mul(0.45)).clamp()
    this.roughnessNode = mix(float(0.04).add(reamySwirl.abs().mul(0.07)).add(filigreeMask.mul(0.16)), float(0.36).sub(solderJoint.mul(0.16)), armatureMask)
    this.specularIntensityNode = mix(float(0.35), float(1), armatureMask)
    this.clearcoatNode = armatureMask.oneMinus().mul(0.88).add(0.06)
    this.clearcoatRoughness = 0.018
// Dichroic gold-ruby nanoparticle iridescence on the glass surface at grazing angles
    this.iridescenceNode = armatureMask.oneMinus().mul(0.58)
    this.iridescenceIOR = 1.52
    this.iridescenceThicknessNode = paneHash.mul(220).add(grazing.mul(180)).add(160)
// Meniscus curvature of hand-poured glass panes + raised soldered lead cames + carved stone mullions
    const paneMeniscus = leadField.smoothstep(0, 0.065).mul(0.0014).add(reamySwirl.mul(0.0005)).add(seedBubble.mul(0.0008))
    const leadHeight = leadMask.mul(0.0028).add(stoneMask.mul(0.0042)).add(solderJoint.mul(0.001))
    const totalRelief = mix(paneMeniscus, leadHeight, armatureMask)
    const normal = proceduralNormal(totalRelief, 1.05)
    this.normalNode = normal
// Backlit stained-glass radiance, internal volumetric God-rays, and specular surface glints
    const glassSparkle = glints(normal, 210).mul(armatureMask.oneMinus()).mul(0.38)
    const transmittedGlow = paneColor.mul(sanctuaryVolume.mul(1.25).add(naveCandles).add(paneColor.mul(0.32))).mul(forwardBeam).mul(facing.mul(0.65).add(0.35)).mul(2.15)
    const bubbleHighlight = color(hsl.integer(84, 100, 92.6)).mul(seedBubble).mul(1.1)
    const goldRim = mix(paneColor, color(hsl.integer(77, 100, 80)), 0.45).mul(grazing.pow(2.6)).mul(armatureMask.oneMinus()).mul(0.5)
    this.emissiveNode = transmittedGlow
      .add(paneColor.mul(sanctuaryVolume).mul(0.85))
      .add(bubbleHighlight)
      .add(color(hsl.integer(83, 100, 97)).mul(glassSparkle))
      .add(goldRim)
      .mul(armatureMask.oneMinus())
  }
}
