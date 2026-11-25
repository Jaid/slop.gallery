import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentLocal, color, float, mix, mx_atan2, normalLocal, tangentLocal, time, uv, vec2, vec3} from 'three/tsl'

import {approach, disk, wave} from '../../candidates/gpt_astra/lib/exhibition/optics.ts'
import {inkLine as stroke} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Security-foil engraving with a directional, wavelength-selective diffraction response. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const tube = uv()
    const {view, grazing, objectDistance} = viewerFrame()
    const near = approach(objectDistance)
    const q = tube.mul(vec2(24, 3))
    const point = q.fract().sub(0.5)
    const aa = q.fwidth().length().max(0.0001)
    const radius = point.length().max(0.0001)
    const theta = mx_atan2(point.y, point.x.add(0.000001)) as unknown as Node<'float'>
    const rosettePhase = radius.mul(112).add(theta.mul(8).cos().mul(2.4))
    const rosette = wave(rosettePhase).smoothstep(0.4, 0.84).mul(disk(radius, 0.397, aa))
    const counter = wave(radius.mul(105).sub(theta.mul(8).cos().mul(2))).smoothstep(0.58, 0.92).mul(disk(radius, 0.397, aa))
    const rim = stroke(radius.sub(0.422), 0.006, aa)
    const rim2 = stroke(radius.sub(0.454), 0.003, aa)
    const hub = stroke(radius.sub(0.072), 0.012, aa)
    const engraving = rosette.max(counter.mul(0.65)).max(rim).max(rim2).max(hub)
    // Microscopic dash rows are area-filtered away in the distance, never left to moiré.
    const micro = wave(tube.x.mul(TAU * 768)).smoothstep(0.2, 0.6).mul(wave(tube.y.mul(TAU * 96)).smoothstep(0.3, 0.7)).mul(disk(radius, 0.466, aa).oneMinus()).mul(near)
    const orientation = tube.y.mul(TAU).add(theta.add(radius.mul(5)).mul(disk(radius, 0.42, aa)))
    const T = tangentLocal.normalize()
    const B = vec3(bitangentLocal as unknown as Node<'vec3'>).normalize()
    const grating = T.mul(orientation.cos()).add(B.mul(orientation.sin())).normalize()
    const light = vec3(-0.35, 0.8, 0.48).normalize()
    const path = view.add(light).dot(grating).abs().mul(0.92).add(time.mul(0.22).sin().mul(0.012))
    const wavelengths = vec3(0.65, 0.53, 0.46)
    const firstOrder = vec3(path).sub(wavelengths).div(0.065).pow2().negate().exp()
    const secondOrder = vec3(path.mul(0.5)).sub(wavelengths).div(0.048).pow2().negate().exp().mul(0.32)
    const spectral = firstOrder.add(secondOrder)
    const groove = engraving.mul(0.7).add(0.22)
    const silver = mix(color(hsl.integer(254, 35, 22)), color(hsl.integer(213, 15, 78)), engraving.mul(0.62).add(0.2))
    this.colorNode = mix(silver, spectral.mul(1.05).add(0.025), groove.mul(0.73)).mul(micro.mul(-0.25).add(1))
    this.metalness = 0.92
    this.roughnessNode = mix(float(0.31), float(0.2), engraving)
    this.anisotropy = 0.75
    this.anisotropyNode = vec2(orientation.cos(), orientation.sin()).mul(0.75)
    this.clearcoat = 0.8
    this.clearcoatRoughness = 0.11
    this.normalNode = proceduralNormal(engraving.mul(0.00032).sub(micro.mul(0.00009)), 0.4)
    const lit = normalLocal.dot(light).abs().mul(0.5).add(0.5)
    this.emissiveNode = spectral.mul(1.8).mul(groove).mul(lit).mul(grazing.mul(0.45).add(0.32)).mul(near.mul(0.4).add(0.65))
  }
}
