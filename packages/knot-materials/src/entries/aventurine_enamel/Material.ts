import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, exp, float, mix, mx_noise_float, normalGeometry, normalViewGeometry, select, tangentGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {panelSky, proceduralEnvironment} from '../../candidates/gemini_argon/lib/environment.ts'
import {tubeCells} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const columns = 20
const rows = 4
/** Depth of the guilloché foil under the enamel surface (object-space meters) for the refracted parallax. */
const foilDepth = 0.02
/** Outer bound of an aventurine platelet’s lens gauge, which is also its farthest reach from the center; it stays inside the 0.27 cell margin. */
const aventurineSupport = 0.25
/** Jitter range [min, min + span] of the aventurine platelet center within its cell. */
const aventurineJitter = [0.27, 0.46] as const
/** Imperial Jingtai Lan Cloisonné & Ginbari Guilloché Enamel lattice: Partitioned into 8-petaled lotus medallions, inner cusped corollas, central ruby cabochon bosses, and cloud-scroll corner cartouches separated by flat-topped 24k gold filigree wire walls (cloisons). */
function cloisonneField(cells: Node<'vec2'>) {
  const period = vec2(columns, rows)
  const baseCell = cells.floor()
  const wrapped = wrapCell(baseCell, period)
  const rnd = cellNoiseVec3(vec3(wrapped, 11.3))
  const rnd2 = cellNoiseVec3(vec3(wrapped.add(vec2(29.7, 43.1)), 67.9))
  const q = cells.fract().sub(0.5)
  const r = q.length()
  const angle = atan(q.y, q.x.add(1e-6))
// 1. Central circular boss & inner ring cloison.
  const dBoss = r.sub(0.115)
// 2. Inner 8-pointed cusped star corolla.
  const innerRadius = angle.mul(8).cos().mul(0.028).add(0.245)
  const dInnerPetal = r.sub(innerRadius)
// 3. Outer 8-petaled imperial lotus rosette with pointed ogee tips and radial petal-divider cloisons.
  const outerPetalWave = angle.mul(8).cos()
  const outerRadius = outerPetalWave.mul(0.058).add(0.415)
  const dOuterLotus = r.sub(outerRadius)
// Smooth radial gold wire partitions separating the 8 petals inside the inner and outer rings.
// Petals bulge at the crests of cos(8θ), so the dividers run through its notches at 22.5° + k · 45°, which is exactly where `petalIndex` changes color. Dividers at the crests (sin(4θ)) left every color boundary without a wire and split each petal with a midrib.
  const spokeCos = angle.mul(4).cos()
  const petalSpokeDist = spokeCos.pow(2).add(0.0004).sqrt().mul(r)
  const petalIndex = angle.div(TAU).mul(8).add(4.5).floor().mod(8)
// 4. Corner quatrefoil cloud-scroll medallions centered at the 4 cell corners (+/-0.5, +/-0.5).
  const cornerQ = q.abs().sub(0.5)
  const cornerR = cornerQ.length()
  const cornerAngle = atan(cornerQ.y, cornerQ.x.add(1e-6))
  const dCornerCloud = cornerR.sub(cornerAngle.mul(4).cos().mul(0.024).add(0.215))
// Signed offset from the nearest cell corner; unlike `cornerQ`, it runs on continuously into the neighboring cells.
  const cornerOffset = q.sub(q.sign().mul(0.5))
  const cornerTurn = atan(cornerOffset.y, cornerOffset.x.add(1e-6))
// Smoothly combine signed distances to the nearest 24k gold cloison wire centerline.
  const sabs = (x: Node<'float'>) => x.pow(2).add(0.00008).sqrt()
  const ringWires = sabs(dBoss).min(sabs(dInnerPetal)).min(sabs(dOuterLotus)).min(sabs(dCornerCloud))
  const inPetalBand = r.greaterThan(0.115).and(r.lessThan(outerRadius))
  const wireCenterDist = select(inPetalBand, ringWires.min(petalSpokeDist), ringWires)
// Region masks: central boss, inner corolla petal, outer lotus petal, corner cloud-scroll, cobalt ground.
  const isBoss = dBoss.lessThan(0).toFloat()
  const isInner = dBoss.greaterThanEqual(0).and(dInnerPetal.lessThan(0)).toFloat()
  const isOuter = dInnerPetal.greaterThanEqual(0).and(dOuterLotus.lessThan(0)).toFloat()
  const isCorner = dCornerCloud.lessThan(0).toFloat()
  return {
    angle,
    cornerQ,
    cornerR,
    cornerTurn,
    isBoss,
    isCorner,
    isInner,
    isOuter,
    petalIndex,
    q,
    r,
    rnd,
    rnd2,
    wireCenterDist,
  }
}
/** 3D suspended Murashiki Aventurine (goldstone) triangular & hexagonal copper crystals ($\text{Cu}_2\text{O}$) with screen-space minimum pixel clamping so copper glints remain crisp and visible at wide angles as well as closeups! */
function aventurineSparks(position: Node<'vec3'>, view: Node<'vec3'>, depth: number, scale: number, threshold: number, seed: number) {
  const q = position.sub(view.mul(depth)).mul(scale).add(seed)
  const cell = q.floor()
  const rnd = cellNoiseVec3(cell)
  const rnd2 = cellNoiseVec3(cell.add(vec3(31.7, 17.3, 59.1)))
  const center = rnd.mul(aventurineJitter[1]).add(aventurineJitter[0])
  const d = q.fract().sub(center)
// Each platelet lies in the enamel plane. Before, it was a block aligned to the object axes, and the curved tube cut it at arbitrary angles into rectangles and parallelograms.
  const normal = normalGeometry.normalize()
  const tangent = tangentGeometry.xyz.sub(normal.mul(tangentGeometry.xyz.dot(normal))).normalize()
  const across = d.dot(normal)
  const along = vec2(d.dot(tangent), d.dot(normal.cross(tangent)))
  const rot = rnd2.x.mul(TAU)
  const c = rot.cos()
  const s = rot.sin()
  const rx = along.x.mul(c).sub(along.y.mul(s))
  const ry = along.x.mul(s).add(along.y.mul(c))
// Polygon gauges scaled to the circumradius, so a value of ρ never reaches farther than ρ from the center.
  const hexagon = rx.abs().max(rx.mul(0.5).add(ry.mul(0.866)).abs()).max(rx.mul(0.5).sub(ry.mul(0.866)).abs()).mul(2 / Math.sqrt(3))
  const triangle = ry.max(rx.mul(0.866).sub(ry.mul(0.5))).max(rx.mul(-0.866).sub(ry.mul(0.5))).mul(2)
  const polygon = select(rnd2.y.lessThan(0.4), triangle, hexagon)
// A polygonal lens: any slice parallel to the surface is the whole polygon, only scaled by √(ρ² − across²), and the body stays inside a sphere of radius ρ.
  const lensDist = polygon.pow2().add(across.pow2()).sqrt()
  const footprint = q.fwidth().length().max(0.001)
  const visibility = footprint.smoothstep(0.32, 1.15).oneMinus()
// Ensure the crystal radius expands slightly with screen-space footprint so glints never vanish sub-pixel in `angle_0`!
  const baseRadius = rnd.z.mul(0.08).add(0.13)
  const radius = baseRadius.max(footprint.mul(0.65))
  const aa = footprint.mul(0.85).max(0.018)
// The center is jittered at least 0.27 from every cell wall; capping the outer edge below that keeps the whole platelet, antialiasing included, inside its cell, so no wall can cut it.
  const outer = radius.add(aa.mul(0.5)).min(aventurineSupport)
  const inner = radius.sub(aa).min(outer.sub(0.02))
  const crystal = lensDist.smoothstep(inner, outer).oneMinus()
  const gate = rnd.x.smoothstep(threshold, Math.min(threshold + 0.08, 0.99))
  const plateletNormal = rnd2.sub(0.5).mul(2).normalize()
// Dual-lobe copper glint: ultra-sharp Dirac flash + broader warm copper reflection so crystals read across all gallery angles.
  const align = plateletNormal.dot(view).abs()
  const specularFlash = align.pow(18).mul(5.8).add(align.pow(4).mul(1.6)).add(0.22)
  const attenuation = Math.exp(-depth * 20)
  return crystal.mul(gate).mul(specularFlash).mul(attenuation).mul(visibility)
}
/** Cloisonné Lotus (Imperial Jingtai Lan & Ginbari Basse-Taille Guilloché Enamel): True physical Beer-Lambert exponential glass absorption `exp(-sigma_a * d)` over a sunken, refracted rose-engine chased pure silver foil floor, bounded by flat-topped 24k gold filigree ribbons and sealed under an optically flat lapidary-ground vitreous polish. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.25)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const cells = tubeCells(tube, columns, rows)
    const footprint = cells.fwidth().x.max(cells.fwidth().y).max(0.0004)
    const ray = tubeRay().mul(vec2(columns, rows))
    const top = cloisonneField(cells)
// 1. 24k Gold Cloison Wire Ribbon Profile:
// Screen-space derivative anti-aliasing (`wireAA`) eliminates any sub-texel stair-stepping along high-curvature petal borders!
    const wireHalfWidth = 0.016
    const wireDist = top.wireCenterDist.sub(wireHalfWidth)
    const wireAA = wireDist.fwidth().max(footprint.mul(1.35)).max(0.0006)
    const wireMask = wireDist.smoothstep(wireAA.mul(-1.25), wireAA.mul(1.25)).oneMinus()
    const wireShoulder = top.wireCenterDist.smoothstep(wireHalfWidth * 0.6, wireHalfWidth * 1.3).oneMinus()
// 2. Sunken Ginbari Silver-Leaf Guilloché Floor (with refracted Snell parallax `ray * foilDepth`):
// The foil used to sit 8.5 cm deep in a 13 cm tube, so toward the silhouettes the parallax shift swept across whole cells: the lathe pattern smeared into streaks and crumpled noise, and the wall shadows slid away from the wires above.
// Precision geometric rose-engine lathe turning: intersecting cycloidal/triangular fluting & grain d'orge (barleycorn) diamond facets!
    const refractedCells = cells.sub(ray.mul(foilDepth))
    const deep = cloisonneField(refractedCells)
// The parallax still compresses the foil toward the silhouettes, so its pattern is filtered by its own footprint, not the surface’s.
    const deepFootprint = refractedCells.fwidth().x.max(refractedCells.fwidth().y).max(0.0004)
    const guillocheResolved = deepFootprint.mul(34).smoothstep(0.06, 0.28).oneMinus()
// Cycloidal rose-engine lathe waves: sharp V-crested machined grooves (`1 - |sin(theta)|^0.75`) instead of soft fluid ripples!
// The sunburst’s wobble fades out at the cell edges, where neighboring cells meet mirrored; there |sin(40θ)| matches on both sides, while the wobble would cut a seam.
    const sunWobble = deep.q.x.abs().max(deep.q.y.abs()).smoothstep(0.4, 0.5).oneMinus()
// Each corner cartouche straddles four cells and is turned around its own center, instead of showing four mirrored corners of the neighboring rosettes. The switch hides under the cartouche’s wire and wall shadow.
    const latheCorner = deep.isCorner.greaterThan(0.5)
    const latheR = select(latheCorner, deep.cornerR, deep.r)
    const latheAngle = select(latheCorner, deep.cornerTurn, deep.angle)
    const sunPhase = latheAngle.mul(40).add(latheR.mul(110).sin().mul(sunWobble.mul(0.85)))
    const ringPhase = latheR.mul(96).add(latheAngle.mul(24).cos().mul(0.45))
// Each band fades to its mean once a groove spans fewer than ~4 pixels. The analytic phase rates avoid the atan seam; the 40 spokes crowd together toward every medallion center (40 / r).
    const deepRadius = latheR.max(0.001)
    const sunDetail = float(40).div(deepRadius).add(110 * 0.85).mul(deepFootprint).smoothstep(0.25, 0.8).oneMinus()
    const ringDetail = float(24 * 0.45).div(deepRadius).add(96).mul(deepFootprint).smoothstep(0.25, 0.8).oneMinus()
// Mean of 1 − |sin|^0.75 over a period.
    const chiselMean = 0.3084
    const sunChisel = mix(float(chiselMean), float(1).sub(sunPhase.sin().abs().pow(0.75)), sunDetail)
    const ringChisel = mix(float(chiselMean), float(1).sub(ringPhase.sin().abs().pow(0.75)), ringDetail)
    const silverRelief = sunChisel.mul(0.58).add(ringChisel.mul(0.42)).mul(guillocheResolved).add(guillocheResolved.oneMinus().mul(0.5))
// Steep occlusion shadow cast by the vertical gold cloison walls onto the sunken silver floor along the refracted ray!
    const wallShadow = deep.wireCenterDist.smoothstep(0.012, 0.095).mul(0.66).add(0.34)
// 3. True Physical Beer-Lambert Volumetric Glass Absorption (`I = I_silver * exp(-sigma_a * d)`):
// Where the silver guilloché peaks rise (`silverRelief -> 1`) or where the enamel wets the gold wall (`meniscusThinning`), optical path `d` is thin -> bright, luminous pastel jewel flash!
// Where the silver grooves drop deep (`silverRelief -> 0`) or toward the center of the cell, `d` is thick -> deep, concentrated imperial jewel tone!
    const meniscusThinning = wireDist.max(0).div(0.05).pow(1.5).negate().exp().mul(0.42)
    const opticalDepth = float(1.35)
      .sub(silverRelief.mul(0.74))
      .sub(meniscusThinning)
      .div(facing.max(0.32).pow(0.45))
      .clamp(0.18, 2.6)
// Spectral absorption coefficients `sigma_a` (RGB) for each imperial kiln-fired lead-potash glass enamel:
    const parity = top.petalIndex.mod(2)
    const sigmaTurquoise = mix(vec3(2.3, 0.14, 0.22), vec3(1.9, 0.12, 0.85), parity)
    const sigma = mix(mix(mix(mix(vec3(2.4, 1.15, 0.08), vec3(0.55, 2.1, 0.32), top.isCorner), sigmaTurquoise, top.isOuter), vec3(0.06, 0.52, 2.8), top.isInner), vec3(0.1, 2.45, 2.1), top.isBoss)
    const beerLambertTransmission = exp(sigma.negate().mul(opticalDepth))
// Chased pure Silver Foil (`F_0 = vec3(0.98, 0.97, 0.95)`) at the bottom of the enamel pool:
// Catches directional studio light and blasts brilliant colored reflections back up through the Beer-Lambert glass!
    const loopWave = tube.x.mul(TAU * 2).sub(time.mul(Math.PI)).sin().mul(0.1)
    const facetTiltX = sunPhase.cos().mul(sunDetail).mul(guillocheResolved).mul(0.6)
    const facetTiltY = ringPhase.cos().mul(ringDetail).mul(guillocheResolved).mul(0.6)
    const foilDot = facing.add(facetTiltX.mul(view.x)).add(facetTiltY.mul(view.y)).add(loopWave).clamp(0, 1)
    const silverFoilRadiance = vec3(0.98, 0.97, 0.95).mul(foilDot.pow(6).mul(1.9).add(foilDot.pow(1.5).mul(0.75)).add(0.28))
    const ginbariPoolColor = silverFoilRadiance.mul(beerLambertTransmission).mul(wallShadow)
// 4. 3D Suspended Murashiki Aventurine Copper Crystals & Microscopic Seed Bubbles (`fukikomi`) inside the glass:
    const aventurineTop = aventurineSparks(p, view, 0.01, 44, 0.34, 5.3)
    const aventurineDeep = aventurineSparks(p, view, 0.032, 72, 0.28, 23.9).mul(near.mul(0.6).add(0.4))
    const inAventurinePool = float(1).sub(top.isBoss).sub(top.isOuter.mul(0.65)).clamp(0, 1)
    const aventurineTotal = aventurineTop.add(aventurineDeep.mul(0.8)).mul(inAventurinePool).mul(wireMask.oneMinus())
// Microscopic spherical seed bubbles (`fukikomi`) trapped in the kiln-fired glass, catching pinpoint white specular glints:
    const bubbleQ = p.sub(view.mul(0.018)).mul(115).add(41.2)
    const bubbleCell = bubbleQ.floor()
    const bubbleRnd = cellNoiseVec3(bubbleCell)
    const bubbleVec = bubbleQ.fract().sub(bubbleRnd.mul(0.5).add(0.25))
    const bubbleDist = bubbleVec.length()
    const bubblePinpoint = bubbleDist.smoothstep(0, 0.075).oneMinus().pow(2)
    const bubbleRim = bubbleDist.smoothstep(0.06, 0.095).mul(bubbleDist.smoothstep(0.095, 0.13).oneMinus())
    const bubbleGate = bubbleRnd.x.smoothstep(0.7, 0.77).mul(bubbleQ.fwidth().length().smoothstep(0.26, 0.85).oneMinus())
    const fukikomiBubbles = bubblePinpoint.mul(1.6).add(bubbleRim.mul(0.7)).mul(bubbleGate).mul(intimate.mul(0.75).add(0.25)).mul(wireMask.oneMinus())
// 5. 24k Burnished Gold Cloison Wire (`F_0 = vec3(0.98, 0.78, 0.38)`):
// Strictly coplanar lapidary-polished top facet with warm 24k gold reflectance.
    const goldBrush = mx_noise_float(p.mul(180)).mul(0.04).add(0.98)
    const cloisonGold = mix(color(hsl.integer(70, 90, 64.6)), color(hsl.integer(95, 100, 90.6)), facing.mul(0.55).add(wireShoulder.mul(0.45))).mul(goldBrush)
    const copperSparkColor = mix(color(hsl.integer(39.4, 100, 62.9)), color(hsl.integer(87, 100, 87)), aventurineTop.div(aventurineTotal.add(0.001)).clamp())
    const enamelComposite = ginbariPoolColor
      .add(copperSparkColor.mul(aventurineTotal.mul(1.6)))
      .add(vec3(0.95, 0.98, 1).mul(fukikomiBubbles))
    this.colorNode = mix(enamelComposite, cloisonGold, wireMask)
// Metalness & Roughness:
// Gold cloison wires are 1.0 metallic with 0.08 burnished roughness;
// Enamel pools transmit the metallic reflection of the sunken Ginbari silver foil beneath a razor-sharp 0.010 optically ground glass clearcoat!
    this.metalnessNode = mix(foilDot.mul(0.44).add(aventurineTotal.clamp(0, 1).mul(0.88)).clamp(0, 0.92), float(1), wireMask)
    this.roughnessNode = mix(float(0.11).add(silverRelief.oneMinus().mul(0.05)), float(0.08), wireMask)
// Normals:
// - Base normal (`this.normalNode`) carries the sunken machined Ginbari silver guilloché facets inside the cells, and is strictly flat across the top of the gold wire!
// - Top glass clearcoat normal (`this.clearcoatNormalNode`) is purely `normalViewGeometry` (100% lapidary stone-polished optical manifold with zero meniscus distortion!).
    const interiorHeight = silverRelief.mul(0.00065).mul(wireMask.oneMinus())
    this.normalNode = mix(proceduralNormal(interiorHeight, 1), normalViewGeometry, wireMask).normalize()
    this.clearcoatNode = mix(float(1), float(0.25), wireMask)
    this.clearcoatRoughnessNode = mix(float(0.01), float(0.055), wireMask)
    this.clearcoatNormalNode = normalViewGeometry
// Subtle thin-film luster on the kiln-fired lead-glass glazes at grazing angles.
    this.iridescenceNode = wireMask.oneMinus().mul(grazing.mul(0.38).add(0.1))
    this.iridescenceIOR = 1.56
    this.iridescenceThicknessNode = opticalDepth.mul(190).add(160)
// Radial anisotropic sheen from the sunken Ginbari guilloché silver foil beneath the glass.
    const foilTangent = vec2(latheAngle.sin().negate(), latheAngle.cos())
// The radial tangent spins once around every lathe center, faster than a pixel can resolve close to it, so the sheen fades out there.
    const foilTangentResolved = latheR.div(deepFootprint.mul(8)).smoothstep(0.5, 1)
    this.anisotropyNode = mix(foilTangent.mul(foilTangentResolved.mul(0.76)), vec2(1, 0).mul(0.55), wireMask)
    this.aoNode = wallShadow.max(wireMask)
// Imperial palace gallery lighting: crisp overhead pavilion skylights to make the Ginbari silver foil flash through the colored glass pools!
    const palace = panelSky({
      zenith: [0.012, 0.022, 0.06],
      horizon: [0.038, 0.034, 0.048],
      nadir: [0.005, 0.004, 0.009],
      glow: {
        color: [1, 0.62, 0.25],
        intensity: 0.36,
        width: 0.07,
      },
      panels: [{
        azimuth: 0.52,
        elevation: 0.58,
        halfWidth: 0.26,
        halfHeight: 0.18,
        color: [1, 0.94, 0.82],
        intensity: 8.2,
        panes: [3, 2],
        softness: 0.1,
      }, {
        azimuth: -1.12,
        elevation: 0.46,
        halfWidth: 0.045,
        halfHeight: 0.54,
        color: [0.48, 0.92, 1],
        intensity: 9.2,
        softness: 0.1,
      }, {
        azimuth: 2.35,
        elevation: 0.4,
        halfWidth: 0.28,
        halfHeight: 0.05,
        color: [1, 0.52, 0.38],
        intensity: 7,
        softness: 0.12,
      }, {
        azimuth: -2.38,
        elevation: 0.24,
        halfWidth: 0.32,
        halfHeight: 0.045,
        color: [0.42, 1, 0.82],
        intensity: 6.4,
        softness: 0.12,
      }],
    })
    this.envNode = proceduralEnvironment(palace)
// Internal Ginbari silver-foil flash through the Beer-Lambert glass pools + Dirac Murashiki aventurine copper sparks + warm 24k gold wire glint!
    const ginbariFlash = beerLambertTransmission.mul(foilDot.pow(5).mul(0.85).add(silverRelief.mul(0.28))).mul(wallShadow).mul(wireMask.oneMinus()).mul(near.mul(0.4).add(0.6))
    const aventurineGlow = copperSparkColor.mul(aventurineTotal.mul(1.05))
    const wireGlint = color(hsl.integer(91.6, 100, 88)).mul(wireMask).mul(facing.pow(3).mul(0.35).add(grazing.pow(2).mul(0.25)))
    this.emissiveNode = ginbariFlash.add(aventurineGlow).add(wireGlint)
  }
}
