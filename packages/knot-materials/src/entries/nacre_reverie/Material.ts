import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, mix, mx_noise_float, time, uv, vec2} from 'three/tsl'

import {ruled, stroke, wave} from '../../candidates/gpt_astra/lib/surface/coverage.ts'
import {exhibitionFrame} from '../../candidates/gpt_astra/lib/surface/frame.ts'
import {tubeRay} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

function lamella(tube: Node<'vec2'>) {
  const grid = tube.mul(vec2(20, 4))
  const stagger = vec2(grid.x.add(grid.y.floor().mod(2).mul(0.5)), grid.y)
  const q = stagger.fract().sub(0.5)
  const r = vec2(q.x, q.y.add(0.5)).length()
  const angle = atan(q.x, q.y.add(0.52))
  return {
    r,
    angle,
    aa: grid.fwidth().length(),
  }
}
/** Overlapping shell platelets and two buried interference sheets beneath an unbroken pearl varnish. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.82)
    this.name = knotData.id
    const {p, near, intimate, grazing, facing, V, tangent} = exhibitionFrame()
    const ray = tubeRay()
    const surface = lamella(uv())
    const middle = lamella(uv().sub(ray.mul(0.011)))
    const deep = lamella(uv().sub(ray.mul(0.026)))
    const {r, angle, aa} = surface
    const lip = stroke(r.sub(0.81), 0.014, aa)
    const ribs = wave(angle.mul(46).add(r.mul(10)))
    const growth = ruled(r.mul(37).add(angle.mul(0.3)), 0.085)
    const pearlWave = wave(middle.r.mul(12).add(middle.angle.mul(3.5)).add(time.mul(0.45)))
    const undertone = wave(deep.r.mul(9).sub(deep.angle.mul(5)).sub(time.mul(0.27)))
    const silver = mix(color(hsl.integer(182, 25, 61)), color(hsl.integer(44, 24, 81)), facing.mul(0.55).add(pearlWave.mul(0.25)))
    const rose = mix(color(hsl.integer(321, 46, 50)), color(hsl.integer(4, 37, 72)), pearlWave)
    const sea = mix(color(hsl.integer(192, 49, 59)), color(hsl.integer(207, 15, 74)), undertone)
    const pearl = mix(silver, mix(rose, sea, V.dot(tangent).mul(0.5).add(0.5)), grazing.mul(0.38).add(near.mul(0.1)).add(0.22))
    this.colorNode = mix(pearl.mul(ribs.mul(0.1).add(0.9)).mul(pearlWave.mul(0.16).add(0.82)), color(hsl.integer(300, 18, 74)), lip.mul(0.34))
      .mul(growth.mul(intimate).mul(-0.035).add(1))
    this.metalness = 0.38
    this.roughnessNode = float(0.245).sub(pearlWave.mul(0.055)).add(lip.mul(0.08))
    this.ior = 1.58
    this.clearcoat = 1
    this.clearcoatRoughness = 0.115
    this.anisotropyNode = vec2(0.38, 0.06)
    this.iridescenceNode = lip.oneMinus().mul(0.9)
    this.iridescenceIOR = 1.34
    this.iridescenceThicknessNode = pearlWave.mul(230).add(undertone.mul(150)).add(170)
    const crown = r.mul(Math.PI).sin().mul(0.0015)
    const fine = growth.mul(0.000025).add(ribs.mul(0.000075)).mul(intimate.mul(0.65).add(0.35))
    this.normalNode = proceduralNormal(crown.add(lip.mul(0.00022)).add(fine).add(mx_noise_float(p.mul(175)).mul(0.000018)), 1)
    const breath = uv().x.mul(TAU * 2).sub(time.mul(0.21)).sin().mul(0.25).add(0.75)
    this.emissiveNode = mix(rose, sea, undertone).mul(grazing.pow(2)).mul(near.mul(0.2).add(0.8)).mul(breath).mul(0.055)
  }
}
