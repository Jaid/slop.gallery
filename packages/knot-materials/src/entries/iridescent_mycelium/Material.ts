import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_vec3, time, vec2, vec3} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function livingNetwork(point: Node<'vec3'>, scale: number, seed: number) {
  const q = point.mul(scale).add(vec3(seed, seed * 0.37, seed * -0.21))
  const warp = vec3(mx_noise_float(q.mul(0.73)), mx_noise_float(q.mul(0.73).add(19.7)), mx_noise_float(q.mul(0.73).add(-7.3)))
  const cells = mx_worley_noise_vec3(q.add(warp.mul(0.34)), 1, 0)
  const edge = cells.y.sub(cells.x)
  const ridges = edge.abs().smoothstep(0.018, 0.065).oneMinus()
  const chamber = cells.x.smoothstep(0.04, 0.19).oneMinus()
  return {
    chamber,
    edge,
    ridges,
  }
}
function strand(point: Node<'vec2'>, phase: Node<'float'>, footprint: Node<'float'>) {
  const x = point.x
  const y = point.y
  const wave = x.mul(9.7).add(phase).sin().mul(0.23).add(x.mul(3.1).add(phase.mul(0.7)).sin().mul(0.07))
  const d = y.sub(wave).abs()
  const filament = d.smoothstep(0.015, footprint.add(0.025)).oneMinus()
  const nodes = vec2(x.mul(3.4).fract().sub(0.5), y.mul(11).fract().sub(0.5)).length().smoothstep(0.09, 0.2).oneMinus()
  return {
    filament,
    nodes,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.92)
    this.name = knotData.id
    const {p, view, facing, grazing, near} = viewerFrame()
    const networkA = livingNetwork(p, 8.3, 0.7)
    const networkB = livingNetwork(p.sub(view.mul(0.065)), 16.7, 8.1)
    const networkC = livingNetwork(p.sub(view.mul(0.12)), 29, 17.4)
    const field = mx_fractal_noise_float(p.mul(3.1).add(vec3(0, time.mul(0.022), 0)), 3, 2.05, 0.53)
    const membrane = field.mul(0.5).add(0.5)
    const sporeA = strand(vec2(p.y.mul(2.8), p.x.mul(6.2)), time.mul(0.12).add(field.mul(1.5)), p.mul(12).fwidth().length().max(0.002))
    const sporeB = strand(vec2(p.x.mul(4.1), p.y.mul(9.4)), time.mul(-0.09).add(field.mul(-1.2)), p.mul(24).fwidth().length().max(0.002))
    const growth = networkA.ridges.mul(0.8).add(networkB.ridges.mul(0.46)).add(networkC.ridges.mul(0.24)).add(sporeA.filament.mul(0.55)).add(sporeB.filament.mul(0.25)).clamp()
    const fruiting = networkB.chamber.mul(networkC.ridges).add(sporeB.nodes.mul(0.55))
    const hue = field.mul(0.55).add(facing.mul(0.32)).add(time.mul(0.008)).add(view.x.mul(0.1))
    const pigment = cosinePalette(hue, [0.08, 0.2, 0.26], [0.04, 0.2, 0.29], [1, 1, 1], [0.58, 0.44, 0.18])
    const skin = mix(color(hsl.integer(223, 46, 9)), pigment.mul(0.75), membrane)
    const glow = mix(color(hsl.integer(171, 99, 88.3)), color(hsl.integer(306, 100, 64)), field.mul(0.5).add(0.5)).add(color(hsl.integer(127, 100, 96.8)).mul(fruiting.mul(0.7)))
    this.colorNode = mix(skin, mix(color(hsl.integer(186, 57, 22)), pigment, 0.35), growth)
    this.roughnessNode = float(0.52).sub(networkA.chamber.mul(0.12)).add(mx_noise_float(p.mul(38)).mul(0.09))
    this.metalness = 0.08
    this.clearcoat = 0.28
    this.clearcoatRoughness = 0.24
    this.transmission = 0.08
    this.thickness = 0.32
    this.ior = 1.42
    this.normalNode = proceduralNormal(growth.mul(0.0022).add(networkC.ridges.mul(0.0007)), 0.0026)
    this.emissiveNode = glow.mul(growth.mul(1.65).add(fruiting.mul(0.9)).add(sporeA.nodes.mul(0.32))).mul(near.mul(0.48).add(0.52)).add(color(hsl.integer(177, 100, 90)).mul(grazing.mul(0.11)))
  }
}
