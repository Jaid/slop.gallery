import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mx_cell_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.envMapIntensity = 0.7
    const {p, facing, near, rim} = viewerFrame()
    const arcFamilies = [
      {
        scale: 2.1,
        drift: [0.31, -0.17, 0.23],
        branch: 5.3,
        tint: hsl.integer(289.2, 100, 49),
        rate: 2.3,
        phase: 3.1,
      },
      {
        scale: 3.4,
        drift: [-0.21, 0.4, 0.12],
        branch: 8.1,
        tint: hsl.integer(220.6, 100, 78),
        rate: 3.1,
        phase: 7.7,
      },
      {
        scale: 1.5,
        drift: [0.12, -0.3, -0.35],
        branch: 4.1,
        tint: hsl.integer(263, 100, 89),
        rate: 1.7,
        phase: 12.9,
      },
    ]
    let arcMask: Node<'float'> = float(0)
    let arcEmissive: Node<'vec3'> = vec3(0)
    let haloSum: Node<'float'> = float(0)
    for (const f of arcFamilies) {
      const drift = vec3(f.drift[0], f.drift[1], f.drift[2])
      const field = mx_noise_float(p.mul(f.scale).add(drift.mul(time.mul(0.33))))
      const line = filament(field, 0.016)
      const halo = filament(field, 0.1).mul(0.4)
      const branchField = mx_noise_float(p.mul(f.branch).add(vec3(11.3, 4.7, 8.2)).add(drift.mul(time.mul(0.5))))
      const branch = filament(branchField, 0.01).mul(0.5)
      const family = line.add(branch).add(halo).clamp()
      const slotGate = mx_cell_noise_float(vec3(time.mul(f.rate).floor().add(0.5), f.phase, 9.1)).smoothstep(0.55, 0.6)
      const stutter = mx_cell_noise_float(vec3(time.mul(26).floor().add(0.5), 5.2, 2.8)).smoothstep(0.3, 0.34).mul(0.65).add(0.35)
      const live = slotGate.mul(stutter)
      haloSum = haloSum.add(halo)
      arcMask = arcMask.max(family.mul(live))
      arcEmissive = arcEmissive.add(color(f.tint).mul(family).mul(live))
    }
    const attract = near.mul(facing.pow(2.5)).mul(1.6).add(0.25)
    const arcs = arcMask.mul(attract)
    const master = mx_cell_noise_float(vec3(time.mul(0.9).floor().add(0.5), 1.1, 4.4)).smoothstep(0.92, 0.95)
    const hazeField = mx_noise_float(p.mul(1.4).add(vec3(time.mul(0.08), 0, 0))).mul(0.5).add(0.5)
    this.colorNode = color(hsl.integer(285, 18, 4))
    this.metalness = 0.55
    this.roughness = 0.05
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.emissiveNode = arcEmissive.mul(attract).mul(near.mul(0.45).add(0.55))
      .add(color(hsl.integer(270, 100, 97)).mul(arcs.mul(arcs).mul(arcs)).mul(1.6))
      .add(color(hsl.integer(289, 73, 38)).mul(haloSum).mul(0.22))
      .add(color(hsl.integer(285, 73, 17)).mul(hazeField).mul(0.16))
      .add(color(hsl.integer(272, 100, 95.6)).mul(arcs).mul(master).mul(2.2))
      .add(color(hsl.integer(292, 100, 74)).mul(rim).mul(master).mul(0.5))
  }
}
