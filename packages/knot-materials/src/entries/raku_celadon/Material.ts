import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, mx_fractal_noise_float, mx_noise_float, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/gemini_argon/lib/detailNormal.ts'
import {glitter} from '../../candidates/gemini_argon/lib/glitter.ts'
import {tubeMetric, tubeTurns} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {beads} from '../../lib/beads.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const throwingFlutes = 10
const throwingShape = (tube: Node<'vec2'>) => {
  const turns = tubeTurns(tube)
  const flutePhase = turns.mul(TAU * throwingFlutes).add(tube.x.mul(TAU * 3).sin().mul(0.4))
  const flute = flutePhase.cos()
  const chattering = tube.x.mul(TAU * 84).add(turns.mul(TAU * 2).cos().mul(0.8)).sin().mul(flute.smoothstep(0.1, 0.85))
  const relief = flute.mul(0.0068).add(chattering.mul(0.0018))
  return {
    chattering,
    flute,
    relief,
    turns,
  }
}
const displacedStoneware = Fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  return position.add(normal.mul(throwingShape(tube).relief))
})
/** Wood-fired Raku & Song-dynasty celadon ceramic with pooled glassy glaze, exposed iron stoneware rims, Voronoi crazing crackle and maki-e gold kintsugi veins. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const metric = tubeMetric(tube)
    const {flute, chattering} = throwingShape(tube)
    const eps = 0.00012
    const du = displacedStoneware(tube.add(vec2(eps, 0))).sub(displacedStoneware(tube.sub(vec2(eps, 0))))
    const dv = displacedStoneware(tube.add(vec2(0, eps))).sub(displacedStoneware(tube.sub(vec2(0, eps))))
    const vesselNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.positionNode = displacedStoneware(tube)
// Glaze pools deep in the throwing flutes and thins on the high ridges where dark iron clay breaks through.
    const clayNoise = mx_fractal_noise_float(p.mul(16), 3, 2.1, 0.5)
    const glazeDepth = flute.negate().mul(0.5).add(0.5).add(clayNoise.mul(0.16)).clamp(0, 1)
    const rawClayMask = glazeDepth.smoothstep(0.12, 0.28).oneMinus()
// Primary and secondary Voronoi crazing network (kan-nyu) at two scales + sub-glaze parallax crackle.
    const crackCoord = p.mul(11).add(vec3(clayNoise.mul(0.25)))
    const primaryEdge = cellularBoundary(crackCoord)
    const secondaryEdge = cellularBoundary(p.mul(26).add(7.4))
    const deepEdge = cellularBoundary(p.sub(view.mul(0.028)).mul(18).add(3.1))
// Select major fracture lines for raised golden urushi kintsugi repair; finer lines remain dark carbonized raku smoke.
    const kintsugiGate = mx_noise_float(p.mul(3.8).add(1.9)).smoothstep(-0.08, 0.22)
    const kintsugiSeam = filteredRibbon(primaryEdge, 0.032).mul(kintsugiGate).mul(rawClayMask.oneMinus())
    const darkCrackle = filteredRibbon(primaryEdge, 0.018).mul(kintsugiGate.oneMinus())
      .max(filteredRibbon(secondaryEdge, 0.014).mul(near.mul(0.75).add(0.25)).mul(0.75))
      .mul(rawClayMask.oneMinus())
    const subGlazeCrackle = filteredRibbon(deepEdge, 0.022).mul(rawClayMask.oneMinus()).mul(0.55)
// Suspended quartz bubbles and iron-oxide crystal blossoms inside the pooled celadon glaze.
    const subsurfaceBubbles = beads(p.sub(view.mul(0.022)).mul(48), 11.3)
    const bubbleGlow = subsurfaceBubbles.mask.mul(glazeDepth.smoothstep(0.35, 0.85)).mul(intimate.mul(0.75).add(0.25))
    const goldDust = glitter(p, 0.0085, 75, 0.45)
// Celadon Beer-Lambert absorption: luminous seafoam where thin, rich imperial jade-emerald in the pooled hollows.
    const thinCeladon = color(hsl.integer(175, 100, 94.8))
    const pooledJade = color(hsl.integer(178, 94, 48))
    const deepAbyssJade = color(hsl.integer(178, 92, 22))
    const celadonBody = mix(thinCeladon, mix(pooledJade, deepAbyssJade, glazeDepth.pow(1.45)), glazeDepth.smoothstep(0.18, 0.92))
    const smokedCrackleColor = color(hsl.integer(59, 16, 7))
    const glazedColor = mix(mix(celadonBody, color(hsl.integer(170, 100, 96.3)), subGlazeCrackle.mul(0.25).add(bubbleGlow.mul(0.35))), smokedCrackleColor, darkCrackle.mul(0.85))
// Charred tenmoku iron stoneware on the unglazed ridges with oil-spot rainbow lustre near the glaze boundary.
    const lustreBorder = glazeDepth.smoothstep(0.14, 0.34).mul(glazeDepth.smoothstep(0.34, 0.56).oneMinus())
    const rakuSpectrum = spectralColor(facing.mul(5).add(clayNoise.mul(3.5)).add(metric.x.mul(2)))
    const charredClay = mix(color(hsl.integer(43, 26, 9)), color(hsl.integer(43, 48, 23)), clayNoise.mul(0.5).add(0.5))
    const clayWithLustre = mix(charredClay, rakuSpectrum.mul(0.65), lustreBorder.mul(0.75))
    const goldBase = mix(color(hsl.integer(82, 89, 78)), color(hsl.integer(92, 100, 92)), goldDust.sparkle.min(1).mul(0.45))
    this.colorNode = mix(mix(glazedColor, clayWithLustre, rawClayMask), goldBase, kintsugiSeam)
    this.metalnessNode = mix(mix(lustreBorder.mul(0.65), float(0.12), rawClayMask), float(1), kintsugiSeam)
    this.roughnessNode = mix(mix(float(0.035).add(darkCrackle.mul(0.22)), float(0.76), rawClayMask), float(0.14).sub(goldDust.sparkle.mul(0.05)).clamp(0.06, 0.22), kintsugiSeam)
    this.ior = 1.54
    this.clearcoatNode = rawClayMask.oneMinus().mul(kintsugiSeam.oneMinus())
    this.clearcoatRoughnessNode = float(0.02).add(darkCrackle.mul(0.18))
    this.iridescenceNode = lustreBorder.mul(0.88).add(darkCrackle.mul(0.35)).mul(kintsugiSeam.oneMinus())
    this.iridescenceIOR = 1.65
    this.iridescenceThicknessNode = glazeDepth.mul(340).add(facing.mul(180)).add(210)
    this.anisotropyNode = rawClayMask.mul(0.45)
    this.anisotropyRotation = 0
// Raised kintsugi lacquer bead, recessed crackle fissures, and gritty iron stoneware relief.
    const microHeight = kintsugiSeam.mul(0.0022)
      .sub(darkCrackle.mul(0.0014))
      .add(rawClayMask.mul(clayNoise.mul(0.0016).add(chattering.mul(0.0005))))
    this.normalNode = detailNormal(vesselNormal, microHeight, 0.95)
    this.aoNode = float(1).sub(darkCrackle.mul(0.45)).sub(rawClayMask.mul(0.18))
// Residual kiln-ember pulse travelling along the golden kintsugi seams and raku reduction rainbow rim.
    const kilnPulse = metric.x.mul(2.5).sub(time.mul(Math.PI)).sin().mul(0.5).add(0.5).pow(3)
    const kintsugiGlow = mix(color(hsl.integer(45, 100, 65)), color(hsl.integer(91, 100, 87.9)), kilnPulse).mul(kintsugiSeam).mul(kilnPulse.mul(0.55).add(0.25))
    const reductionRim = rakuSpectrum.mul(lustreBorder).mul(grazing.pow(2.2)).mul(0.32)
    const jadeSubsurface = color(hsl.integer(172, 96, 78)).mul(glazeDepth.pow(2)).mul(grazing.pow(2.5)).mul(rawClayMask.oneMinus()).mul(0.24)
    this.emissiveNode = kintsugiGlow
      .add(reductionRim)
      .add(jadeSubsurface)
      .add(color(hsl.integer(97, 100, 95)).mul(goldDust.sparkle).mul(kintsugiSeam).mul(intimate).mul(0.55))
  }
}
