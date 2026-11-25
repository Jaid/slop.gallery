import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {cellGrain} from '../../candidates/gpt_sol/lib/cellGrain.ts'
import {filament} from '../../candidates/gpt_sol/lib/filament.ts'
import {viewerFrame} from '../../candidates/gpt_sol/lib/viewerFrame.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

function hyphae(q: Node<'vec3'>, seed: number) {
  const offset = vec3(seed * 4.7, seed * -7.1, seed * 2.9)
  const guide = mx_noise_float(q.mul(3.2).add(offset))
  const trunkField = mx_noise_float(q.mul(10.5)
    .add(offset.mul(1.7))
    .add(guide.mul(2.25)))
  const hairField = mx_noise_float(q.mul(24)
    .sub(offset)
    .add(trunkField.mul(1.7)))
  const territory = guide
    .abs()
    .smoothstep(0.12, 0.68)
    .oneMinus()
  const trunks = filament(trunkField.add(guide.mul(0.28)), 0.029)
  const hairs = filament(hairField.add(trunkField.mul(0.24)), 0.018)
  return trunks
    .mul(territory.mul(0.4).add(0.7))
    .add(hairs.mul(territory).mul(0.65))
    .clamp()
}

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.55
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
    const shallow = hyphae(p.sub(view.mul(0.025)), 1.2)
    const middle = hyphae(p.sub(view.mul(0.085)), 3.1)
    const deep = hyphae(p.sub(view.mul(0.15)), 5.4)
    const network = shallow
      .mul(0.75)
      .add(middle.mul(0.72))
      .add(deep.mul(grazing.mul(0.45).add(0.38)))
      .clamp()
    const inner = p.sub(view.mul(0.09))
    const pulsePhase = inner
      .dot(vec3(5.4, 12.5, -4.1))
      .sub(time.mul(0.72))
      .add(mx_noise_float(inner.mul(3.3)).mul(4))
    const pulse = pulsePhase
      .sin()
      .mul(0.5)
      .add(0.5)
      .pow(8)
    const skinNoise = mx_fractal_noise_float(p.mul(12), 3, 2, 0.5)
      .mul(0.5)
      .add(0.5)
    const age = skinNoise.smoothstep(0.58, 0.86)
    const body = mix(color(hsl.integer(90, 26, 73)), color(hsl.integer(98, 22, 15)), age)
    this.colorNode = mix(body, color(hsl.integer(124, 54, 33)), network.mul(0.2))
    this.transmission = 0.35
    this.transmissionNode = facing
      .mul(0.16)
      .add(network.mul(0.09))
      .add(0.09)
      .clamp(0.08, 0.36)
    this.thickness = 0.42
    this.ior = 1.39
    this.attenuationColor.set(hsl.integer(123, 72, 54))
    this.attenuationDistance = 0.58
    this.roughnessNode = float(0.46)
      .add(age.mul(0.22))
      .sub(network.mul(0.08))
      .clamp(0.3, 0.72)
    this.clearcoat = 0.08
    this.clearcoatRoughness = 0.4
    this.sheen = 0.18
    this.sheenColor.set(hsl.integer(95, 41, 84))
    this.sheenRoughness = 0.72
    this.normalNode = proceduralNormal(skinNoise
      .mul(0.16)
      .add(shallow.mul(0.28)), 0.0018)
    const spores = cellGrain(p.sub(view.mul(0.11)), 72, 0.988)
    const primaryTint = mix(color(hsl.integer(135.3, 100, 88.1)), color(hsl.integer(100, 100, 94.4)), pulse)
    const sporeTint = mix(color(hsl.integer(132, 100, 90.6)), color(hsl.integer(99, 100, 96.5)), spores.rnd.z)
    this.emissiveNode = primaryTint
      .mul(network)
      .mul(pulse.mul(0.8).add(0.28))
      .mul(near.mul(0.72).add(0.22))
      .add(sporeTint
        .mul(spores.mask)
        .mul(intimate)
        .mul(1.15))
      .add(color(hsl.integer(131, 81, 58))
        .mul(rim)
        .mul(0.055))
  }
}
