import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, mx_cell_noise_float, mx_fractal_noise_float, normalLocal, positionGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {refractedParallax} from '../../candidates/gemini_argon/lib/refractedParallax.ts'
import {tubeCells} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {voronoi} from '../../candidates/gemini_argon/lib/voronoi3dStruct.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {displacementView} from '../../lib/displacementView.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const frustulesAlong = 26
const frustulesAround = 3
/** Hexagonal sieve-plate pores (cribrum) in 2D tile coordinates. */
function hexSievePores(coord: Node<'vec2'>, scale: number, footprint: Node<'float'>) {
  const q = coord.mul(scale)
  const r = vec2(1, 1.7320508)
  const h = r.mul(0.5)
  const a = q.mod(r).sub(h)
  const b = q.sub(h).mod(r).sub(h)
  const gv = a.dot(a).lessThan(b.dot(b)).select(a, b)
  const dist = gv.length()
  const aa = footprint.mul(scale).max(0.01)
  const visibility = aa.smoothstep(0.18, 0.52).oneMinus()
  const pore = dist.smoothstep(0.29, float(0.29).add(aa)).oneMinus()
  const rim = dist.sub(0.31).abs().smoothstep(0.048, float(0.048).add(aa)).oneMinus()
  return {
    pore: pore.mul(visibility),
    rim: rim.mul(visibility),
  }
}
/** Haeckel-inspired radiolarian and centric diatom frustule exoskeleton in hydrated opal-A biosilica. Features hierarchical hexagonal areolae, nanoscale cribrum sieve plates, vertex-displaced silica ribs, and a bioluminescent deep-sea cytoplasm with traveling action-potential waves. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const tube = uv()
    const dispView = displacementView()
    const grid = vec2(frustulesAlong, frustulesAround)
    const cells = tubeCells(tube, frustulesAlong, frustulesAround)
    const cellId = wrapCell(cells.floor(), grid)
    const cellRnd = cellNoiseVec3(vec3(cellId, 37.2))
    const local = cells.fract().sub(0.5)
    const r = local.length()
    const theta = atan(local.y, local.x.add(1e-6))
// Radial costae (ribs) and concentric valve rings of each centric diatom frustule
    const sectorSymmetry = cellRnd.x.greaterThan(0.5).select(float(16), float(12))
    const ribWave = theta.mul(sectorSymmetry).cos()
    const ringWave = r.mul(TAU * 4.5).cos()
    const domeProfile = r.smoothstep(0.48, 0.06)
// 3D Voronoi biosilica foam scaffold for the inter-frustule girdle bands
    const voronoiScaffold = voronoi(positionGeometry.mul(19).add(2.3), 0.88)
    const scaffoldRib = voronoiScaffold.border.smoothstep(0.075, 0.008)
// Vertex displacement: raised silica costae, radial spines, and convex frustule valves
    const spineTip = r.sub(0.32).abs().smoothstep(0.045, 0).mul(ribWave.clamp(0, 1).pow(4))
    const vertexHeight = domeProfile.mul(0.0065)
      .add(ribWave.clamp(0, 1).mul(domeProfile).mul(0.0038))
      .add(ringWave.clamp(0, 1).mul(domeProfile).mul(0.0022))
      .add(spineTip.mul(0.0035))
      .add(scaffoldRib.mul(0.0025))
      .mul(dispView.near.mul(0.35).add(0.65))
    this.positionNode = positionGeometry.add(normalLocal.mul(vertexHeight))
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const footprint = cells.fwidth().x.max(cells.fwidth().y).max(0.0003)
// Primary silica ribs (costae), girdle rim, and Voronoi trabeculae
    const costaLine = filteredRibbon(ribWave, 0.2).mul(r.smoothstep(0.07, 0.11)).mul(r.smoothstep(0.46, 0.42))
    const ringLine = filteredRibbon(ringWave, 0.22).mul(r.smoothstep(0.47, 0.43))
    const girdleRim = filteredRibbon(r.sub(0.455), 0.022)
    const primarySilica = costaLine.max(ringLine).max(girdleRim).max(scaffoldRib.mul(r.smoothstep(0.38, 0.48)))
// Secondary hexagonal areolae chambers and tertiary nanoscale cribrum sieve pores (revealed up close)
    const chamberSieve = hexSievePores(local, 18, footprint)
    const nanoCribrum = hexSievePores(local.add(vec2(0.03, 0.07)), 64, footprint)
    const silicaSkeleton = primarySilica
      .max(chamberSieve.rim.mul(0.85))
      .max(nanoCribrum.rim.mul(intimate).mul(0.65))
      .mul(chamberSieve.pore.mul(0.88).oneMinus())
    const openPoreMask = silicaSkeleton.oneMinus()
// Deep refracted parallax into the living cytoplasm and vacuole organelles beneath the silica shell
    const deepP1 = refractedParallax(p, n, view, 0.018, 1.44)
    const deepP2 = refractedParallax(p, n, view, 0.042, 1.44)
// Deep-sea dinoflagellate/radiolarian action-potential wave triggered by viewer proximity
    const bioWavePhase = p.dot(vec3(0.58, 0.65, -0.49)).mul(16).sub(time.mul(2.1)).add(cellRnd.y.mul(TAU))
    const bioActionWave = bioWavePhase.sin().mul(0.5).add(0.5).pow(3.5)
    const shockwave = hairline(bioWavePhase.sin(), 0.065)
// Subsurface chlorophyll/luciferin organelles (plastids) in two parallax strata
    const organelle1 = voronoi(deepP1.mul(24).add(vec3(0, time.mul(0.18), 0)), 0.9)
    const organelle2 = voronoi(deepP2.mul(15).sub(vec3(time.mul(0.12), 0, 0)), 0.9)
    const plastidCore1 = organelle1.distance.smoothstep(0.32, 0.06).mul(mx_cell_noise_float(organelle1.cell).smoothstep(0.38, 0.78))
    const plastidCore2 = organelle2.distance.smoothstep(0.38, 0.08).mul(mx_cell_noise_float(organelle2.cell.add(19)).smoothstep(0.32, 0.75))
    const internalWeb = organelle1.border.smoothstep(0.048, 0.006).mul(0.6).add(organelle2.border.smoothstep(0.055, 0.008).mul(0.4))
// Photonic crystal diffraction across the periodic frustule pore lattice (Bragg grating iridescence)
    const gratingPhase = view.dot(vec3(1, 0.6, -0.4).normalize()).mul(9.5).add(r.mul(14)).add(grazing.mul(4.2))
    const photonicIridescence = spectralColor(gratingPhase).mul(grazing.pow(1.2).mul(0.75).add(0.25))
// Hydrated opal-A biosilica glass albedo vs deep abyssal bioluminescent cavity
    const opalSilica = mix(color(hsl.integer(219, 74, 9)), color(hsl.integer(187, 95, 45)), silicaSkeleton.mul(0.65)).add(photonicIridescence.mul(silicaSkeleton).mul(0.22))
    const abyssalCavity = mix(color(hsl.integer(242, 100, 2)), color(hsl.integer(243, 76, 5)), internalWeb)
    this.colorNode = mix(abyssalCavity, opalSilica, silicaSkeleton)
    this.metalnessNode = silicaSkeleton.mul(0.68)
    this.roughnessNode = mix(float(0.04), float(0.14).sub(nanoCribrum.pore.mul(intimate).mul(0.08)), silicaSkeleton)
    this.specularIntensityNode = mix(float(0.06), float(0.75), silicaSkeleton)
    this.clearcoatNode = silicaSkeleton.mul(0.85)
    this.clearcoatRoughnessNode = mix(float(0.03), float(0.045), silicaSkeleton)
    this.iridescenceNode = silicaSkeleton.mul(0.92).add(0.08)
    this.iridescenceIOR = 1.46
    this.iridescenceThicknessNode = r.mul(260).add(grazing.mul(240)).add(180)
// Crisp 3D normal relief across ribs, hexagonal sieve rims, and nano-cribrum pores
    const microRelief = vertexHeight
      .add(primarySilica.mul(0.0024))
      .add(chamberSieve.rim.mul(0.0012))
      .sub(chamberSieve.pore.mul(0.0015))
      .sub(nanoCribrum.pore.mul(intimate).mul(0.0006))
    const normal = proceduralNormal(microRelief, 1.1)
    this.normalNode = normal
// Bioluminescent luciferin emission: radium emerald, Cherenkov electric cyan, abyssal magenta-violet, and golden nucleolus sparks
    const radiumEmerald = color(hsl.integer(148, 100, 85))
    const cherenkovCyan = color(hsl.integer(237, 100, 68.7))
    const abyssalViolet = color(hsl.integer(319.5, 100, 59.6))
    const nucleolusAmber = color(hsl.integer(40.7, 100, 63.5))
    const organelleTint = mix(mix(cherenkovCyan, radiumEmerald, organelle1.random.x), abyssalViolet, organelle1.random.y.smoothstep(0.45, 0.78))
    const cytoplasmGlow = organelleTint
      .mul(plastidCore1.mul(1.35).add(plastidCore2.mul(0.85)).add(internalWeb.mul(0.35)))
      .mul(openPoreMask.mul(0.82).add(0.18))
// Central frustule nucleus and inner ring pulsing inside each diatom chamber
    const nucleusCore = r.smoothstep(0.22, 0.045).mul(openPoreMask.max(0.72))
    const nucleusPulse = time.mul(2.8).add(cellRnd.z.mul(TAU)).sin().mul(0.3).add(0.85)
// Action-potential wave and optical silica edge waveguiding (total internal reflection along the ribs)
    const ribWaveguide = primarySilica.mul(bioActionWave.mul(0.65).add(shockwave.mul(1.55))).mul(near.mul(0.6).add(0.4))
    const wetGlints = glints(normal, 210).mul(silicaSkeleton).mul(0.32)
    const protoplasmicStream = mx_fractal_noise_float(deepP1.mul(32).add(vec3(time.mul(0.6), time.mul(-0.5), 0)), 2, 2.1, 0.5).clamp(0, 1).mul(intimate)
    this.emissiveNode = cytoplasmGlow.mul(facing.mul(0.6).add(0.4)).mul(1.35)
      .add(nucleolusAmber.mul(nucleusCore).mul(nucleusPulse).mul(2.8))
      .add(mix(radiumEmerald, abyssalViolet, cellRnd.x).mul(ribWaveguide).mul(1.4))
      .add(cherenkovCyan.mul(shockwave).mul(openPoreMask).mul(1.8))
      .add(photonicIridescence.mul(rim.pow(1.8)).mul(silicaSkeleton).mul(0.85))
      .add(radiumEmerald.mul(protoplasmicStream).mul(openPoreMask).mul(0.65))
      .add(color(hsl.integer(196, 100, 98)).mul(wetGlints))
  }
}
