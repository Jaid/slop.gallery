import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalLocal, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Thousands of rounded palette-knife marks, each with its own pigment and direction. */
function brushwork(grid: Node<'vec2'>, seed: number) {
  const cell = grid.floor()
  const local = grid.fract().sub(0.5)
  const random = cellNoiseVec3(vec3(cell.x.add(0.5), cell.y.add(0.5), seed))
  const turn = random.x.mul(TAU).add(time.mul(0.04))
  const point = vec2(local.x.mul(turn.cos()).sub(local.y.mul(turn.sin())), local.x.mul(turn.sin()).add(local.y.mul(turn.cos())))
  const length = random.z.mul(0.1).add(0.24)
  const width = random.y.mul(0.035).add(0.065)
  const distance = point.y.abs().max(point.x.abs().sub(length).max(0))
  const profile = distance.add(distance.fwidth().mul(0.35)).sub(width).oneMinus().max(0)
  const relief = distance.sub(width).oneMinus().max(0)
  return {
    profile,
    relief,
    random,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.82)
    this.name = knotData.id
    const {p, view, facing, grazing, near} = viewerFrame()
    const tube = uv()
    const drift = tube.y.sin().mul(0.18)
    const broad = brushwork(vec2(tube.x.mul(30).add(drift), tube.y.mul(7)), 1.7)
    const fine = brushwork(vec2(tube.x.mul(54).sub(drift), tube.y.mul(14)), 8.3)
    const lapis = color(hsl.integer(265, 91, 26))
    const ultramarine = color(hsl.integer(268, 91, 35))
    const vermilion = color(hsl.integer(34, 91, 53))
    const gold = color(hsl.integer(80, 79, 76))
    const cream = color(hsl.integer(79, 39, 88))
    const observerWarmth = view.x.mul(0.13).add(facing.mul(0.16)).sub(grazing.mul(0.08))
    let broadPigment = mix(lapis, ultramarine, broad.random.x)
    broadPigment = mix(broadPigment, mix(vermilion, gold, broad.random.z), broad.random.y.smoothstep(0.43, 0.76).add(observerWarmth).clamp())
    broadPigment = mix(broadPigment, cream, broad.random.x.smoothstep(0.84, 0.97).mul(0.72))
    const finePigment = mix(mix(gold, vermilion, fine.random.y), mix(color(hsl.integer(201, 64, 79)), cream, fine.random.x), fine.random.z.smoothstep(0.5, 0.86))
    const pigment = mix(broadPigment, finePigment, fine.profile.mul(near.oneMinus().mul(0.55).add(0.2)).mul(0.48))
    this.positionNode = p.add(normalLocal.mul(broad.relief.mul(0.004)))
    this.normalNode = proceduralNormal(broad.relief, 0.004)
    this.colorNode = pigment.mul(broad.profile.oneMinus().mul(0.3).add(0.8))
    this.metalness = 0
    this.roughnessNode = float(0.33).sub(broad.profile.mul(0.055)).add(fine.profile.mul(near).mul(0.045))
    this.clearcoat = 0.58
    this.clearcoatRoughness = 0.19
    this.sheen = 0.14
    this.sheenRoughness = 0.52
    const wetGlint = glints(normalViewGeometry, 72)
    this.emissiveNode = mix(gold, cream, fine.random.x).mul(fine.profile).mul(wetGlint).mul(near).mul(0.18)
      .add(color(hsl.integer(260, 100, 91)).mul(grazing.pow(4)).mul(0.035))
  }
}
