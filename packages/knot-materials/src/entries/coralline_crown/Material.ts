import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, Fn, mix, modelWorldMatrixInverse, negateOnBackSide, positionView, positionViewDirection, time, transformNormalToView, uv, varying, vec2, vec4} from 'three/tsl'

import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import knotData from './data.ts'

function crownFields(tube: Node<'vec2'>) {
  const u = tube.x.mul(Math.PI * 24).add(tube.y.mul(Math.PI * 8).sin().mul(0.35))
  const v = tube.y.mul(Math.PI * 8)
  const radius = u.mul(0.5).sin().abs().pow(2).add(v.mul(0.5).sin().abs().pow(2)).max(0.00001).sqrt()
  return {
    crown: radius.sub(0.48).abs().pow(2).mul(-26).exp(),
    bowl: radius.pow(2).mul(-18).exp(),
    breath: time.mul(0.55).add(u.mul(0.25)).sin().mul(0.075).add(0.925),
  }
}
const reliefPosition = Fn(([
  tube,
]: [
  Node<'vec2'>,
]) => {
  const {position: p, normal} = knotFrame(tube)
  const cameraLocal = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
  const proximity = cameraLocal.sub(p).length().smoothstep(1, 5).oneMinus()
  const {crown, bowl, breath} = crownFields(tube)
  const height = crown.mul(knotData.displacement).mul(breath).sub(bowl.mul(0.04)).mul(proximity.mul(0.28).add(0.72))
  return p.add(normal.mul(height))
})

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const tube = uv()
    const {crown, bowl, breath} = crownFields(tube)
    this.positionNode = reliefPosition(tube)
    // Sample neighboring surface points in the vertex stage, then interpolate the true displaced normal.
    const epsilon = 0.0001
    const du = reliefPosition(tube.add(vec2(epsilon, 0))).sub(reliefPosition(tube.sub(vec2(epsilon, 0))))
    const dv = reliefPosition(tube.add(vec2(0, epsilon))).sub(reliefPosition(tube.sub(vec2(0, epsilon))))
    const normal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.normalNode = negateOnBackSide(normal)
    this.clearcoatNormalNode = this.normalNode
    const facing = normal.dot(positionViewDirection).abs().clamp()
    const near = positionView.length().smoothstep(1, 5).oneMinus()
    this.colorNode = mix(mix(color(hsl.integer(205, 72, 24)), color(hsl.integer(46, 75, 48)), crown.smoothstep(0.08, 0.8)), color(hsl.integer(80, 71, 86.3)), crown.pow(4))
    this.metalness = 0.85
    this.roughnessNode = crown.mul(-0.24).add(0.4)
    this.clearcoat = 0.25
    this.clearcoatRoughness = 0.12
    this.iridescenceNode = facing.oneMinus().mul(0.65)
    this.iridescenceThicknessNode = crown.mul(260).add(180)
    this.emissiveNode = mix(color(hsl.integer(180, 98.6, 67)), color(hsl.integer(219, 100, 88)), facing).mul(bowl).mul(near.mul(0.7).add(0.08)).mul(breath)
  }
}
