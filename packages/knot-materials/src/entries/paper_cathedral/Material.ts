import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, time, uv, vec2, vec3} from 'three/tsl'

import {angle, coverage, stroke, wave} from '../../candidates/gpt_astra/lib/exhibition/fields.ts'
import {tubeRay} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Nested pierced pages. All apertures are ray-shifted before depth compositing. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.6)
    this.name = knotData.id
    const {p, intimate, grazing} = viewerFrame()
    const tube = uv()
    const modules = vec2(12, 2)
    const q = tube.mul(modules)
    const ray = tubeRay().mul(modules)
    const fibers = mx_noise_float(p.mul(vec3(290, 60, 130))).mul(0.5).add(0.5)
    let paper: Node<'vec3'> = color(hsl.integer(323, 39, 12)).rgb
    let lip: Node<'float'> = float(0)
    let height: Node<'float'> = float(0)
    let opening: Node<'float'> = float(0)
    // Back-to-front: the contour shape is repeated, but its opening contracts with depth.
    for (let i = 6; i >= 0; i--) {
      const depth = i * 0.012
      const layer = q.sub(ray.mul(depth))
      const aa = layer.fwidth().length().max(0.0001)
      const c = layer.fract().sub(0.5).mul(vec2(1.22, 1))
      const r = c.length()
      const theta = angle(c)
      const petal = theta.mul(6).cos().mul(0.035)
      const distance = r.sub(petal).sub(0.42 - i * 0.047)
      const sheet = coverage(distance.negate(), aa)
      const edge = stroke(distance, 0.005, aa)
      const shadow = distance.sub(0.047).abs().smoothstep(0, 0.035).mul(0.63).add(0.37)
      const illuminatedEdge = stroke(distance, 0.003, aa).mul(0.2)
      const tint = mix(color(hsl.integer(91, 62, 93)), color(hsl.integer(62, 51, 58)), float(i / 10))
      const page = tint.mul(shadow.add(illuminatedEdge)).mul(fibers.mul(0.055).add(0.955))
      paper = mix(paper, page, sheet)
      lip = mix(lip, edge, sheet)
      height = mix(height, float(-depth), sheet)
      if (i === 0) {
        opening = sheet.oneMinus()
      }
    }
    const grain = wave(tube.x.mul(Math.PI * 2 * 1100)).mul(intimate)
    this.colorNode = mix(paper, color(hsl.integer(75, 50, 65)), lip.mul(0.22)).mul(grain.mul(0.025).add(0.975))
    this.metalnessNode = lip.mul(0.3)
    this.roughnessNode = mix(float(0.86), float(0.46), lip)
    this.sheen = 0.3
    this.sheenColor.set(hsl.integer(69, 46, 82.6))
    this.sheenRoughness = 0.85
    // Small bump only: the depth is already communicated by occlusion and paper-edge shadows.
    this.normalNode = proceduralNormal(height.mul(0.12).add(fibers.mul(intimate).mul(0.00008)), 0.5)
    this.aoNode = opening.mul(-0.3).add(1)
    const staticPoint = q.fract().sub(0.5).mul(vec2(1.22, 1))
    const staticEdge = staticPoint.length().sub(angle(staticPoint).mul(6).cos().mul(0.035))
    const depression = staticEdge.smoothstep(0.06, 0.44).oneMinus().mul(-0.013)
    this.positionNode = p.add(normalLocal.mul(depression))
    const lantern = tube.x.mul(Math.PI * 8).sub(time.mul(0.22)).sin().mul(0.5).add(0.5)
    this.emissiveNode = color(hsl.integer(41, 80, 60)).mul(opening).mul(lantern).mul(0.09)
      .add(color(hsl.integer(82, 53, 80)).mul(grazing.pow(3)).mul(0.035))
  }
}
