import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Bismuth crystal: sharp stepped terraces with rainbow oxide film. The terraces form a maze-like pattern that shifts with viewing angle. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.2)
    this.name = knotData.id
    const {view, facing, grazing, near, intimate} = viewerFrame()
    const p = positionGeometry
    // Stepped terrace field — quantized noise creates flat plateaus with sharp edges
    const terraceField = mx_noise_float(p.mul(7)).mul(0.5).add(0.5)
    // Quantize into discrete steps (bismuth's characteristic staircase).
    const numSteps = 8
    const stepPhase = terraceField.mul(numSteps)
    const stepped = stepPhase.floor().div(numSteps)
    const stepFraction = stepPhase.fract()
    const stepFootprint = stepPhase.fwidth().max(0.0001)
    const stepResolved = stepFootprint.smoothstep(0.65, 1.35).oneMinus()
    const stepBlendWidth = stepFootprint.mul(0.75).max(0.015).min(0.48)
    const stepBlend = stepFraction.smoothstep(stepBlendWidth.oneMinus(), 1)
    const filteredStepped = mix(
      terraceField,
      stepPhase.floor().add(stepBlend).div(numSteps),
      stepResolved,
    )
    // Keep terrace edges at least one pixel wide, then retire them once unresolved.
    const edgeWidth = 0.06
    const stepEdgeWidth = stepFootprint.mul(0.75).max(edgeWidth).min(0.48)
    const stepInterior = stepFraction.smoothstep(0, stepEdgeWidth)
      .mul(stepFraction.smoothstep(stepEdgeWidth.oneMinus(), 1).oneMinus())
    const stepEdge = stepInterior.mul(stepResolved)
    // Secondary finer terracing for detail at close range.
    const fineField = mx_noise_float(p.mul(18).add(13.7)).mul(0.5).add(0.5)
    const finePhase = fineField.mul(numSteps * 2)
    const fineStepped = finePhase.floor().div(numSteps * 2)
    const fineStepFraction = finePhase.fract()
    const fineFootprint = finePhase.fwidth().max(0.0001)
    const fineResolved = fineFootprint.smoothstep(0.55, 1.2).oneMinus()
    const fineBlendWidth = fineFootprint.mul(0.75).max(0.012).min(0.48)
    const fineBlend = fineStepFraction.smoothstep(fineBlendWidth.oneMinus(), 1)
    const filteredFineStepped = mix(
      fineField,
      finePhase.floor().add(fineBlend).div(numSteps * 2),
      fineResolved,
    )
    const fineEdgeWidth = fineFootprint.mul(0.75).max(edgeWidth * 0.7).min(0.48)
    const fineInterior = fineStepFraction.smoothstep(0, fineEdgeWidth)
      .mul(fineStepFraction.smoothstep(fineEdgeWidth.oneMinus(), 1).oneMinus())
    const fineEdge = fineInterior.mul(fineResolved).mul(near)
    // Displacement stays vertex-safe. Fragment shading gets derivative-filtered terraces.
    const height = stepped.mul(0.8).add(fineStepped.mul(0.2).mul(near))
    const shadedHeight = filteredStepped.mul(0.8).add(filteredFineStepped.mul(0.2).mul(near))
    const terraceHeight = height.mul(0.035)
    const shadedTerraceHeight = shadedHeight.mul(0.035)
    // Extreme iridescence — bismuth's signature rainbow oxide coating
    const iriPhase = shadedHeight.mul(12)
      .add(view.dot(vec3(0.7, 0.3, 0.6).normalize()).mul(8))
      .add(facing.mul(4))
      .add(time.mul(0.05))
    const iriColor = spectralColor(iriPhase)
    // Oxide mask — not all surfaces equally oxidized
    const oxideMask = terraceField.smoothstep(0.15, 0.55)
    // Bismuth base metal color
    const metalBase = mix(
      color(hsl.integer(74, 10, 49)),
      color(hsl.integer(78, 17, 84)),
      stepEdge.mul(0.5).add(fineEdge.mul(0.3)),
    )
    // Color: blend metal base with iridescent oxide
    this.colorNode = mix(
      metalBase,
      iriColor.mul(oxideMask.mul(0.8).add(0.2)),
      oxideMask.mul(0.7).add(grazing.mul(0.2)).clamp(),
    )
    this.metalness = 1
    this.roughnessNode = float(0.08)
      .add(stepEdge.oneMinus().mul(0.18))
      .clamp(0.04, 0.35)
    // Strong native iridescence
    this.iridescence = 1
    this.iridescenceIOR = 2.4
    this.iridescenceThicknessNode = shadedHeight.mul(380).add(grazing.mul(120)).add(180)
    this.clearcoat = 0.6
    this.clearcoatRoughness = 0.04
    // Normals — flat terrace faces with anti-aliased step edges
    this.normalNode = proceduralNormal(shadedTerraceHeight, 1.2)
    // Displacement — actual stepped relief
    this.positionNode = positionGeometry.add(normalLocal.mul(terraceHeight))
    // Emissive — specular fire along edges
    const edgeHighlight = stepEdge.oneMinus().mul(fineEdge.oneMinus()).mul(stepResolved)
    const edgeGlow = edgeHighlight.mul(facing.pow(3)).mul(near)
    const spectralFire = grazing.pow(5).mul(iriColor)
    this.emissiveNode = iriColor.mul(edgeGlow).mul(0.4)
      .add(spectralFire.mul(0.25))
      .add(iriColor.mul(intimate).mul(edgeHighlight).mul(0.1))
  }
}
