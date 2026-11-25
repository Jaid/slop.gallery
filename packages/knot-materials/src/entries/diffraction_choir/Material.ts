import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalLocal, time, uv, vec2, vec3} from 'three/tsl'

import {angle, ring, stroke, wave} from '../../candidates/gpt_astra/lib/exhibition/fields.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** An engraved diffraction grating: ordered spectral fans, not rainbow-colored noise. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.05)
    this.name = knotData.id
    const {view, facing, grazing, intimate} = viewerFrame()
    const tube = uv()
    const q = tube.mul(vec2(28, 4))
    const aa = q.fwidth().length().max(0.0001)
    const c = q.fract().sub(0.5).mul(vec2(1.1, 1))
    const r = c.length()
    const theta = angle(c)
    const scallop = theta.mul(8).cos().mul(0.024)
    const scrollPhase = r.add(scallop).mul(190)
    const cut = wave(scrollPhase).mul(0.5).add(0.5)
    const frame = ring(r, 0.435, 0.008, aa)
    const hub = ring(r, 0.06, 0.005, aa)
    const spokes = stroke(theta.mul(8).sin().mul(r), 0.002, aa).mul(r.smoothstep(0.12, 0.2))
    // Each rosette has a radial groove direction; changing the camera rotates the spectral fans.
    const incident = view.x.mul(theta.cos()).add(view.y.mul(theta.sin())).add(view.z.mul(0.34))
    const order = incident.mul(8.5).add(r.mul(9)).add(time.mul(0.085))
    const spectrum = vec3(order.add(0.1).cos(), order.add(2.15).cos(), order.add(4.2).cos()).mul(0.5).add(0.5).pow(2)
    const lobe = incident.add(normalLocal.dot(view).mul(0.4)).sin().abs().pow(1.5)
    const spectralStrength = lobe.mul(facing.mul(0.35).add(0.55))
    const silver = mix(color(hsl.integer(236, 39, 15)), color(hsl.integer(226, 19, 56)), cut.mul(0.4).add(0.22))
    const chroma = spectrum.mul(vec3(0.72, 0.88, 1)).add(0.025)
    const engraving = frame.max(hub).max(spokes.mul(0.45))
    this.colorNode = mix(mix(silver, chroma, spectralStrength), color(hsl.integer(202, 10, 75)), engraving)
    this.metalness = 0.92
    this.roughnessNode = float(0.27).add(cut.mul(0.065)).sub(engraving.mul(0.08))
    this.anisotropy = 0.8
    this.anisotropyNode = vec2(theta.sin().negate(), theta.cos()).mul(0.8)
    this.clearcoat = 0.45
    this.clearcoatRoughness = 0.15
    this.iridescence = 0.7
    this.iridescenceIOR = 1.36
    this.iridescenceThicknessNode = r.mul(240).add(180)
    this.normalNode = proceduralNormal(engraving.mul(0.00045).add(cut.mul(intimate).mul(0.00006)), 0.7)
    this.emissiveNode = chroma.mul(spectralStrength).mul(0.3).mul(engraving.mul(-0.75).add(1))
      .add(color(hsl.integer(206, 58, 88)).mul(frame).mul(grazing.pow(3)).mul(0.09))
  }
}
