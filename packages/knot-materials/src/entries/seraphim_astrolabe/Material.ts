import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, mx_atan2, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/gemini_argon/lib/detailNormal.ts'
import {panelSky, proceduralEnvironment} from '../../candidates/gemini_argon/lib/environment.ts'
import {tubeCells} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const columns = 18
const rows = 2
const rotate2 = (p: Node<'vec2'>, angle: Node<'float'>) => {
  const c = angle.cos()
  const s = angle.sin()
  return vec2(p.x.mul(c).sub(p.y.mul(s)), p.x.mul(s).add(p.y.mul(c)))
}
/** Precision horological gear wheel SDF: positive inside the gear metal, negative in cutaways. */
function gearWheel(p: Node<'vec2'>, outerRadius: number, innerRadius: number, spokeWidth: number, teeth: number, spin: Node<'float'>) {
  const q = rotate2(p, spin)
  const r = q.length().max(0.0001)
  const theta = mx_atan2(q.y, q.x) as unknown as Node<'float'>
  const toothWave = theta.mul(teeth).cos()
  const rimOuter = toothWave.smoothstep(-0.22, 0.22).mul(outerRadius * 0.1).add(outerRadius)
  const outerWall = rimOuter.sub(r)
  const innerCut = r.sub(innerRadius)
// 5-spoke skeletal bridge + central hub
  const spokeAngle = theta.mul(5).cos().abs()
  const spokeDist = r.mul(float(1).sub(spokeAngle.pow(2)).max(0).sqrt()).sub(spokeWidth)
  const hub = float(innerRadius * 0.44).sub(r)
  const interior = innerCut.negate().min(spokeDist).max(hub)
  return outerWall.min(interior.negate())
}
/** Smooth, low-frequency vertex displacement along the 256×64 mesh grid (no sawtooth stepping). */
function macroArch(tube: Node<'vec2'>) {
  const cells = tubeCells(tube, columns, rows)
  const local = cells.fract().sub(0.5)
  const dist = local.length()
  const meridianRib = tube.y.mul(TAU * rows * 2).cos().mul(0.5).add(0.5).pow(1.6)
  const cellRing = dist.sub(0.36).abs().div(0.11).pow(2).negate().exp()
  const wellDepression = dist.smoothstep(0.12, 0.34).oneMinus()
  return meridianRib.mul(0.45).add(cellRing.mul(0.65)).sub(wellDepression.mul(0.45))
}
const displacedAstrolabe = Fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  return position.add(normal.mul(macroArch(tube).mul(0.011)))
})
/** Celestial Horological Astrolabe: 5N rose-gold armillary bezels, Clous de Paris guilloche bridges, heat-blued steel hands and deep multi-layer tourbillon escapements over an aventurine star dial. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.35)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const eps = 0.00025
    const du = displacedAstrolabe(tube.add(vec2(eps, 0))).sub(displacedAstrolabe(tube.sub(vec2(eps, 0))))
    const dv = displacedAstrolabe(tube.add(vec2(0, eps))).sub(displacedAstrolabe(tube.sub(vec2(0, eps))))
    const macroNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.positionNode = displacedAstrolabe(tube)
    const cells = tubeCells(tube, columns, rows)
    const period = vec2(columns, rows)
    const cell = wrapCell(cells.floor(), period)
    const rnd = cellNoiseVec3(vec3(cell, 3.7))
    const local = cells.fract().sub(0.5)
    const dist = local.length()
    const fp = cells.fwidth().x.max(cells.fwidth().y).max(0.0005)
    const aa = (sdf: Node<'float'>) => sdf.smoothstep(fp.negate(), fp)
    const loopPhase = time.mul(Math.PI)
    const directionSign = rnd.x.greaterThan(0.5).select(float(1), float(-1))
// Structural framing: raised longitudinal meridian rails + ring bezel + recessed tourbillon aperture
    const meridianBorder = local.y.abs().smoothstep(0.41, 0.455)
    const crossStrut = local.x.abs().smoothstep(0.445, 0.48)
    const frameMask = meridianBorder.max(crossStrut.mul(0.85))
    const ringBezel = aa(float(0.044).sub(dist.sub(0.365).abs()))
    const bezelFlat = aa(float(0.028).sub(dist.sub(0.365).abs()))
    const bezelChamfer = ringBezel.sub(bezelFlat).max(0)
    const innerLip = aa(float(0.016).sub(dist.sub(0.31).abs()))
    const socketWell = aa(float(0.315).sub(dist))
// Circular satin brushing (brosse circulaire) micro-grooves on the flat top of the rose-gold bezel
    const theta = mx_atan2(local.y, local.x.add(1e-6)) as unknown as Node<'float'>
    const satinBrush = dist.mul(220).sin().mul(0.5).add(0.5).mul(bezelFlat).mul(fp.smoothstep(0.008, 0.025).oneMinus())
// Crisp Clous de Paris (45-degree diamond hobnail pyramids) + rosette guilloche on the rhodium bridge deck
    const hobCoord = vec2(local.x.add(local.y), local.x.sub(local.y)).mul(28)
    const hobPyramid = float(1).sub(hobCoord.fract().sub(0.5).abs().x.max(hobCoord.fract().sub(0.5).abs().y).mul(2))
    const hobVGroove = hobPyramid.smoothstep(0.04, 0.16)
    const guilloche = hobPyramid.mul(hobVGroove).mul(fp.smoothstep(0.012, 0.036).oneMinus())
// Compass degree tick engravings around the main 5N rose-gold bezel ring
    const majorTick = theta.mul(12).cos().smoothstep(0.955, 0.985)
    const minorTick = theta.mul(60).cos().smoothstep(0.85, 0.94).mul(aa(float(0.015).sub(dist.sub(0.358).abs())))
    const bezelTicks = majorTick.max(minorTick.mul(0.75)).mul(bezelFlat).mul(fp.smoothstep(0.016, 0.048).oneMinus())
// Corner blued-steel retention screws at the four diagonal corners of each bridge plate
    const cornerLocal = local.abs().sub(vec2(0.39, 0.34))
    const cornerDist = cornerLocal.length()
    const screwHead = aa(float(0.042).sub(cornerDist))
    const screwRim = aa(float(0.052).sub(cornerDist)).sub(screwHead).max(0)
    const screwSlotCoord = rotate2(cornerLocal, rnd.y.mul(TAU))
    const screwSlot = screwSlotCoord.y.abs().smoothstep(0.005, 0.01).oneMinus().mul(screwHead)
// Tangent-space parallax ray for nested horological strata inside the tourbillon well
    const ray = tubeRay().mul(vec2(columns, rows))
// Layer 1 (top of tourbillon well): Skeleton tourbillon upper bridge bar + heat-blued Breguet pointer hand
    const bridgeShape = float(0.022).sub(local.y.abs().sub(dist.smoothstep(0, 0.13).oneMinus().mul(0.038))).min(float(0.315).sub(local.x.abs()))
    const bridgeBar = aa(bridgeShape).mul(socketWell)
    const bridgeBevel = bridgeShape.smoothstep(0, 0.01).oneMinus().mul(bridgeBar)
    const handAngle = loopPhase.mul(directionSign).add(rnd.z.mul(TAU))
    const p1 = rotate2(local.sub(ray.mul(0.016)), handAngle)
    const handShaft = float(0.012).sub(p1.y.abs().add(p1.x.max(0).mul(0.036))).min(float(0.245).sub(p1.x)).min(p1.x.add(0.085))
    const handEye = float(0.008).sub(p1.sub(vec2(0.145, 0)).length().sub(0.022).abs())
    const bluedHand = aa(handShaft.max(handEye)).mul(socketWell)
// Layer 2 (mid depth): Primary gold escapement wheel (16 teeth, 1 revolution per 2s loop)
    const p2 = local.sub(ray.mul(0.044))
    const mainGearSdf = gearWheel(p2, 0.238, 0.17, 0.017, 16, loopPhase.mul(directionSign).add(rnd.x.mul(TAU)))
    const mainGear = aa(mainGearSdf).mul(socketWell)
    const mainGearBevel = mainGearSdf.smoothstep(0, 0.022).mul(mainGear)
// Layer 3 (deeper): Two meshing counter-rotating rhodium pinion gears
    const p3 = local.sub(ray.mul(0.082))
    const subGearSdfA = gearWheel(p3.sub(vec2(0.1, 0.058)), 0.108, 0.07, 0.012, 12, loopPhase.mul(-2).add(rnd.y.mul(TAU)))
    const subGearSdfB = gearWheel(p3.add(vec2(0.1, 0.058)), 0.108, 0.07, 0.012, 12, loopPhase.mul(2).add(rnd.z.mul(TAU)))
    const subGearA = aa(subGearSdfA).mul(socketWell)
    const subGearB = aa(subGearSdfB).mul(socketWell)
    const rhodiumGears = subGearA.max(subGearB)
// Layer 4 (deepest): Abyssal blue-gold aventurine glass dial + crisp golden astrolabe rete rings
    const p4 = local.sub(ray.mul(0.13))
    const dialR = p4.length()
    const dialTheta = mx_atan2(p4.y, p4.x.add(1e-6)) as unknown as Node<'float'>
    const dialCircles = dialR.mul(16).sin().abs().smoothstep(0.06, 0.16).oneMinus()
    const dialRays = dialTheta.mul(8).sin().abs().smoothstep(0.04, 0.11).oneMinus().mul(dialR.smoothstep(0.06, 0.11))
    const zodiacGrid = dialCircles.max(dialRays).mul(fp.smoothstep(0.015, 0.045).oneMinus())
// Aventurine copper-gold glitter flakes suspended in deep midnight glass
    const flakeCell = p.sub(view.mul(0.05)).mul(88)
    const flakeRnd = cellNoiseVec3(flakeCell.floor())
    const flakeDist = flakeCell.fract().sub(flakeRnd.mul(0.5).add(0.25)).length()
    const flakeNormal = flakeRnd.sub(0.5).normalize()
    const flakeFlash = flakeNormal.dot(view).abs().pow(16).mul(flakeDist.smoothstep(0.07, 0.2).oneMinus())
// Central screwed gold chaton collar with 3 heat-blued retention screws + faceted synthetic corundum ruby
    const chatonOuter = 0.064
    const chatonGold = aa(float(chatonOuter).sub(dist))
    const chatonChamfer = dist.sub(0.052).abs().smoothstep(0.012, 0).mul(chatonGold)
// 3 discrete blued-steel micro-screws around the gold chaton collar at radius 0.05
    const screwAngleA = vec2(Math.cos(0), Math.sin(0)).mul(0.05)
    const screwAngleB = vec2(Math.cos(TAU / 3), Math.sin(TAU / 3)).mul(0.05)
    const screwAngleC = vec2(Math.cos(TAU * 2 / 3), Math.sin(TAU * 2 / 3)).mul(0.05)
    const chatonScrewDist = local.sub(screwAngleA).length().min(local.sub(screwAngleB).length()).min(local.sub(screwAngleC).length())
    const chatonScrews = aa(float(0.0085).sub(chatonScrewDist))
    const rubyRadius = 0.036
    const rubyMask = aa(float(rubyRadius).sub(dist))
    const rubyNormR = dist.div(rubyRadius).clamp()
// Faceted step-cut pavilion + olive-drilled center pivot hole inside the ruby jewel
    const rubyFacet = theta.mul(8).cos().mul(0.08).add(rubyNormR)
    const rubyTable = rubyNormR.smoothstep(0.45, 0.52).oneMinus()
    const rubyPivotHole = aa(float(0.009).sub(dist))
    const rubyDome = float(1).sub(rubyNormR.pow(2)).sqrt().mul(rubyTable.mul(-0.25).add(1))
// Authentic horological palettes (linear light)
    const roseGold = mix(color(hsl.integer(51, 71, 60)), color(hsl.integer(68, 100, 88.4)), bezelChamfer.mul(0.65).add(satinBrush.mul(0.25)).add(0.2))
    const champagneBrass = mix(color(hsl.integer(79, 79, 70)), color(hsl.integer(92, 100, 92.4)), mainGearBevel)
    const rhodiumSilver = mix(color(hsl.integer(259, 19, 58)), color(hsl.integer(254, 55, 94.4)), guilloche.mul(0.65).add(0.25))
    const bluedSteel = mix(color(hsl.integer(263, 91, 17.5)), color(hsl.integer(258, 100, 59)), facing.pow(1.4).mul(0.75).add(grazing.mul(0.25)))
    const aventurineBase = mix(color(hsl.integer(263, 60, 4)), color(hsl.integer(264, 71, 9)), dialR.smoothstep(0, 0.3))
      .add(color(hsl.integer(70, 86, 75)).mul(zodiacGrid.mul(0.55)))
      .add(color(hsl.integer(78, 100, 82)).mul(flakeFlash.mul(near.mul(1.8).add(0.65))))
// Composite layers from bottom (deepest well) to top (bridge & ruby jewel)
    let col: Node<'vec3'> = aventurineBase
// Ambient occlusion inside the tourbillon well wall
    const wellWallShadow = dist.smoothstep(0.24, 0.315).oneMinus().mul(0.42).add(0.58)
    col = col.mul(wellWallShadow)
// Rhodium gears + drop shadow
    col = mix(col, col.mul(0.22), rhodiumGears.mul(0.75))
    col = mix(col, rhodiumSilver, rhodiumGears)
// Main brass escapement wheel + drop shadow
    col = mix(col, col.mul(0.2), mainGear.mul(0.8))
    col = mix(col, champagneBrass, mainGear)
// Outer bridge deck: rhodium-plated Clous de Paris guilloche + 5N rose-gold bezel & meridian rails
    const outerDeck = mix(rhodiumSilver.mul(hobVGroove.mul(0.55).add(0.45)), roseGold, ringBezel.max(frameMask).max(innerLip))
    const engravedDeck = mix(outerDeck, color(hsl.integer(57, 41, 7)), bezelTicks.mul(0.82))
    col = mix(engravedDeck, col, socketWell.mul(ringBezel.oneMinus()))
// Tourbillon upper bridge bar, blued-steel Breguet hand, corner screws and central gold chaton
    col = mix(col, mix(rhodiumSilver, color(hsl.integer(0, 0, 100)), bridgeBevel.mul(0.65)), bridgeBar)
    col = mix(col, bluedSteel, bluedHand.max(screwHead))
    col = mix(col, roseGold, screwRim)
    col = mix(col, color(hsl.integer(262, 32, 5)), screwSlot)
    col = mix(col, mix(champagneBrass.add(chatonChamfer.mul(0.25)), bluedSteel, chatonScrews), chatonGold)
// Deep pigeon-blood faceted synthetic corundum ruby + dark central pivot arbor
    const rubyCaustic = rubyFacet.sub(0.62).abs().smoothstep(0.18, 0).add(theta.mul(8).sin().abs().smoothstep(0.15, 0).mul(0.45)).mul(facing.pow(1.6))
    const rubyColor = mix(color(hsl.integer(13, 92, 8)), color(hsl.integer(23, 99.4, 50.6)), rubyDome.pow(1.4))
      .add(color(hsl.integer(15, 100, 62.6)).mul(rubyCaustic.mul(0.9)))
    col = mix(col, mix(rubyColor, color(hsl.integer(347, 19, 9)), rubyPivotHole), rubyMask)
    this.colorNode = col
// Metalness: 1 on all metals, 0.04 on aventurine glass dial and synthetic ruby jewel
    const isMetal = socketWell.oneMinus()
      .max(ringBezel)
      .max(mainGear)
      .max(rhodiumGears)
      .max(bridgeBar)
      .max(bluedHand)
      .max(chatonGold)
      .mul(rubyMask.oneMinus())
      .clamp()
    this.metalnessNode = mix(float(0.04), float(1), isMetal)
// Roughness contrast: satin-brushed bezel flat (~0.17) vs diamond-polished anglage chamfers (~0.025)
    const metalRough = float(0.09)
      .add(bezelFlat.mul(0.085))
      .add(guilloche.oneMinus().mul(0.11).mul(socketWell.oneMinus()).mul(ringBezel.oneMinus()))
      .add(bezelTicks.mul(0.15))
      .sub(bezelChamfer.add(bridgeBevel).add(chatonChamfer).mul(0.07))
      .sub(bluedHand.max(screwHead).mul(0.06))
    this.roughnessNode = mix(float(0.025), metalRough, isMetal).clamp(0.02, 0.26)
// Circularly brushed anisotropy around the tourbillon bezel and gear wheels
    const tangentCircle = vec2(local.y.negate(), local.x).normalize()
    this.anisotropyNode = tangentCircle.mul(bezelFlat.max(mainGear).mul(0.84))
// Anti-reflective (AR) treated sapphire crystal over the recessed tourbillon dial + ruby jewel
    this.clearcoatNode = socketWell.mul(ringBezel.oneMinus()).mul(0.32).add(rubyMask.mul(0.95))
    this.clearcoatRoughness = 0.02
// Tempered oxide thin-film interference on heat-blued steel and AR sapphire crystal coating
    this.iridescenceNode = bluedHand.max(screwHead).mul(0.82).add(socketWell.mul(0.24))
    this.iridescenceIOR = 1.72
    this.iridescenceThicknessNode = facing.mul(130).add(285)
// Precision micro-relief height for surface-gradient normal perturbation (including Clous de Paris pyramids & faceted ruby)
    const microHeight = ringBezel.mul(0.0022)
      .add(satinBrush.mul(0.00025))
      .add(frameMask.mul(0.0018))
      .add(guilloche.mul(socketWell.oneMinus()).mul(ringBezel.oneMinus()).mul(0.0011))
      .sub(bezelTicks.mul(0.0013))
      .add(mainGearBevel.mul(0.0019))
      .add(rhodiumGears.mul(0.0011))
      .add(bridgeBar.add(bluedHand).mul(0.0018))
      .add(screwHead.sub(screwSlot).mul(0.0013))
      .add(chatonGold.sub(chatonScrews.mul(0.3)).mul(0.0022))
      .add(rubyDome.sub(rubyPivotHole.mul(0.6)).mul(rubyMask).mul(0.0036))
    const surfaceNormal = detailNormal(macroNormal, microHeight, 0.95)
    this.normalNode = surfaceNormal
// Warm horological atelier lighting environment (softened intensity to prevent sapphire glare blowout)
    const studio = panelSky({
      zenith: [0.05, 0.06, 0.11],
      horizon: [0.16, 0.15, 0.18],
      nadir: [0.02, 0.02, 0.03],
      glow: {
        color: [1, 0.76, 0.42],
        intensity: 0.65,
        width: 0.08,
      },
      panels: [{
        azimuth: 0.52,
        elevation: 0.62,
        halfWidth: 0.36,
        halfHeight: 0.22,
        color: [1, 0.92, 0.78],
        intensity: 7.6,
        panes: [4, 2],
      }, {
        azimuth: -1.15,
        elevation: 0.44,
        halfWidth: 0.055,
        halfHeight: 0.65,
        color: [0.62, 0.85, 1],
        intensity: 8.4,
      }, {
        azimuth: 2.3,
        elevation: 0.5,
        halfWidth: 0.3,
        halfHeight: 0.065,
        color: [1, 0.64, 0.32],
        intensity: 7.4,
      }, {
        azimuth: -2.35,
        elevation: 0.2,
        halfWidth: 0.42,
        halfHeight: 0.055,
        color: [0.85, 0.92, 1],
        intensity: 5.8,
      }],
    })
    this.envNode = proceduralEnvironment(studio)
// Ruby jewel internal caustic fire, escapement impulse and golden astrolabe rete glow on approach
    const escapementPulse = loopPhase.mul(6).add(rnd.x.mul(TAU)).sin().mul(0.5).add(0.5).pow(4)
    const rubyFire = mix(color(hsl.integer(24, 99.3, 41.6)), color(hsl.integer(18, 99, 59)), rubyCaustic).mul(rubyMask).mul(rubyPivotHole.oneMinus()).mul(near.mul(0.75).add(0.3).add(escapementPulse.mul(0.55)))
    const tickGlow = color(hsl.integer(70, 100, 78)).mul(bezelTicks).mul(intimate.mul(0.65).add(grazing.pow(2.2).mul(0.25)))
    const dialLoom = color(hsl.integer(70, 91, 75)).mul(zodiacGrid).mul(socketWell).mul(mainGear.oneMinus()).mul(bridgeBar.oneMinus()).mul(near.mul(0.42).add(0.16))
    const specSpark = glints(surfaceNormal, 72).mul(bezelChamfer.max(mainGearBevel).max(bridgeBevel)).mul(0.2)
    this.emissiveNode = rubyFire
      .add(tickGlow.mul(0.5))
      .add(dialLoom.mul(0.45))
      .add(color(hsl.integer(87, 100, 96)).mul(specSpark))
  }
}
