import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, mx_cell_noise_float, mx_fractal_noise_float, mx_noise_float, normalLocal, normalViewGeometry, select, time, uv, vec2, vec3} from 'three/tsl'

import {studioSheen} from '../../candidates/gemini_argon/lib/environmentHighlight.ts'
import {tubeCells} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {voronoi} from '../../candidates/gemini_argon/lib/voronoi3dStruct.ts'
import {inkFill, inkLine, tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {starfield} from '../../lib/starfield.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const ringsAlong = 28
const ringsAround = 3
/** Graduated degree tick marks on a brass armillary ring with Nyquist filtering. */
function vernierTicks(coord: Node<'float'>, frequency: number, footprint: Node<'float'>) {
  const phase = coord.mul(frequency * TAU)
  const fw = footprint.mul(frequency * TAU)
  const vis = fw.smoothstep(0.6, 2.8).oneMinus()
  return phase.cos().smoothstep(0.65, 0.92).mul(vis)
}
/** Renaissance Keplerian armillary sphere and astrolabe in burnished brass, copper, and silver, enclosing a deep lapis-lazuli planetarium with 3D constellation stick-figures, orbital planets, and vernier scales. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, rim, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const tube = uv()
    const grid = vec2(ringsAlong, ringsAround)
    const cells = tubeCells(tube, ringsAlong, ringsAround)
    const footprint = cells.fwidth().x.max(cells.fwidth().y).max(0.0003)
    const cellId = wrapCell(cells.floor(), grid)
    const cellRnd = cellNoiseVec3(vec3(cellId, 61.8))
    const local = cells.fract().sub(0.5)
    const r = local.length()
    const theta = atan(local.y, local.x.add(1e-6))
// Top Layer: Outer Brass Meridian Rings, Ecliptic Band, and Astrolabe Rete Pointers
    const meridianX = local.x.abs().sub(0.455).abs()
    const equatorY = local.y.abs().sub(0.455).abs()
    const eclipticDiag = local.x.mul(0.52).add(local.y.mul(0.85)).abs()
    const outerBezel = r.sub(0.42).abs()
    const innerRete = r.sub(0.245).abs()
// Astrolabe star-pointer daggers (curved Gothic pointers on the inner rete ring)
    const pointerAngle = theta.add(time.mul(0.14)).add(cellRnd.x.mul(TAU))
    const pointerTip = pointerAngle.mul(4).cos().smoothstep(0.72, 0.96).mul(r.sub(0.19).abs().smoothstep(0.055, 0.005))
    const meridianMask = inkLine(meridianX.min(equatorY), 0.024, footprint)
    const eclipticMask = inkLine(eclipticDiag, 0.028, footprint).mul(r.smoothstep(0.46, 0.42))
    const bezelMask = inkLine(outerBezel, 0.026, footprint)
    const reteMask = inkLine(innerRete, 0.016, footprint).max(pointerTip)
    const topBrassMask = meridianMask.max(eclipticMask).max(bezelMask).max(reteMask)
// Graduated Vernier degree and arcminute ticks engraved into the top brass rings
    const degreeTicks = vernierTicks(theta.div(TAU), 72, footprint).mul(bezelMask)
      .add(vernierTicks(cells.x, 36, footprint).mul(meridianMask.max(eclipticMask)))
      .add(vernierTicks(theta.div(TAU), 144, footprint).mul(reteMask).mul(intimate))
// Mid-Layer Parallax (depth 0.024): Counter-rotating Copper Solstice Ring and Silver Equatorial Armilla
    const ray = tubeRay().mul(grid)
    const midCells = cells.sub(ray.mul(0.024))
    const midLocal = midCells.fract().sub(0.5)
    const midR = midLocal.length()
    const midTheta = atan(midLocal.y, midLocal.x.add(1e-6)).sub(time.mul(0.22))
    const copperRingField = midR.sub(0.335).abs()
    const copperSpokes = midTheta.mul(6).sin().abs().mul(midR).max(midR.sub(0.34)).max(float(0.11).sub(midR))
    const copperMask = inkLine(copperRingField, 0.022, footprint).max(inkLine(copperSpokes, 0.011, footprint))
// Tiny orbiting tellurium planets (golden sun at center, pearl moon & ruby Mars on orbital rings)
    const sunOrb = inkFill(midR.sub(0.058), footprint)
    const planetAngle = time.mul(0.65).add(cellRnd.y.mul(TAU))
    const planetPos = vec2(planetAngle.cos(), planetAngle.sin()).mul(0.335)
    const planetOrb = inkFill(midLocal.sub(planetPos).length().sub(0.036), footprint)
    const moonAngle = time.mul(1.45).add(cellRnd.z.mul(TAU))
    const moonPos = vec2(moonAngle.cos(), moonAngle.sin()).mul(0.245)
    const moonOrb = inkFill(local.sub(moonPos).length().sub(0.024), footprint)
// Deep Layer Parallax (depth 0.058): Lapis-Lazuli Vault of Heaven, Golden Coordinate Grid, and 3D Constellation Lines
    const deepCells = cells.sub(ray.mul(0.058))
    const deepP = p.sub(view.mul(0.052))
// Celestial right-ascension & declination golden hairlines in the deep vault
    const raGrid = hairline(deepCells.x.mul(4).fract().sub(0.5), 0.014)
    const decGrid = hairline(deepCells.y.mul(4).fract().sub(0.5), 0.014)
    const celestialCoordinateGrid = raGrid.max(decGrid).mul(near.mul(0.6).add(0.4))
// 3D Voronoi constellation stick-figures and bright navigation stars
    const constelVoro = voronoi(deepP.mul(14).add(7.3), 0.86)
    const constelStick = constelVoro.border.smoothstep(0.022, 0.004)
      .mul(mx_cell_noise_float(constelVoro.cell).smoothstep(0.35, 0.65))
    const navStar = constelVoro.distance.smoothstep(0.095, 0.015)
    const deepStarfield = starfield(deepP.normalize(), 34, 0.72)
// Crushed Lapis Lazuli (Ultramarine + Sodalite + Calcite veins + Golden Pyrite flecks)
    const lapisNoise = mx_fractal_noise_float(deepP.mul(11), 4, 2.1, 0.52).mul(0.5).add(0.5)
    const calciteVein = hairline(mx_noise_float(deepP.mul(8.5)).sub(0.18), 0.025).mul(0.35)
    const pyriteFlecks = cellularPoints(deepP.mul(95), 0.03, 0.16, 0.55).mul(near.mul(0.65).add(0.35))
    const lapisBase = mix(color(hsl.integer(266, 84, 6)), color(hsl.integer(265, 94, 24.4)), lapisNoise)
      .add(color(hsl.integer(265, 66, 46)).mul(calciteVein))
      .add(color(hsl.integer(85, 81, 77)).mul(pyriteFlecks.mul(0.85)))
// Compose the layers from deep lapis planetarium -> mid copper armilla -> top brass astrolabe
    const topShadow = topBrassMask.smoothstep(0, 0.2).oneMinus().mul(0.45).oneMinus()
    const midVisible = copperMask.max(sunOrb).max(planetOrb).mul(topBrassMask.oneMinus())
    const totalMetalMask = topBrassMask.max(midVisible).max(moonOrb)
    const brassColor = mix(color(hsl.integer(79, 80, 70)), color(hsl.integer(90, 100, 90)), degreeTicks.oneMinus().mul(0.45))
      .mul(degreeTicks.mul(0.42).oneMinus())
    const copperColor = mix(color(hsl.integer(42, 70, 51)), color(hsl.integer(45, 76, 73)), midR.smoothstep(0.1, 0.35))
    const silverMoonColor = color(hsl.integer(253, 38, 91))
    const rubyMarsColor = color(hsl.integer(24, 97, 49.5))
    let midLayerColor: Node<'vec3'> = mix(copperColor, color(hsl.integer(86.5, 100, 84.7)), sunOrb)
    midLayerColor = mix(midLayerColor, rubyMarsColor, planetOrb)
    let compositeAlbedo: Node<'vec3'> = mix(lapisBase.mul(topShadow), midLayerColor.mul(topShadow), midVisible)
    compositeAlbedo = mix(compositeAlbedo, brassColor, topBrassMask)
    compositeAlbedo = mix(compositeAlbedo, silverMoonColor, moonOrb)
    this.colorNode = compositeAlbedo
// Physical Material Properties: high-metalness brushed brass/copper on rings, low-specular deep lapis vault beneath
    const isRuby = planetOrb.mul(topBrassMask.oneMinus())
    this.metalnessNode = totalMetalMask.mul(isRuby.oneMinus()).mul(0.95).add(pyriteFlecks.mul(totalMetalMask.oneMinus()).mul(0.85)).clamp()
    this.specularIntensityNode = mix(float(0.16), float(1), totalMetalMask.max(pyriteFlecks))
    this.roughnessNode = mix(float(0.28).sub(pyriteFlecks.mul(0.18)), select(isRuby.greaterThan(0.5), float(0.04), float(0.14).add(degreeTicks.mul(0.12))), totalMetalMask)
// Directional anisotropic brushing along the circumference of the brass and copper rings
    const ringTangent = vec2(local.y.negate(), local.x).div(r.max(1e-4))
    this.anisotropyNode = ringTangent.mul(totalMetalMask).mul(0.75)
    this.clearcoatNode = mix(float(0.88), float(0.28), totalMetalMask)
    this.clearcoatRoughness = 0.015
    this.clearcoatNormalNode = normalViewGeometry
    this.aoNode = mix(float(0.52), float(1), totalMetalMask)
// Multi-tier 3D mechanical relief normal: raised brass bezel, recessed vernier ticks, mid copper ring, and spherical tellurium orbs
    const relief = topBrassMask.mul(0.0038)
      .sub(degreeTicks.mul(0.0009))
      .add(midVisible.mul(0.0018))
      .add(sunOrb.add(planetOrb).add(moonOrb).mul(0.0022))
      .add(pyriteFlecks.mul(0.0005))
    const normal = proceduralNormal(relief, 1.15)
    this.normalNode = normal
// Celestial emission: glowing golden constellations, navigating stars, tellurium sun, and studio brass highlights
    const constellationGold = color(hsl.integer(87, 100, 86.2))
    const astrolabeCyan = color(hsl.integer(212, 100, 82.6))
    const starTwinkle = time.mul(3.1).add(constelVoro.random.x.mul(TAU)).sin().mul(0.28).add(0.82)
    const vaultEmission = constellationGold.mul(celestialCoordinateGrid.mul(0.38))
      .add(mix(astrolabeCyan, constellationGold, 0.45).mul(constelStick).mul(1.35))
      .add(color(hsl.integer(91, 100, 96.2)).mul(navStar).mul(starTwinkle).mul(2.4))
      .add(deepStarfield.mul(2.1))
      .add(color(hsl.integer(90, 100, 87.8)).mul(pyriteFlecks).mul(glints(normal, 180)).mul(0.95))
    const brassSheen = studioSheen(n).mul(topBrassMask).mul(0.32)
    const chamferEdge = outerBezel.min(meridianX).min(equatorY).smoothstep(0.028, 0.018).mul(topBrassMask)
    const chamferGlint = glints(normal, 220).mul(chamferEdge.add(midVisible.mul(0.4)))
    this.emissiveNode = vaultEmission.mul(totalMetalMask.oneMinus())
      .add(color(hsl.integer(74, 100, 78)).mul(sunOrb).mul(topBrassMask.oneMinus()).mul(2.2))
      .add(rubyMarsColor.mul(isRuby).mul(0.85))
      .add(brassColor.mul(brassSheen))
      .add(color(hsl.integer(91, 100, 95.5)).mul(chamferGlint).mul(0.65))
      .add(color(hsl.integer(265, 100, 52.5)).mul(rim.pow(2.5)).mul(totalMetalMask.oneMinus()).mul(0.45))
  }
}
