import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {fractalNoise, ridgedNoise} from '../../candidates/grok/lib/fractalNoise.ts'
import {palette} from '../../candidates/grok/lib/palette.ts'
import {screenRibbon} from '../../candidates/grok/lib/screenRibbon.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Columnar basalt with a cooling psalm still moving in the joints. The columns are Voronoi prisms; olivine crystals glint only at a steep angle, and the fissures breathe red when you come near. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.28)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const scale = p.mul(3.1)
    const boundary = cellularBoundary(scale)
    const joint = boundary.smoothstep(0.16, 0.035)
    const column = screenRibbon(boundary.sub(0.055), 0.045)
    const strata = ridgedNoise(p.mul(vec3(0.8, 6.4, 0.8)))
    const pits = fractalNoise(p.mul(11), 3).smoothstep(0.68, 0.9)
    const stone = palette(strata.mul(0.75).add(0.12), [{
      at: 0,
      rgb: hsl.integer(62, 20, 10),
    }, {
      at: 0.3,
      rgb: hsl.integer(67, 17, 28),
    }, {
      at: 0.58,
      rgb: hsl.integer(73, 27, 46),
    }, {
      at: 0.82,
      rgb: hsl.integer(71, 40, 69),
    }, {
      at: 1,
      rgb: hsl.integer(221, 24, 57),
    }])
    const lichen = palette(mx_noise_float(p.mul(6)).mul(0.5).add(0.5), [{
      at: 0,
      rgb: hsl.integer(145, 27, 19),
    }, {
      at: 1,
      rgb: hsl.integer(120, 65, 67),
    }])
    const damp = facing.smoothstep(0.15, 0.85)
    const body = mix(stone, lichen, pits.mul(intimate).mul(0.4))
    const olivinePhase = mx_noise_float(p.mul(14).add(view.mul(4)))
    const olivine = olivinePhase.smoothstep(0.74, 0.86).mul(grazing.pow(1.1)).mul(intimate.mul(0.65).add(0.35))
    this.colorNode = mix(mix(body, color(hsl.integer(125.6, 100, 91.8)), olivine.mul(0.85)), color(hsl.integer(269, 13, 5)), joint.mul(0.82))
    const height = joint.mul(-0.012).add(strata.mul(0.008)).sub(pits.mul(0.004))
    this.positionNode = positionGeometry.add(normalLocal.mul(height.mul(0.45)))
    this.normalNode = proceduralNormal(height.add(olivine.mul(0.004)), 1.8)
    this.roughnessNode = float(0.86).sub(damp.mul(0.28)).sub(olivine.mul(0.45)).add(joint.mul(0.05)).clamp(0.16, 0.96)
    this.metalnessNode = olivine.mul(0.22)
    this.clearcoatNode = damp.mul(0.22).add(olivine.mul(0.35))
    this.clearcoatRoughnessNode = float(0.45).sub(olivine.mul(0.3))
    this.sheenNode = color(hsl.integer(79, 33, 80)).mul(grazing.pow(1.7).mul(0.22))
    this.sheenRoughness = 0.62
    const steps = 4
    let hymn: Node<'vec3'> = vec3(0)
    for (let index = 0;index < steps;index++) {
      const q = p.sub(view.mul(0.02 + index * 0.028))
      const vein = screenRibbon(cellularBoundary(q.mul(3.1)).sub(0.05), 0.055)
      const travel = time.mul(0.35).add(q.dot(vec3(0.3, 2.1, -0.4))).add(index * 1.7).sin().mul(0.5).add(0.5)
      const heat = palette(travel, [{
        at: 0,
        rgb: hsl.integer(29, 75, 10),
      }, {
        at: 0.4,
        rgb: hsl.integer(34, 98, 54),
      }, {
        at: 0.75,
        rgb: hsl.integer(67, 100, 79),
      }, {
        at: 1,
        rgb: hsl.integer(87, 100, 95.5),
      }])
      hymn = hymn.add(heat.mul(vein).mul(travel.pow(1.6)).mul(1 - index * 0.16))
    }
    this.emissiveNode = hymn.mul(near.mul(0.9).add(0.55)).mul(1.15).add(color(hsl.integer(118, 100, 95.7)).mul(olivine).mul(facing).mul(0.4)).add(color(hsl.integer(41, 100, 68)).mul(column).mul(intimate.add(0.35)).mul(0.16))
  }
}
