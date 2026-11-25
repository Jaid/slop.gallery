import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, normalLocal, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function fractureField(tube: Node<'vec2'>) {
  const q = tube.mul(vec2(28, 11))
  const broad = q.x.mul(1.9).add(q.y.mul(0.72).sin()).add(q.y.mul(0.31).cos().mul(0.4))
  const fine = q.x.mul(4.1).add(q.y.mul(1.6).sin().mul(0.7))
  const main = broad.sin().add(fine.sin().mul(0.15)).abs().smoothstep(0.025, 0.14).oneMinus()
  const hair = fine.sin().abs().smoothstep(0.012, 0.065).oneMinus()
  const broadGlow = broad.sin().abs().smoothstep(0.04, 0.24).oneMinus()
  return {
    q,
    main,
    hair,
    broadGlow,
  }
}

/** A living stellar bestiary drawn from connected pinpricks of light. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.65)
    this.name = knotData.id
    const tube = uv()
    const {p, view, grazing, near, intimate} = viewerFrame()
    const field = fractureField(tube)
    const nebula = mx_fractal_noise_float(p.mul(2.5).add(vec3(0, time.mul(0.018), 0)), 4, 2.1, 0.56).mul(0.5).add(0.5)
    const starField = nebula.mul(nebula).mul(nebula)
    const angle = view.dot(vec3(-0.52, 0.18, 0.83).normalize()).mul(0.5).add(0.5)
    const lacquer = mix(color(hsl.integer(276, 29, 5)), color(hsl.integer(285, 52, 10)), nebula.mul(0.5))
    const gold = mix(color(hsl.integer(58, 83, 40)), color(hsl.integer(89, 100, 88.3)), angle).mul(field.main.mul(0.5).add(0.5))
    const height = field.main.mul(-0.022).add(field.hair.mul(0.008)).add(field.broadGlow.mul(0.004))
    this.positionNode = p.add(normalLocal.mul(height.mul(near.mul(0.5).add(0.5)).mul(0.0014)))
    this.colorNode = mix(lacquer, gold, field.main.mul(0.88).add(field.hair.mul(0.2)))
    this.metalnessNode = field.main.mul(0.75).add(field.hair.mul(0.15))
    this.roughnessNode = float(0.16).add(field.hair.mul(0.28)).sub(field.main.mul(0.08)).clamp(0.06, 0.5)
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.025).add(field.main.mul(0.08))
    this.normalNode = proceduralNormal(height.mul(1.2), 0.0015)
    this.iridescenceNode = nebula.mul(0.2).add(field.broadGlow.mul(0.24))
    this.iridescenceThicknessNode = nebula.mul(240).add(100)
    const flash = glints(normalViewGeometry, 130).mul(field.hair).mul(near)
    this.emissiveNode = color(hsl.integer(85, 100, 88.5)).mul(field.main.mul(grazing).mul(0.65).add(flash.mul(0.4))).add(color(hsl.integer(274, 100, 52)).mul(starField.mul(grazing).mul(intimate).mul(0.22)))
    this.aoNode = float(0.74).add(field.main.mul(0.26))
  }
}
