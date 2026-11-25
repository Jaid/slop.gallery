import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalViewGeometry, positionViewDirection, tangentView, time, uv, vec2} from 'three/tsl'

import {fill, stroke, wave} from '../../candidates/gpt_astra/lib/exhibition/pattern.ts'
import {tubeRay} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Three screen-printed compositions behind optical riblets; tangent-space viewing angle selects the print. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {facing, intimate} = viewerFrame()
    const tube = uv()
    const ray = tubeRay()
    const q = tube.sub(ray.mul(0.008)).mul(vec2(12, 2))
    const local = q.fract().sub(0.5)
    const fw = q.fwidth().length().max(0.0001)
    const ivory = color(hsl.integer(92, 42, 88))
    const red = color(hsl.integer(30, 87, 46))
    const ink = color(hsl.integer(264, 63, 14))
    const jade = color(hsl.integer(195, 79, 47))
    const saffron = color(hsl.integer(80, 81, 69))
    const rA = local.sub(vec2(-0.15, 0.13)).length()
    const ringA = stroke(rA.sub(0.28), 0.085, fw)
    const discA = fill(local.sub(vec2(0.21, -0.21)).length().sub(0.135), fw)
    const barA = fill(local.x.add(local.y.mul(0.6)).sub(0.08).abs().sub(0.033), fw)
    const scoreA = wave(rA.mul(140)).smoothstep(0.1, 0.8).mul(ringA)
    const printA = mix(mix(mix(ivory, red, ringA), ink, discA.max(barA)), ivory, scoreA.mul(0.28))
    const arch = local.add(vec2(0, 0.22)).mul(vec2(1, 0.72)).length()
    const ringB = stroke(arch.sub(0.34), 0.047, fw).max(stroke(arch.sub(0.19), 0.026, fw))
    const horizon = fill(local.y.negate().sub(0.21), fw)
    const printB = mix(mix(jade, ivory, ringB), saffron, horizon)
    const rC = local.sub(vec2(0.28, 0.28)).length()
    const ribbonC = wave(rC.mul(43)).smoothstep(-0.1, 0.2)
    const discC = fill(local.add(vec2(0.22, 0.19)).length().sub(0.14), fw)
    const printC = mix(mix(ink, ivory, ribbonC.mul(0.8)), red, discC)
    const slope = positionViewDirection.dot(tangentView.normalize()).div(facing.max(0.3))
    const opticalAngle = slope.mul(2.8).add(time.mul(0.17).sin().mul(0.35))
    const weightA = opticalAngle.cos().mul(0.5).add(0.5).pow(6)
    const weightB = opticalAngle.add(TAU / 3).cos().mul(0.5).add(0.5).pow(6)
    const weightC = opticalAngle.sub(TAU / 3).cos().mul(0.5).add(0.5).pow(6)
    const image = printA.mul(weightA).add(printB.mul(weightB)).add(printC.mul(weightC))
      .div(weightA.add(weightB).add(weightC).max(0.001))
    const surfaceQ = tube.mul(vec2(12, 2))
    const edge = surfaceQ.fract().sub(0.5).abs()
    const frame = stroke(edge.x.sub(0.5), 0.008, surfaceQ.fwidth().x)
      .max(stroke(edge.y.sub(0.5), 0.008, surfaceQ.fwidth().y))
    const lens = wave(tube.x.mul(TAU * 768))
    this.colorNode = mix(image, color(hsl.integer(87, 34, 64)), frame)
    this.metalnessNode = frame.mul(0.8)
    this.roughnessNode = mix(float(0.25), float(0.28), frame)
    this.normalNode = proceduralNormal(lens.mul(intimate).mul(0.000055).add(frame.mul(0.0002)), 1)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.12
    this.clearcoatNormalNode = normalViewGeometry
    this.anisotropy = 0.4
    this.anisotropyNode = vec2(0, 0.4)
    this.emissiveNode = image.mul(0.055)
  }
}
