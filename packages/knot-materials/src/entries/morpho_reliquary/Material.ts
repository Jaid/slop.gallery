import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, mx_noise_float, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/gemini_argon/lib/detailNormal.ts'
import {tubeHex} from '../../candidates/gemini_argon/lib/tubeHex.ts'
import {tubeMetric, tubeTurns} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {beads} from '../../lib/beads.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const scaleGrid = [88, 12] as const
const wingVertexRelief = (tube: Node<'vec2'>) => {
  const turns = tubeTurns(tube)
  const metric = tubeMetric(tube)
  const primaryWave = turns.mul(TAU * 6).add(tube.x.mul(TAU * 2).sin().mul(0.55)).cos()
  const primaryVein = primaryWave.smoothstep(0.86, 0.98)
  const cellEdge = cellularBoundary(vec3(metric.x.mul(3.4), turns.mul(8), 1.7))
  const secondaryVein = cellEdge.smoothstep(0, 0.045).oneMinus()
  const veinMask = primaryVein.max(secondaryVein.mul(0.85))
  const membraneBillow = cellEdge.smoothstep(0, 0.35).mul(0.0055).sub(veinMask.mul(0.0022))
  return {
    cellEdge,
    membraneBillow,
    metric,
    primaryVein,
    turns,
    veinMask,
  }
}
const displacedWing = Fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  const {membraneBillow, veinMask} = wingVertexRelief(tube)
  const scaleTile = tubeHex(tube, scaleGrid, 2.3)
  const shingleTilt = scaleTile.offset.x.mul(18).clamp(-0.5, 0.5).mul(0.0018).mul(veinMask.oneMinus())
  return position.add(normal.mul(membraneBillow.add(shingleTilt)))
})
/** Lepidoptera Photonic Chitin & Structural Diffraction: shingled Morpho / Urania butterfly wing scales with lamellar Bragg diffraction, dark chitin wing venation, golden hemolymph channels and hydrophobic dew droplets. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const eps = 0.00012
    const du = displacedWing(tube.add(vec2(eps, 0))).sub(displacedWing(tube.sub(vec2(eps, 0))))
    const dv = displacedWing(tube.add(vec2(0, eps))).sub(displacedWing(tube.sub(vec2(0, eps))))
    const wingNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.positionNode = displacedWing(tube)
    const {cellEdge, primaryVein, turns, metric} = wingVertexRelief(tube)
    const secondaryVein = filteredRibbon(cellEdge, 0.032)
    const veinMask = primaryVein.max(secondaryVein.mul(0.85))
    const scaleTile = tubeHex(tube, scaleGrid, 2.3)
    const scaleRadius = scaleTile.distance.div(0.042)
    const scaleFootprint = scaleRadius.fwidth().max(0.002)
    const scaleResolved = scaleFootprint.smoothstep(0.08, 0.28).oneMinus()
// Scalloped apical teeth at the tip of each overlapping butterfly wing scale.
    const toothWave = scaleTile.offset.y.mul(420).cos().mul(0.08)
    const scaleBody = scaleRadius.sub(float(0.88).add(toothWave)).smoothstep(scaleFootprint.negate(), scaleFootprint).oneMinus()
// Sub-micron longitudinal ridge grating inside each chitin scale (Morpho Christmas-tree lamellae).
    const ridgeGrating = scaleTile.offset.y.mul(950).cos().mul(0.5).add(0.5).mul(scaleFootprint.smoothstep(0.02, 0.08).oneMinus())
// Structural diffraction phase: shifts dramatically with viewing angle, scale random tilt, and azimuthal orientation.
    const scaleTilt = scaleTile.id.x.sub(0.5).mul(0.55).mul(scaleResolved)
    const azimuthShift = view.x.mul(turns.mul(TAU).cos()).add(view.z.mul(turns.mul(TAU).sin())).mul(0.85)
    const opticalPath = facing.mul(4.8).add(azimuthShift).add(scaleTilt).add(scaleTile.id.y.mul(0.45))
    const morphoSpectrum = spectralColor(opticalPath)
// Morpho rhetenor & Urania ripheus photonic palette: blazing emerald -> electric cobalt -> deep royal violet -> magenta.
    const emeraldCyan = mix(color(hsl.integer(155, 100, 85.8)), color(hsl.integer(222, 100, 76)), facing.smoothstep(0.45, 0.92))
    const royalViolet = mix(color(hsl.integer(265, 100, 39.6)), color(hsl.integer(297, 100, 48)), grazing.smoothstep(0.2, 0.75))
    const magentaEdge = color(hsl.integer(359, 100, 60.1))
    const structuralColor = mix(mix(emeraldCyan, royalViolet, grazing.smoothstep(0.15, 0.68)), magentaEdge, grazing.pow(2.6))
      .mul(mix(vec3(1), morphoSpectrum, 0.38))
// Dark melanin-pigmented chitin ground beneath the scales + golden hemolymph veins.
    const melaninGround = color(hsl.integer(303, 37, 4))
    const scaleShade = scaleBody.mul(0.75).add(0.25).mul(ridgeGrating.mul(0.22).add(0.88))
    const chitinVeinColor = mix(color(hsl.integer(53, 28, 6)), color(hsl.integer(77, 86, 69)), primaryVein.mul(0.65).add(secondaryVein.mul(0.35)))
// Hydrophobic morning dew droplets sitting atop the micro-textured scales.
    const dew = beads(p.mul(38), 9.4)
    const dewMask = dew.mask.mul(veinMask.oneMinus())
    const dewSpark = glints(wingNormal, 95).mul(dewMask).mul(intimate.mul(0.7).add(0.3))
    const wingSurface = mix(melaninGround, structuralColor.mul(scaleShade), scaleBody.mul(scaleResolved).add(scaleResolved.oneMinus().mul(0.85)))
    this.colorNode = mix(mix(wingSurface, chitinVeinColor, veinMask), color(hsl.integer(226, 100, 96.4)), dewMask.mul(0.35))
    this.metalnessNode = mix(float(0.68), float(0.85), veinMask).mul(dewMask.oneMinus())
    this.roughnessNode = mix(
      float(0.18).sub(ridgeGrating.mul(0.06)).add(scaleTile.id.z.mul(0.06)),
      float(0.12),
      veinMask,
    ).sub(dewMask.mul(0.14)).clamp(0.02, 0.32)
    this.iridescenceNode = veinMask.oneMinus().mul(0.96).add(0.04)
    this.iridescenceIOR = 1.76
    this.iridescenceThicknessNode = facing.mul(310).add(scaleTilt.mul(180)).add(260)
    this.sheenNode = mix(color(hsl.integer(171, 100, 87)), color(hsl.integer(310, 100, 56)), grazing).mul(veinMask.oneMinus()).mul(0.75)
    this.sheenRoughness = 0.2
// Strong anisotropic sheen aligned with the scale ridge lamellae.
    this.anisotropyNode = veinMask.oneMinus().mul(0.84)
    this.anisotropyRotation = 0
    this.clearcoatNode = veinMask.mul(0.7).add(dewMask).clamp(0, 1)
    this.clearcoatRoughness = 0.02
    const detailHeight = scaleBody.mul(scaleResolved).mul(0.0014)
      .add(ridgeGrating.mul(0.00035))
      .add(veinMask.mul(0.0024))
      .add(dew.cap.mul(dewMask).mul(0.0016))
    this.normalNode = detailNormal(wingNormal, detailHeight, 0.92)
    this.aoNode = mix(scaleBody.mul(0.35).add(0.65), float(0.9), veinMask)
// Bioluminescent golden hemolymph pulse flowing along the wing veins + photonic scale scintillation.
    const pulse = metric.x.mul(2.4).sub(time.mul(Math.PI)).sin().mul(0.5).add(0.5).pow(2.8)
    const veinPulse = mix(color(hsl.integer(51, 100, 68)), color(hsl.integer(98, 100, 91)), pulse).mul(veinMask).mul(pulse.mul(0.65).add(0.2))
    const scaleSparkle = structuralColor.mul(scaleTile.id.x.smoothstep(0.65, 0.96)).mul(scaleResolved).mul(near.mul(0.6).add(0.35)).mul(0.52)
    const noiseShimmer = mx_noise_float(p.mul(32)).mul(0.5).add(0.5)
    this.emissiveNode = veinPulse
      .add(scaleSparkle.mul(noiseShimmer.mul(0.5).add(0.5)))
      .add(structuralColor.mul(grazing.pow(2.4)).mul(veinMask.oneMinus()).mul(0.36))
      .add(color(hsl.integer(0, 0, 100)).mul(dewSpark).mul(1.1))
  }
}
