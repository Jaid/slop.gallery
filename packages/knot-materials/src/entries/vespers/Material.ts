import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, exp, float, Fn, max, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, positionViewDirection, sin, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {bumpNormal} from '../../candidates/deepseek/lib/bumpNormal.ts'
import {voronoiSurface} from '../../candidates/deepseek/lib/voronoiSurface.ts'
import {beads} from '../../lib/beads.ts'
import {glints} from '../../lib/glints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const period = vec2(56, 7)
/** Jewels are sampled as a discrete palette, not as a rainbow: each pane commits to one glass. */
function jewelPalette(t: Node<'float'>) {
  const p = t.fract()
  let c = mix(color(hsl.integer(266, 93.5, 21)), color(hsl.integer(13, 88, 27.3)), p.smoothstep(0, 0.2))
  c = mix(c, color(hsl.integer(157, 97, 32)), p.smoothstep(0.2, 0.4))
  c = mix(c, color(hsl.integer(62, 92, 51.4)), p.smoothstep(0.4, 0.6))
  c = mix(c, color(hsl.integer(299, 84, 23)), p.smoothstep(0.6, 0.8))
  c = mix(c, color(hsl.integer(213, 93, 33)), p.smoothstep(0.8, 1))
  return c
}
/** Hand-blown panes bow outward; the lead is added as a crisp shading relief in the fragment. */
const panePosition = Fn(([tube]: [Node<'vec2'>]) => {
  const {position: p, normal} = knotFrame(tube)
  const warp = mx_noise_vec3(p.mul(2.2).add(vec3(3.1, 8.7, 2.4))).xy.mul(0.35)
  const cells = voronoiSurface(tube.mul(period).add(warp), period, 31.2)
  const dome = cells.edge.smoothstep(0, 0.24).mul(cells.random.z.mul(0.0021).add(0.0014))
  const sway = mx_noise_float(p.mul(3.4).add(vec3(0.8, 2.6, 7.9))).mul(0.0009)
  return p.add(normal.mul(dome.add(sway)))
})

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const tube = uv()
    this.positionNode = panePosition(tube)
    const epsilon = 0.0004
    const du = panePosition(tube.add(vec2(epsilon, 0))).sub(panePosition(tube.sub(vec2(epsilon, 0))))
    const dv = panePosition(tube.add(vec2(0, epsilon))).sub(panePosition(tube.sub(vec2(0, epsilon))))
    const surfaceNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    const {p, grazing, near} = viewerFrame()
    const warp = mx_noise_vec3(p.mul(2.2).add(vec3(3.1, 8.7, 2.4))).xy.mul(0.35)
    const cells = voronoiSurface(tube.mul(period).add(warp), period, 31.2)
    const edge = cells.edge.toVar()
    const aa = edge.fwidth().max(0.001)
    const junction = cells.d3.sub(cells.d2).smoothstep(0, 0.07).oneMinus()
    const leadWidth = float(0.046).add(junction.mul(0.02))
    const lead = edge.smoothstep(leadWidth, leadWidth.add(aa)).oneMinus().mul(0.995)
    const pane = lead.oneMinus()
    const innerShadow = edge.smoothstep(leadWidth, leadWidth.add(0.085)).oneMinus().mul(pane).mul(0.52)
// Pane-local polar coordinates let each light paint its own tiny rose window.
    const local = tube.mul(period).add(warp).sub(cells.cell)
    const centre = cells.random.xy.mul(0.8).add(0.1)
    const radial = local.sub(centre).add(vec2(0.0001))
    const radius = radial.length()
    const angle = atan(radial.y, radial.x)
    const interior = edge.smoothstep(0.06, 0.22)
    const paintGate = cells.random.z.smoothstep(0.38, 0.58)
    const petals = sin(angle.mul(cells.random.y.smoothstep(0.4, 0.6).mul(4).add(5)).add(cells.random.x.mul(TAU))).max(0).pow(8)
    const rings = sin(radius.mul(38).add(mx_noise_float(p.mul(18).add(vec3(1.7, 4.2, 8.1))).mul(2.4))).max(0).pow(10)
    const grisaille = petals.mul(0.52).add(rings.mul(0.22)).mul(interior).mul(paintGate).clamp()
    const paneColor = jewelPalette(cells.random.x)
    const glassShade = mx_fractal_noise_float(p.mul(16).add(cells.random.mul(9.3)), 3, 2.02, 0.52).mul(0.5).add(0.5)
    const paneColorShaded = mix(paneColor.mul(0.62), paneColor.mul(1.22), glassShade.smoothstep(0.2, 0.8))
