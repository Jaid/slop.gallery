import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_worley_noise_vec3, time, uv, vec2} from 'three/tsl'

import {enamel, etch, filteredCos, ornamentCell, polarAngle, turn} from '../../candidates/gpt_sol/lib/ornamentAtlas.ts'
import {tubeRay} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

function blueGarden(tube: Node<'vec2'>, breath: Node<'float'>) {
  const {q, random} = ornamentCell(tube, 16, 2, 29)
  const sway = time.mul(0.19).add(random.z.mul(TAU)).sin().mul(0.06)
  const local = turn(q.sub(vec2(random.x.sub(0.5).mul(0.11), 0.015)), random.y.sub(0.5).mul(0.7).add(sway))
  const r = local.length()
  const a = polarAngle(local)
  const radius = a.mul(5).cos().mul(0.045).add(0.155).add(breath.mul(0.012))
  const petalDistance = r.sub(radius)
  const bloom = enamel(petalDistance)
  const petalEdge = etch(petalDistance, 0.008)
  const petalRibs = filteredCos(a.mul(15).add(r.mul(43))).mul(0.5).add(0.5)
  const stamen = etch(r.sub(0.037), 0.007).add(enamel(r.sub(0.022))).clamp()
  const stemField = q.x.sub(q.y.mul(TAU).sin().mul(0.115))
  const stem = etch(stemField, 0.009).mul(bloom.oneMinus())
  const shoot = etch(q.x.add(q.y.mul(0.65)).sub(0.2), 0.004)
    .mul(enamel(q.y.abs().sub(0.32))).mul(enamel(q.x.abs().sub(0.28))).mul(bloom.oneMinus())
  const left = turn(q.sub(vec2(-0.17, 0.25)), -0.8)
  const right = turn(q.sub(vec2(0.17, -0.25)), -0.8)
  const leafA = left.div(vec2(0.09, 0.17)).length().sub(1)
  const leafB = right.div(vec2(0.09, 0.17)).length().sub(1)
  const leaves = enamel(leafA).add(enamel(leafB)).clamp()
  const veins = etch(left.x, 0.005).mul(enamel(leafA)).add(etch(right.x, 0.005).mul(enamel(leafB)))
  const leafBrush = filteredCos(q.y.mul(150).add(q.x.mul(45))).mul(0.15).add(0.65)
  const pigment = bloom.mul(petalRibs.mul(0.24).add(0.34))
    .add(petalEdge.mul(0.6)).add(stamen.mul(0.95)).add(stem.mul(0.8)).add(shoot.mul(0.6))
    .add(leaves.mul(leafBrush)).add(veins.mul(0.3)).clamp()
  return {
    pigment,
    bloom,
    leaves,
    petalDistance,
  }
}

/** Underglaze brushwork, pooled celadon glaze, crazing and sparse, genuinely metallic repairs. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = data.id
    const tube = uv()
    const {p, grazing, near, intimate} = viewerFrame()
    const garden = blueGarden(tube, near)
    const phantom = blueGarden(tube.sub(tubeRay().mul(0.012)), near)
    const porcelainGrain = mx_noise_float(p.mul(110)).mul(0.5).add(0.5)
    const pooling = mx_noise_float(p.mul(5.5)).mul(0.5).add(0.5)
    const crackCells = mx_worley_noise_vec3(p.mul(10.5), 0.9, 0)
    const crackField = crackCells.y.sub(crackCells.x)
    const repairSelector = mx_noise_float(p.mul(3).add(17)).smoothstep(0.13, 0.33)
    const repair = etch(crackField, 0.009).mul(repairSelector)
    const hairlineCells = mx_worley_noise_vec3(p.mul(49), 0.82, 0)
    const craze = etch(hairlineCells.y.sub(hairlineCells.x), 0.004)
      .mul(intimate.mul(0.6).add(0.15)).mul(repairSelector.oneMinus().mul(0.5).add(0.5))
    const ivory = mix(color(hsl.integer(90, 46, 91.7)), color(hsl.integer(166, 20, 83)), pooling.mul(0.21))
    const cobalt = mix(color(hsl.integer(259, 76, 22)), color(hsl.integer(253, 73, 43)), pooling)
    const painting = mix(ivory, cobalt, garden.pigment)
    const ghostInk = phantom.pigment.sub(garden.pigment.mul(0.8)).max(0).mul(grazing.pow(2)).mul(0.12)
    const glazed = mix(painting, color(hsl.integer(210, 42, 74)), ghostInk)
    const aged = mix(glazed, color(hsl.integer(200, 27, 54)), craze.mul(0.12))
    const gold = mix(color(hsl.integer(80, 72, 56)), color(hsl.integer(90, 67, 81)), porcelainGrain.mul(0.45).add(0.35))
    this.colorNode = mix(aged.mul(porcelainGrain.mul(0.012).add(0.991)), gold, repair)
    this.metalnessNode = repair.mul(0.92)
    this.roughnessNode = float(0.21).add(pooling.mul(0.055)).add(craze.mul(0.06))
      .sub(garden.pigment.mul(0.035)).add(repair.mul(0.035))
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.07).add(pooling.mul(0.035)).add(craze.mul(0.04))
    this.ior = 1.5
    this.normalNode = proceduralNormal(pooling.mul(0.00028).add(porcelainGrain.mul(0.000018))
      .add(repair.mul(0.00035)).sub(craze.mul(0.00012)).add(garden.pigment.mul(0.000045)), 0.9)
    this.clearcoatNormalNode = proceduralNormal(pooling.mul(0.00028).sub(craze.mul(0.00005)), 0.7)
    this.emissiveNode = color(hsl.integer(220, 40, 61)).mul(ghostInk).mul(0.065)
      .add(color(hsl.integer(87, 58, 83)).mul(repair).mul(near).mul(0.012))
  }
}
