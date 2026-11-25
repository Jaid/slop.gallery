import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, tangentLocal, time, uv, vec2} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Silk velvet with a buried brocade. The pile flips from void to blood as the nap turns toward the eye, and the gold thread only speaks at a grazing angle. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.34)
    this.name = knotData.id
    const {p, view, facing, grazing, objectDistance} = viewerFrame()
    const proximity = objectDistance.smoothstep(1.5, 4.6).oneMinus()
    const nap = tangentLocal.div(tangentLocal.length().max(1e-4))
    const breath = time.mul(0.45).sin().mul(0.04)
    const pile = nap.dot(view).smoothstep(float(-0.45).add(breath), float(0.42).add(breath))
    const fluff = grazing.pow(1.2)
    const velvet = mix(color(hsl.integer(9, 65, 4)), color(hsl.integer(22, 97.4, 44)), pile)
    const lit = mix(velvet, color(hsl.integer(15, 100, 70)), fluff.mul(pile).mul(0.7))
    const tube = uv()
    const u = tube.x.mul(TAU)
    const v = tube.y.mul(TAU)
    const diagA = u.mul(4).add(v.mul(2)).sin()
    const diagB = u.mul(4).sub(v.mul(2)).sin()
    const threads = filteredRibbon(diagA, 0.18).add(filteredRibbon(diagB, 0.18))
    const jewel = diagA.abs().mul(diagB.abs()).pow(4)
    const brocade = threads.mul(0.9).add(jewel.mul(1.4)).clamp(0, 1)
    const reveal = grazing.smoothstep(0.08, 0.62).mul(pile.oneMinus().mul(0.4).add(0.6)).mul(facing.mul(0.25).add(0.75))
    const gold = color(hsl.integer(90, 100, 90))
    this.colorNode = mix(lit, gold, brocade.mul(reveal).mul(0.92))
    this.metalnessNode = brocade.mul(reveal).mul(0.84)
    this.roughnessNode = mix(float(0.82), float(0.28), brocade.mul(reveal)).sub(pile.mul(0.05)).clamp(0.16, 0.92)
    this.specularIntensity = 0.2
    this.sheenNode = mix(color(hsl.integer(16, 75, 14)), color(hsl.integer(18, 100, 62.4)), pile).mul(fluff.mul(0.55).add(0.18))
    this.sheenRoughness = 0.38
    this.anisotropyNode = vec2(float(0.72), 0)
    const fiberScale = p.mul(70)
    const fibers = cellularPoints(fiberScale, 0.018, 0.07, 0.9)
    const fiberFade = fiberScale.fwidth().length().smoothstep(0.48, 0.16).oneMinus()
    this.emissiveNode = color(hsl.integer(7, 100, 89.6)).mul(fibers).mul(fiberFade).mul(pile).mul(proximity).mul(0.7)
      .add(gold.mul(brocade).mul(reveal).mul(grazing.mul(0.65).add(0.2)).mul(0.55))
      .add(color(hsl.integer(14, 99, 70.7)).mul(fluff.pow(2)).mul(0.08))
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(48).add(nap)), 0.01)
  }
}
