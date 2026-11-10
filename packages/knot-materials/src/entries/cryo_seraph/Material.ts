import type {Node, Texture} from 'three/webgpu'

import {atan, color, float, Fn, mix, mx_noise_float, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/gemini_argon/lib/detailNormal.ts'
import {glitter} from '../../candidates/gemini_argon/lib/glitter.ts'
import {tubeHex} from '../../candidates/gemini_argon/lib/tubeHex.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {beads} from '../../lib/beads.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const frostCells = [44, 6] as const
/** 6-fold stellar dendrite snowflake / hoarfrost fern crystal on a periodic hexagonal tube lattice. */
function dendriteCrystal(tube: Node<'vec2'>) {
  const hex = tubeHex(tube, frostCells, 3.7)
  const r = hex.distance.div(0.068)
  const angle = atan(hex.offset.y, hex.offset.x.add(1e-6)).add(hex.id.z.mul(TAU))
// Fold angle into 60-degree crystal sector for 6-fold hexagonal ice symmetry.
  const sector = angle.div(TAU / 6).fract().sub(0.5).abs().mul(TAU / 6)
  const alongArm = r.mul(sector.cos())
  const acrossArm = r.mul(sector.sin())
// Primary hexagonal spine + periodic 60-degree side-branching fern chevrons.
  const branchWave = alongArm.mul(18).sub(acrossArm.mul(10.4)).cos().smoothstep(0.25, 0.85)
  const spineWidth = float(0.085).add(branchWave.mul(0.16)).mul(r.smoothstep(0, 0.92).oneMinus())
  const hexCore = r.mul(sector.cos()).smoothstep(0.18, 0.24).oneMinus()
  const crystal = acrossArm.smoothstep(spineWidth.mul(0.55), spineWidth).oneMinus().mul(r.smoothstep(0.85, 1.02).oneMinus()).max(hexCore)
  const rimMask = r.smoothstep(0.15, 0.78)
  return {
    branchWave,
    crystal: crystal.mul(hex.id.x.smoothstep(0.12, 0.55)),
    id: hex.id,
    r,
    rimMask,
  }
}
/** Round diamond-dust grains inside the glitter lattice, so sparkles read as points instead of lighting whole cubic cells. */
function diamondDustGrains(position: Node<'vec3'>, cellSize: number, sharpness: number, tilt: number) {
  const facets = glitter(position, cellSize, sharpness, tilt)
  const q = position.div(cellSize)
  const center = cellNoiseVec3(q.floor()).mul(0.5).add(0.25)
  const outer = q.fwidth().length().add(0.18).min(0.24)
  const mask = q.fract().sub(center).length().smoothstep(0.06, outer).oneMinus()
  return {
    resolved: facets.resolved,
    sparkle: facets.sparkle.mul(mask),
  }
}
// Vertices are 2.8 cm apart along the tube, far coarser than the 6–17 mm dendrite arms, so the geometry only carries a smooth frost mound per crystal; the arms themselves stay in the per-pixel relief below.
const displacedGlacier = Fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  const frost = dendriteCrystal(tube)
  const mound = frost.r.smoothstep(0.1, 1).oneMinus().pow2().mul(frost.id.x.smoothstep(0.12, 0.55))
  const swell = tube.x.mul(TAU * 9).add(tube.y.mul(TAU * 2).sin()).cos().mul(0.0032)
  return position.add(normal.mul(mound.mul(0.0085).add(swell)))
})
/** Arctic Hoarfrost & Sub-Glacial Aurora Borealis: 6-fold dendritic frost ferns and diamond-dust micro-glitter over deep glacier blue ice with parallax pressure fractures, frozen air-bubble chains and an internal auroral curtain. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const eps = 0.00012
    const du = displacedGlacier(tube.add(vec2(eps, 0))).sub(displacedGlacier(tube.sub(vec2(eps, 0))))
    const dv = displacedGlacier(tube.add(vec2(0, eps))).sub(displacedGlacier(tube.sub(vec2(0, eps))))
    const glacierNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.positionNode = displacedGlacier(tube)
    const frost = dendriteCrystal(tube)
    const ray = tubeRay()
    const subFrost = dendriteCrystal(tube.sub(ray.mul(0.16)))
// Frost thickens toward grazing rims and cold windward crests; clear ice windows open on facing views.
    const frostCoverage = frost.crystal.mul(grazing.mul(0.45).add(0.65)).clamp(0, 1)
// Three-depth parallax internal pressure fractures and frozen methane/air bubble inclusions.
    const crackShallow = filteredRibbon(cellularBoundary(p.sub(view.mul(0.03)).mul(9.5)), 0.016)
    const crackMid = filteredRibbon(cellularBoundary(p.sub(view.mul(0.085)).mul(14).add(4.2)), 0.022)
    const crackDeep = filteredRibbon(cellularBoundary(p.sub(view.mul(0.16)).mul(19).add(9.8)), 0.028)
    const bubbleShallow = beads(p.sub(view.mul(0.045)).mul(34), 2.1)
    const bubbleDeep = beads(p.sub(view.mul(0.11)).mul(48), 8.7)
    const internalBubbles = bubbleShallow.mask.add(bubbleDeep.mask.mul(0.65)).mul(near.mul(0.65).add(0.35))
// Sub-glacial Aurora Borealis curtain dancing inside the deep ice core on a seamless 2-second loop.
    const loopAngle = time.mul(Math.PI)
    const deepP = p.sub(view.mul(0.14))
    const auroraWave = deepP.x.mul(11).add(deepP.z.mul(9)).add(mx_noise_float(deepP.mul(4.5).add(vec3(loopAngle.cos().mul(0.45), 0, loopAngle.sin().mul(0.45)))).mul(2.8))
    const auroraCurtain = opticalLine(auroraWave.sin(), 0.18).mul(deepP.y.mul(6).add(loopAngle).cos().mul(0.4).add(0.6))
    const auroraColor = mix(color('#00ff9d'), mix(color('#00d9ff'), color('#b833ff'), deepP.y.mul(1.8).add(0.5).clamp()), auroraWave.cos().mul(0.5).add(0.5))
// Diamond-dust micro-crystal facets that ignite under the gallery's studio lamps.
    const diamondDust = diamondDustGrains(p, 0.011, 85, 0.6)
// Deep glacier blue Beer-Lambert absorption in the clear windows, snow-white crystalline frost on the dendrites.
    const abyssalIce = mix(color('#021329'), color('#0b4f82'), facing.mul(0.65).add(0.35))
    const fractureIce = mix(abyssalIce, color('#8cebff'), crackShallow.mul(0.75).add(crackMid.mul(0.45)).add(crackDeep.mul(0.25)).add(internalBubbles.mul(0.6)).clamp(0, 1))
    const snowWhite = mix(color('#d8f0ff'), color('#ffffff'), frost.branchWave)
    this.colorNode = mix(fractureIce, snowWhite, frostCoverage.max(subFrost.crystal.mul(0.28)))
    this.metalnessNode = frostCoverage.mul(0.08)
    this.roughnessNode = mix(float(0.025), float(0.42), frostCoverage)
      .sub(diamondDust.sparkle.mul(0.08))
      .clamp(0.018, 0.48)
    this.ior = 1.31
    this.clearcoatNode = frostCoverage.oneMinus().mul(0.85).add(0.15)
    this.clearcoatRoughnessNode = mix(float(0.012), float(0.16), frostCoverage)
    this.sheenNode = color('#bce8ff').mul(frostCoverage).mul(0.85)
    this.sheenRoughness = 0.25
    this.iridescenceNode = crackShallow.add(frostCoverage.mul(0.35)).clamp(0, 1).mul(0.55)
    this.iridescenceIOR = 1.35
    this.iridescenceThicknessNode = facing.mul(240).add(frost.r.mul(180)).add(200)
    // The arms' relief moved out of the vertex displacement, so the per-pixel bump carries a little more of it.
    const fineRelief = frost.crystal.mul(0.0035).sub(crackShallow.mul(0.0012)).add(diamondDust.resolved.mul(0.0003))
    this.normalNode = detailNormal(glacierNormal, fineRelief, 0.92)
// Sub-glacial auroral ribbon, backlit Tyndall ice scatter, and diamond-dust frost sparkles.
    const tyndallScatter = color('#12b8ff').mul(crackMid.add(crackDeep).add(internalBubbles)).mul(0.55)
    const auroraGlow = auroraColor.mul(auroraCurtain).mul(frostCoverage.oneMinus().mul(0.7).add(0.3)).mul(1.35)
    const frostSparkle = color('#e8f9ff').mul(diamondDust.sparkle).mul(frostCoverage.max(0.25)).mul(intimate.mul(0.65).add(0.35))
    const coldRim = color('#5cd6ff').mul(grazing.pow(3)).mul(0.34)
    this.emissiveNode = auroraGlow
      .add(tyndallScatter)
      .add(frostSparkle.mul(0.9))
      .add(coldRim)
  }
}
