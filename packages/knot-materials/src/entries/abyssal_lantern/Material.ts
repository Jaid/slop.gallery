import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, time, uv, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A translucent deep-sea animal in knotted form. A luminous pulse travels endlessly along its tube, violet organs drift at two parallax depths inside the bell, and its skin ripples like water whenever you lean close. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    // Breathing is derivative-free so it can run in the vertex stage.
    const travel = tube.x.mul(Math.PI * 12).sub(time.mul(Math.PI * 2))
    const pulseRaw = travel.sin().mul(0.5).add(0.5)
    const swell = pulseRaw.pow(3).mul(0.009).add(mx_noise_float(p.mul(5)).mul(0.0025)).add(0.004)
    this.positionNode = p.add(normalLocal.normalize().mul(swell))
    // The same traveling wave, read again for light: three crests chase each other around the knot.
    const pulse = pulseRaw.pow(4)
    const drift = vec3(time.mul(0.02), time.mul(-0.013), time.mul(0.017))
    const organsNear = cellularPoints(p.sub(view.mul(0.09)).add(drift).mul(23), 0.03, 0.19, 0.55)
    const organsDeep = cellularPoints(p.sub(view.mul(0.19)).sub(drift).mul(15), 0.04, 0.22, 0.62)
    const membrane = mx_noise_float(p.mul(9).add(drift.mul(3))).mul(0.5).add(0.5)
    const bell = mix(color(hsl.integer(229, 80, 13)), color(hsl.integer(214, 78, 54)), facing.mul(0.55).add(membrane.mul(0.3)).clamp())
    this.colorNode = mix(bell, color(hsl.integer(334, 67, 34)), organsDeep.mul(0.35))
    this.transmission = 0.74
    this.thickness = 0.55
    this.ior = 1.38
    this.dispersion = 0.22
    this.attenuationColor.set(hsl.integer(183, 86, 68))
    this.attenuationDistance = 0.85
    this.metalness = 0
    this.roughnessNode = float(0.14).sub(pulse.mul(0.05)).add(organsNear.mul(0.08)).clamp(0.05, 0.3)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.08
    this.iridescence = 0.55
    this.iridescenceIOR = 1.34
    this.iridescenceThicknessNode = facing.mul(220).add(180)
    this.normalNode = liquidNormal(near.mul(0.85).add(0.25), 0.75)
    this.emissiveNode = color(hsl.integer(186, 92, 81.5))
      .mul(pulse)
      .mul(near.mul(0.75).add(0.3))
      .mul(0.85)
      .add(color(hsl.integer(338, 100, 67)).mul(organsNear).mul(intimate.mul(0.9).add(0.25)).mul(1.6))
      .add(color(hsl.integer(291, 100, 55)).mul(organsDeep).mul(near.mul(0.6).add(0.3)).mul(1.1))
      .add(color(hsl.integer(266, 100, 48.5)).mul(grazing.pow(3)).mul(0.28))
  }
}
