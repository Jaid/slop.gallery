import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, negateOnBackSide, normalLocal, normalWorld, transformNormalToView, vec3} from 'three/tsl'

import {voronoi3} from '../../candidates/deepseek/lib/voronoi.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Six cathedral glasses, selected per pane so neighbours never repeat a hue. */
const jewel = (t: Node<'float'>) => {
  const sapphire = color(hsl.integer(262, 91, 21))
  const ruby = color(hsl.integer(19, 92, 29))
  const emerald = color(hsl.integer(159, 96, 33))
  const amber = color(hsl.integer(69, 92, 58))
  const amethyst = color(hsl.integer(303, 83, 19))
  const teal = color(hsl.integer(207, 90, 34))
  return mix(mix(mix(mix(mix(sapphire, ruby, t.step(0.17)), emerald, t.step(0.33)), amber, t.step(0.5)), amethyst, t.step(0.67)), teal, t.step(0.83))
}
/** Leaded glass wound into a knot. Each pane is a different glass, the came between them is soft metal, and a fixed cathedral sun outside the room decides which panes burn and which stay dark. Walking around the piece turns the same window into a different window. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const scale = 6.5
    const q = p.mul(scale)
    const cell = voronoi3(q)
    const footprint = q.fwidth().length().max(0.0001)
    const identity = cellNoiseVec3(cell.key)
    const identity2 = cellNoiseVec3(cell.key.add(vec3(23.1, 4.7, 11.3)))
    const resolved = footprint.smoothstep(0.14, 0.8).oneMinus()
// Lead came: a narrow rounded bead that follows every seam and stands proud of the glass.
    const cameWidth = footprint.mul(0.55).max(0.045)
    const pane = cell.edge.smoothstep(0, cameWidth)
    const bead = cell.edge.smoothstep(cameWidth.mul(0.55), cameWidth)
// The glass itself: rolled, slightly uneven, with bubbles trapped in the melt.
    const ripple = mx_fractal_noise_float(p.mul(26), 3, 2.2, 0.5).mul(0.5).add(0.5)
    const bubble = mx_fractal_noise_float(p.mul(62), 2, 2, 0.5).abs().sub(0.06)
    const bubbleLine = bubble.smoothstep(0, footprint.mul(2.4).add(0.01)).oneMinus().mul(near).mul(0.7)
    const glassColor = jewel(identity.x)
    const paneTint = mix(glassColor, color(hsl.integer(92, 52, 94.7)), identity2.y.mul(0.1))
// One pane in twelve is a plain quarried roundel rather than a coloured light.
    const roundel = identity2.z.smoothstep(0.9, 0.94)
    this.colorNode = mix(mix(color(hsl.integer(258, 12, 6)), paneTint.mul(0.9), roundel.oneMinus()), color(hsl.integer(249, 12, 7)), pane.oneMinus())
    this.metalnessNode = pane.oneMinus().mul(0.25)
    this.roughnessNode = mix(mix(float(0.88), float(0.07), pane).add(bubbleLine.mul(0.1)), float(0.16), roundel)
    this.ior = 1.52
    this.transmissionNode = pane.mul(0.72).mul(roundel.oneMinus().mul(0.25).add(0.75))
    this.thicknessNode = pane.mul(0.3)
    this.attenuationColor.set(hsl.integer(58, 70, 37))
    this.attenuationDistance = 0.9
    this.clearcoatNode = pane.mul(0.32)
    this.clearcoatRoughness = 0.1
// The pane normal leans in slightly toward the came, and the glass is not perfectly flat.
    const lean = normalLocal.normalize().add(cell.offset.normalize().mul(0.28)).normalize()
    const glassNormal = lean.add(vec3(ripple.sub(0.5), bubbleLine.mul(0.5), 0).mul(0.06)).normalize()
    this.normalNode = negateOnBackSide(transformNormalToView(glassNormal))
    this.clearcoatNormalNode = this.normalNode
// ---------------------------------------------------------------
// The sun. It never moves; you do. Panes whose normal faces it
// blaze, the ones turned away fall into deep bottle-green shadow.
// ---------------------------------------------------------------
    const sun = vec3(-0.36, 0.82, -0.44).normalize()
    const lit = normalWorld.dot(sun).clamp()
    const backlight = lit.pow(1.8).mul(2.2).add(lit.mul(0.3))
    const glow = paneTint.mul(backlight).mul(pane).mul(near.mul(0.3).add(0.6)).mul(4.5)
// Sunlight raking the lead bead, plus a cool bounce from the nave floor.
    this.emissiveNode = glow
      .add(color(hsl.integer(95, 38, 88.6)).mul(bead).mul(pane.oneMinus()).mul(facing.pow(3)).mul(0.12))
      .add(color(hsl.integer(261, 36, 91)).mul(pane.oneMinus()).mul(facing.pow(4)).mul(0.16))
      .add(color(hsl.integer(264, 35, 86)).mul(grazing.pow(3)).mul(intimate.mul(0.5).add(0.2)).mul(0.08))
      .add(paneTint.mul(bubbleLine).mul(backlight).mul(resolved).mul(0.6))
  }
}
