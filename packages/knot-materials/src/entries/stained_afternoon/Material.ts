import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_noise_vec3, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {colorRamp} from '../../candidates/deepseek/lib/colorRamp.ts'
import {voronoiCells} from '../../candidates/deepseek/lib/voronoiCells.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Leaded stained glass. Every pane was cut by hand, so no two are the same size, and each one holds a different metal oxide: cobalt, gold, copper, manganese. The lead came between them is dark and matte, and the panes themselves are lit from behind, so the knot reads as a window rather than a solid. Walk around it and the light travels from pane to pane. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const {p, view, grazing, intimate} = viewerFrame()
    const warp = mx_noise_vec3(p.mul(2.8)).mul(0.12)
    const q = p.add(warp)
    const panels = voronoiCells(q.mul(2.6))
    const paneRandom = cellNoiseVec3(panels.identity)
    const paneRandom2 = cellNoiseVec3(panels.identity.add(31.7))
// Lead came: dark, matte, a hair proud of the glass.
    const leadAA = panels.edge.fwidth().max(0.0004)
    const leadWidth = mx_noise_float(q.mul(11)).mul(0.5).add(0.5).mul(0.014).add(0.022)
    const lead = panels.edge.smoothstep(leadWidth, leadWidth.add(leadAA.mul(2.5))).oneMinus()
    const glass = lead.oneMinus()
// Six oxides, from cobalt blue to manganese violet.
    const oxide = colorRamp(paneRandom.x, [hsl.integer(264.4, 95, 27.5), hsl.integer(17, 93, 33), hsl.integer(151, 98.5, 43), hsl.integer(85, 90, 66), hsl.integer(302, 87, 30), hsl.integer(232, 93, 43)])
// The panes are lit from behind: brightest when the eye looks along the light.
    const sun = vec3(0.42, 0.46, 0.78).normalize()
    const through = view.dot(sun).negate().clamp()
    const paneBrightness = paneRandom2.y.smoothstep(0.05, 0.95).mul(1.5).add(0.25)
    const glow = oxide.mul(through.pow(1.3).mul(0.85).add(0.3)).mul(paneBrightness)
// Bubbles and rolling striations left in the glass by the blower.
    const bubbleField = mx_noise_float(q.mul(60)).mul(0.5).add(0.5)
    const bubbles = bubbleField.smoothstep(0.78, 0.86).mul(glass).mul(intimate)
    const streak = mx_noise_float(q.mul(18)).mul(0.5).add(0.5)
// The lead came is a soft dark metal, not a black line.
    const leadColor = mix(color(hsl.integer(258, 10, 8)), color(hsl.integer(264, 11, 18)), mx_noise_float(q.mul(40)).mul(0.5).add(0.5))
// The vertex stage cannot use derivatives, so the relief uses a fixed width.
    const leadRelief = panels.edge.smoothstep(leadWidth, leadWidth.add(0.004)).oneMinus()
    const bubblesRelief = bubbleField.smoothstep(0.78, 0.86).mul(leadRelief.oneMinus()).mul(intimate)
    const height = leadRelief.mul(0.0022).add(bubblesRelief.mul(0.0004))
    this.colorNode = mix(leadColor, oxide.mul(0.05), glass).add(color(hsl.integer(0, 0, 100)).mul(bubbles).mul(0.25))
    this.metalnessNode = lead.mul(0.35)
    this.roughnessNode = mix(float(0.5), float(0.42).add(streak.mul(0.06)), glass)
    this.specularIntensity = 0.25
    this.clearcoat = 0.15
    this.clearcoatRoughness = 0.1
    this.ior = 1.52
    this.normalNode = proceduralNormal(height, 1)
    this.clearcoatNormalNode = this.normalNode
// A slow drift of the daylight keeps the window alive.
    const daylight = time.mul(0.18).sin().mul(0.08).add(0.92)
    this.emissiveNode = glow.mul(glass).mul(daylight).mul(2.6).add(oxide.mul(bubbles).mul(0.6)).add(color(hsl.integer(83, 100, 93.2)).mul(lead).mul(grazing.pow(3)).mul(0.12))
    this.aoNode = glass.mul(0.1).add(0.9)
    this.positionNode = positionGeometry.add(normalLocal.mul(height))
  }
}
