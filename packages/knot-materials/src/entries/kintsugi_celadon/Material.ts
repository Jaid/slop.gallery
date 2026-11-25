import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, mx_noise_float, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/gemini_argon/lib/detailNormal.ts'
import {panelSky, proceduralEnvironment} from '../../candidates/gemini_argon/lib/environment.ts'
import {tubeMetric, tubeTurns} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {voronoi} from '../../candidates/gemini_argon/lib/voronoiNearestPair.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {glints} from '../../lib/glints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Subtle carved Song-dynasty porcelain lotus-fluting ribs along the knot. */
function celadonCarving(tube: Node<'vec2'>) {
  const turns = tubeTurns(tube)
  const flutes = 16
  const flutePhase = turns.mul(flutes * TAU)
  const fluteGroove = flutePhase.cos().mul(0.5).add(0.5).pow(0.8)
  const glazePooling = float(1).sub(fluteGroove)
  const relief = fluteGroove.mul(0.45).sub(0.22)
  return {
    fluteGroove,
    glazePooling,
    relief,
    turns,
  }
}
const displacedCeladon = Fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  const {relief} = celadonCarving(tube)
  return position.add(normal.mul(relief.mul(0.0095)))
})
/** Kintsugi Celadon (Song-Dynasty Ge-ware / Longquan Porcelain & 24k Gold Urushi Joinery): misty fenqing sky-celadon glaze, true two-tier Jin Si Tie Xian crackle hierarchy, and brittle shard kintsugi seams. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.1)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, near, intimate} = viewerFrame()
    const eps = 0.00025
    const du = displacedCeladon(tube.add(vec2(eps, 0))).sub(displacedCeladon(tube.sub(vec2(eps, 0))))
    const dv = displacedCeladon(tube.add(vec2(0, eps))).sub(displacedCeladon(tube.sub(vec2(0, eps))))
    const macroNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.positionNode = displacedCeladon(tube)
    const {fluteGroove, glazePooling, turns} = celadonCarving(tube)
    const loopPhase = time.mul(Math.PI)
    const metric = tubeMetric(tube)
    const dsWorld = p.fwidth().length().max(0.00005)
// Primary brittle ceramic shard Voronoi on exact metric tube coordinates (11 × 2 near-square shards around the knot; never forms hollow closed loops!)
// Small, high-frequency angular perturbation creates crisp brittle deflections while keeping ||∇_S(f2 - f1)|| uniform!
    const shardGrid: [number, number] = [11, 2]
    const shardCoord = vec2(metric.x.mul(shardGrid[0] / 7.177185), turns.mul(shardGrid[1]))
    const angularSnap = vec2(mx_noise_float(p.mul(14)), mx_noise_float(p.mul(14).add(5.3))).mul(0.032)
    const macroShard = voronoi(shardCoord.add(angularSnap), shardGrid, 7, 0.82)
    const shardId = cellNoiseVec3(vec3(macroShard.cell, 3.1))
// Normalize by 3D surface derivative so the kintsugi seam maintains a constant 3D metric caliber across every curve and intersection
    const rawShardEdge = macroShard.f2.sub(macroShard.f1)
    const edgeDist = rawShardEdge.div(rawShardEdge.fwidth().div(dsWorld).max(2.2))
    const goldHalfWidth = float(0.0029).max(dsWorld.mul(1.35))
    const goldMask = edgeDist.smoothstep(goldHalfWidth, goldHalfWidth.add(dsWorld.mul(1.15))).oneMinus()
// Burnished flush-to-convex urushi lacquer meniscus profile + micro-granular kimpun gold powder texture
    const normSeam = edgeDist.div(goldHalfWidth.mul(1.06)).clamp()
    const seamCrown = float(1).sub(normSeam.pow(2.2)).max(0).pow(0.75)
    const kimpunGrain = mx_noise_float(p.mul(240)).mul(0.5).add(0.5)
// Reddish-black bengara urushi lacquer fringe right at the gold meniscus edge
    const ironFootLip = edgeDist.smoothstep(goldHalfWidth, goldHalfWidth.add(0.0016)).oneMinus().mul(goldMask.oneMinus())
// Authentic 3D Object-Space Two-Tier "Jin Si Tie Xian" (金丝铁线 - Golden Thread & Iron Wire) Ge-ware crackle hierarchy:
// Tier 1: Razor-sharp, bold dark charcoal/black "Iron Wire" (Tie Xian) primary structural fractures
    const pLayer1 = p.sub(view.mul(0.008))
    const warp1 = vec3(mx_noise_float(pLayer1.mul(6.5)), mx_noise_float(pLayer1.mul(6.5).add(4.1)), mx_noise_float(pLayer1.mul(6.5).add(8.3))).mul(0.048)
      .add(vec3(mx_noise_float(pLayer1.mul(18)), mx_noise_float(pLayer1.mul(18).add(2.7)), mx_noise_float(pLayer1.mul(18).add(6.9))).mul(0.015))
    const q1 = pLayer1.add(warp1).mul(5.6)
    const cDist1 = cellularBoundary(q1)
    const fp1 = cDist1.fwidth().max(0.0004)
// Crisp, razor-sharp primary Iron Wire fissure
    const ironWire = cDist1.smoothstep(0.024, float(0.026).add(fp1.mul(1.15))).oneMinus()
// Tier 2: Subtle, 3.5× thinner warm ochre-amber "Golden Thread" (Jin Si) micro-cracks nested strictly inside the primary Iron Wire cells!
    const pLayer2 = p.sub(view.mul(0.022))
    const macroCellId = cellNoiseVec3(q1.floor())
    const q2 = pLayer2.add(warp1.mul(0.7)).mul(19.5).add(macroCellId.mul(4.3))
    const cDist2 = cellularBoundary(q2)
    const fp2 = cDist2.fwidth().max(0.0004)
// Terminate Golden Thread cleanly at the Iron Wire wall (forming 90-degree T-junctions) and preserve visibility across distances
    const insideMacroCell = cDist1.smoothstep(0.025, 0.045)
    const jinWidth = float(0.013).max(fp2.mul(0.95))
    const goldenThread = cDist2.smoothstep(jinWidth, jinWidth.add(fp2.mul(1.15))).oneMinus()
      .mul(insideMacroCell)
      .mul(ironWire.oneMinus())
// Internal angled crystalline cleavage planes that catch glancing light inside the glaze thickness
    const shardTilt = macroCellId.sub(0.5).normalize()
    const cleavageWallFlash = cDist1.smoothstep(0.02, 0.075).oneMinus().mul(shardTilt.dot(view).abs().pow(4)).mul(0.38)
    const iceFacetFlash = shardTilt.dot(view).abs().pow(7).mul(cDist2.smoothstep(0, 0.18).oneMinus()).mul(0.2).add(cleavageWallFlash)
// Deep suspended quartz & feldspar mineral speckles + microscopic kiln bubbles inside the glaze
    const bubbleField = p.sub(view.mul(0.03)).mul(68)
    const bubbleRnd = cellNoiseVec3(bubbleField.floor())
    const bubbleDist = bubbleField.fract().sub(bubbleRnd.mul(0.5).add(0.25)).length()
    const kilnBubbles = bubbleDist.smoothstep(0.06, 0.16).oneMinus().mul(bubbleRnd.z.smoothstep(0.58, 0.86))
// Historic Song-dynasty Ge-ware / Longquan "Fenqing" (misty powder blue-green / seafoam jade) palette over a warm stoneware body:
    const warmPorcelainRidge = color(hsl.integer(165, 14, 88))
    const fenqingSkyJade = color(hsl.integer(187, 28, 63))
    const deepPooledFenqing = color(hsl.integer(188, 42, 40))
    const ironOxideRim = color(hsl.integer(45, 31, 15))
    const ridgeThinness = fluteGroove.smoothstep(0.76, 0.98)
// Subtle per-shard glaze tone shift across the mended kintsugi break
    const shardTint = shardId.x.sub(0.5).mul(0.05)
    const baseGlaze = mix(mix(fenqingSkyJade, deepPooledFenqing, glazePooling.mul(0.66).add(shardTint).clamp()), warmPorcelainRidge, ridgeThinness.mul(0.55))
// Composite delicate tea-amber Golden Thread FIRST, and bold charcoal-black Iron Wire ON TOP so Tie Xian unmistakably dominates!
    const threadStained = mix(baseGlaze, color(hsl.integer(66, 73, 49)), goldenThread.mul(0.62))
    const ironStained = mix(threadStained, color(hsl.integer(52, 12, 4)), ironWire.mul(0.96))
    const glazedBody = mix(ironStained, ironOxideRim, ironFootLip.mul(0.72))
      .add(color(hsl.integer(185, 45, 95)).mul(iceFacetFlash.add(kilnBubbles.mul(0.18))))
// Authentic satin-burnished 24k kimpun gold powder over urushi lacquer
    const keshifunSparkle = cellNoiseVec3(p.mul(220).floor()).sub(0.5).normalize().dot(view).abs().pow(14).mul(near.mul(0.6).add(0.4))
    const pure24kGold = mix(color(hsl.integer(69, 89, 63)), color(hsl.integer(82, 100, 84)), seamCrown.mul(0.65).add(kimpunGrain.mul(0.35)))
      .add(color(hsl.integer(95, 100, 95.5)).mul(keshifunSparkle.mul(0.32)))
    this.colorNode = mix(glazedBody, pure24kGold, goldMask)
// Metalness: 1 on 24k gold kintsugi seams, 0 on dielectric porcelain glaze
    this.metalnessNode = goldMask
// Shallow 2mm celadon glaze translucency over a denser stoneware ceramic core (prevents deep watery ribbon artifacts!)
    this.transmissionNode = goldMask.oneMinus().mul(0.38)
    this.thicknessNode = mix(float(0.16), float(0.38), glazePooling).mul(goldMask.oneMinus())
    this.ior = 1.52
    this.attenuationColor.set(hsl.integer(188, 59, 47))
    this.attenuationDistance = 0.32
// Unctuous "mutton-fat jade" luster on celadon (~0.095 roughness) and micro-granular satin-burnished 24k kimpun gold (~0.21 roughness)
    const goldRough = float(0.185).add(kimpunGrain.mul(0.065)).sub(seamCrown.mul(0.025))
    const glazeRough = float(0.095).add(ridgeThinness.mul(0.03)).add(ironWire.mul(0.045))
    this.roughnessNode = mix(glazeRough, goldRough, goldMask).clamp(0.06, 0.26)
    this.sheen = 0.35
    this.sheenColor.set(hsl.integer(189, 42, 88.7))
    this.sheenRoughness = 0.45
// Smooth vitreous silica clearcoat strictly on the porcelain (0 on gold so the burnished gold powder sits proudly ABOVE the glaze!)
    this.clearcoatNode = goldMask.oneMinus().mul(0.88)
    this.clearcoatRoughness = 0.065
// Micro-relief height: subtle per-shard reassembly step offset + burnished urushi gold meniscus + substrate fracture trench + Iron Wire indentation
    const shardStep = shardId.z.sub(0.5).mul(0.0014)
    const microHeight = shardStep
      .add(seamCrown.mul(goldMask).mul(0.0044))
      .add(kimpunGrain.mul(goldMask).mul(0.00035))
      .sub(ironFootLip.mul(0.0011))
      .sub(ironWire.mul(goldMask.oneMinus()).mul(0.00075))
    const surfaceNormal = detailNormal(macroNormal, microHeight, 0.95)
    this.normalNode = surfaceNormal
// Soft diffused museum skylight environment
    const gallerySky = panelSky({
      zenith: [0.07, 0.1, 0.12],
      horizon: [0.18, 0.19, 0.18],
      nadir: [0.03, 0.04, 0.04],
      glow: {
        color: [0.92, 0.82, 0.62],
        intensity: 0.48,
        width: 0.14,
      },
      panels: [{
        azimuth: 0.55,
        elevation: 0.6,
        halfWidth: 0.52,
        halfHeight: 0.32,
        color: [1, 0.95, 0.88],
        intensity: 5.4,
        softness: 0.25,
      }, {
        azimuth: -1.1,
        elevation: 0.46,
        halfWidth: 0.18,
        halfHeight: 0.64,
        color: [0.78, 0.94, 0.92],
        intensity: 5.8,
        softness: 0.22,
      }, {
        azimuth: 2.25,
        elevation: 0.48,
        halfWidth: 0.42,
        halfHeight: 0.16,
        color: [1, 0.78, 0.46],
        intensity: 4.8,
        softness: 0.22,
      }],
    })
    this.envNode = proceduralEnvironment(gallerySky)
// Deep internal porcelain translucency + subtle golden kiln-spirit luster along the mended kintsugi seams
    const emberWave = metric.x.mul(2.5).add(p.y.mul(3.5)).sub(loopPhase.mul(2)).sin().mul(0.5).add(0.5).pow(2.6)
    const jadeSubsurface = mix(color(hsl.integer(190, 64, 29)), color(hsl.integer(188, 59, 62)), glazePooling).mul(facing.oneMinus().mul(0.55).add(0.35)).mul(goldMask.oneMinus()).mul(0.22)
    const cleavageEmissive = color(hsl.integer(188, 52, 89)).mul(cleavageWallFlash).mul(goldMask.oneMinus()).mul(0.28)
    const goldSeamLuster = color(hsl.integer(71.5, 100, 78)).mul(goldMask).mul(seamCrown).mul(near.mul(0.45).add(0.14)).mul(emberWave.mul(0.6).add(0.4))
    const goldSparkle = glints(surfaceNormal, 48).mul(goldMask).mul(intimate.mul(0.35).add(0.2))
    this.emissiveNode = jadeSubsurface
      .add(cleavageEmissive)
      .add(goldSeamLuster)
      .add(color(hsl.integer(92, 100, 92)).mul(goldSparkle).mul(0.3))
  }
}
