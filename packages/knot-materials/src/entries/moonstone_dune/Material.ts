import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalLocal, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function duneField(tube: Node<'vec2'>, p: Node<'vec3'>) {
  const q = tube.mul(vec2(21, 11))
  const cell = q.floor()
  const local = q.fract().sub(0.5)
  const random = cellNoiseVec3(vec3(cell.x.add(0.5), cell.y.add(0.5), 4.4))
  const dune = q.x.mul(1.3).add(q.y.mul(0.36).sin().mul(0.8)).add(p.dot(vec3(1.7, -0.8, 2.2)).mul(0.42))
  const ripple = dune.sin().mul(0.5).add(0.5)
  const crest = dune.sin().abs().smoothstep(0.15, 0.5).oneMinus()
  const grain = local.length().smoothstep(0.08, 0.24).oneMinus().mul(random.y.smoothstep(0.36, 0.74))
  return {
    q,
    cell,
    local,
    random,
    dune,
    ripple,
    crest,
    grain,
  }
}

/** A living stellar bestiary drawn from connected pinpricks of light. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const tube = uv()
    const {p, view, grazing, near} = viewerFrame()
    const field = duneField(tube, p)
    const drift = time.mul(0.018).add(tube.x.mul(1.7)).sin().mul(0.5).add(0.5)
    const angle = view.dot(vec3(-0.6, 0.18, 0.78).normalize()).mul(0.5).add(0.5)
    const fire = spectralColor(field.ripple.mul(0.7).add(angle.mul(0.8)).add(drift.mul(0.12))).mul(0.58).add(0.25)
    const stone = mix(color(hsl.integer(79, 19, 42)), color(hsl.integer(83, 35, 79)), field.ripple.mul(0.55).add(field.random.x.mul(0.22)))
    const height = field.ripple.mul(0.027).add(field.crest.mul(0.018)).add(field.grain.mul(0.008))
    this.positionNode = p.add(normalLocal.mul(height.mul(near.mul(0.55).add(0.45)).mul(0.002)))
    this.colorNode = mix(stone, fire, field.crest.mul(0.38).add(field.grain.mul(0.2)).add(grazing.mul(0.12)))
    this.metalnessNode = field.grain.mul(0.22)
    this.roughnessNode = float(0.38).sub(field.ripple.mul(0.11)).add(field.grain.mul(0.16)).clamp(0.16, 0.58)
    this.sheen = 0.62
    this.sheenColor.set(hsl.integer(267, 100, 86))
    this.sheenRoughness = 0.4
    this.clearcoatNode = field.ripple.mul(0.22)
    this.clearcoatRoughness = 0.12
    this.normalNode = proceduralNormal(height.mul(1.5), 0.0017)
    this.iridescenceNode = field.crest.mul(0.4).add(grazing.mul(0.18))
    this.iridescenceIOR = 1.3
    this.iridescenceThicknessNode = field.ripple.mul(260).add(100)
    const sparkle = glints(normalViewGeometry, 110).mul(field.grain).mul(near)
    this.emissiveNode = fire.mul(field.crest.mul(grazing).mul(near).mul(0.2)).add(color(hsl.integer(261, 100, 92)).mul(sparkle.mul(0.36)))
    this.aoNode = float(0.7).add(field.ripple.mul(0.3))
  }
}
