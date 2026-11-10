import type {Node, Texture} from 'three/webgpu'

import {color, float, Fn, mix, mx_noise_float, select, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/gemini_argon/lib/detailNormal.ts'
import {panelSky, proceduralEnvironment} from '../../candidates/gemini_argon/lib/environment.ts'
import {tubeCells, tubeMetric, tubeTurns} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const plateGrid: [number, number] = [12, 2]
/** Periodic 2D Voronoi with smooth-minimum (smin) filleted edge distance so 3-way fissure junctions never produce sharp diagonal miter seams! */
function smoothEdgeVoronoi(p: Node<'vec2'>, period: [number, number], seed = 0, jitter = 0.7) {
  const size = vec2(...period)
  const base = p.floor()
  const local = p.sub(base)
  const bias = (1 - jitter) / 2
  let nearest: Node<'float'> = float(16)
  let cell: Node<'vec2'> = vec2(0)
  let bestDelta: Node<'vec2'> = vec2(0)
  for (let j = -1;j <= 1;j++) {
    for (let i = -1;i <= 1;i++) {
      const step = vec2(i, j)
      const wrapped = wrapCell(base.add(step), size)
      const random = cellNoiseVec3(vec3(wrapped, seed))
      const delta = step.add(random.xy.mul(jitter).add(bias)).sub(local)
      const distance = delta.dot(delta)
      const closer = distance.lessThan(nearest)
      nearest = select(closer, distance, nearest)
      cell = select(closer, wrapped, cell)
      bestDelta = select(closer, delta, bestDelta)
    }
  }
// Second pass: smooth-minimum (polynomial smin) across all neighbor bisector planes!
// This fillets 3-way Voronoi Y-junctions smoothly so there is NEVER a hard diagonal miter bisector!
  let edgeDist: Node<'float'> = float(8)
  const sminK = 0.085
  for (let j = -1;j <= 1;j++) {
    for (let i = -1;i <= 1;i++) {
      const step = vec2(i, j)
      const wrapped = wrapCell(base.add(step), size)
      const random = cellNoiseVec3(vec3(wrapped, seed))
      const delta = step.add(random.xy.mul(jitter).add(bias)).sub(local)
      const diff = delta.sub(bestDelta)
      const diffLen = diff.length()
      const isOther = diffLen.greaterThan(0.001)
      const planeDist = bestDelta.add(delta).mul(0.5).dot(diff.div(diffLen.max(0.0001)))
      const validDist = select(isOther, planeDist, float(8))
      const h = float(sminK).sub(edgeDist.sub(validDist).abs()).max(0).div(sminK)
      edgeDist = edgeDist.min(validDist).sub(h.pow(2).mul(sminK * 0.25))
    }
  }
  return {
    f1: nearest.sqrt(),
    edgeDist: edgeDist.max(0),
    cell,
  }
}
/** Tectonic basalt plate Voronoi & sunken magma canyon geometry along the knot. */
function calderaTectonics(tube: Node<'vec2'>) {
  const metric = tubeMetric(tube)
  const turns = tubeTurns(tube)
  const cells = tubeCells(tube, plateGrid[0], plateGrid[1])
  const uAng = tube.x.mul(TAU)
  const vAng = turns.mul(TAU)
  const warp = vec2(uAng.sin().mul(0.11).add(vAng.cos().mul(0.08)), uAng.cos().mul(0.11).sub(vAng.sin().mul(0.08)))
  const plate = smoothEdgeVoronoi(cells.add(warp), plateGrid, 11)
  const colId = cellNoiseVec3(vec3(plate.cell, 2.7))
  const edgeDist = plate.edgeDist
  const quantizedStep = colId.x.mul(4).floor().div(3)
  const platePlateau = edgeDist.smoothstep(0.06, 0.125)
  const elevation = mix(float(-0.55), quantizedStep.mul(0.42).add(0.38), platePlateau)
  return {
    cells,
    colId,
    edgeDist,
    elevation,
    metric,
    plate,
    platePlateau,
    quantizedStep,
    turns,
    warp,
  }
}
const displacedCaldera = Fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  const {elevation} = calderaTectonics(tube)
  return position.add(normal.mul(elevation.mul(0.022)))
})
/** Basalt Caldera (Columnar Basalt, Scoria Cliff Walls & Pahoehoe Magma): bone-dry matte stony basalt plateaus, continuous radiant transition from center-hot magma up the overhanging cliff walls, and smin-filleted fissure junctions. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.65)
    this.name = knotData.id
    const tube = uv()
    const {p, view, near} = viewerFrame()
    const eps = 0.0003
    const du = displacedCaldera(tube.add(vec2(eps, 0))).sub(displacedCaldera(tube.sub(vec2(eps, 0))))
    const dv = displacedCaldera(tube.add(vec2(0, eps))).sub(displacedCaldera(tube.sub(vec2(0, eps))))
    const macroNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.positionNode = displacedCaldera(tube)
    const {colId, edgeDist, metric, quantizedStep, turns} = calderaTectonics(tube)
    const fpEdge = edgeDist.fwidth().max(0.0005)
    const loopPhase = time.mul(Math.PI)
// Subtle micro-fracture rock chipping along the cliff walls
    const edgeChipping = mx_noise_float(p.mul(44)).mul(0.009).add(mx_noise_float(p.mul(105)).mul(0.003))
    const dCanyon = edgeDist.add(edgeChipping).max(0)
// Continuous Symmetric Canyon Geometry in `dCanyon` (smin-filleted so 3-way junctions have zero diagonal miter seams!):
// Zone 1 (`dCanyon < floorHalfWidth`): Recessed Magma Channel Floor
// Zone 2 (`dCanyon in [floorHalfWidth .. topRimRadius]`): Steep Vertical Basalt Cliff Walls
// Zone 3 (`dCanyon > topRimRadius`): Cold, Matte Stony Top Basalt Plateau
    const pressureWiden = near.mul(0.012)
    const floorHalfWidth = float(0.068).add(pressureWiden).max(fpEdge.mul(1.8))
    const cliffSpan = 0.048
    const topRimRadius = floorHalfWidth.add(cliffSpan)
    const isMagmaFloor = dCanyon.smoothstep(floorHalfWidth.sub(0.006), floorHalfWidth.add(0.006)).oneMinus()
    const inTrenchCavity = dCanyon.smoothstep(topRimRadius, topRimRadius.add(fpEdge.mul(1.25))).oneMinus()
    const isCliffWall = inTrenchCavity.mul(isMagmaFloor.oneMinus())
// Normalized height up the vertical cliff wall: `0.0` at the magma contact line (`floorHalfWidth`), `1.0` at the cold top rim (`topRimRadius`)!
    const cliffHeight = dCanyon.sub(floorHalfWidth).div(cliffSpan).clamp()
// Cross-Channel Coordinate `channelCore` inside the Magma Floor (`0.0` at the cliff wall contact `dCanyon = floorHalfWidth`, `1.0` at the center axis `dCanyon = 0` of the magma river):
    const channelCore = float(1).sub(dCanyon.div(floorHalfWidth.max(0.001)).clamp())
// 1. Directional Tangent-Guided Corded Pahoehoe Folds & Vesicular Porosity across the Cold Stony Basalt Plateaus:
    const smoothSwirl = p.x.mul(9.5).sin().mul(p.y.mul(9.5).cos()).add(p.z.mul(9.5).sin()).mul(0.45)
    const parabolicFlowDrag = turns.mul(4).fract().sub(0.5).pow(2).mul(1.8)
    const flowStreamline = metric.x.mul(16).sub(parabolicFlowDrag).add(smoothSwirl).add(colId.y.mul(2.5))
    const fpFlow = flowStreamline.fwidth().max(0.0005)
    const ropeFilter = fpFlow.smoothstep(0.18, 0.52).oneMinus()
    const ropePhase = flowStreamline.mul(TAU)
    const pahoehoeCords = ropePhase.add(ropePhase.sin().mul(0.42)).sin().mul(0.5).add(0.5).mul(ropeFilter)
    const basaltGrain = mx_noise_float(p.mul(38)).mul(0.5).add(0.5)
    const vesicleField1 = mx_noise_float(p.mul(95)).mul(0.5).add(0.5)
    const vesicleField2 = mx_noise_float(p.mul(215)).mul(0.5).add(0.5)
    const vesiclePits = vesicleField1.smoothstep(0.54, 0.76).add(vesicleField2.smoothstep(0.58, 0.8).mul(0.65)).mul(fpEdge.smoothstep(0.012, 0.038).oneMinus())
// 2. Continuous Center-Hot Magma Thermal Gradient (`channelCore` from `1.0` at center axis to `0.0` at cliff wall):
// IMPORTANT: There is NO pitch-black unlit gap between the lava and the orange cliff wall!
// At `channelCore = 0` (`cliffHeight = 0`), the magma margin is glowing deep red-orange (`magmaTemp ~ 0.32`), which connects seamlessly to the glowing red-orange base of the vertical cliff wall (`cliffHeight = 0`) and grazes the tops of the scoria crust fragments!
    const flowConvection = mx_noise_float(p.sub(view.mul(0.025)).mul(14).add(vec3(loopPhase.cos().mul(0.35), loopPhase.sin().mul(0.35), 2.3))).mul(0.5).add(0.5)
    const crustNoise = mx_noise_float(p.sub(view.mul(0.015)).mul(24).add(vec3(loopPhase.sin().mul(0.3), 0, loopPhase.cos().mul(0.3)))).mul(0.5).add(0.5)
    const marginScoria = crustNoise.add(float(1).sub(channelCore).mul(0.35)).smoothstep(0.76, 0.94).mul(channelCore.smoothstep(0.85, 0.15))
    const pulseHeat = loopPhase.mul(2).add(colId.z.mul(TAU)).sin().mul(0.06).add(0.94)
// Temperature stays >= 0.28 at the wall contact (`channelCore = 0`) and rises to 1.08 at the center axis (`channelCore = 1`), so even the margin scoria and wall contact glow warm cherry-orange rather than dropping to pitch black!
    const baseCrossTemp = channelCore.pow(1.25).mul(0.74).add(0.28)
    const magmaTemp = baseCrossTemp
      .add(flowConvection.mul(channelCore).mul(0.2))
      .sub(marginScoria.mul(0.32))
      .mul(pulseHeat)
      .add(near.mul(0.08).mul(channelCore))
      .clamp(0.18, 1.12)
// Planckian Blackbody Color Ramp:
// Warm cherry-red wall contact & scoria grazed by lava bounce (#7a0900 -> #d92b00) -> Mid-channel orange (#ff5500 -> #ffa818) -> Center-axis white-hot core (#ffe855 -> #ffffff)
    const planckianMagma = mix(color('#6e0700'), mix(color('#d92800'), mix(color('#ff5900'), mix(color('#ffb01c'), color('#fff8c4'), magmaTemp.smoothstep(0.68, 0.96)), magmaTemp.smoothstep(0.42, 0.72)), magmaTemp.smoothstep(0.2, 0.46)), magmaTemp.smoothstep(0.1, 0.26))
      .add(color('#ffffff').mul(magmaTemp.smoothstep(0.84, 1.08).pow(1.6).mul(1.35)))
// 3. Matte Stony Basalt Plateau & Cliff Rim Color:
    const stonyBasalt = mix(color('#16181d'), color('#2e333d'), pahoehoeCords.mul(0.55).add(quantizedStep.mul(0.28)).add(basaltGrain.mul(0.17)))
      .mul(vesiclePits.mul(-0.52).add(1))
    const dryStonyRim = dCanyon.sub(topRimRadius).abs().smoothstep(0.022, 0).mul(isMagmaFloor.oneMinus())
    const plateauWithRim = mix(stonyBasalt, color('#383e4a'), dryStonyRim.mul(0.45))
// 4. Inverse-Square Continuous Radiosity Tail (`1 / (1 + k * d^2)`) that does NOT clamp at `topRimRadius`, plus Inter-Loop Bounce Light:
    const distFromLavaEdge = dCanyon.sub(floorHalfWidth).max(0)
// Inverse-square physical decay across the cliff wall and bleeding softly onto the surrounding basalt plateau!
    const inverseSquareRadiosity = float(1).div(float(1).add(distFromLavaEdge.div(0.036).pow(2)))
    const localHotSpot = flowConvection.mul(0.35).add(0.8)
    const radiosityIntensity = inverseSquareRadiosity.mul(localHotSpot).mul(isMagmaFloor.oneMinus())
// Smooth chromatic decay along the radiosity tail: bright volcanic orange near the lava edge -> deep crimson -> warm dark ember brown on the plateau
    const radiosityColor = mix(color('#3d0400'), mix(color('#b51400'), color('#ff5e05'), inverseSquareRadiosity.smoothstep(0.35, 0.92)), inverseSquareRadiosity.smoothstep(0.05, 0.55))
    const litBasaltRock = plateauWithRim.add(radiosityColor.mul(radiosityIntensity).mul(0.75))
    this.colorNode = mix(litBasaltRock, planckianMagma, isMagmaFloor)
// 5. Bone-Dry Matte Stony Roughness & Low Specular Reflectivity across ALL Basalt & Cliff Rims:
    this.metalness = 0
    this.clearcoat = 0
    this.specularIntensityNode = float(0.08).mul(isMagmaFloor.oneMinus())
    const stonyRoughness = mix(float(0.92), float(0.86), pahoehoeCords)
      .add(vesiclePits.mul(0.06))
      .add(basaltGrain.sub(0.5).mul(0.06))
    this.roughnessNode = mix(stonyRoughness, float(0.98), isMagmaFloor).clamp(0.85, 0.99)
// Micro-Relief Height:
    const cliffRockRoughness = mx_noise_float(p.mul(85)).mul(isCliffWall).mul(0.0022)
    const pahoehoeRopeRelief = pahoehoeCords.mul(inTrenchCavity.oneMinus()).mul(0.0038)
    const microHeight = cliffHeight.mul(0.015)
      .add(pahoehoeRopeRelief)
      .add(cliffRockRoughness)
      .sub(vesiclePits.mul(inTrenchCavity.oneMinus()).mul(0.0032))
      .add(marginScoria.mul(isMagmaFloor).mul(0.0016))
    const surfaceNormal = detailNormal(macroNormal, microHeight, 1.15)
    this.normalNode = surfaceNormal
// Analytical 3D Inter-Loop & Local Fissure Radiosity:
// 1. Directional local micro-illumination: compute the screen-space gradient of `dCanyon` to find the vector pointing toward the glowing fissure, and dot it with the micro-bumped surface normal so the rough basalt ridges and pahoehoe folds directly adjacent to the channel catch directional orange-red raking light on their fissure-facing slopes!
    const toFissureView = vec3(dCanyon.dFdx().negate(), dCanyon.dFdy().negate(), 0.002).normalize()
    const microSlopeCatch = surfaceNormal.dot(toFissureView).max(0).mul(0.75).add(0.25)
    const longTail = float(1).div(float(1).add(distFromLavaEdge.div(0.135).pow(2)))
    const shoulderRadiosity = mix(color('#520500'), color('#ff5200'), longTail.smoothstep(0.12, 0.85)).mul(longTail).mul(microSlopeCatch).mul(isMagmaFloor.oneMinus())
// 2. Analytical 3D Inter-Loop Diffuse + Rough-Specular Bounce Light:
    const crossingLights = [vec3(0.26, 0, 0), vec3(-0.13, 0.225, 0), vec3(-0.13, -0.225, 0), vec3(0, 0, 0.12)] as const
    let interStrandIrradiance: Node<'float'> = float(0)
    let interStrandSpec: Node<'float'> = float(0)
    for (const emitter of crossingLights) {
      const deltaL = emitter.sub(p)
      const distSq = deltaL.dot(deltaL).max(0.006)
      const dirL = transformNormalToView(deltaL.normalize())
      const cosTheta = surfaceNormal.dot(dirL).max(0).mul(0.75).add(0.25)
      const atten = float(0.024).div(float(0.018).add(distSq))
      interStrandIrradiance = interStrandIrradiance.add(cosTheta.mul(atten))
      const halfDir = dirL.add(vec3(0, 0, 1)).normalize()
      const roughSpec = surfaceNormal.dot(halfDir).max(0).pow(4).mul(atten)
      interStrandSpec = interStrandSpec.add(roughSpec)
    }
// Soft diffused volcanic sky environment
    const calderaSky = panelSky({
      zenith: [0.07, 0.09, 0.13],
      horizon: [0.14, 0.11, 0.09],
      nadir: [0.16, 0.05, 0.01],
      glow: {
        color: [1, 0.42, 0.08],
        intensity: 0.65,
        width: 0.15,
      },
      panels: [{
        azimuth: 0.5,
        elevation: 0.6,
        halfWidth: 0.62,
        halfHeight: 0.38,
        color: [0.78, 0.86, 0.96],
        intensity: 3.8,
        softness: 0.35,
      }, {
        azimuth: -1.18,
        elevation: 0.44,
        halfWidth: 0.32,
        halfHeight: 0.62,
        color: [0.85, 0.9, 0.98],
        intensity: 4.1,
        softness: 0.32,
      }, {
        azimuth: 2.2,
        elevation: -0.18,
        halfWidth: 0.55,
        halfHeight: 0.22,
        color: [1, 0.44, 0.08],
        intensity: 4.5,
        softness: 0.3,
      }],
    })
    this.envNode = proceduralEnvironment(calderaSky)
// Emissive combination:
// Tier 1: Direct Planckian incandescence on the recessed magma floor (`isMagmaFloor`)
// Tier 2: Continuous inverse-square diffuse radiosity (`continuousRadiosity` + `shoulderRadiosity`) raking across the micro-bumped basalt ridges and pahoehoe folds adjacent to the fissure!
// Tier 3: Analytical 3D Inter-Strand Bounce Light (`interLoopBounce`) illuminating neighboring loops and crossings with warm volcanic orange-red light!
    const magmaEmission = planckianMagma.mul(isMagmaFloor).mul(float(0.65).add(magmaTemp.mul(1.65)))
    const continuousRadiosity = radiosityColor.mul(radiosityIntensity).add(shoulderRadiosity.mul(0.95)).mul(near.mul(0.35).add(0.75)).mul(1.2)
    const interLoopBounce = mix(color('#8c1100'), color('#ff5900'), interStrandIrradiance.clamp(0, 1)).mul(interStrandIrradiance.mul(stonyBasalt.r.mul(3.5).add(0.45)).add(interStrandSpec.mul(0.65))).mul(isMagmaFloor.oneMinus()).mul(1.15)
    this.emissiveNode = magmaEmission.add(continuousRadiosity).add(interLoopBounce)
  }
}
