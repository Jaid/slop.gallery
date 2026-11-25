import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_worley_noise_float, time, vec3} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Living pupa - translucent skin, vein network, slow pulse + heartbeat */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, grazing, rim, near} = viewerFrame()
    const pulse = time.mul(0.9).sin().mul(0.5).add(0.5)
    const heartbeat = time.mul(1.7).sin().mul(0.5).add(0.5).pow(6)
    const organic = p.mul(2.2)
    const worley = mx_worley_noise_float(organic.add(vec3(time.mul(0.03), float(0), float(0))))
    const worley2 = mx_worley_noise_float(organic.mul(1.7).add(vec3(2.3, 1.1, 4.5)))
    const veinField = worley.oneMinus().pow(2.5)
    const veinMask = veinField.smoothstep(0.55, 0.82)
    const fineVein = opticalLine(worley2.sub(0.5), 0.04).mul(0.8)
    const membrane = mx_noise_float(p.mul(1.5)).mul(0.3).add(0.7)
    const skinBase = mix(color(hsl.integer(92, 37, 89)), color(hsl.integer(81, 34, 81)), membrane)
    const bloodTint = mix(color(hsl.integer(36, 100, 71.5)), color(hsl.integer(21, 100, 59)), heartbeat)
    this.colorNode = mix(skinBase, color(hsl.integer(83, 48, 92)), veinMask.mul(0.15).oneMinus())
    this.transmission = 0.68
    this.thickness = 0.45
    this.ior = 1.38
    this.attenuationColor.set(hsl.integer(79, 100, 93.4))
    this.attenuationDistance = 0.35
    this.roughnessNode = float(0.38).sub(veinMask.mul(0.15)).add(grazing.mul(0.12))
    this.metalness = 0
    this.clearcoat = 0.35
    this.clearcoatRoughness = 0.28
    this.normalNode = liquidNormal(near.mul(0.3).add(0.2), 0.35)
      .add(proceduralNormal(veinMask.mul(0.7).add(fineVein.mul(0.5)), 0.001))
    this.emissiveNode = bloodTint.mul(veinMask).mul(pulse.mul(0.4).add(0.4)).mul(0.6)
      .add(color(hsl.integer(51, 99, 74)).mul(fineVein).mul(heartbeat).mul(0.9))
      .add(color(hsl.integer(159, 99, 92.2)).mul(rim.pow(2).mul(0.12)))
    this.envMapIntensity = 0.35
  }
}
