import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, refractVector, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Smoked crystal. Caustic loops are drawn by the refracted view, so they swim when you circle and collapse into a hot core when you lean in. The glass itself stays dark enough for the light to read. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.04)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate, view} = viewerFrame()
    const warp = mx_noise_float(p.mul(2.2).add(time.mul(0.05)))
    const bent = refractVector.add(vec3(warp.mul(0.45), view.y.mul(0.25), warp.mul(-0.3)))
    const a = bent.dot(vec3(4.2, 1.1, 3.4)).add(time.mul(0.3))
    const b = bent.dot(vec3(-2.4, 5.2, 1.8)).sub(time.mul(0.18))
    const fold = a.sin().mul(b.sin()).abs()
    const focus = fold.pow(4).mul(8).clamp()
    const vein = a.sin().abs().oneMinus().pow(10)
    const cross = b.sin().abs().oneMinus().pow(10)
    const network = focus.add(vein.mul(0.55)).add(cross.mul(focus.add(0.2)).mul(0.4))
    const resolved = a.fwidth().max(b.fwidth()).smoothstep(2.2, 0.4)
    const glow = mix(color(hsl.integer(242, 100, 77.3)), color(hsl.integer(83, 100, 86.6)), bent.y.mul(0.5).add(0.5))
    this.colorNode = glow.mul(network.mul(0.6).add(0.15))
    this.metalness = 0
    this.roughness = 1
    this.transmission = 0.12
    this.thickness = 1.4
    this.ior = 1.55
    this.dispersionNode = float(1.1).add(intimate.mul(0.8))
    this.attenuationColor.set(hsl.integer(237, 100, 81.3))
    this.attenuationDistance = 0.35
    this.clearcoat = 0
    this.iridescenceNode = grazing.mul(0.7)
    this.iridescenceIOR = 1.33
    this.iridescenceThicknessNode = float(140).add(grazing.mul(380)).add(near.mul(80))
    this.normalNode = liquidNormal(float(0.2), 0.28)
    this.emissiveNode = glow.mul(network).mul(resolved).mul(0.8)
      .add(color(hsl.integer(91, 100, 97)).mul(focus.pow(2)).mul(resolved).mul(intimate).mul(1.1))
      .add(color(hsl.integer(231, 100, 93.4)).mul(grazing.pow(3.5)).mul(0.55))
      .add(color(hsl.integer(0, 0, 100)).mul(facing.pow(8)).mul(near).mul(0.35))
  }
}
