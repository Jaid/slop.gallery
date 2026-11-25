import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn as fn, mix, negateOnBackSide, positionView, transformNormalToView, uv, varying, vec2} from 'three/tsl'

import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

function bonbonPhase(tube: Node<'vec2'>) {
  return tube.y.add(tube.x.mul(3)).mul(TAU)
}
/** Six rounded sugar flutes: displacement ∈ [−0.018, 0.010] meters. */
function bonbonOffset(tube: Node<'vec2'>) {
  const flute = bonbonPhase(tube).mul(6).cos().mul(0.5).add(0.5)
  return flute.mul(0.024).sub(0.016).add(tube.x.mul(TAU * 8).sin().mul(0.002))
}
const bonbonPosition = fn(([tube]: [Node<'vec2'>]) => {
  const frame = knotFrame(tube)
  return frame.position.add(frame.normal.mul(bonbonOffset(tube)))
})

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const tube = uv()
    const phase = bonbonPhase(tube)
    this.positionNode = bonbonPosition(tube)
    // Differentiate the actual displaced surface; the lacquer highlights follow every flute.
    const epsilon = 0.0001
    const along = bonbonPosition(tube.add(vec2(epsilon, 0))).sub(bonbonPosition(tube.sub(vec2(epsilon, 0))))
    const around = bonbonPosition(tube.add(vec2(0, epsilon))).sub(bonbonPosition(tube.sub(vec2(0, epsilon))))
    const normal = varying(transformNormalToView(along.cross(around).normalize())).normalize()
    this.normalNode = negateOnBackSide(normal)
    this.clearcoatNormalNode = this.normalNode
    const pigment = phase.mul(2).cos().smoothstep(-0.12, 0.12)
    const groove = phase.mul(6).cos().mul(-0.5).add(0.5)
    const footprint = phase.fwidth().mul(6).max(0.001)
    const piping = groove.smoothstep(float(0.82).sub(footprint), float(0.94).add(footprint))
    const sugar = mix(color(hsl.integer(185, 93, 62)), color(hsl.integer(11, 86, 57)), pigment)
    this.colorNode = mix(sugar, color(hsl.integer(87, 100, 95.2)), piping)
    // Fine pulled-sugar striations resolve only at inspection distance.
    const near = positionView.length().smoothstep(1.1, 3.2).oneMinus()
    const striation = phase.mul(144).sin().mul(phase.fwidth().mul(144).smoothstep(0.4, 2).oneMinus()).mul(near)
    this.roughnessNode = float(0.21).add(piping.mul(0.09)).add(striation.mul(0.015))
    this.metalness = 0
    this.ior = 1.47
    this.clearcoat = 0.85
    this.clearcoatRoughness = 0.14
    this.aoNode = groove.mul(-0.12).add(1)
  }
}
