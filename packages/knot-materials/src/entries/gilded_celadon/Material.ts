import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_noise_vec3, mx_worley_noise_vec3, normalLocal} from 'three/tsl'

import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Kintsugi. A celadon vessel was dropped, and every fracture was filled with molten gold rather than hidden. The seams stand proud of the glaze, catch the studio lights as hard metal, and the ceramic around them is chipped, crazed and slightly darker where the break ran. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
// Warp the fracture lattice so the shards are torn and uneven rather than
// a tidy turtle shell.
    const warp = mx_noise_vec3(p.mul(2.2)).mul(0.55)
    const shardField = mx_worley_noise_vec3(p.mul(5.4).add(warp), 1, 0)
    const shard = shardField.y.sub(shardField.x)
    const crazeField = mx_worley_noise_vec3(p.mul(34).add(7.3), 1, 0)
    const craze = crazeField.y.sub(crazeField.x)
// Molten gold is never a constant width; it pools and thins along the seam.
    const veinWidth = mx_noise_float(p.mul(6.5)).mul(0.016).add(0.036)
// The vertex stage cannot use screen-space derivatives, so the displacement uses a plain
// smoothstep while the fragment stage gets the properly filtered ribbon.
    const veinShape = shard.smoothstep(0, veinWidth).oneMinus()
    const vein = filteredRibbon(shard, veinWidth)
    const branch = filteredRibbon(shardField.z.sub(shardField.x), veinWidth.mul(0.7)).mul(0.6)
    const gold = vein.max(branch)
    const halo = filteredRibbon(shard, veinWidth.mul(3.4)).mul(0.5)
    const fringe = filteredRibbon(shard, veinWidth.mul(1.7)).mul(gold.oneMinus())
    const crazing = filteredRibbon(craze, 0.02).mul(0.55)
// Celadon glaze, warm where it is thick and cool where it pooled thin.
    const glazeNoise = mx_noise_float(p.mul(4.2)).mul(0.5).add(0.5)
    const glazeFine = mx_noise_float(p.mul(19)).mul(0.5).add(0.5)
    const celadon = mix(mix(color(hsl.integer(165, 31, 43)), color(hsl.integer(155, 25, 69)), glazeNoise), color(hsl.integer(128, 26, 81)), glazeFine.mul(0.3))
    const chipped = mix(celadon, color(hsl.integer(143, 18, 30)), halo.mul(0.5))
// Raw urushi lacquer bleeds out from under the gold leaf.
    const body = mix(chipped, color(hsl.integer(47, 36, 13)), fringe.mul(0.75)).mul(crazing.mul(-0.22).add(1))
// Gold leaf: warm, slightly uneven, and polished to a hard mirror.
    const goldTint = mix(color(hsl.integer(69, 92, 58)), color(hsl.integer(88, 100, 88.1)), mx_noise_float(p.mul(15)).mul(0.5).add(0.5))
    const goldBrush = mx_noise_float(p.mul(90)).mul(0.5).add(0.5)
    this.positionNode = p.add(normalLocal.mul(veinShape.mul(0.0052)))
    this.colorNode = mix(body, goldTint.mul(goldBrush.mul(0.18).add(0.9)), gold)
    this.metalnessNode = gold.mul(0.98).add(0.01)
    this.roughnessNode = mix(float(0.32).sub(glazeFine.mul(0.06)), float(0.16).add(goldBrush.mul(0.12)), gold)
    this.ior = 1.52
    this.clearcoatNode = gold.oneMinus().mul(0.7)
    this.clearcoatRoughnessNode = mix(float(0.09), float(0.03), gold)
    this.normalNode = proceduralNormal(veinShape.mul(0.55).add(crazing.mul(0.35)), 0.0011)
    this.clearcoatNormalNode = this.normalNode
    this.emissiveNode = color(hsl.integer(81, 100, 86)).mul(gold).mul(grazing.pow(2.5)).mul(near.mul(0.3).add(0.5)).mul(0.22)
      .add(color(hsl.integer(72, 100, 79.1)).mul(vein).mul(intimate).mul(0.05))
  }
}
