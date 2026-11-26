import type {Amount, CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {vec2, vec3} from 'three/tsl'

import {slopeNormal} from '#src/lib/materials/filters.ts'

import {amountNode} from '../lib/canvasSurface.ts'

/** what the silver is turned and enameled with: the material’s fields, or the proof editor’s sliders */
export type GuillocheKnobs = {
  /** how sharply the engine-turned grooves stretch the silver’s highlights across them, against what they were made with */
  engine: Amount
  /** how large the waves and grooves are against the size they were made at, which the position is divided by already */
  scale: Amount
  /** how much of the silver ground shows through the enamel, from none at 0 to all of it at 1 */
  silver: Amount
  /** how far the grooves swing in their waves, against what they were made with */
  waves: Amount
}

const tau = 2 * Math.PI
/** how far apart the grooves are cut at scale 1, in meters */
export const groovePitch = 0.0005
/** how deep a groove is cut at scale 1, in meters */
const grooveDepth = 0.000008
/** how far apart the waves run along x at scale 1, in meters, and how far a groove swings across them */
export const waveLength = 0.008
const waveHeight = 0.001
/** over how many meters up the waves’ phase swings to and fro once, and by how many turns, which folds the waves into chevrons */
const chevronSpan = 0.03
const chevronTurns = 0.25

/**
 * Translucent enamel fired over engine-turned silver, as on a guilloché case: grooves a fraction of a millimeter apart run in waves that fold into chevrons, and the silver stretches each highlight across its grooves, so bands of light run over the waves as the lamp moves, through the colors of the enamel.
 *
 * The picture is the enamel: deep where it is dark, while the silver glows through where it is light, and a glassy surface over it mirrors the room sharply. The grooves themselves tilt the normal only while they are wide enough to draw and fade into the anisotropic sheen they make from afar, which needs no resolving.
 */
export default function paintGuilloche(material: MeshPhysicalNodeMaterial, {fine, image, position}: CanvasSurface, knobs: GuillocheKnobs) {
  const waves = amountNode(knobs.waves)
  const chevron = position.y.mul(tau / chevronSpan)
  const phase = position.x.mul(tau / waveLength).add(chevron.sin().mul(chevronTurns * tau)).toVar('guillochePhase')
  const swing = waves.mul(waveHeight)
  // Every groove is a line of equal y + swing·sin(phase); its gradient points across the grooves.
  const across = vec2(phase.cos().mul(swing).mul(tau / waveLength), phase.cos().mul(swing).mul(chevron.cos().mul(chevronTurns * tau * tau / chevronSpan)).add(1)).toVar('guillocheAcross')
  const groove = position.y.add(phase.sin().mul(swing)).mul(tau / groovePitch)
  const grooveSlope = across.mul(groove.cos().mul(grooveDepth * tau / groovePitch)).mul(fine(groovePitch))
  material.colorNode = image.pow(1.1).mul(vec3(0.95, 0.93, 0.88))
  material.metalnessNode = amountNode(knobs.silver)
  material.roughness = 0.35
  // The grooves turn along the waves, so once a pixel spans a wave the silver is evenly brushed every way, which is no way at all.
  material.anisotropyNode = across.normalize().mul(amountNode(knobs.engine).mul(0.55).min(1)).mul(fine(waveLength))
  material.normalNode = slopeNormal(grooveSlope)
  material.clearcoat = 1
  material.clearcoatRoughness = 0.04
}
