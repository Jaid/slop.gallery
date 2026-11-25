import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, vec3} from 'three/tsl'

import {fractalNoise, ridgedNoise} from '../../candidates/grok/lib/fractalNoise.ts'
import {palette} from '../../candidates/grok/lib/palette.ts'
import {screenRibbon} from '../../candidates/grok/lib/screenRibbon.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A reduction-fired ceramic with a crawling tenmoku glaze. The body stays matte and iron-dark; the glass coat pools in the valleys, crazes, and runs hotter when you lean in. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.42)
    this.name = knotData.id
    const {p, facing, grazing, near, intimate, view} = viewerFrame()
    const clay = ridgedNoise(p.mul(3.4), 4, 2.1, 0.55)
    const grain = fractalNoise(p.mul(14), 3)
    const heat = mx_noise_float(p.mul(1.35).add(vec3(time.mul(0.08), time.mul(-0.05), time.mul(0.03)))).mul(0.5).add(0.5)
    const flow = mx_noise_float(p.mul(2.4).add(view.mul(0.6))).mul(0.5).add(0.5)
    const glazePool = clay.smoothstep(0.22, 0.7).oneMinus().mul(flow.mul(0.25).add(0.8))
    const body = palette(grain.mul(0.4).add(clay.mul(0.25)), [{
      at: 0,
      rgb: hsl.integer(33, 39, 8),
    }, {
      at: 0.4,
      rgb: hsl.integer(36, 70, 28),
    }, {
      at: 1,
      rgb: hsl.integer(53, 64, 59),
    }])
    const glaze = palette(heat.mul(0.7).add(flow.mul(0.3)).add(view.y.mul(0.08)), [{
      at: 0,
      rgb: hsl.integer(27, 43, 5),
    }, {
      at: 0.22,
      rgb: hsl.integer(20, 91, 28),
    }, {
      at: 0.4,
      rgb: hsl.integer(28.5, 98.4, 47),
    }, {
      at: 0.58,
      rgb: hsl.integer(40, 98, 60.7),
    }, {
      at: 0.76,
      rgb: hsl.integer(65, 83, 73),
    }, {
      at: 0.9,
      rgb: hsl.integer(16, 90, 29),
    }, {
      at: 1,
      rgb: hsl.integer(86, 100, 92),
    }])
    const ash = palette(grain, [{
      at: 0,
      rgb: hsl.integer(168, 13, 38),
    }, {
      at: 1,
      rgb: hsl.integer(89, 47, 86),
    }])
    const crawl = screenRibbon(fractalNoise(p.mul(7.5).add(vec3(2.2, 0.4, 1)), 3).sub(0.08), 0.03)
    const cells = p.mul(6.5)
    const identity = cellNoiseVec3(cells.floor())
    const center = identity.mul(0.42).add(0.29)
    const cellDist = cells.fract().sub(center).length()
    const cellEdge = screenRibbon(cellDist.sub(identity.z.mul(0.06).add(0.18)), 0.028).mul(glazePool)
    const oilspot = cellDist.smoothstep(0.12, 0.03).mul(identity.y.smoothstep(0.48, 0.66)).mul(glazePool)
    const surface = mix(body, glaze, glazePool.mul(0.94))
    this.colorNode = mix(surface, ash, crawl.mul(0.7).add(oilspot.mul(0.28)))
    const height = clay.mul(0.016).add(grain.mul(0.002)).sub(glazePool.mul(0.006))
    this.normalNode = proceduralNormal(height.sub(crawl.mul(0.004)).sub(cellEdge.mul(0.003)), 1.5)
    this.roughnessNode = mix(float(0.78), float(0.1), glazePool).add(crawl.mul(0.16)).add(grain.mul(intimate).mul(0.05)).clamp(0.06, 0.92)
    this.metalnessNode = glazePool.mul(heat).mul(0.28)
    this.clearcoatNode = glazePool.mul(0.95)
    this.clearcoatRoughnessNode = mix(float(0.24), float(0.04), heat).add(crawl.mul(0.1))
    this.sheenNode = color(hsl.integer(57, 58, 77)).mul(grazing.pow(1.4).mul(0.45).mul(glazePool.oneMinus()))
    this.sheenRoughness = 0.48
    this.iridescenceNode = oilspot.mul(0.85).add(heat.mul(glazePool).mul(grazing).mul(0.45))
    this.iridescenceIOR = 1.5
    this.iridescenceThicknessNode = heat.mul(420).add(80).add(flow.mul(180))
    const ember = heat.pow(2.2).mul(glazePool).mul(facing.mul(0.35).add(0.75))
    const copper = view.x.mul(0.5).add(0.5)
    this.emissiveNode = mix(color(hsl.integer(32.6, 100, 59.6)), color(hsl.integer(67, 100, 79)), copper).mul(ember).mul(near.mul(0.75).add(0.28)).add(color(hsl.integer(68, 100, 89)).mul(cellEdge).mul(ember).mul(0.7)).add(color(hsl.integer(77, 100, 83.5)).mul(oilspot).mul(facing).mul(intimate.add(0.35)).mul(0.28)).add(color(hsl.integer(18, 87, 24.6)).mul(crawl).mul(grazing).mul(0.12))
  }
}
