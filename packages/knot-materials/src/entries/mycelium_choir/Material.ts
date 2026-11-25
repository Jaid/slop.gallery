import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_float, positionView, time, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function choirPulse() {
  return time
    .mul(0.92)
    .add(positionView.length().mul(2.15))
    .sin()
    .mul(0.5)
    .add(0.5)
    .pow(5)
}

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
    const inner = p.sub(view.mul(0.08))
    const bark = mx_fractal_noise_float(p.mul(3.4), 4, 2.15, 0.5)
    const veinField = mx_noise_float(inner.mul(7.2).add(vec3(0, time.mul(0.04), 0)))
    const hyphae = opticalLine(veinField, 0.045)
    const hyphaeFine = opticalLine(mx_noise_float(inner.mul(18.5).add(veinField.mul(1.4))), 0.03).mul(near.mul(0.4).add(intimate))
    const nodes = cellularPoints(inner.mul(22), 0.08, 0.24, 0.3)
    const pulse = choirPulse()
    const choir = hyphae.mul(pulse.mul(0.75).add(0.25)).add(hyphaeFine.mul(0.65)).add(nodes.mul(pulse).mul(1.2))
    // Worley distances can exceed one; a negative pow base poisons transmission with NaNs.
    const fruit = mx_worley_noise_float(inner.mul(8.5)).oneMinus().clamp().pow(5).mul(intimate)
    const spores = cellularPoints(p.sub(view.mul(0.14)).mul(54), 0.025, 0.15, 0.7).mul(intimate)
    const rind = mix(color(hsl.integer(67, 17, 11)), color(hsl.integer(70, 27, 33)), bark.mul(0.5).add(0.5))
    const pale = mix(color(hsl.integer(80, 25, 74)), color(hsl.integer(78, 26, 46)), grazing)
    this.colorNode = mix(mix(rind, pale, facing.mul(0.25)), color(hsl.integer(75, 19, 16)), hyphae.mul(0.55))
    this.metalness = 0
    this.roughnessNode = bark.mul(0.18).add(hyphae.mul(-0.12)).add(0.42)
    this.clearcoat = 0.12
    this.clearcoatRoughness = 0.5
    this.sheen = 0.9
    this.sheenColor.set(hsl.integer(145, 46, 72))
    this.sheenRoughness = 0.48
    this.transmissionNode = fruit.mul(0.35).add(spores.mul(0.15))
    this.thickness = 0.25
    this.ior = 1.4
    this.attenuationColor.set(hsl.integer(155, 65, 23))
    this.attenuationDistance = 0.35
    this.normalNode = proceduralNormal(bark.mul(0.5).add(hyphae.mul(0.35)), 0.0026)
    this.emissiveNode = mix(color(hsl.integer(153, 96, 38)), color(hsl.integer(156, 100, 91)), facing)
      .mul(choir)
      .mul(1.45)
      .mul(near.mul(0.5).add(0.55))
      .add(color(hsl.integer(127, 100, 97)).mul(nodes).mul(pulse).mul(1.8))
      .add(color(hsl.integer(126, 100, 93.5)).mul(spores).mul(2.1))
      .add(color(hsl.integer(135, 70, 34)).mul(rim).mul(0.1))
  }
}
