import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {filament} from '../../lib/filament.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 1. ABYSSAL CATHEDRAL A sunken stone nave, drowned for centuries. Caustic light from far above, god-rays threading through cold water, encrusted barnacles and drifting bioluminescent motes that bloom as the viewer swims closer. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, grazing, rim, intimate} = viewerFrame()
    // Caustic lattice — two crossed wave-fields projected up the Y axis.
    const causticOrigin = vec3(p.x.mul(3.2), time.mul(0.28), p.z.mul(3.2))
    const causticA = mx_noise_float(causticOrigin)
    const causticB = mx_noise_float(causticOrigin.mul(1.63).add(vec3(11.7, 0, 4.3)))
    const causticRaw = causticA.add(causticB).mul(0.5).abs().oneMinus()
    const caustic = causticRaw.pow(5).mul(facing.mul(0.5).add(0.5))
    // Light shafts — long vertical interference bands.
    const shaftPhase = p.x.mul(7.5).add(p.z.mul(5.1))
      .add(mx_noise_float(p.mul(0.7)).mul(3.4))
    const shafts = filament(shaftPhase.sin(), 0.16)
    // Barnacles — spherical blisters scattered across the surface.
    const q = p.mul(31)
    const rnd = cellNoiseVec3(q)
    const rnd2 = cellNoiseVec3(q.floor().add(vec3(23, 92, 47)))
    const d = q.fract().sub(rnd.mul(0.5).add(0.25)).length()
    const fp = q.fwidth().length().max(0.002)
    const barnacle = d.smoothstep(0.16, fp.add(0.22).min(0.24)).oneMinus()
    const barnacleTint = mix(color(hsl.integer(94, 35, 90)), color(hsl.integer(82, 25, 59)), rnd2.y)
    // Algae — fractal noise mottling the stone.
    const algae = mx_fractal_noise_float(p.mul(4.2), 3, 2, 0.55).mul(0.5).add(0.5)
    // Deep cold stone.
    const stoneDeep = mix(color(hsl.integer(229, 43, 7)), color(hsl.integer(224, 50, 20)), algae)
    const stoneShallow = mix(color(hsl.integer(215, 58, 29)), color(hsl.integer(209, 45, 41)), algae.mul(0.6))
    const stone = mix(stoneDeep, stoneShallow, facing.pow(0.6))
    // Silt accumulation in crevices.
    const silt = mx_noise_float(p.mul(18)).mul(0.4).add(0.6)
    const surfaceCol = mix(stone, barnacleTint, barnacle.mul(silt))
    // Bioluminescent motes hovering around the mesh.
    const motes = cellularPoints(p.mul(48).add(vec3(0, time.mul(0.06), 0)), 0.03, 0.18)
    this.colorNode = surfaceCol
    this.roughnessNode = barnacle.mul(-0.55).add(0.9)
    this.metalness = 0.04
    this.clearcoat = 0.45
    this.clearcoatRoughness = 0.35
    this.normalNode = proceduralNormal(barnacle.mul(0.7)
      .add(algae.mul(0.35))
      .add(mx_noise_float(p.mul(64)).mul(0.08)), 0.005)
    this.emissiveNode
      = color(hsl.integer(208, 84, 71.5)).mul(caustic).mul(grazing.mul(0.4).add(0.6)).mul(0.42)
        .add(color(hsl.integer(214, 100, 83)).mul(shafts).mul(grazing.mul(0.5).add(0.3)).mul(0.16))
        .add(color(hsl.integer(174, 100, 87.4)).mul(motes).mul(intimate.mul(0.7).add(0.35)).mul(2.4))
        .add(color(hsl.integer(210, 88, 53)).mul(rim).mul(0.08))
  }
}
