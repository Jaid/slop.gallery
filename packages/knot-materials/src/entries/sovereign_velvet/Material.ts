import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentView, color, float, mix, mx_noise_float, positionViewDirection, tangentView, time, uv, vec2, vec3} from 'three/tsl'

import {enamel, etch, filteredCos, ornamentCell, polarAngle, turn} from '../../candidates/gpt_sol/lib/ornamentAtlas.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Cut-pile velvet and raised Jacquard goldwork; the color reversal belongs to the fibers, not a rainbow ramp. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = data.id
    const tube = uv()
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const {q, random} = ornamentCell(tube, 16, 2, 15)
    const local = vec2(q.x.mul(1.08), q.y)
    const r = local.length()
    const theta = polarAngle(local)
    const petalRadius = theta.mul(6).cos().mul(0.055).add(0.235)
    const flowerDistance = r.sub(petalRadius)
    const flower = enamel(flowerDistance)
    const embroidery = etch(flowerDistance, 0.007)
      .add(etch(r.sub(0.072), 0.007))
    const curlingStem = local.x.sub(local.y.mul(TAU * 1.5).sin().mul(0.08))
    const stem = etch(curlingStem, 0.008).mul(enamel(r.sub(0.445))).mul(flower.oneMinus())
    const leafA = turn(local.sub(vec2(0.14, 0.31)), -0.65).div(vec2(0.092, 0.15)).length().sub(1)
    const leafB = turn(local.sub(vec2(-0.14, -0.31)), -0.65).div(vec2(0.092, 0.15)).length().sub(1)
    const leaf = enamel(leafA).add(enamel(leafB)).clamp()
    const leafEdge = etch(leafA, 0.065).add(etch(leafB, 0.065)).clamp()
    const scroll = etch(r.sub(theta.mul(4).sin().mul(0.016).add(0.408)), 0.0025)
    const goldMask = embroidery.add(stem).add(leafEdge).add(scroll.mul(0.8)).clamp()
    const jacquard = flower.mul(0.8).add(leaf.mul(0.7)).clamp()
    const warpPhase = tube.x.mul(TAU * 880)
    const weftPhase = tube.y.mul(TAU * 100)
    const warp = filteredCos(warpPhase).mul(0.5).add(0.5)
    const weft = filteredCos(weftPhase).mul(0.5).add(0.5)
    const thread = warp.mul(0.58).add(weft.mul(0.42))
    const roughNap = mx_noise_float(p.mul(140)).mul(0.5).add(0.5)
    const along = positionViewDirection.dot(tangentView.normalize())
    const across = positionViewDirection.dot(vec3(bitangentView as unknown as import('three/webgpu').Node<'vec3'>).normalize())
    const lay = along.mul(theta.cos()).add(across.mul(theta.sin())).mul(0.5).add(0.5)
    const pressure = tube.x.mul(TAU * 3).sub(time.mul(0.28)).add(tube.y.mul(TAU)).sin().mul(0.5).add(0.5)
    const reverse = lay.smoothstep(0.2, 0.8).mul(grazing.mul(0.6).add(0.4))
    const velvet = mix(color(hsl.integer(359, 73, 11)), color(hsl.integer(2, 81, 26)), facing.mul(0.6).add(pressure.mul(0.16)))
    const pileColor = mix(velvet, color(hsl.integer(293, 67, 19.4)), reverse.mul(0.72))
    const cutPile = mix(pileColor, pileColor.mul(1.65).add(color(hsl.integer(354, 74, 14)).mul(0.1)), jacquard)
    const spunGold = mix(color(hsl.integer(53, 58, 34)), color(hsl.integer(79, 58, 76)), lay.mul(0.4).add(thread.mul(0.3)).add(random.y.mul(0.08)).add(0.2))
    this.colorNode = mix(cutPile.mul(thread.mul(0.08).add(0.94)), spunGold, goldMask)
    this.metalnessNode = goldMask.mul(0.78)
    this.roughnessNode = mix(float(0.86).sub(jacquard.mul(0.17)), float(0.38), goldMask)
      .sub(pressure.mul(0.03)).clamp(0.31, 0.9)
    this.sheen = 1
    this.sheenNode = mix(color(hsl.integer(9, 84, 50)), color(hsl.integer(292, 53, 48)), reverse).mul(goldMask.mul(-0.7).add(0.85))
    this.sheenRoughnessNode = mix(float(0.55), float(0.32), jacquard)
    this.anisotropy = 0.65
    this.anisotropyNode = vec2(theta.cos(), theta.sin()).mul(goldMask.mul(0.25).add(0.4))
    this.clearcoat = 0
    const napHeight = warp.mul(weft).mul(0.00022).mul(intimate.mul(0.5).add(0.5))
    const relief = jacquard.mul(0.0006).add(goldMask.mul(0.00085)).add(napHeight)
    this.normalNode = proceduralNormal(relief.add(roughNap.mul(0.000025)), 0.55)
    // The very faint warm underlight avoids crushing burgundy fibers in a dim gallery.
    this.emissiveNode = color(hsl.integer(360, 77, 22)).mul(grazing.pow(2)).mul(0.012)
      .add(color(hsl.integer(71, 61, 78)).mul(goldMask).mul(pressure.pow(5)).mul(near).mul(0.014))
  }
}
