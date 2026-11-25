import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, vec3} from 'three/tsl'

import {cellGrain} from '../../candidates/gpt_sol/lib/cellGrain.ts'
import {filament} from '../../candidates/gpt_sol/lib/filament.ts'
import {viewerFrame} from '../../candidates/gpt_sol/lib/viewerFrame.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

function iceFracture(q: Node<'vec3'>, seed: number, detail: number) {
  const offset = vec3(seed * 7.13, seed * -3.71, seed * 5.47)
  const direction = vec3(0.31 + seed * 0.07, 0.87 - seed * 0.04, -0.36 + seed * 0.03).normalize()
  const guide = mx_noise_float(q.mul(4.1).add(offset))
  const shard = mx_noise_float(q.mul(detail)
    .add(offset.mul(2.7))
    .add(guide.mul(2.1)))
  const fork = mx_noise_float(q.mul(detail * 1.65)
    .sub(offset)
    .add(shard.mul(1.4)))
  const territory = guide
    .abs()
    .smoothstep(0.16, 0.72)
    .oneMinus()
  const trunk = filament(shard.add(guide.mul(0.32)), 0.025)
  const twigs = filament(fork.add(shard.mul(0.2)), 0.018)
  const crystalPlane = filament(q.dot(direction)
    .mul(detail * 0.78)
    .add(guide.mul(2.4))
    .sin(), 0.035)
  return trunk
    .mul(territory.mul(0.45).add(0.75))
    .add(twigs.mul(territory).mul(0.7))
    .add(crystalPlane.mul(territory).mul(0.22))
    .clamp()
}

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 1.1
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
    const shallow = iceFracture(p.sub(view.mul(0.035)), 1.1, 17)
    const middle = iceFracture(p.sub(view.mul(0.11)), 2.3, 21)
    const deep = iceFracture(p.sub(view.mul(0.21)), 3.7, 27)
    const fractures = shallow
      .mul(0.65)
      .add(middle.mul(0.8))
      .add(deep.mul(grazing.mul(0.55).add(0.55)))
      .clamp()
    const surface = mx_fractal_noise_float(p.mul(10.5), 3, 2, 0.5)
      .mul(0.5)
      .add(0.5)
    const frost = surface
      .smoothstep(0.64, 0.86)
      .mul(grazing.mul(0.8).add(0.12))
    const bubbles = cellGrain(p.sub(view.mul(0.14)), 58, 0.976)
    const angleTint = view
      .dot(vec3(0.53, -0.21, 0.82).normalize())
      .mul(0.5)
      .add(0.5)
    const paleFactor = facing
      .pow(0.65)
      .mul(0.62)
      .add(angleTint.mul(0.18))
      .clamp()
    const ice = mix(color(hsl.integer(213, 45, 61)), color(hsl.integer(212, 100, 97)), paleFactor)
    this.colorNode = mix(ice, color(hsl.integer(197, 100, 99.3)), frost.mul(0.7)).mul(fractures.mul(0.08).add(0.82))
    this.transmission = 1
    this.transmissionNode = float(0.94)
      .sub(fractures.mul(0.5))
      .sub(frost.mul(0.42))
      .clamp(0.18, 0.95)
    this.thickness = 0.72
    this.ior = 1.31
    this.dispersion = 0.08
    this.attenuationColor.set(hsl.integer(214, 53, 64))
    this.attenuationDistance = 0.65
    this.roughnessNode = float(0.035)
      .add(frost.mul(0.48))
      .add(shallow.mul(0.1))
      .clamp(0.025, 0.58)
    const iceNormal = proceduralNormal(surface
      .mul(0.22)
      .add(shallow.mul(0.55))
      .add(frost.mul(0.2)), 0.0014)
    this.normalNode = iceNormal
    this.clearcoat = 1
    this.clearcoatNormalNode = iceNormal
    this.clearcoatRoughnessNode = float(0.025)
      .add(frost.mul(0.3))
    const fractureTint = mix(color(hsl.integer(223, 99, 80)), color(hsl.integer(0, 0, 100)), angleTint)
    this.emissiveNode = fractureTint
      .mul(fractures)
      .mul(near.mul(0.75).add(0.18))
      .add(color(hsl.integer(197, 100, 98.6))
        .mul(bubbles.mask)
        .mul(intimate)
        .mul(0.85))
      .add(color(hsl.integer(215, 58, 60))
        .mul(rim)
        .mul(0.035))
  }
}
