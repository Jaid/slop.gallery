import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn, mix, negateOnBackSide, positionView, positionViewDirection, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

function terraceFields(tube: Node<'vec2'>) {
  const su = tube.x.mul(34)
  const sv = tube.y.mul(15)
  const id = vec2(su.floor(), sv.floor())
  const rnd = cellNoiseVec3(vec3(id.x.add(0.5), id.y.add(0.5), 9.1))
  const rotA = rnd.x.mul(Math.PI * 2)
  const cu = su.fract().sub(0.5)
  const cv = sv.fract().sub(0.5)
  const ru = cu.mul(rotA.cos()).sub(cv.mul(rotA.sin())).mul(0.62)
  const rv = cu.mul(rotA.sin()).add(cv.mul(rotA.cos()))
  const d = ru.abs().max(rv.abs())
  const sizeVar = rnd.y.mul(0.3).add(0.8)
  const sRaw = d.mul(-2).add(1).mul(sizeVar).clamp(0, 1)
  const level = sRaw.mul(5).floor()
  const stair = level.div(5)
  const border = d.smoothstep(0.42, 0.5)
  const ringField = sRaw.mul(5)
  const ringDist = ringField.fract().sub(0.5).abs()
  const ringW = ringField.fwidth().max(0.02)
  const edge = ringDist.smoothstep(float(0.5).sub(ringW.mul(1.6)).max(0.01), 0.5)
  const height = stair.mul(0.055).mul(border.oneMinus()).sub(border.mul(0.018))
  return {
    rnd,
    stair,
    border,
    edge,
    height,
  }
}
const terracePosition = Fn(([
  tube,
]: [
  Node<'vec2'>,
]) => {
  const {position: p, normal} = knotFrame(tube)
  const {height} = terraceFields(tube)
  return p.add(normal.mul(height))
})

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const tube = uv()
    const fields = terraceFields(tube)
    const epsilon = 0.0001
    const du = terracePosition(tube.add(vec2(epsilon, 0))).sub(terracePosition(tube.sub(vec2(epsilon, 0))))
    const dv = terracePosition(tube.add(vec2(0, epsilon))).sub(terracePosition(tube.sub(vec2(0, epsilon))))
    const normal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.positionNode = terracePosition(tube)
    this.normalNode = negateOnBackSide(normal)
    this.clearcoatNormalNode = this.normalNode
    const facing = normal.dot(positionViewDirection).abs().clamp()
    const near = positionView.length().smoothstep(1, 5).oneMinus()
    const hue = fields.stair.mul(3.4).add(fields.rnd.z.mul(5)).add(facing.mul(2.2)).add(time.mul(0.04))
    const oxide = spectralColor(hue).mul(0.62).add(0.3)
    const inCrystal = fields.border.oneMinus()
    const crystalColor = mix(color(hsl.integer(297, 41, 10)), oxide.mul(fields.edge.oneMinus().mul(0.25).add(0.75)), inCrystal)
    this.colorNode = crystalColor
    this.metalness = 0.88
    this.roughnessNode = float(0.2).mix(0.55, fields.border)
    this.clearcoat = 0.4
    this.clearcoatRoughness = 0.15
    this.iridescence = 0.3
    this.iridescenceThicknessNode = facing.mul(300).add(150)
    this.emissiveNode = oxide.mul(fields.edge).mul(0.35).mul(near.mul(0.6).add(0.4))
      .add(color(hsl.integer(0, 0, 100)).mul(fields.edge).mul(facing.pow(3)).mul(0.5))
      .add(spectralColor(hue.add(2)).mul(inCrystal).mul(near.oneMinus()).mul(0.12))
  }
}
