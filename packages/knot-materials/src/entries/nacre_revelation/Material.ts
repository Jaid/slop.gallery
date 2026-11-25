import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, mx_fractal_noise_float, mx_noise_float, negateOnBackSide, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const nacreRelief = (tube: Node<'vec2'>) => {
  const flow = tube.x.mul(TAU * 3.1).add(tube.y.mul(3.4)).add(time.mul(0.018))
  return flow.sin().mul(0.0018).add(flow.mul(1.9).sin().mul(0.0007))
}
const nacrePosition = Fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  return position.add(normal.mul(nacreRelief(tube)))
})

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.12)
    this.name = knotData.id
    this.envMapIntensity = 1.12
    const tube = uv()
    const relief = nacreRelief(tube)
    const epsilon = 0.0001
    const du = nacrePosition(tube.add(vec2(epsilon, 0))).sub(nacrePosition(tube.sub(vec2(epsilon, 0))))
    const dv = nacrePosition(tube.add(vec2(0, epsilon))).sub(nacrePosition(tube.sub(vec2(0, epsilon))))
    const formNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.positionNode = nacrePosition(tube)
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const deepP = p.sub(view.mul(0.032))
    const broadWarp = mx_fractal_noise_float(p.mul(1.8).add(vec3(time.mul(0.012), 0, time.mul(-0.009))), 3, 2.04, 0.52)
    const deepWarp = mx_fractal_noise_float(deepP.mul(2.4).add(8.7), 2, 2.08, 0.5)
    const growth = p.x.mul(17.2).add(p.y.mul(8.4)).sub(p.z.mul(6.3)).add(broadWarp.mul(2.1))
    const deepGrowth = deepP.x.mul(13.4).add(deepP.y.mul(9.1)).add(deepP.z.mul(5.7)).add(deepWarp.mul(1.7))
    const growthBand = growth.sin().mul(0.5).add(0.5)
    const deepBand = deepGrowth.sin().mul(0.5).add(0.5)
    const platelets = mx_noise_float(deepP.mul(31).add(vec3(1.3, 7.1, 3.8))).mul(0.5).add(0.5)
    const interference = spectralColor(growth.mul(0.12).add(deepGrowth.mul(0.065)).add(view.dot(vec3(0.42, 0.71, -0.56)).mul(0.46)))
    const pearl = mix(color(hsl.integer(205, 21, 77)), color(hsl.integer(79, 52, 92.6)), growthBand.mul(0.52).add(0.22))
    this.metalness = 0.08
    this.colorNode = mix(pearl, interference.mul(0.68), grazing.mul(0.42).add(deepBand.mul(0.2)).add(0.2))
    this.iridescence = 1
    this.iridescenceIOR = 1.31
    this.iridescenceThicknessNode = growth.mul(30).add(deepGrowth.mul(20)).add(view.dot(vec3(-0.4, 0.2, 0.89)).mul(110)).add(280)
    this.sheen = 0.32
    this.sheenColor.set(hsl.integer(354, 100, 94))
    this.sheenRoughness = 0.22
    this.anisotropy = 0.28
    this.anisotropyRotation = Math.PI / 2
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.045).add(platelets.mul(0.035))
    this.normalNode = negateOnBackSide(formNormal)
    const micro = mx_fractal_noise_float(deepP.mul(74).add(vec3(2.1, 4.4, 8.2)), 2, 2.1, 0.48).mul(0.5).add(0.5)
    const microFootprint = deepP.mul(74).fwidth().length().max(0.001)
    const microDetail = micro.mul(microFootprint.smoothstep(0.18, 0.62).oneMinus())
    this.clearcoatNormalNode = proceduralNormal(growthBand.mul(0.0006).add(platelets.mul(0.00035)).add(microDetail.mul(0.00012)).add(relief), 0.85)
    this.emissiveNode = interference.mul(grazing.pow(2.2)).mul(0.075)
      .add(color(hsl.integer(79, 100, 95.5)).mul(platelets).mul(facing.pow(4)).mul(near.mul(0.35).add(0.08)))
      .add(color(hsl.integer(221, 100, 90.7)).mul(growthBand).mul(intimate.mul(0.025)))
  }
}
