import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, mx_worley_noise_float, time, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, grazing, rim, near, intimate} = viewerFrame()
    const inner = p.sub(view.mul(0.22))
    const wLarge1 = mx_worley_noise_float(inner.mul(4.2))
    const wLarge2 = mx_worley_noise_float(inner.mul(4.2).add(vec3(5.2, 1.3, 2.8)))
    const crackLarge = filament(wLarge1.sub(wLarge2), 0.035)
    const wFine1 = mx_worley_noise_float(inner.mul(13).add(vec3(0, time.mul(0.05), 0)))
    const wFine2 = mx_worley_noise_float(inner.mul(13).add(vec3(9.1, 4.7, 3.3)))
    const crackFine = filament(wFine1.sub(wFine2), 0.02).mul(near.mul(0.8).add(0.2))
    const cracks = crackLarge.add(crackFine.mul(0.6)).clamp()
    const flow = mx_noise_float(vec3(p.x.mul(2.5), p.y.mul(3).sub(time.mul(0.7)), p.z.mul(2.5))).mul(0.5).add(0.5)
    const heatFlicker = time.mul(7).sin().mul(0.08).add(time.mul(13.7).sin().mul(0.05)).add(0.9)
    const temp = cracks.mul(0.7).add(flow.mul(0.3)).mul(heatFlicker).clamp()
    const lavaDeep = color(hsl.integer(36, 100, 9))
    const lavaMid = color(hsl.integer(36.4, 100, 61))
    const lavaHot = color(hsl.integer(78, 100, 89.8))
    const lava = mix(mix(lavaDeep, lavaMid, temp.smoothstep(0.15, 0.55)), lavaHot, temp.smoothstep(0.6, 0.92))
    this.colorNode = mix(color(hsl.integer(286, 8, 3)), lava, cracks.mul(0.9))
    this.metalness = 0.15
    this.roughness = 0.06
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.envMapIntensity = 1.2
    this.normalNode = proceduralNormal(wLarge1.mul(0.4).add(flow.mul(0.4)), 0.0012)
    // Compact embers at their original interior depth, not entire glowing cells.
    const embers = cellularPoints(p.sub(view.mul(0.1)).mul(52), 0.035, 0.2, 0.6).mul(intimate.mul(0.8).add(0.2))
    this.emissiveNode = lava.mul(cracks).mul(3.2).mul(facing.mul(0.6).add(0.4)).mul(near.mul(0.4).add(0.8)).add(color(hsl.integer(58, 100, 70.6)).mul(embers).mul(2.5)).add(color(hsl.integer(31.6, 100, 58)).mul(rim).mul(0.35)).add(color(hsl.integer(35, 100, 17)).mul(grazing.pow(2)).mul(0.3))
  }
}
