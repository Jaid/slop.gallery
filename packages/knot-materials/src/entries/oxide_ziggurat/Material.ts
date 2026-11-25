import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, select, time, uv, vec2, vec3} from 'three/tsl'

import {environmentHighlight, studioSheen} from '../../candidates/gemini_argon/lib/environmentHighlight.ts'
import {tubeCells} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {wavelengthColor} from '../../candidates/gemini_argon/lib/wavelengthColor.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {displacementView} from '../../lib/displacementView.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const hoppersAlong = 28
const hoppersAround = 3
/** Smoothly quantized staircase with derivative-aware riser antialiasing. */
function steppedTerrace(value: Node<'float'>, steps: number, sharpness = 0.22) {
  const scaled = value.mul(steps)
  const idx = scaled.floor()
  const frac = scaled.fract()
  const ramp = frac.smoothstep(0.5 - sharpness, 0.5 + sharpness)
  return idx.add(ramp).div(steps)
}
/** Hopper-grown synthetic bismuth (Bi) crystals with inverted L-infinity square ziggurat terraces. A nanometric bismuth-trioxide (Bi2O3) thin film produces vibrant angle-dependent interference spectra from electric magenta and gold to Peacock cyan and royal violet. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.92)
    this.name = knotData.id
    const tube = uv()
    const dispView = displacementView()
    const grid = vec2(hoppersAlong, hoppersAround)
    const cells = tubeCells(tube, hoppersAlong, hoppersAround)
    const cellId = wrapCell(cells.floor(), grid)
    const cellRnd = cellNoiseVec3(vec3(cellId, 53.9))
// Alternate slight L-infinity square rotation (0 or 9 degrees) and sub-center offset per crystal cell
    const localRaw = cells.fract().sub(0.5).sub(cellRnd.xy.sub(0.5).mul(0.14))
    const tiltAngle = cellRnd.z.sub(0.5).mul(0.22)
    const cosA = tiltAngle.cos()
    const sinA = tiltAngle.sin()
    const local = vec2(localRaw.x.mul(cosA).sub(localRaw.y.mul(sinA)), localRaw.x.mul(sinA).add(localRaw.y.mul(cosA)))
// Hopper crystal geometry: outer rim is highest, stepping down into an L-infinity hollow pit, then rising in an inner nested ziggurat
    const boxRadius = local.x.abs().max(local.y.abs()).mul(2).clamp(0, 1)
    const hopperV = boxRadius.sub(0.42).abs().mul(1.72).clamp(0, 1)
    const primaryStep = steppedTerrace(hopperV, 6, 0.14)
// Secondary sub-hopper quadrant terraces inside each macro-ziggurat
    const subLocal = local.mul(2).fract().sub(0.5)
    const subBox = subLocal.x.abs().max(subLocal.y.abs()).mul(2)
    const secondaryStep = steppedTerrace(subBox, 4, 0.18)
    const combinedTerrace = primaryStep.mul(0.76).add(secondaryStep.mul(0.24))
// Vertex displacement: sharp architectural stepped terraces along the knot
    const vertexDisplacement = combinedTerrace.mul(0.015).mul(dispView.near.mul(0.3).add(0.7))
    this.positionNode = positionGeometry.add(normalLocal.mul(vertexDisplacement))
    const {p, facing, grazing, rim, near, intimate} = viewerFrame()
    const footprint = cells.fwidth().x.max(cells.fwidth().y).max(0.0003)
// Parallax into the recessed hopper cavity
    const ray = tubeRay().mul(grid)
    const parLocal = local.sub(ray.mul(primaryStep.oneMinus().mul(0.036)))
    const parBox = parLocal.x.abs().max(parLocal.y.abs()).mul(2).clamp(0, 1)
    const parHopper = parBox.sub(0.42).abs().mul(1.72).clamp(0, 1)
    const parTerrace = steppedTerrace(parHopper, 6, 0.12)
// Identify which of the 4 cardinal hopper walls (+X, -X, +Y, -Y) or horizontal terrace tread the pixel lies on
    const isXWall = parLocal.x.abs().greaterThan(parLocal.y.abs())
    const wallSignX = parLocal.x.sign()
    const wallSignY = parLocal.y.sign()
    const riserPhase = parHopper.mul(6).fract()
    const isRiser = riserPhase.smoothstep(0.32, 0.44).mul(riserPhase.smoothstep(0.68, 0.56))
// Construct 3D object-space facet normal for sharp crystalline reflections and directional oxide interference
    const n = normalLocal.normalize()
    const facetTiltX = select(isXWall, wallSignX, float(0)).mul(isRiser).mul(0.6)
    const facetTiltY = select(isXWall, float(0), wallSignY).mul(isRiser).mul(0.6)
    const crystalFacetNormal = n.add(vec3(facetTiltX, facetTiltY, facetTiltX.negate().mul(0.45))).normalize()
// Nanoscale Epitaxial Growth Striations (90-degree rectilinear micro-grooves along each terrace step)
    const striationCoord = select(isXWall, parLocal.y, parLocal.x).mul(72)
    const striationVisibility = footprint.mul(72).smoothstep(0.25, 0.75).oneMinus()
    const striations = striationCoord.sin().mul(striationVisibility).mul(near.mul(0.7).add(0.3))
// Bismuth Trioxide (Bi2O3, n = 2.45) Thin-Film Interference Physics:
// Oxide thickness increases toward the hotter outer crystal rims and varies with terrace step & thermal drift
    const thermalWave = p.dot(vec3(0.7, 0.5, -0.5)).mul(4.5).sub(time.mul(0.45)).sin().mul(22)
    const oxideThickness = parBox.mul(165)
      .add(parTerrace.mul(110))
      .add(cellRnd.x.mul(95))
      .add(mx_noise_float(p.mul(14)).mul(28))
      .add(thermalWave)
      .add(215)
// Optical path difference 2 * n_oxide * d * cos(theta_t) mapped into visible spectral wavelengths [405, 685] nm
    const nOxide = 2.45
    const cosRefracted = float(1).sub(grazing.pow2().div(nOxide * nOxide)).sqrt()
    const opticalPath = oxideThickness.mul(cosRefracted)
// Fold optical path across 2nd and 3rd interference orders for bismuth's signature rainbow succession
    const interferenceOrder = opticalPath.div(275).fract()
    const wavelength = interferenceOrder.mul(270).add(410)
    const spectralFilm = wavelengthColor(wavelength).mul(vec3(1.25, 0.98, 1.35))
// Secondary higher-order interference harmonic for rich magenta/gold/cyan metallic crossover
    const harmonicWave = interferenceOrder.add(0.38).fract().mul(260).add(415)
    const harmonicFilm = wavelengthColor(harmonicWave).mul(vec3(1.2, 0.92, 1.32))
    const bismuthOxideColor = mix(spectralFilm, harmonicFilm, grazing.smoothstep(0.15, 0.75))
// Crisp 90-degree step-edge bevel highlights and deep hopper-cavity ambient occlusion
    const stepEdge = filteredRibbon(parHopper.mul(6).fract().sub(0.5), 0.065)
    const subStepEdge = filteredRibbon(subBox.mul(4).fract().sub(0.5), 0.075).mul(intimate.mul(0.7).add(0.3))
    const edgeHighlight = stepEdge.max(subStepEdge.mul(0.75))
    const pitOcclusion = parTerrace.pow(1.4).mul(0.84).add(0.16)
    const riserShadow = isRiser.mul(0.42).oneMinus()
// Base metallic reflectance of oxidized bismuth
    const rawBismuthSilver = color(hsl.integer(340, 15, 75))
    const metallicAlbedo = mix(bismuthOxideColor.mul(0.75), rawBismuthSilver, edgeHighlight.mul(0.42)).mul(pitOcclusion).mul(riserShadow)
    this.colorNode = metallicAlbedo
    this.metalness = 0.96
    this.roughnessNode = float(0.11)
      .sub(edgeHighlight.mul(0.06))
      .add(striations.abs().mul(0.05))
      .add(isRiser.mul(0.04))
      .clamp(0.04, 0.24)
// Anisotropic brushing aligned with the rectilinear 90-degree crystal growth axes
    const anisoDir = select(isXWall, vec2(0, 1), vec2(1, 0))
    this.anisotropyNode = anisoDir.mul(0.68)
// Hardware thin-film iridescence layer reinforcing the custom Bi2O3 spectral stack
    this.iridescence = 0.92
    this.iridescenceIOR = 2.15
    this.iridescenceThicknessNode = oxideThickness
    this.clearcoat = 0.32
    this.clearcoatRoughness = 0.03
    this.aoNode = pitOcclusion.mul(riserShadow)
// Detailed stepped normal map: macro hopper terraces + parTerrace parallax steps + 90-degree epitaxial striations
    const heightDetail = vertexDisplacement
      .add(parTerrace.mul(0.0046))
      .add(secondaryStep.mul(0.002))
      .add(edgeHighlight.mul(0.0009))
      .add(striations.mul(0.00038))
    const normal = proceduralNormal(heightDetail, 1.2)
    this.normalNode = normal
// High-contrast studio metal reflections + rainbow facet flashes + molten gold/magenta step-edge glints
    const envFlash = environmentHighlight(environment, crystalFacetNormal, 0.08, {threshold: 1.25})
    const tentSheen = studioSheen(crystalFacetNormal)
    const edgeGlints = glints(normal, 250).mul(edgeHighlight.mul(0.75).add(0.25))
    this.emissiveNode = bismuthOxideColor.mul(envFlash).mul(0.85)
      .add(bismuthOxideColor.mul(tentSheen).mul(pitOcclusion).mul(0.28))
      .add(mix(bismuthOxideColor, color(hsl.integer(83, 100, 93)), 0.48).mul(edgeHighlight).mul(facing.mul(0.5).add(0.5)).mul(0.38))
      .add(harmonicFilm.mul(rim.pow(2.2)).mul(0.48))
      .add(color(hsl.integer(83, 100, 97.8)).mul(edgeGlints).mul(0.45))
  }
}
