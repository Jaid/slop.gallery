import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, mx_cell_noise_float, mx_noise_float, normalLocal, normalViewGeometry, select, time, uv, vec2, vec3} from 'three/tsl'

import {studioSheen} from '../../candidates/gemini_argon/lib/environmentHighlight.ts'
import {tubeCells} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {voronoi} from '../../candidates/gemini_argon/lib/voronoi3dStruct.ts'
import {inkLine, tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const medallionsAlong = 26
const medallionsAround = 3
/** Imperial Ming Jingtai Lan Cloisonné enamel palette in linear light. */
function jingtaiEnamelColor(zone: Node<'float'>, variant: Node<'float'>) {
  const turquoise = color(hsl.integer(224, 100, 51)) // Imperial Jingtai Turquoise
  const lapisBlue = color(hsl.integer(265, 97.3, 20)) // Ming Cobalt Lapis
  const carmineRuby = color(hsl.integer(22, 98.6, 38)) // Gold-ruby Rouge
  const imperialYellow = color(hsl.integer(68, 99, 64.6)) // Imperial Egg-Yolk Amber
  const celadonJade = color(hsl.integer(154, 99, 37)) // Jadeite Emerald
  const innerPetal = mix(carmineRuby, imperialYellow, variant.smoothstep(0.35, 0.65))
  const outerPetal = mix(turquoise, celadonJade, variant.smoothstep(0.4, 0.75))
  const ruyiCloud = mix(lapisBlue, turquoise, variant.smoothstep(0.25, 0.6))
  return select(zone.lessThan(0.5), imperialYellow, select(zone.lessThan(1.5), innerPetal, select(zone.lessThan(2.5), outerPetal, ruyiCloud)))
}
/** Imperial Chinese Cloisonné (Jingtai Lan) & Fabergé Basse-Taille guilloché vitreous enamel. Hand-bent 24k gilded brass cloisons partition translucent pools of kiln-fired glass with concave meniscus domes, fine cooling craquelure, and an engine-turned silver/gold guilloché foil substrate visible via refracted parallax. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const tube = uv()
    const grid = vec2(medallionsAlong, medallionsAround)
    const cells = tubeCells(tube, medallionsAlong, medallionsAround)
    const footprint = cells.fwidth().x.max(cells.fwidth().y).max(0.0003)
    const cellId = wrapCell(cells.floor(), grid)
    const cellRnd = cellNoiseVec3(vec3(cellId, 29.4))
    const local = cells.fract().sub(0.5)
    const r = local.length()
    const theta = atan(local.y, local.x.add(1e-6))
// 1. Hand-bent Cloisonné Filigree Wire Geometry (Baoxianghua Sacred Lotus Medallion + Ruyi Cloud Scrolls)
    const pistilField = r.sub(0.088)
// Inner 8-petal lotus ring with pointed ogee tips
    const wave8 = theta.mul(8).cos()
    const innerLotusRadius = wave8.abs().pow(0.75).mul(0.072).add(0.155)
    const innerLotusField = r.sub(innerLotusRadius)
    const innerSepals = theta.add(Math.PI / 8).mul(8 / TAU).fract().sub(0.5).abs().mul(TAU / 8).mul(r).max(r.sub(innerLotusRadius)).max(float(0.088).sub(r))
// Outer 16-petal lotus ring with double-curved cusps
    const wave16 = theta.add(Math.PI / 16).mul(16).cos()
    const outerLotusRadius = wave16.abs().pow(0.7).mul(0.068).add(0.31)
    const outerLotusField = r.sub(outerLotusRadius)
    const outerSepals = theta.mul(16 / TAU).fract().sub(0.5).abs().mul(TAU / 16).mul(r).max(r.sub(outerLotusRadius)).max(innerLotusRadius.sub(r))
// Medallion circular frame and Ruyi C-scroll corner cloud tendrils in the spandrels
    const medallionFrame = r.sub(0.435)
    const cornerLocal = local.abs().sub(vec2(0.36, 0.36))
    const ruyiSpiral = cornerLocal.length().mul(22).sub(atan(cornerLocal.y, cornerLocal.x.add(1e-6)).mul(2)).sin().abs().div(22)
    const ruyiScroll = ruyiSpiral.max(float(0.41).sub(r))
    const borderBox = float(0.492).sub(local.x.abs().max(local.y.abs()))
// Signed distance to the nearest gilded brass cloison wire
    const wireDist = pistilField.abs()
      .min(innerLotusField.abs())
      .min(innerSepals.abs())
      .min(outerLotusField.abs())
      .min(outerSepals.abs())
      .min(medallionFrame.abs())
      .min(ruyiScroll.abs())
      .min(borderBox.abs())
    const cloisonWireMask = inkLine(wireDist, 0.014, footprint)
// Identify which compartment zone (0 = pistil, 1 = inner petal, 2 = outer petal, 3 = spandrel cloud) the pixel belongs to
    const zone = select(pistilField.lessThan(0), float(0), select(innerLotusField.lessThan(0), float(1), select(outerLotusField.lessThan(0), float(2), float(3))))
    const petalIndex = select(zone.lessThan(1.5), theta.div(TAU).add(0.5).mul(8).floor(), theta.div(TAU).add(0.5).mul(16).floor())
    const cellHash = mx_cell_noise_float(vec3(cellId.x.mul(11).add(zone.mul(3)), cellId.y.mul(19).add(petalIndex), 47.2))
    const enamelColor = jingtaiEnamelColor(zone, cellHash.add(cellRnd.x).fract())
    const enamelVec = vec3(enamelColor.r, enamelColor.g, enamelColor.b)
// 2. Refracted Parallax to the Engine-Turned Basse-Taille Guilloché Foil Substrate (depth 0.024, glass IOR = 1.54)
    const ray = tubeRay().mul(grid).div(1.54)
    const subCells = cells.sub(ray.mul(0.026))
    const subLocal = subCells.fract().sub(0.5)
    const subR = subLocal.length()
    const subTheta = atan(subLocal.y, subLocal.x.add(1e-6))
// Engine-turned Rose-Engine Guilloché wave pattern (sunburst + barleycorn sinusoidal interference)
    const guillochePhase = subR.mul(135).add(subTheta.mul(24).sin().mul(2.6)).add(subTheta.mul(8).cos().mul(1.4))
    const guillocheWave = opticalBands(guillochePhase)
// Analytic tangent of the guilloché grooves so a blazing metallic cat's-eye highlight sweeps across each petal as the viewer orbits
    const radialDir = subLocal.div(subR.max(1e-4))
    const tangentDir = vec2(radialDir.y.negate(), radialDir.x)
    const grooveSlope = subTheta.mul(24).cos().mul(0.35)
    const foilNormal2D = radialDir.add(tangentDir.mul(grooveSlope)).normalize()
    const foilNormal3D = n.add(vec3(foilNormal2D.x, foilNormal2D.y, foilNormal2D.x.negate().mul(0.5)).mul(guillocheWave.sub(0.5).mul(0.45))).normalize()
    const foilSheen = studioSheen(foilNormal3D).mul(guillocheWave.mul(0.75).add(0.25))
// 3. Vitreous Enamel Micro-Features: Kiln Craquelure Fissures, Aventurine Gold Copper Spangles, and Pinhole Bubbles
    const subP = p.sub(view.mul(0.014))
    const craquelureVoro = voronoi(subP.mul(46).add(11.7), 0.85)
    const craquelureLine = hairline(craquelureVoro.border, 0.018).mul(cloisonWireMask.oneMinus()).mul(near.mul(0.75).add(0.25))
// Aventurine goldstone copper-crystal spangles suspended inside the translucent glass
    const spangleVoro = voronoi(subP.mul(72).add(39.4), 0.9)
    const spangleCore = spangleVoro.distance.smoothstep(0.22, 0.06).mul(spangleVoro.random.x.smoothstep(0.62, 0.82)).mul(intimate.mul(0.75).add(0.25))
// Beer-Lambert depth absorption: enamel is thicker and darker near the center of each cell, thinner near the brass cloisons
    const meniscusProfile = wireDist.smoothstep(0, 0.065)
    const wireShadow = wireDist.smoothstep(0, 0.032).mul(0.68).add(0.32)
    const opticalDepth = meniscusProfile.mul(0.75).add(0.35).div(facing.max(0.35))
    const beerLambertTransmission = enamelVec.pow(opticalDepth.mul(1.15))
// Combine gilded 24k brass cloison wires and translucent basse-taille enamel compartments
    const wireGold = mix(color(hsl.integer(78, 83, 69.5)), color(hsl.integer(93, 100, 92)), wireDist.smoothstep(0.014, 0))
    const foilTint = mix(color(hsl.integer(91, 100, 93.4)), color(hsl.integer(0, 0, 100)), zone.mod(2))
    const enamelBody = beerLambertTransmission.mul(0.28)
      .add(beerLambertTransmission.mul(foilTint).mul(foilSheen).mul(0.42))
      .add(enamelVec.mul(guillocheWave.mul(0.18)))
      .mul(wireShadow)
    this.colorNode = mix(enamelBody, wireGold, cloisonWireMask)
    this.metalnessNode = mix(float(0.38).add(spangleCore.mul(0.58)), float(0.96), cloisonWireMask)
    this.specularIntensityNode = mix(float(0.15), float(1), cloisonWireMask)
    this.roughnessNode = mix(float(0.035).add(craquelureLine.mul(0.15)), float(0.14), cloisonWireMask)
    this.aoNode = mix(wireShadow, float(1), cloisonWireMask)
// Anisotropic brushing along the gilded brass cloisons and underlying guilloché engine-turning
    this.anisotropyNode = mix(tangentDir.mul(0.6), vec2(0.8, 0.2), cloisonWireMask)
    this.clearcoatNode = mix(float(0.82), float(0.28), cloisonWireMask)
    this.clearcoatRoughness = 0.012
    this.clearcoatNormalNode = normalViewGeometry
    this.iridescenceNode = cloisonWireMask.oneMinus().mul(0.38)
    this.iridescenceIOR = 1.54
    this.iridescenceThicknessNode = meniscusProfile.mul(180).add(grazing.mul(160)).add(190)
// Meniscus surface tension dome inside each enamel cell + raised lapped brass cloison wires + craquelure grooves
    const surfaceHeight = meniscusProfile.mul(0.002)
      .add(cloisonWireMask.mul(0.003))
      .sub(craquelureLine.mul(0.0007))
      .add(mx_noise_float(p.mul(36)).mul(0.00018))
    const normal = proceduralNormal(surfaceHeight, 1.15)
    this.normalNode = normal
// Internal Basse-Taille Guilloché fire, backlit craquelure light-piping, and Aventurine gold-spangle glints
    const wireSparkle = glints(normal, 220).mul(cloisonWireMask)
    const spangleSparkle = glints(normal, 180).mul(spangleCore).mul(cloisonWireMask.oneMinus())
    const guillocheFire = beerLambertTransmission.mul(foilTint)
      .mul(foilSheen.pow(1.5).mul(1.1).add(guillocheWave.mul(0.22)))
      .mul(facing.mul(0.65).add(0.35))
      .mul(wireShadow)
    const craquelureGlow = mix(enamelVec, color(hsl.integer(94, 100, 96)), 0.5).mul(craquelureLine).mul(0.65)
    const breathe = time.mul(1.6).add(cellRnd.z.mul(TAU)).sin().mul(0.12).add(0.92)
    this.emissiveNode = guillocheFire.mul(breathe).mul(cloisonWireMask.oneMinus()).mul(0.95)
      .add(craquelureGlow)
      .add(color(hsl.integer(87.3, 100, 85.4)).mul(spangleCore.mul(0.65).add(spangleSparkle.mul(1.4))))
      .add(color(hsl.integer(94, 100, 96.7)).mul(wireSparkle).mul(0.65))
      .add(enamelVec.mul(rim.pow(2.4)).mul(cloisonWireMask.oneMinus()).mul(0.45))
  }
}
