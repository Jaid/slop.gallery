import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function fleckField(tube: Node<'vec2'>) {
  const q = tube.mul(vec2(84, 19))
  const cell = q.floor()
  const local = q.fract().sub(0.5)
  const random = cellNoiseVec3(vec3(cell.x.add(0.5), cell.y.add(0.5), 17.8))
  const distance = local.length()
  const fleck = distance.smoothstep(0.08, 0.22).oneMinus().mul(random.z.smoothstep(0.66, 0.86))
  const foil = distance.smoothstep(0.14, 0.32).oneMinus().mul(random.x.smoothstep(0.58, 0.82))
  return {
    cell,
    local,
    random,
    distance,
    fleck,
    foil,
  }
}

/** A living stellar bestiary drawn from connected pinpricks of light. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.35)
    this.name = knotData.id
    const tube = uv()
    const {p, grazing, near, intimate} = viewerFrame()
    const field = fleckField(tube)
    const flow = p.dot(vec3(1.3, 2.1, -0.7)).add(time.mul(0.06)).add(mx_noise_float(p.mul(2.2)).mul(1.8))
    const brushed = flow.sin().mul(0.5).add(0.5)
    const red = mix(color(hsl.integer(21, 94, 12.4)), color(hsl.integer(28, 95.6, 53)), brushed.pow(1.8).mul(0.76).add(0.16))
    const gold = mix(color(hsl.integer(55, 84, 40)), color(hsl.integer(84, 100, 87)), field.random.y)
    const leaf = field.foil.mul(field.random.z.smoothstep(0.4, 0.7))
    const height = field.fleck.mul(0.012).add(field.foil.mul(0.025)).add(brushed.mul(0.002))
    this.positionNode = p.add(normalLocal.mul(height.mul(near.mul(0.4).add(0.6)).mul(0.0017)))
    this.colorNode = mix(red, gold, leaf.mul(0.8)).add(color(hsl.integer(37, 100, 68)).mul(brushed).mul(grazing).mul(0.08))
    this.metalnessNode = leaf.mul(0.9).add(field.fleck.mul(0.55))
    this.roughnessNode = float(0.1).add(field.foil.mul(0.12)).add(field.fleck.mul(0.17)).sub(grazing.mul(0.025)).clamp(0.045, 0.36)
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.025).add(field.fleck.mul(0.08))
    this.normalNode = proceduralNormal(height.mul(1.3), 0.0014)
    this.iridescenceNode = field.fleck.mul(0.18).add(grazing.mul(0.08))
    this.iridescenceThicknessNode = field.random.x.mul(300).add(80)
    const sparkle = glints(normalViewGeometry, 150).mul(field.fleck).mul(near)
    this.emissiveNode = color(hsl.integer(94, 100, 94.7)).mul(sparkle.mul(0.65)).add(color(hsl.integer(31.4, 100, 59.7)).mul(brushed).mul(grazing).mul(intimate).mul(0.12))
    this.aoNode = float(0.78).add(field.foil.mul(0.22))
  }
}
