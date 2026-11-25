import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, select, time, uv, vec2, vec3} from 'three/tsl'

import {tubeCells} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {wavelengthColor} from '../../candidates/gemini_argon/lib/wavelengthColor.ts'
import {inkFill, inkLine, tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const wavesAlong = 36
const wavesAround = 4
/** Traditional Japanese Seigaiha (blue ocean wave) overlapping concentric crests. Evaluates a staggered two-row tile lattice so upper circles cleanly occlude lower circles. */
function seigaihaCrests(cells: Node<'vec2'>, footprint: Node<'float'>) {
  const grid = vec2(wavesAlong, wavesAround)
  let bestLayer: Node<'float'> = float(-99)
  let bestR: Node<'float'> = float(1)
  let bestId: Node<'vec2'> = vec2(0)
  let bestTheta: Node<'float'> = float(0)
// Check staggered overlapping wave fan centers
  const candidates = [[0, 0], [-0.5, -0.5], [0.5, -0.5], [0, -1], [-0.5, 0.5], [0.5, 0.5]] as const
  for (const [ox, oy] of candidates) {
    const shifted = cells.sub(vec2(ox, oy))
    const id = shifted.floor()
    const local = shifted.fract().sub(vec2(0.5, 0.15))
    const r = local.length()
    const inside = r.lessThan(0.68)
    const priority = id.y.add(oy)
    const wins = inside.and(priority.greaterThan(bestLayer))
    bestLayer = select(wins, priority, bestLayer)
    bestR = select(wins, r, bestR)
    bestId = select(wins, wrapCell(id.add(vec2(ox * 2, oy * 2)), grid), bestId)
    bestTheta = select(wins, atan(local.y, local.x.add(1e-6)), bestTheta)
  }
// 5 concentric wave arches per fan
  const ringPhase = bestR.div(0.68).mul(4.5)
  const archDist = ringPhase.fract().sub(0.5).abs().div(4.5).mul(0.68)
  const goldArch = inkLine(archDist, 0.018, footprint)
  const outerRim = inkLine(bestR.sub(0.66), 0.022, footprint)
  const waveHash = mx_cell_noise_float(vec3(bestId, 17.5))
  return {
    arch: goldArch.max(outerRim),
    ringIndex: ringPhase.floor(),
    radius: bestR,
    theta: bestTheta,
    hash: waveHash,
    id: bestId,
  }
}
/** 5-pointed Japanese autumn Momiji (maple leaf) and Sakura petal signed distance field in 2D tile space. */
function momijiLeaf(p: Node<'vec2'>, rotation: Node<'float'>, scale: number, footprint: Node<'float'>) {
  const c = rotation.cos()
  const s = rotation.sin()
  const q = vec2(p.x.mul(c).sub(p.y.mul(s)), p.x.mul(s).add(p.y.mul(c))).div(scale)
  const r = q.length()
  const a = atan(q.y, q.x.add(1e-6))
// 5 pointed lobes with serrated edges and basal stem notch
  const lobes = a.mul(5).cos().mul(0.38).add(a.mul(15).cos().mul(0.06)).add(0.52)
  const stemCut = a.add(Math.PI * 0.5).cos().smoothstep(0.75, 0.98).mul(0.35)
  const leafRadius = lobes.sub(stemCut).max(0.08)
  const dist = r.sub(leafRadius)
  const aa = footprint.div(scale)
  const fill = inkFill(dist, aa)
  const border = inkLine(dist, 0.045, aa)
  const veinAngle = a.mul(5).sin().abs().mul(r)
  const veins = inkLine(veinAngle, 0.035, aa).mul(fill).mul(r.smoothstep(0.75, 0.1))
  return {
    fill,
    border,
    veins,
    r,
  }
}
/** Imperial Japanese Raden (iridescent abalone mother-of-pearl inlay) & Maki-e (sprinkled 24k gold dust) suspended inside multi-layered Roiro-urushi (mirror-black lacquer) with Kintsugi seams and Nashiji parallax. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.82)
    this.name = knotData.id
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    const cells = tubeCells(tube, wavesAlong, wavesAround)
    const footprint = cells.fwidth().x.max(cells.fwidth().y).max(0.0003)
    const ray = tubeRay().mul(vec2(wavesAlong, wavesAround))
// Layer 1 (Top sub-lacquer): Seigaiha 24k Gold Maki-e wave crests and inlaid Raden nacre wave fans
    const waves = seigaihaCrests(cells.sub(ray.mul(0.006)), footprint)
// Select wave fans and specific concentric bands to hold hand-cut Raden mother-of-pearl shell tablets
    const bandSelect = waves.ringIndex.add(waves.id.x).mod(2).smoothstep(0.2, 0.8)
    const isRadenFan = waves.hash.smoothstep(0.38, 0.48).mul(bandSelect).mul(waves.arch.oneMinus())
// Abalone nacre (CaCO3 aragonite platelets, n = 1.68) Bragg thin-film interference + organic conchiolin growth bands
    const nacreBands = waves.radius.mul(36).add(mx_noise_float(p.mul(28).add(waves.hash.mul(12))).mul(4.2)).sin()
    const nacreAngle = view.dot(vec3(0.65, 0.52, -0.55).normalize()).mul(125).add(grazing.mul(165))
    const nacreWavelength = float(500).add(nacreBands.mul(65)).add(waves.hash.mul(95)).sub(nacreAngle).clamp(405, 675)
    const abaloneSpectrum = wavelengthColor(nacreWavelength).mul(vec3(1.2, 1.1, 1.35))
    const motherOfPearl = mix(color(hsl.integer(187, 65, 85)), abaloneSpectrum, 0.82).mul(nacreBands.mul(0.22).add(0.88))
// Layer 2 (Mid-depth parallax): Autumn Momiji maple leaves in Taka-maki-e (raised vermilion & burnished gold) + Raden leaf inlays
    const leafGrid = vec2(22, 3)
    const leafCells = tubeCells(tube, 22, 3).sub(ray.mul(0.018))
    const leafFootprint = leafCells.fwidth().x.max(leafCells.fwidth().y).max(0.0003)
    const leafId = wrapCell(leafCells.floor(), leafGrid)
    const leafRnd = cellNoiseVec3(vec3(leafId, 83.4))
    const leafLocal = leafCells.fract().sub(0.5).sub(leafRnd.xy.sub(0.5).mul(0.24))
    const leafRot = leafRnd.z.mul(TAU).add(time.mul(0.08).sin().mul(0.12))
    const leaf = momijiLeaf(leafLocal, leafRot, 0.38, leafFootprint)
    const leafPresent = leafRnd.x.smoothstep(0.2, 0.28)
    const leafMask = leaf.fill.mul(leafPresent)
    const leafIsNacre = leafRnd.y.greaterThan(0.58)
    const vermilionLacquer = mix(color(hsl.integer(30, 99, 41)), color(hsl.integer(33.6, 100, 60.3)), leaf.r.smoothstep(0.8, 0.1))
    const leafBodyColor = select(leafIsNacre, motherOfPearl.mul(1.1), vermilionLacquer)
    const leafGoldTrim = leaf.border.max(leaf.veins).mul(leafPresent)
// Layer 3 (Deep Nashiji lacquer parallax): 3 strata of suspended gold/silver dust flakes and drifting Toro pond lanterns
    const nashijiP1 = p.sub(view.mul(0.014)).mul(78)
    const nashijiP2 = p.sub(view.mul(0.032)).mul(62).add(19.4)
    const nashijiP3 = p.sub(view.mul(0.054)).mul(48).add(43.1)
    const flake1 = cellularPoints(nashijiP1, 0.03, 0.18, 0.44).mul(near.mul(0.5).add(0.5))
    const flake2 = cellularPoints(nashijiP2, 0.04, 0.2, 0.42).mul(0.8)
    const flake3 = cellularPoints(nashijiP3, 0.05, 0.22, 0.4).mul(0.55)
    const microGoldDust = cellularPoints(p.sub(view.mul(0.008)).mul(135), 0.03, 0.17).mul(intimate)
    const nashijiTotal = flake1.add(flake2).add(flake3).add(microGoldDust.mul(0.9))
// Golden Kintsugi (gold-mended fracture veins) meandering across the urushi knot
    const kintsugiWarp = mx_fractal_noise_float(p.mul(3.6).add(vec3(2.1, -4.7, 1.3)), 3, 2.1, 0.52)
    const kintsugiField = p.dot(vec3(0.75, -0.45, 0.48)).mul(3.2).add(kintsugiWarp.mul(1.4)).sin()
    const kintsugiCrack = inkLine(kintsugiField, 0.016, kintsugiField.fwidth().max(0.0002))
// Warm underwater Toro (floating paper lanterns) / golden koi bioluminescence deep in the dark pond
    const lanternCoord = p.sub(view.mul(0.065)).add(vec3(time.mul(0.025), time.mul(0.015).sin().mul(0.02), time.mul(-0.02))).mul(11)
    const lanternRnd = cellNoiseVec3(lanternCoord.floor())
    const lanternDist = lanternCoord.fract().sub(lanternRnd.mul(0.45).add(0.275)).length()
    const lanternGlow = lanternDist.smoothstep(0.32, 0.04).mul(lanternRnd.x.smoothstep(0.62, 0.78))
// Composite the multi-layered urushi artwork from bottom to top
// Only the dark Roiro-urushi pond background is dielectric; keeping its specularIntensity low stops diffuse light from washing out the black lacquer
    const roiroBlack = mix(color(hsl.integer(284, 27, 2)), color(hsl.integer(38, 39, 3)), grazing.pow(2).mul(0.5))
    const gold24k = color(hsl.integer(82, 91, 79))
    const paleGold = color(hsl.integer(91, 100, 91))
    let lacquerCanvas: Node<'vec3'> = roiroBlack
      .add(gold24k.mul(nashijiTotal).mul(0.95))
      .add(color(hsl.integer(49, 100, 68)).mul(lanternGlow).mul(0.45))
// Composite mid-depth Momiji leaves (shadowed by upper Seigaiha layer)
    const leafComposite = mix(leafBodyColor, paleGold, leafGoldTrim)
    lacquerCanvas = mix(lacquerCanvas, leafComposite, leafMask.mul(0.95))
// Composite upper Seigaiha Raden shell tablets and 24k Maki-e wave arches
    lacquerCanvas = mix(lacquerCanvas, motherOfPearl, isRadenFan.mul(0.92))
    const goldFeatureMask = waves.arch.max(leafGoldTrim.mul(isRadenFan.oneMinus())).max(kintsugiCrack)
    lacquerCanvas = mix(lacquerCanvas, mix(gold24k, paleGold, kintsugiCrack), goldFeatureMask)
    this.colorNode = lacquerCanvas
// Physical Material Properties: metallic where 24k gold Maki-e or Kintsugi sits, dielectric lacquer elsewhere, with mirror clearcoat over all
    const inlayMask = goldFeatureMask.max(isRadenFan).max(leafMask).max(nashijiTotal.clamp(0, 1))
    const metalMask = goldFeatureMask.max(nashijiTotal.clamp(0, 1).mul(0.85)).max(isRadenFan.mul(0.42))
    this.metalnessNode = metalMask.mul(0.95)
    this.specularIntensityNode = mix(float(0.04), float(1), inlayMask)
    this.roughnessNode = mix(float(0.14), mix(float(0.11), float(0.05), kintsugiCrack), goldFeatureMask)
      .sub(isRadenFan.mul(0.06))
      .clamp(0.035, 0.22)
// 30 layers of hand-polished transparent Roiro-urushi sap clearcoat
    this.clearcoat = 0.72
    this.clearcoatRoughness = 0.01
    this.clearcoatNormalNode = normalViewGeometry
// Hardware thin-film iridescence on the Raden abalone shell inlays
    this.iridescenceNode = isRadenFan.max(leafMask.mul(select(leafIsNacre, float(1), float(0)))).mul(0.96)
    this.iridescenceIOR = 1.68
    this.iridescenceThicknessNode = nacreBands.mul(140).add(grazing.mul(220)).add(260)
// Taka-maki-e (raised relief lacquer) normal beneath the glass-smooth clearcoat
    const reliefHeight = waves.arch.mul(0.0022)
      .add(isRadenFan.mul(0.0014))
      .add(nacreBands.mul(isRadenFan).mul(0.00035))
      .add(leafMask.mul(0.0018))
      .add(leafGoldTrim.mul(0.001))
      .add(kintsugiCrack.mul(0.0028))
      .add(flake1.mul(0.0007))
    const underNormal = proceduralNormal(reliefHeight, 1.15)
    this.normalNode = underNormal
// Luminous reflections from buried Nashiji gold flakes, Raden abalone fire, vermilion Momiji leaves, and deep pond lanterns
    const goldSparkle = glints(underNormal, 175).mul(nashijiTotal.add(goldFeatureMask.mul(0.75)))
    const radenShimmer = abaloneSpectrum.mul(isRadenFan.max(leafMask.mul(select(leafIsNacre, float(0.9), float(0)))))
      .mul(facing.mul(0.6).add(grazing.pow(1.4).mul(0.95)))
    const vermilionGlow = vermilionLacquer.mul(leafMask.mul(select(leafIsNacre, float(0), float(1)))).mul(facing.mul(0.5).add(0.5)).mul(0.48)
    const kintsugiPulse = time.mul(1.8).add(p.y.mul(8)).sin().mul(0.2).add(0.85)
    this.emissiveNode = radenShimmer.mul(0.95)
      .add(gold24k.mul(goldFeatureMask).mul(facing.mul(0.5).add(0.5)).mul(0.42))
      .add(vermilionGlow)
      .add(color(hsl.integer(89, 100, 88)).mul(goldSparkle).mul(1.3))
      .add(color(hsl.integer(45, 100, 65.9)).mul(lanternGlow).mul(facing.mul(0.6).add(0.4)).mul(1.35))
      .add(color(hsl.integer(91, 100, 89.6)).mul(kintsugiCrack).mul(kintsugiPulse).mul(0.55))
      .add(abaloneSpectrum.mul(rim.pow(2.4)).mul(0.42))
  }
}
