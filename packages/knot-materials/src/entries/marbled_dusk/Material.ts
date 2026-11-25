import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalViewGeometry, positionGeometry, time, vec3} from 'three/tsl'

import {bumpNormal} from '../../candidates/claude_sonnet/lib/bumpNormal.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Piecewise-smooth palette lookup over an ordered list of stops. */
const ramp = (t: Node<'float'>, stops: Array<number>) => {
  const s = t.clamp().mul(stops.length - 1)
  let out: Node<'vec3'> = vec3(color(stops[0]).r, color(stops[0]).g, color(stops[0]).b)
  for (let i = 1;i < stops.length;i++) {
    const c = color(stops[i])
    out = mix(out, vec3(c.r, c.g, c.b), s.sub(i - 1).smoothstep(0, 1))
  }
  return out
}
/** Ebru paper marbling under lacquer. Ink is floated, stirred with warping vortices, then combed: a fine dragged-comb layer joins on approach, gold size lines follow the contours, and the lacquer over the paper throws oil-slick color to a viewer at a low angle. The pigment slowly keeps flowing. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.3)
    this.name = knotData.id
    const {near, intimate, grazing, facing} = viewerFrame()
    const p = positionGeometry
    const drift = time.mul(0.018)
    const warp1 = vec3(mx_noise_float(p.mul(2).add(vec3(0, drift, 0))), mx_noise_float(p.mul(2).add(vec3(5.2, 1.3, drift))), mx_noise_float(p.mul(2).add(vec3(drift, 8.8, 2.1))))
    const stirred = p.add(warp1.mul(0.42))
    const warp2 = vec3(mx_noise_float(stirred.mul(4.1).add(3.3)), mx_noise_float(stirred.mul(4.1).add(9.1)), mx_noise_float(stirred.mul(4.1).add(1.7)))
    const swirled = stirred.add(warp2.mul(0.2))
  // Comb: a saw of displaced streaks along one direction, gaining strength as the viewer approaches.
    const combPhase = swirled.dot(vec3(11, 7, -9))
    const comb = combPhase.sin().mul(0.5).add(0.5).mul(combPhase.fwidth().smoothstep(0.9, 2.8).oneMinus())
    const combbed = swirled.add(vec3(0.03, -0.02, 0.025).mul(comb).mul(near.mul(0.7).add(0.3)))
    const field = mx_fractal_noise_float(combbed.mul(2.8), 4, 2.05, 0.5).mul(0.5).add(0.5)
    const bands = field.mul(7.5)
    const bandFoot = bands.fwidth().max(1e-4)
    const band = bands.fract()
    const bandId = bands.floor()
    const inkFade = bandFoot.smoothstep(0.35, 1.3).oneMinus()
    const stops = [hsl.integer(268, 85, 8), hsl.integer(274, 93, 20), hsl.integer(7, 90, 41.4), hsl.integer(41, 96, 61), hsl.integer(81, 85, 81), hsl.integer(187, 97, 52), hsl.integer(250, 82, 18), hsl.integer(348, 81, 27)]
    const tone = mix(float(0.5), bandId.mul(0.137).add(field.mul(0.55)).fract(), inkFade)
    const ink = ramp(tone, stops)
  // Gold size lines trace the contours of the flow.
    const goldLine = band.smoothstep(0, 0.05).oneMinus().add(band.smoothstep(0.95, 1)).mul(inkFade).clamp()
    const veined = mx_noise_float(combbed.mul(16)).mul(0.5).add(0.5)
    const gold = goldLine.mul(veined.smoothstep(0.18, 0.5)).mul(0.9)
    const paper = mx_noise_float(p.mul(120)).mul(0.5).add(0.5)
    const surface = mix(ink, color(hsl.integer(84, 73, 79)), gold)
    this.colorNode = surface.mul(paper.mul(0.1).add(0.92))
    this.metalnessNode = gold.mul(0.95)
    this.roughnessNode = float(0.2).add(gold.mul(0.12)).sub(near.mul(0.02))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.iridescence = 0.45
    this.iridescenceIOR = 1.5
    this.iridescenceThicknessNode = field.mul(240).add(260).add(comb.mul(80))
    this.sheen = 0.2
    this.sheenColor.set(hsl.integer(75, 100, 92.6))
    const height = goldLine.mul(0.0011).add(field.mul(0.0006)).add(paper.mul(0.00025).mul(near))
    const shaded = bumpNormal(normalViewGeometry.normalize(), height)
    this.normalNode = shaded
    const foil = glints(shaded.add(vec3(paper.sub(0.5), paper.mul(9.7).fract().sub(0.5), paper.mul(4.3).fract().sub(0.5)).mul(0.4)).normalize(), 110).mul(gold).mul(near.mul(0.6).add(0.25))
    this.emissiveNode = color(hsl.integer(87, 100, 91)).mul(foil).mul(0.28)
      .add(ink.mul(intimate).mul(0.05))
      .add(mix(color(hsl.integer(282, 100, 49.3)), color(hsl.integer(47, 100, 71)), field).mul(grazing.pow(2.4)).mul(0.14))
      .add(surface.mul(facing).mul(0.03))
  }
}
