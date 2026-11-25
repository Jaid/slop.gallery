import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, normalViewGeometry, positionGeometry, time, vec2, vec3} from 'three/tsl'

import {beads} from '../../lib/beads.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A drop of the Oligocene, forty million years thick. Honey and cognac resin hold ferns, winged specks, air breaths and dust at three suspended depths, and the inclusions swim as the viewer circles. Internal fractures flare like captured lightning at grazing angles, and when the low sun finds the stone from behind it burns like a struck coal. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const p = positionGeometry
    const {view, facing, grazing, rim, near, intimate} = viewerFrame()
    const sunDir = vec3(time.mul(Math.PI).sin().mul(0.3).add(0.15), 0.85, 0.45).normalize()
    const cloud = mx_fractal_noise_float(p.mul(3), 4, 2, 0.5).mul(0.5).add(0.5)
    const drift = vec3(time.mul(Math.PI).sin(), time.mul(Math.PI * 2).sin(), time.mul(Math.PI * 3).sin()).mul(0.02)
// Inclusions sit at their own depths behind the surface and parallax apart while walking.
    const deep = (depth: number) => p.sub(view.mul(depth)).add(drift.mul(depth))
    const project = (point: Node<'vec3'>, axis: number) => (axis === 0 ? vec2(point.dot(vec3(1, 0.3, 0.2)), point.dot(vec3(0.2, 1, 0.1))) : vec2(point.dot(vec3(0.3, 1, 0.4)), point.dot(vec3(-0.5, 0.2, 1))))
    const frond = (point: Node<'vec3'>, axis: number, scale: number) => {
      const q = project(point, axis).mul(scale)
      const spine = q.y.sub(q.x.mul(3).sin().mul(0.2))
      const taper = q.x.abs().smoothstep(0.35, 0.55).oneMinus()
      const width = spine.abs().smoothstep(0.2, 0.3).oneMinus()
      const barb = filteredRibbon(spine.mul(14).add(q.x.mul(26)).sin(), 0.3).mul(width)
      const stem = filteredRibbon(spine, 0.015)
      return stem.add(barb.mul(0.75)).mul(taper)
    }
    const fernDeep = frond(deep(0.34), 0, 1)
    const fernMid = frond(deep(0.22), 1, 1.4)
    const inclusion = fernDeep.add(fernMid.mul(0.85)).clamp()
    const midgeQ = project(deep(0.26), 1).sub(vec2(0.12, 0.04)).mul(3.2)
    const midgeBody = filteredRibbon(midgeQ.x.mul(midgeQ.x).add(midgeQ.y.mul(midgeQ.y).mul(3)).sub(0.02), 0.02)
    const midgeWing = filteredRibbon(midgeQ.y.sub(midgeQ.x.mul(0.55)), 0.03).add(filteredRibbon(midgeQ.y.add(midgeQ.x.mul(0.55)), 0.03)).mul(midgeQ.x.abs().smoothstep(0.3, 0.15).oneMinus())
    const midge = midgeBody.add(midgeWing.mul(0.5)).mul(0.9)
    const bubble = beads(deep(0.18).mul(13), 0.5)
    const bubbleRing = bubble.mask.sub(bubble.core).clamp()
    const dust = cellularPoints(deep(0.08).add(drift).mul(38), 0.015, 0.05, 0.6)
    const crackA = filteredRibbon(p.sub(view.mul(0.28)).dot(vec3(0.6, 0.7, 0.3).normalize()).sub(0.12).add(mx_noise_float(p.mul(5)).mul(0.05)), 0.012)
    const crackB = filteredRibbon(p.sub(view.mul(0.3)).dot(vec3(-0.4, 0.5, 0.8).normalize()).sub(-0.2), 0.01)
    const crack = crackA.add(crackB.mul(0.8)).clamp()
    const crackFlare = crack.mul(grazing.pow(2)).mul(1.4)
    const body = mix(color(hsl.integer(43, 86, 14)), color(hsl.integer(65, 90, 69)), facing.mul(0.5).add(cloud.mul(0.3)).add(0.08).clamp())
    const resin = mix(body, color(hsl.integer(82.2, 100, 84)), cloud.smoothstep(0.6, 0.95).mul(0.45))
    const shade = inclusion.mul(0.95).add(midge.mul(0.85)).add(bubble.core.mul(0.3)).clamp()
    const sunBehind = normalLocal.dot(sunDir).negate().smoothstep(-0.2, 0.5)
    const through = sunBehind.mul(view.dot(sunDir).negate().smoothstep(0, 0.85))
    const fire = through.mul(1.9).add(0.3).mul(cloud.mul(0.5).add(0.6)).mul(intimate.mul(0.35).add(0.75))
    const relief = cloud.mul(0.2).sub(crack.mul(0.4)).sub(bubble.cap.mul(bubble.mask).mul(0.3)).add(dust.mul(0.25)).mul(intimate.add(near).clamp())
    this.colorNode = mix(resin, mix(color(hsl.integer(43, 77, 15)), color(hsl.integer(57, 73, 8)), midge), shade)
    this.metalness = 0
    this.roughnessNode = float(0.1).add(bubbleRing.mul(0.08)).add(crack.mul(0.12))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.ior = 1.55
    this.aoNode = float(1).sub(shade.mul(0.35))
    this.normalNode = proceduralNormal(relief, 0.0018)
    this.emissiveNode = color(hsl.integer(64, 100, 74)).mul(fire).mul(shade.oneMinus().mul(0.85).add(0.15))
      .add(color(hsl.integer(90, 100, 93)).mul(crackFlare))
      .add(color(hsl.integer(68, 100, 78.6)).mul(rim.pow(2.5)).mul(0.85))
      .add(color(hsl.integer(92, 100, 94.7)).mul(bubbleRing).mul(near).mul(0.5))
      .add(color(hsl.integer(78, 100, 89)).mul(glints(normalViewGeometry, 120)).mul(bubbleRing).mul(0.8))
  }
}