// Gold leaf borders and medallions turn a few panes into reliquaries.
    const goldBorder = max(float(0), exp(edge.sub(leadWidth.add(0.06)).pow2().mul(-4200))).mul(cells.random.y.smoothstep(0.52, 0.66))
    const goldMedallion = max(float(0), exp(radius.sub(0.085).pow2().mul(-2600))).mul(cells.random.z.smoothstep(0.62, 0.74))
    const goldDot = radius.smoothstep(0.028, 0.042).oneMinus().mul(cells.random.y.smoothstep(0.82, 0.9))
    const goldMask = max(goldBorder, max(goldMedallion, goldDot)).mul(pane).mul(interior).clamp()
    const bubble = beads(p.mul(44), 3.7)
    const bubbles = bubble.mask.mul(pane).mul(near).mul(0.8)
    const glassColor = mix(paneColorShaded, color(hsl.integer(76, 27, 6)), grisaille.mul(0.55)).mul(innerShadow.mul(-0.45).add(1))
      .add(color(hsl.integer(252, 100, 91.5)).mul(bubbles.mul(0.18)))
    const goldColor = mix(color(hsl.integer(64, 94, 46)), color(hsl.integer(90, 100, 92)), glassShade)
    const leadColor = mix(color(hsl.integer(0, 0, 3)), color(hsl.integer(71, 27, 21)), junction.mul(0.55))
    const body = mix(mix(glassColor, goldColor, goldMask), leadColor, lead)
    this.colorNode = body
    this.metalnessNode = max(goldMask.mul(0.95), lead.mul(0.4))
    this.roughnessNode = mix(mix(float(0.055), float(0.18), goldMask), float(0.44), lead)
    this.ior = 1.52
    this.clearcoatNode = pane.mul(goldMask.oneMinus()).mul(0.9)
    this.clearcoatRoughnessNode = float(0.022).add(glassShade.mul(0.025))
// Lead cames are rounded bars; the glass has its own faint waviness, bubbles and painted relief.
    const leadHeight = edge.div(leadWidth).pow2().oneMinus().max(0).sqrt().mul(junction.mul(0.0011).add(0.0013))
    const leadBevel = max(float(0), exp(edge.sub(leadWidth).pow2().mul(-9000))).mul(0.00055)
    const goldHeight = goldMask.mul(0.00055)
    const glassWave = mx_noise_float(p.mul(27).add(vec3(5.4, 1.2, 8.6))).mul(0.00022)
    const paintRelief = grisaille.mul(-0.00018)
    const bubbleRelief = bubble.cap.mul(near).mul(0.00042)
    const detailHeight = leadHeight.add(leadBevel).add(goldHeight).add(glassWave).add(paintRelief).add(bubbleRelief)
    const detailFade = edge.fwidth().smoothstep(0.022, 0.075).oneMinus()
    const bump = bumpNormal(detailHeight, surfaceNormal, detailFade.mul(1.15).add(0.18))
    this.normalNode = bump
    this.clearcoatNormalNode = bump
    const facing = surfaceNormal.dot(positionViewDirection).abs().clamp()
// A fixed sun behind the window: the panes that face away from it ignite as the viewer circles.
    const sunView = transformNormalToView(vec3(-0.36, 0.76, -0.54).normalize())
    const transmit = surfaceNormal.dot(sunView.negate()).max(0)
    const paneLight = transmit.mul(0.82).add(grazing.pow(1.4).mul(0.33)).add(0.18)
    const flicker = sin(time.mul(cells.random.z.mul(1.6).add(0.55)).add(cells.random.x.mul(TAU))).mul(0.22).add(0.78)
    const procession = sin(time.mul(0.34).sub(tube.x.mul(TAU * 2)).add(cells.random.x.mul(0.6))).max(0).pow(6).mul(0.14)
    const glow = paneColorShaded.mul(paneLight.add(procession)).mul(flicker).mul(pane).mul(goldMask.oneMinus()).mul(grisaille.oneMinus().mul(0.45).add(0.55)).mul(0.92)
    const paneEdgeGlow = paneColor.mul(edge.smoothstep(leadWidth, leadWidth.add(0.12)).oneMinus().mul(pane)).mul(0.14)
    const goldGlint = glints(surfaceNormal, 85).mul(goldMask).mul(near).mul(0.65)
    this.emissiveNode = glow.add(paneEdgeGlow).add(color(hsl.integer(85, 100, 93)).mul(goldGlint))
      .add(color(hsl.integer(90, 100, 96)).mul(transmit.mul(cells.random.y.smoothstep(0.76, 0.9)).mul(pane).mul(0.16)))
      .add(paneColor.mul(grazing.pow(4)).mul(0.2))
      .add(color(hsl.integer(86, 65, 87)).mul(facing.pow(6)).mul(0.02))
  }
}
