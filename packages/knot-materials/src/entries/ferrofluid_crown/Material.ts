import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mx_worley_noise_float, normalViewGeometry, time, vec3} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** magnetic liquid that senses you: spikes rise toward the camera, ripples chase your steps */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 1.4
    const {p, view, cameraLocal, rim, intimate} = viewerFrame()
    const dist = cameraLocal.sub(p).length()
    const toward = dist.smoothstep(0.9, 3.2).oneMinus()
    const drift = vec3(time.mul(0.05), time.mul(-0.04), time.mul(0.03))
    const cones = mx_worley_noise_float(p.mul(9).add(drift))
    const spikes = cones.mul(1.7).oneMinus().clamp().pow(2.2)
    const spikeField = spikes.mul(toward.mul(0.9).add(0.25))
    const ripple = dist.mul(26).sub(time.mul(4)).sin().mul(dist.smoothstep(0.6, 2.4).oneMinus().mul(intimate)).mul(0.5)
    const field = spikeField.add(ripple)
    this.colorNode = color(hsl.integer(285, 15, 3))
    this.metalness = 0.65
    this.roughnessNode = float(0.32).sub(spikeField.mul(0.2)).clamp()
    this.clearcoat = 1
    this.clearcoatRoughnessNode = spikeField.mul(0.25).add(0.04)
    this.iridescence = 0.55
    this.iridescenceIOR = 1.3
    this.iridescenceThicknessNode = spikeField.mul(420).add(view.x.mul(80)).add(120)
    this.normalNode = proceduralNormal(field, 0.016)
    this.emissiveNode = spectralColor(spikeField.mul(2.5).add(view.x.mul(1.5))).mul(spikeField.pow(3)).mul(0.3)
      .add(color(hsl.integer(271, 61, 34)).mul(rim).mul(0.18))
      .add(color(hsl.integer(275, 100, 69)).mul(glints(normalViewGeometry, 50)).mul(spikeField).mul(0.5))
  }
}
