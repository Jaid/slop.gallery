import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2} from 'three/tsl'

import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Shot silk woven around the knot: teal warp and wine weft trade places with the viewing angle, a gold brocade diamond hides until you come close, and ten thousand individual threads catch the studio lamps. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const tube = uv()
    const {p, grazing, near, intimate} = viewerFrame()
    // Integer thread counts keep the weave seamless around and along the tube.
    const warp = tube.x.mul(TAU * 220).sin()
    const weft = tube.y.mul(TAU * 44).sin()
    const weave = warp.mul(weft)
    // Gold brocade: a diamond lattice worked into the cloth, revealed on approach.
    const cell = tube.mul(vec2(24, 4))
    const local = cell.fract().sub(0.5)
    const diamond = local.x.abs().add(local.y.abs())
    const brocade = filteredRibbon(diamond.sub(0.31), 0.045).mul(intimate)
    const brocadeHeart = filteredRibbon(diamond.sub(0.13), 0.03).mul(intimate)
    const slub = mx_noise_float(p.mul(30)).mul(0.5).add(0.5)
    const shot = grazing.pow(1.4)
    const cloth = mix(color(hsl.integer(185, 90, 21)), color(hsl.integer(2, 79, 24)), shot)
    const shaded = mix(cloth, color(hsl.integer(181, 92, 30)), weave.mul(0.16).add(slub.mul(0.1)))
    this.colorNode = mix(mix(shaded, color(hsl.integer(83, 89, 66)), brocade.mul(0.9)), color(hsl.integer(92, 100, 92.7)), brocadeHeart.mul(0.7))
    this.metalnessNode = brocade.max(brocadeHeart).mul(0.9)
    this.roughnessNode = float(0.46).sub(weave.abs().mul(0.07)).sub(brocade.mul(0.24)).clamp(0.18, 0.55)
    this.sheen = 1
    this.sheenNode = mix(color(hsl.integer(181, 90, 79)), color(hsl.integer(359, 99, 66)), shot)
    this.sheenRoughnessNode = float(0.38).sub(near.mul(0.1))
    this.anisotropy = 0.75
    this.anisotropyRotation = Math.PI / 2
    const silkNormal = proceduralNormal(weave.mul(0.4).add(brocade.mul(0.15)), 0.55)
    this.normalNode = silkNormal
    this.emissiveNode = color(hsl.integer(85, 100, 88.5))
      .mul(glints(silkNormal, 110))
      .mul(brocade.add(brocadeHeart))
      .mul(near.mul(0.5).add(0.12))
      .add(color(hsl.integer(181, 96, 81)).mul(weave.abs().pow(6)).mul(grazing).mul(0.05).mul(time.mul(Math.PI).sin().mul(0.3).add(0.7)))
  }
}
