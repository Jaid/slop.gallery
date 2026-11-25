import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, mx_hsvtorgb, mx_noise_float, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {detailNormal} from '../../candidates/gemini_argon/lib/detailNormal.ts'
import {panelSky, proceduralEnvironment} from '../../candidates/gemini_argon/lib/environment.ts'
import {knotFrame} from '../../candidates/gemini_argon/lib/knotFrame.ts'
import {tubeMetric, tubeTurns} from '../../candidates/gemini_argon/lib/tubeMetric.ts'
import {beads} from '../../lib/beads.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const combRows = 8
const platesAlong = 96
/** Octagonal bathypelagic ctenophore anatomy: 8 raised longitudinal comb-row ridges, sawtooth shingled ciliary paddles and peristaltic metachronal wave pulsation. */
function ctenophoreEnvelope(tube: Node<'vec2'>) {
  const metric = tubeMetric(tube)
  const turns = tubeTurns(tube)
  const loopPhase = time.mul(Math.PI)
  const rowPhase = turns.mul(combRows * TAU)
  const rib = rowPhase.cos().mul(0.5).add(0.5).pow(1.8)
// Peristaltic metachronal wave + soft organic body undulation
  const wave = tube.x.mul(TAU * 4).sub(loopPhase.mul(2)).add(rowPhase.sin().mul(0.25)).sin()
  const organicSwell = tube.x.mul(TAU * 3).add(turns.mul(TAU * 2)).add(loopPhase).sin().mul(0.18)
  const relief = rib.mul(0.68).add(wave.mul(0.22)).add(organicSwell).sub(0.24)
  return {
    loopPhase,
    metric,
    relief,
    rib,
    rowPhase,
    turns,
    wave,
  }
}
const displacedCtenophore = Fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  const {relief} = ctenophoreEnvelope(tube)
  return position.add(normal.mul(relief.mul(0.015)))
})
/** Abyssal Ctenophore (Bathypelagic Comb Jelly): translucent colloidal mesoglea, 8 metachronal shingled ciliary diffraction rows, and proximity-reactive bioluminescent gastrovascular canals. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.88)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const basis = knotFrame(tube)
    const eps = 0.00022
    const du = displacedCtenophore(tube.add(vec2(eps, 0))).sub(displacedCtenophore(tube.sub(vec2(eps, 0))))
    const dv = displacedCtenophore(tube.add(vec2(0, eps))).sub(displacedCtenophore(tube.sub(vec2(0, eps))))
    const macroNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.positionNode = displacedCtenophore(tube)
    const {turns, loopPhase, rib} = ctenophoreEnvelope(tube)
// 8 longitudinal comb-row bands (ctenes)
    const rowCoord = turns.mul(combRows)
    const rowLocalY = rowCoord.fract().sub(0.5)
    const rowId = rowCoord.floor()
    const fpY = rowCoord.fwidth().max(0.0005)
// Comb row width + sunken cushion-cell attachment groove down the center of each row
    const rowBand = rowLocalY.abs().smoothstep(0.195, float(0.24).add(fpY)).oneMinus()
    const cushionGroove = rowLocalY.abs().smoothstep(0.015, float(0.042).add(fpY)).oneMinus()
// Continuous overlapping roof-tile shingling along the comb row (no bare gaps between plates!)
    const normY = rowLocalY.div(0.21).clamp(-1, 1)
    const archCurve = normY.pow(2).mul(0.32)
    const ciliaFringe = rowLocalY.mul(TAU * 62).sin().mul(0.04).mul(fpY.smoothstep(0.012, 0.038).oneMinus())
// Continuous metachronal traveling wave along each comb row (5 full wavelengths around the knot)
    const metachronalPhase = tube.x.mul(TAU * 5)
      .sub(loopPhase.mul(2))
      .add(rowId.mul(0.785))
    const strokeWave = metachronalPhase.sin().mul(0.5).add(0.5)
    const plateCoord = tube.x.mul(platesAlong).add(rowId.mul(0.37)).add(archCurve).add(ciliaFringe).sub(strokeWave.sub(0.5).mul(0.14))
    const shingleFract = plateCoord.fract()
    const fpX = plateCoord.fwidth().max(0.0005)
    const plateResolution = fpX.smoothstep(0.16, 0.48).oneMinus()
// Sawtooth roof-tile overlap: each plate rises from base (0) to a bright projecting lip (0.76..0.85), then drops into a deep imbricated shadow crease (0.85..1.0)
    const shingleRamp = shingleFract.div(0.84).clamp()
    const overlapDrop = shingleFract.smoothstep(0.82, float(0.91).add(fpX))
    const shingleLip = shingleFract.sub(0.79).abs().smoothstep(0.07, 0).mul(plateResolution)
    const shingleHeight = shingleRamp.pow(1.3).mul(overlapDrop.oneMinus()).add(shingleLip.mul(0.35))
    const overlapShadow = shingleFract.sub(0.9).abs().smoothstep(0.095, 0).mul(plateResolution)
    const cteneMask = rowBand.mul(mix(float(1), overlapDrop.oneMinus().mul(0.45).add(0.55), plateResolution))
// Anisotropic tangent-dependent Bragg diffraction spectrum (shifts strongly with view.dot(basis.along) + rich saturated emerald green)
    const viewAlong = view.dot(basis.along)
    const rawHue = tube.x.mul(4.5)
      .sub(loopPhase.div(TAU).mul(2))
      .add(viewAlong.mul(0.95))
      .add(facing.mul(0.65))
      .add(rowId.mul(0.125))
      .add(shingleRamp.mul(0.18))
      .fract()
// Expand the emerald-green spectral bracket around hue 0.35 so true saturated emerald stands out clearly
    const emeraldLock = rawHue.sub(0.35).abs().smoothstep(0.14, 0).mul(rawHue.sub(0.35).mul(0.45))
    const gratingHue = rawHue.sub(emeraldLock).fract()
    const ciliaRainbow = mx_hsvtorgb(vec3(gratingHue, 0.94, 1)).pow(1.65)
// Deep parallax volumetric interior: soft volumetric Tyndall scatter + radial canal branches emerging from the 8 meridional canals
    let internalGlow: Node<'vec3'> = vec3(0)
    const depths = [0.034, 0.078, 0.128]
    for (const [index, depth] of depths.entries()) {
      const q = p.sub(view.mul(depth))
      const warpA = mx_noise_float(q.mul(3.6).add(vec3(0, loopPhase.sin().mul(0.22), index * 3.7)))
      const warpB = mx_noise_float(q.mul(4.4).add(vec3(5.2, index * 2.1, loopPhase.cos().mul(0.22))))
      const qWarped = q.add(vec3(warpA, warpB, warpA.sub(warpB)).mul(0.21))
      const densityScale = qWarped.length().mul(3.2).add(5.2 + index * 2.4)
      const cellEdge = cellularBoundary(qWarped.mul(densityScale).add(index * 11.3))
// Soft volumetric canal glow + delicate core (concentrated near the 8 meridional canals rather than a uniform wireframe)
      const canalSoft = cellEdge.smoothstep(0, 0.16).oneMinus().pow(2.2)
      const canalCore = filteredRibbon(cellEdge, 0.022 - index * 0.003).mul(0.55)
      const radialEnvelope = rowLocalY.abs().smoothstep(0.04, 0.42).oneMinus().mul(0.65).add(0.35)
      const pulseWave = qWarped.x.mul(6.5).add(qWarped.y.mul(5)).sub(loopPhase.mul(2)).add(index * 1.8).sin().mul(0.5).add(0.5)
      const excitability = pulseWave.pow(mix(float(4.2), float(1.9), near)).mul(near.mul(0.85).add(0.35))
      const canalColor = mix(color(hsl.integer(262.9, 100, 45.3)), color(hsl.integer(167, 100, 86.8)), pulseWave)
// Suspended glowing photocyte organelles (beads) inside the gelatinous mesoglea
      const organelle = beads(qWarped.mul(15 + index * 5), index * 7.1 + 1.3)
      const organellePulse = loopPhase.mul(2).add(organelle.random.x.mul(TAU)).sin().mul(0.5).add(0.5).pow(3)
      const organelleColor = mix(color(hsl.integer(217, 100, 78)), color(hsl.integer(153.3, 100, 85.9)), organelle.random.y)
      const layerWeight = [0.38, 0.25, 0.16][index]
      internalGlow = internalGlow
        .add(canalColor.mul(canalSoft.mul(0.65).add(canalCore)).mul(radialEnvelope).mul(excitability.mul(1.35).add(0.2)).mul(layerWeight))
        .add(organelleColor.mul(organelle.mask).mul(organellePulse.mul(1.45).add(0.35)).mul(near.mul(0.75).add(0.25)).mul(layerWeight * 1.4))
    }
// Meridional sub-comb gastrovascular canal directly beneath each of the 8 comb rows (with soft volumetric halo into surrounding tissue)
    const meridionalCore = rowLocalY.abs().smoothstep(0.025, float(0.068).add(fpY)).oneMinus()
    const meridionalHalo = rowLocalY.abs().smoothstep(0.04, 0.26).oneMinus().pow(2)
    const canalPulse = tube.x.mul(TAU * 3).sub(loopPhase.mul(2)).add(rowId.mul(0.9)).sin().mul(0.5).add(0.5).pow(2.4)
    const meridionalGlow = mix(color(hsl.integer(263, 100, 45)), color(hsl.integer(160, 100, 86)), canalPulse).mul(meridionalCore.add(meridionalHalo.mul(0.42))).mul(near.mul(0.65).add(0.35))
// Hydrated colloidal bathypelagic mesoglea body color + shingled iridescent comb rows
    const gelBody = mix(color(hsl.integer(251, 76, 14)), color(hsl.integer(246, 79, 29)), rib.mul(0.55).add(grazing.mul(0.45)))
    const shadedRainbow = ciliaRainbow.add(shingleLip.mul(0.38)).mul(overlapShadow.mul(-0.84).add(1)).mul(cushionGroove.mul(-0.32).add(1))
    this.colorNode = mix(gelBody, shadedRainbow.mul(0.95), rowBand.mul(0.88))
    this.metalnessNode = rowBand.mul(0.56)
// Colloidal turbid mesoglea: softer roughness (~0.17) and zero clearcoat on bare gel so it looks like hydrated water-gel rather than hard glass
    this.transmissionNode = mix(float(0.84), float(0.28), rowBand)
    this.thicknessNode = mix(float(0.92), float(0.44), rib)
    this.ior = 1.338
    this.dispersion = 0.18
    this.attenuationColor.set(hsl.integer(244, 91, 33))
    this.attenuationDistance = 0.55
    this.roughnessNode = mix(float(0.175), float(0.085).sub(shingleLip.mul(0.04)), rowBand).clamp(0.04, 0.24)
    this.sheen = 0.72
    this.sheenColor.set(hsl.integer(224, 100, 77.8))
    this.sheenRoughness = 0.52
    this.clearcoatNode = rowBand.mul(0.65)
    this.clearcoatRoughness = 0.16
// Longitudinal anisotropy along the ciliary comb hairs
    this.anisotropyNode = vec2(1, 0).mul(rowBand.mul(0.75))
// Strong thin-film optical interference across the comb plates and delicate rainbow sheen on the gel skin
    this.iridescenceNode = mix(grazing.mul(0.38), float(0.98), rowBand)
    this.iridescenceIOR = 1.66
    this.iridescenceThicknessNode = metachronalPhase.sin().mul(160).add(facing.mul(220)).add(330)
// Micro-relief height: raised comb-row ridges, pronounced overlapping sawtooth shingle steps, cushion groove and macrocilia hairs
    const microHeight = rowBand.mul(0.0018)
      .sub(cushionGroove.mul(0.0009))
      .add(shingleHeight.mul(rowBand).mul(plateResolution).mul(0.0052))
      .add(ciliaFringe.mul(rowBand).mul(0.0038))
    this.normalNode = detailNormal(macroNormal, microHeight, 1.15)
// Soft diffuse abyssal lighting environment (broad soft light domes prevent hard acrylic specular lines)
    const abyssSky = panelSky({
      zenith: [0.03, 0.11, 0.2],
      horizon: [0.015, 0.05, 0.11],
      nadir: [0.005, 0.015, 0.04],
      glow: {
        color: [0.06, 0.58, 0.88],
        intensity: 0.42,
        width: 0.16,
      },
      panels: [{
        azimuth: 0.4,
        elevation: 0.7,
        halfWidth: 0.68,
        halfHeight: 0.36,
        color: [0.3, 0.82, 1],
        intensity: 3.2,
        softness: 0.32,
      }, {
        azimuth: -1.25,
        elevation: 0.38,
        halfWidth: 0.22,
        halfHeight: 0.62,
        color: [0.16, 0.9, 0.78],
        intensity: 3.6,
        softness: 0.28,
      }, {
        azimuth: 2.15,
        elevation: 0.45,
        halfWidth: 0.46,
        halfHeight: 0.2,
        color: [0.52, 0.35, 1],
        intensity: 3.1,
        softness: 0.28,
      }],
    })
    this.envNode = proceduralEnvironment(abyssSky)
// Emissive combination: overlapping shingled rainbow diffraction + meridional & radial canals + turbid Tyndall colloidal scatter
    const cteneFlash = shadedRainbow.mul(cteneMask).mul(strokeWave.pow(1.5).mul(1.25).add(0.45)).mul(intimate.mul(0.35).add(0.78))
    const tyndallScatter = mix(color(hsl.integer(248, 87, 23)), color(hsl.integer(237, 89, 39)), facing.oneMinus().pow(1.4)).mul(0.38).mul(rowBand.oneMinus())
    const membraneRim = mix(color(hsl.integer(217, 100, 78)), color(hsl.integer(164, 100, 86.84)), view.y.mul(0.5).add(0.5)).mul(grazing.pow(2.2)).mul(0.36)
    this.emissiveNode = cteneFlash
      .add(meridionalGlow.mul(0.68))
      .add(internalGlow)
      .add(tyndallScatter)
      .add(membraneRim)
  }
}
