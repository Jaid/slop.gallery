import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, select, time, uv} from 'three/tsl'

import {glitter} from '../../candidates/gemini_argon/lib/glitter.ts'
import {tubeHex} from '../../candidates/gemini_argon/lib/tubeHex.ts'
import {tubeMetric, tubeTurns} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {inkFill, inkLine, tubeRay} from '../../lib/atelier.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Venetian Murano murrine cane cross-section: concentric starry glass petals, milk-white lattimo border, contrasting inner floret and pinwheel center core. */
function murrineCane(tube: Node<'vec2'>, cells: readonly [number, number], maxRadius: number, seed: number) {
  const hex = tubeHex(tube, cells, seed)
  const r = hex.distance.div(maxRadius)
  const angle = atan(hex.offset.y, hex.offset.x.add(1e-6)).add(hex.id.z.mul(TAU))
  const footprint = r.fwidth().max(0.002)
// 12-pointed outer star cane and 6-petalled inner rosette.
  const outerStar = angle.mul(12).cos().mul(0.065)
  const midPetal = angle.mul(6).cos().mul(0.055)
  const outerDist = r.sub(float(0.86).add(outerStar))
  const lattimoOuterDist = r.sub(float(0.66).add(outerStar.mul(0.7)))
  const lattimoInnerDist = r.sub(float(0.54).add(midPetal.mul(0.6)))
  const innerDist = r.sub(float(0.42).add(midPetal))
  const coreDist = r.sub(0.18)
  const outerMask = inkFill(outerDist, footprint)
  const lattimoRing = inkFill(lattimoOuterDist, footprint).mul(inkFill(lattimoInnerDist, footprint).oneMinus())
  const innerMask = inkFill(innerDist, footprint)
  const coreMask = inkFill(coreDist, footprint)
  const radialRibs = angle.mul(12).cos().smoothstep(0.35, 0.75).mul(outerMask)
// Palette per cane from its deterministic cell identity.
  const primaryHue = cosinePalette(hex.id.x, [0.48, 0.44, 0.48], [0.48, 0.46, 0.48], [1, 1, 1], [0.02, 0.35, 0.68]).clamp(0.05, 1)
  const secondaryHue = cosinePalette(hex.id.y.add(0.38), [0.5, 0.46, 0.5], [0.48, 0.46, 0.48], [1, 1, 1], [0.15, 0.48, 0.82]).clamp(0.05, 1)
  const lattimoWhite = color(hsl.integer(83, 33, 93.6))
  const caneRim = select(hex.id.z.greaterThan(0.5), color(hsl.integer(263, 88, 18)), color(hsl.integer(18, 97, 32.5)))
  let caneColor: Node<'vec3'> = mix(caneRim, primaryHue, radialRibs.mul(0.8).add(0.2))
  caneColor = mix(caneColor, secondaryHue, innerMask)
  caneColor = mix(caneColor, lattimoWhite, lattimoRing)
  caneColor = mix(caneColor, mix(color(hsl.integer(82.3, 100, 81.3)), color(hsl.integer(16, 96, 50)), hex.id.z), coreMask)
// Subtle 3D dome shading inside each fused glass cane.
  const domeShade = float(1).sub(r.clamp(0, 1).pow(2).mul(0.28))
  return {
    caneColor: caneColor.mul(domeShade),
    domeHeight: float(1).sub(r.clamp(0, 1).pow(2)).mul(outerMask),
    id: hex.id,
    mask: outerMask,
  }
}
/** Round grain per cell of a jittered lattice: the center stays in [0.25, 0.75] and the support radius at most 0.24, so no grain ever touches a cell wall. */
function roundGrain(q: Node<'vec3'>) {
  const rnd = cellNoiseVec3(q.floor())
  const outer = q.fwidth().length().add(0.18).min(0.24)
  return {
    mask: q.fract().sub(rnd.mul(0.5).add(0.25)).length().smoothstep(0.06, outer).oneMinus(),
    rnd,
  }
}
/** Round copper flecks inside the glitter lattice, so aventurine sparkles read as points instead of lighting whole 9.5 mm cubic cells. */
function aventurineFlecks(position: Node<'vec3'>, cellSize: number, sharpness: number, tilt: number) {
  const facets = glitter(position, cellSize, sharpness, tilt)
  const grain = roundGrain(position.div(cellSize))
  // A three times finer bed of copper crystals that face away from the lamps; they stay visible as dull flecks and fade out once they shrink below a pixel.
  const dustQ = position.div(cellSize / 3)
  const dust = roundGrain(dustQ)
  const dustResolved = dustQ.fwidth().length().smoothstep(0.32, 1.15).oneMinus()
  return {
    fleck: dust.mask.mul(dust.rnd.z.mul(0.6).add(0.4)).mul(dustResolved),
    resolved: facets.resolved,
    sparkle: facets.sparkle.mul(grain.mask),
  }
}
/** Parallax depths in object-space meters; all of them stay inside the 13 cm tube radius, so the buried strata don’t smear into streaks toward the silhouettes. */
const caneDepths = {
  top: 0.025,
  mid: 0.07,
  ribbon: 0.095,
  deep: 0.12,
} as const
/** Venetian Murano Millefiori & Filigrana Cristallo Glass: three parallax depths of starry murrine rosettes, counter-spiraling lattimo canes and glittering copper aventurine goldstone ribbons. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.2)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const ray = tubeRay()
    const turns = tubeTurns(tube)
    const metric = tubeMetric(tube)
// Three distinct depth strata of fused murrine flowers and twisted filigrana threads.
    const topTube = tube.sub(ray.mul(caneDepths.top))
    const midTube = tube.sub(ray.mul(caneDepths.mid))
    const deepTube = tube.sub(ray.mul(caneDepths.deep))
    const topCane = murrineCane(topTube, [56, 6], 0.056, 1.3)
    const midCane = murrineCane(midTube, [44, 6], 0.064, 7.9)
    const deepCane = murrineCane(deepTube, [36, 4], 0.078, 15.4)
// Zanfirico / Reticello counter-spiraling milk-glass lattimo canes and copper aventurine goldstone ribbons.
    const twistA = tube.x.mul(36).add(turns.mul(6))
    const twistB = tube.x.mul(36).sub(turns.mul(6)).sub(ray.x.mul(36 * caneDepths.ribbon))
    const twistFootprint = twistA.fwidth().max(0.001)
    const lattimoRibbon = inkLine(twistA.fract().sub(0.5), 0.065, twistFootprint)
    const aventurineRibbon = inkLine(twistB.fract().sub(0.5), 0.085, twistFootprint)
// Copper aventurine micro-crystals suspended inside the glass that sparkle under studio lights.
    const aventurineSparkle = aventurineFlecks(p.sub(view.mul(0.035)), 0.0095, 68, 0.55)
    const aventurineBody = mix(color(hsl.integer(43, 86, 29)), color(hsl.integer(70, 94, 73)), aventurineSparkle.sparkle.min(1.2).mul(0.75).add(aventurineSparkle.fleck.mul(0.6)).add(0.15).min(1))
// Deep Venetian cobalt-teal cristallo matrix at the core, layered bottom-to-top with Beer-Lambert depth tint.
    const cristalloCore = mix(color(hsl.integer(255, 66, 6.5)), color(hsl.integer(229, 81, 22)), facing.mul(0.65).add(0.35))
    let composite: Node<'vec3'> = mix(cristalloCore, deepCane.caneColor.mul(color(hsl.integer(223, 58, 70))).mul(0.58), deepCane.mask)
    composite = mix(composite, aventurineBody, aventurineRibbon.mul(0.85))
    composite = mix(composite, midCane.caneColor.mul(color(hsl.integer(218, 69, 88.4))).mul(0.82), midCane.mask)
    composite = mix(composite, color(hsl.integer(85, 40, 95.6)), lattimoRibbon.mul(0.78))
    composite = mix(composite, topCane.caneColor, topCane.mask)
    this.colorNode = composite
    // The ribbon lies beneath the middle canes too, so its metallic copper only shows where neither cane stratum covers it.
    const ribbonVisible = aventurineRibbon.mul(midCane.mask.oneMinus()).mul(topCane.mask.oneMinus())
    this.metalnessNode = ribbonVisible.mul(0.78)
    this.roughnessNode = float(0.025).add(ribbonVisible.mul(0.08))
    this.ior = 1.56
    this.clearcoat = 1
    this.clearcoatRoughness = 0.012
    this.iridescence = 0.32
    this.iridescenceIOR = 1.48
    this.iridescenceThicknessNode = facing.mul(220).add(topCane.domeHeight.mul(160)).add(190)
// Subtle fire-polished pillowing over each fused murrine cane.
    const pillowHeight = topCane.domeHeight.mul(0.0014).add(midCane.domeHeight.mul(0.0006)).add(lattimoRibbon.mul(0.0004))
    this.normalNode = proceduralNormal(pillowHeight, 1)
// Internal light-piping through the translucent milk-glass hearts and glittering aventurine flecks.
    const loopWave = metric.x.mul(2.2).sub(time.mul(Math.PI)).sin().mul(0.5).add(0.5)
    const caneLuminance = topCane.caneColor.mul(topCane.mask).mul(0.28)
      .add(midCane.caneColor.mul(midCane.mask).mul(topCane.mask.oneMinus()).mul(0.22))
    const aventurineGlint = color(hsl.integer(87, 100, 88)).mul(aventurineSparkle.sparkle).mul(aventurineRibbon.max(0.22)).mul(topCane.mask.oneMinus()).mul(intimate.mul(0.65).add(0.45))
    // The copper crystals that face away from the lamps still glint faintly in the ribbon, so the goldstone reads as densely flecked rather than flat brown.
    const aventurineFleckGlow = color(hsl.integer(60, 81, 66)).mul(aventurineSparkle.fleck).mul(ribbonVisible).mul(intimate.mul(0.2).add(0.18))
    const glassRim = mix(color(hsl.integer(178, 95, 80)), color(hsl.integer(358, 100, 68.7)), loopWave).mul(grazing.pow(3)).mul(0.32)
    this.emissiveNode = caneLuminance.mul(near.mul(0.45).add(0.55))
      .add(aventurineGlint.mul(0.95))
      .add(aventurineFleckGlow)
      .add(glassRim)
  }
}
