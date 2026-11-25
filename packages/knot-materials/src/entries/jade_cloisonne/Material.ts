import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, Fn, mix, mx_noise_float, select, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/gemini_argon/lib/detailNormal.ts'
import {glitter} from '../../candidates/gemini_argon/lib/glitter.ts'
import {tubeCells} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {inkFill, inkLine, tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const lotusAlong = 36
const lotusAround = 4
/** overlapping Byzantine/Imperial Chinese lotus-scale and scroll cloisonné geometry. */
function lotusCloison(cells: Node<'vec2'>) {
  const period = vec2(lotusAlong, lotusAround)
  const cell = wrapCell(cells.floor(), period)
  const id = cellNoiseVec3(vec3(cell, 6.3))
  const local = cells.fract().sub(0.5)
  const r = local.length()
  const angle = atan(local.y, local.x.add(1e-6))
// 8-petalled lotus medallion with ogee petal tips and concentric stamen ring.
  const outerPetal = r.sub(angle.mul(8).cos().mul(0.058).add(0.41))
  const innerPetal = r.sub(angle.mul(8).add(Math.PI / 8).cos().mul(0.042).add(0.245))
  const stamenRing = r.sub(0.11)
// Interlocking corner cloud-scrolls (ruyi) shared across adjacent cells.
  const corner = local.abs().sub(0.5)
  const cornerR = corner.length()
  const cornerScroll = cornerR.sub(0.24)
  const wireDist = outerPetal.abs().min(innerPetal.abs()).min(stamenRing.abs()).min(cornerScroll.abs())
  return {
    angle,
    cornerR,
    cornerScroll,
    id,
    innerPetal,
    local,
    outerPetal,
    r,
    stamenRing,
    wireDist,
  }
}
/** Round aventurine flecks inside the glitter lattice, so sparkles read as points instead of lighting whole 9 mm cubic cells. */
function aventurineFlecks(position: Node<'vec3'>, cellSize: number, sharpness: number, tilt: number) {
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
// Vertices are 2.8 cm apart along the tube, but the cloison wires are under 1 cm wide, so the geometry only carries a smooth cabochon swell over each lotus medallion and corner scroll; the wires and the enamel meniscus stay in the per-pixel relief below.
const displacedCloisonne = Fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  const cells = tubeCells(tube, lotusAlong, lotusAround)
  const {cornerR, r} = lotusCloison(cells)
  const swell = r.smoothstep(0, 0.46).oneMinus().pow2().add(cornerR.smoothstep(0, 0.36).oneMinus().pow2().mul(0.8))
  return position.add(normal.mul(swell.mul(0.0028)))
})
/** Imperial Jingfa Cloisonné & Ginbari Basse-Taille Enamel: hand-bent gilded brass cloisons filled with translucent vitreous enamel over engine-turned guilloché silver leaf that shimmers with parallax as the viewer moves. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.25)
    this.name = knotData.id
    const tube = uv()
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const cells = tubeCells(tube, lotusAlong, lotusAround)
    const footprint = cells.fwidth().x.max(cells.fwidth().y).max(0.0005)
    const eps = 0.00012
    const du = displacedCloisonne(tube.add(vec2(eps, 0))).sub(displacedCloisonne(tube.sub(vec2(eps, 0))))
    const dv = displacedCloisonne(tube.add(vec2(0, eps))).sub(displacedCloisonne(tube.sub(vec2(0, eps))))
    const baseNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.positionNode = displacedCloisonne(tube)
    const cloison = lotusCloison(cells)
// Crisp anti-aliased gilded brass wire partition (cloison) and concave enamel meniscus shadow.
    const wireMask = inkLine(cloison.wireDist, 0.021, footprint)
    const meniscusDepth = cloison.wireDist.smoothstep(0.015, 0.14)
// Ginbari silver-foil substrate shifted by tangent-space refraction ray beneath the vitreous enamel layer.
    const ray = tubeRay().mul(vec2(lotusAlong, lotusAround))
// Mirror-tiled (whole-cell counts are even, so the seams still close), so neighboring guilloché rosettes meet without a hard seam through the enamel.
    const foilCoord = cells.sub(ray.mul(0.042)).mul(0.5).fract().mul(2).sub(1).abs().sub(0.5)
    const foilR = foilCoord.length()
    const foilAngle = atan(foilCoord.y, foilCoord.x.add(1e-6))
    // The 24 spokes converge at each rosette center, so they also fade where they get finer than a few pixels.
    const guillocheResolved = footprint.smoothstep(0.008, 0.028).oneMinus().mul(foilR.smoothstep(footprint.mul(6), footprint.mul(12)))
    const engineTurned = foilAngle.mul(24).add(foilR.mul(85).sin().mul(3.5)).cos().mul(0.5).add(0.5)
    const ginbariFoil = engineTurned.mul(guillocheResolved).add(guillocheResolved.oneMinus().mul(0.5))
// Region masks for the distinct polychrome enamel cells.
    const inStamen = inkFill(cloison.stamenRing, footprint)
    const inInnerLotus = inkFill(cloison.innerPetal, footprint).mul(inStamen.oneMinus())
    const inOuterLotus = inkFill(cloison.outerPetal, footprint).mul(inInnerLotus.oneMinus()).mul(inStamen.oneMinus())
    const inCornerScroll = inkFill(cloison.cornerScroll, footprint)
// Imperial Ming/Qing cloisonné vitreous enamel palette with Beer-Lambert depth darkening near the wires.
    const cobaltBlue = mix(color(hsl.integer(265, 93, 16)), color(hsl.integer(262, 95, 40.6)), meniscusDepth)
    const imperialTurquoise = mix(color(hsl.integer(214, 93, 30)), color(hsl.integer(204, 96, 72)), meniscusDepth)
    const rubyEnamel = mix(color(hsl.integer(12, 91, 16)), color(hsl.integer(16.6, 96, 49)), meniscusDepth)
    const celadonJade = mix(color(hsl.integer(165, 92, 22)), color(hsl.integer(158, 96.7, 73)), meniscusDepth)
    const imperialAmber = mix(color(hsl.integer(52, 92, 29)), color(hsl.integer(72.1, 100, 77)), meniscusDepth)
    const outerHue = select(cloison.id.x.greaterThan(0.5), imperialTurquoise, celadonJade)
    const innerHue = select(cloison.id.y.greaterThan(0.45), rubyEnamel, imperialAmber)
    let enamelColor: Node<'vec3'> = cobaltBlue
    enamelColor = mix(enamelColor, celadonJade, inCornerScroll)
    enamelColor = mix(enamelColor, outerHue, inOuterLotus)
    enamelColor = mix(enamelColor, innerHue, inInnerLotus)
    enamelColor = mix(enamelColor, imperialAmber, inStamen)
// Modulate translucent enamel by the submerged ginbari silver guilloché foil and microscopic firing pinholes.
    const foilRadiance = ginbariFoil.mul(0.55).add(0.65)
    const aventurineSpark = aventurineFlecks(p, 0.009, 80, 0.5)
    const enamelWithFoil = enamelColor.mul(foilRadiance).add(enamelColor.mul(ginbariFoil.pow(3)).mul(0.45))
    const gildedWireColor = mix(color(hsl.integer(78, 88, 69)), color(hsl.integer(97, 100, 94)), cloison.wireDist.div(0.025).clamp().oneMinus())
    this.colorNode = mix(enamelWithFoil, gildedWireColor, wireMask)
    this.metalnessNode = mix(float(0.28).add(ginbariFoil.mul(0.35)), float(1), wireMask)
    this.roughnessNode = mix(float(0.03).add(meniscusDepth.oneMinus().mul(0.04)), float(0.14), wireMask)
    this.ior = 1.57
    this.clearcoatNode = wireMask.oneMinus()
    this.clearcoatRoughness = 0.015
    this.iridescenceNode = wireMask.oneMinus().mul(0.28)
    this.iridescenceIOR = 1.52
    this.iridescenceThicknessNode = meniscusDepth.mul(220).add(facing.mul(160)).add(180)
    // The wires and meniscus left the vertex displacement, so the per-pixel bump carries a little more of their relief.
    const wireCrown = cloison.wireDist.div(0.021).clamp().pow2().oneMinus().mul(0.6).add(0.4)
    const detailHeight = wireMask.mul(wireCrown).mul(0.0036).add(meniscusDepth.mul(0.0018)).add(ginbariFoil.mul(0.0003).mul(wireMask.oneMinus()))
    this.normalNode = detailNormal(baseNormal, detailHeight, 0.95)
    this.aoNode = meniscusDepth.mul(0.35).add(0.65).max(wireMask)
// Luminous internal reflection off the curved ginbari silver foil + золотой glint on the brass cloisons.
    const loopPulse = cells.x.div(lotusAlong).mul(TAU * 2).sub(time.mul(Math.PI)).sin().mul(0.5).add(0.5)
    const basseTailleGlow = enamelColor.mul(ginbariFoil.pow(2.2)).mul(wireMask.oneMinus()).mul(near.mul(0.5).add(0.5)).mul(0.55)
    const wireGlint = color(hsl.integer(93, 100, 91.6)).mul(wireMask).mul(grazing.pow(2).mul(0.6).add(loopPulse.mul(0.25))).mul(0.42)
    const sparkGlow = color(hsl.integer(87, 100, 88)).mul(aventurineSpark.sparkle).mul(wireMask.oneMinus()).mul(intimate).mul(0.65)
    const noiseShimmer = mx_noise_float(p.mul(24)).mul(0.04)
    this.emissiveNode = basseTailleGlow.add(wireGlint).add(sparkGlow).add(enamelColor.mul(noiseShimmer))
  }
}
