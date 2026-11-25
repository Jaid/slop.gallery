import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, time, vec2} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Celadon porcelain that remembers every fracture. Rivers of gold run through the mended breaks, burnished along the form so they flare as the viewer passes, while a candle deep in the porcelain leaks a warm halo through the seams. Come closer and a crazing of finer scars resolves in the glaze, each hairline dusted with stray gold. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const {p, rim, near, intimate} = viewerFrame()
    const macro = cellularBoundary(p.mul(5.2))
    const micro = cellularBoundary(p.mul(15.5))
    const seam = filteredRibbon(macro, 0.042)
    const crazing = filteredRibbon(micro, 0.018).mul(near.mul(0.85).add(0.15))
    const nearSeam = filteredRibbon(macro, 0.24)
    const fleck = cellularPoints(p.mul(42), 0.03, 0.1, 0.72).mul(nearSeam).mul(near)
    const goldMask = seam.add(crazing.mul(0.8)).add(fleck).clamp()
    const halo = filteredRibbon(macro, 0.13).mul(0.55)
      .add(filteredRibbon(macro, 0.26).mul(0.3))
      .add(filteredRibbon(micro, 0.055).mul(near).mul(0.25))
    const flicker = time.mul(Math.PI * 3).sin().mul(0.13).add(time.mul(Math.PI * 5).sin().mul(0.07)).add(0.92)
    const pool = mx_noise_float(p.mul(2.2)).mul(0.5).add(0.5)
    const glaze = mix(color(hsl.integer(167, 29, 58)), color(hsl.integer(149, 23, 83)), pool.mul(0.5).add(0.15))
    const burnish = glints(normalViewGeometry, 80).mul(0.32).add(0.5).clamp()
    const gold = mix(color(hsl.integer(66, 87, 37)), color(hsl.integer(93, 78, 89)), burnish)
    const relief = goldMask.mul(0.55)
      .sub(seam.mul(0.3))
      .sub(crazing.mul(0.35))
      .add(pool.mul(0.18))
      .mul(intimate.add(near).clamp())
    this.colorNode = mix(glaze, gold, goldMask)
    this.metalnessNode = goldMask.mul(0.95)
    this.roughnessNode = float(0.18).mix(0.28, goldMask)
    this.clearcoatNode = float(1).mix(0.35, goldMask)
    this.clearcoatRoughness = 0.05
    this.anisotropyNode = vec2(0.55, 0).mul(goldMask)
    this.aoNode = float(1).sub(crazing.mul(0.25))
    this.normalNode = proceduralNormal(relief, 0.002)
    this.emissiveNode = color(hsl.integer(60, 99, 74)).mul(halo).mul(flicker).mul(intimate.mul(0.5).add(0.45))
      .add(color(hsl.integer(78, 100, 92.5)).mul(rim.pow(3)).mul(0.55))
      .add(color(hsl.integer(93, 100, 92.4)).mul(glints(normalViewGeometry, 150)).mul(goldMask).mul(near).mul(0.55))
  }
}
