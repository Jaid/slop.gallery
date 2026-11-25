import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** An ornamental repeat of petals, vines and moons drawn as a single metallic thread. */
function brocadePattern(grid: Node<'vec2'>, seed: number) {
  const cell = grid.floor()
  const random = cellNoiseVec3(vec3(cell.x.add(0.5), cell.y.add(0.5), seed))
  const local = grid.fract().sub(0.5)
  const angle = random.x.sub(0.5).mul(0.22)
  const point = vec2(local.x.mul(angle.cos()).sub(local.y.mul(angle.sin())), local.x.mul(angle.sin()).add(local.y.mul(angle.cos())))
  const line = (field: Node<'float'>, width: number) => hairline(field.sub(width), width)
  const petal = (center: Node<'vec2'>, scale: Node<'vec2'>, width = 0.008) => line(point.sub(center).div(scale).length().sub(1).mul(scale.x.min(scale.y)), width)
  let zari: Node<'float'> = line(point.length().sub(0.075), 0.009)
  zari = zari.max(petal(vec2(0, 0.07), vec2(0.065, 0.115)))
  zari = zari.max(petal(vec2(-0.1, 0), vec2(0.05, 0.09)))
  zari = zari.max(petal(vec2(0.1, 0), vec2(0.05, 0.09)))
  zari = zari.max(petal(vec2(0, -0.08), vec2(0.06, 0.09)))
  zari = zari.max(petal(vec2(-0.18, 0.16), vec2(0.035, 0.07), 0.006))
  zari = zari.max(petal(vec2(0.18, 0.16), vec2(0.035, 0.07), 0.006))
  zari = zari.max(petal(vec2(-0.18, -0.16), vec2(0.035, 0.07), 0.006))
  zari = zari.max(petal(vec2(0.18, -0.16), vec2(0.035, 0.07), 0.006))
  const vine = point.y.sub(0.22).add(point.x.mul(9).sin().mul(0.11))
  zari = zari.max(line(vine, 0.007).mul(point.x.abs().smoothstep(0.37, 0.29)))
  const lowerVine = point.y.add(0.22).sub(point.x.mul(7).sin().mul(0.075))
  zari = zari.max(line(lowerVine, 0.006).mul(point.x.abs().smoothstep(0.35, 0.27)))
  const border = point.x.abs().sub(0.405)
  zari = zari.max(line(border, 0.006).mul(point.y.abs().smoothstep(0.4, 0.33)))
  return {
    random,
    zari,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.72)
    this.name = knotData.id
    const {p, view, facing, grazing, near} = viewerFrame()
    const tube = uv()
    const grid = vec2(tube.x.mul(18).add(p.y.mul(0.12)), tube.y.mul(5).add(p.z.mul(0.16)))
    const deepGrid = grid.add(vec2(view.x.mul(-0.038), view.y.mul(-0.026)))
    const front = brocadePattern(grid, 6.2)
    const deep = brocadePattern(deepGrid, 6.2)
    const zari = front.zari.max(deep.zari.mul(0.16))
    const phaseWarp = tube.x.mul(TAU * 220)
    const phaseWeft = tube.y.mul(TAU * 64)
    const warp = phaseWarp.cos().mul(0.5).add(0.5)
    const weft = phaseWeft.cos().mul(0.5).add(0.5)
    const footprint = phaseWarp.fwidth().max(phaseWeft.fwidth())
    const resolved = footprint.smoothstep(1.4, 4.5).oneMinus()
    const weave = mix(float(0.5), warp.mul(weft).mul(0.72).add(warp.add(weft).mul(0.14)), resolved)
    const moon = front.random.x.mul(0.15).add(deep.random.y.mul(0.08)).add(facing.mul(0.12))
    let silk = mix(color(hsl.integer(291, 60, 8)), color(hsl.integer(306, 69, 20)), moon)
    silk = mix(silk, color(hsl.integer(309, 31, 45)), grazing.pow(2).mul(0.34))
    const gold = mix(color(hsl.integer(63, 80, 40)), color(hsl.integer(87, 100, 91)), front.random.z)
    const height = zari.mul(0.38).add(weave.mul(near).mul(0.12))
    const normal = proceduralNormal(height, 0.0025)
    this.normalNode = normal
    this.clearcoatNormalNode = normal
    this.colorNode = mix(silk, gold, zari).add(gold.mul(weave).mul(near).mul(0.08))
    this.metalnessNode = zari.mul(0.88)
    this.roughnessNode = mix(float(0.46), float(0.19), zari).add(weave.mul(near).mul(0.035))
    this.clearcoat = 0.08
    this.clearcoatRoughness = 0.32
    this.sheen = 0.95
    this.sheenRoughness = 0.3
    this.sheenColor.set(hsl.integer(293, 54, 68))
    this.anisotropy = 0.6
    this.anisotropyRotation = 0
    const threadFlash = glints(normal, 92)
    this.emissiveNode = gold.mul(zari).mul(threadFlash).mul(near.mul(0.18).add(0.035))
      .add(color(hsl.integer(300, 58, 73)).mul(grazing.pow(4)).mul(0.045))
  }
}
