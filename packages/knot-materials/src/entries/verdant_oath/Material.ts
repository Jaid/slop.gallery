import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_atan2, mx_noise_float, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {fill, rotatePoint, stroke, wave} from '../../candidates/gpt_astra/lib/exhibition/pattern.ts'
import {beads} from '../../lib/beads.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Maki-e ginkgo fans: mineral green inlay, leaf-gold veins and scattered gold powder on oxblood lacquer. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, facing, grazing, intimate} = viewerFrame()
    const tube = uv()
    const period = vec2(20, 2)
    const q = tube.mul(period)
    const rnd = cellNoiseVec3(vec3(wrapCell(q.floor(), period), 93.1))
    const local = rotatePoint(q.fract().sub(0.5), rnd.z.sub(0.5).mul(1.25))
    const leafPoint = local.add(vec2(0, 0.2))
    const r = leafPoint.length()
    const angle = mx_atan2(leafPoint.x, leafPoint.y.add(0.00001)) as unknown as Node<'float'>
    const fw = q.fwidth().length().max(0.0001)
    const breath = time.mul(0.29).add(rnd.x.mul(TAU)).sin().mul(0.014)
    const notch = angle.abs().smoothstep(0.02, 0.22).oneMinus().mul(0.068)
    const leafRadius = float(0.47).add(angle.mul(11).cos().mul(0.016)).add(breath).sub(notch)
    const angularEdge = angle.abs().sub(1.04).mul(r)
    const leaf = fill(r.sub(leafRadius), fw).mul(fill(angularEdge, fw)).mul(r.smoothstep(0.055, 0.11))
    const outline = stroke(r.sub(leafRadius), 0.008, fw).max(stroke(angularEdge, 0.005, fw)).mul(leaf)
    const veins = wave(angle.mul(42).add(r.mul(7))).smoothstep(0.75, 0.96).mul(leaf)
      .mul(r.smoothstep(0.08, 0.16))
    const stem = stroke(local.x.sub(local.y.mul(0.07)), 0.006, fw)
      .mul(fill(local.y.add(0.3).abs().sub(0.13), fw))
    const goldMask = outline.max(veins.mul(0.65)).max(stem)
    const tide = tube.x.mul(TAU * 3).sub(time.mul(0.23)).add(angle.mul(0.3)).sin().mul(0.5).add(0.5)
    const lacquer = mix(color(hsl.integer(330, 40, 8)), color(hsl.integer(11, 62, 19)), mx_noise_float(p.mul(3)).mul(0.3).add(0.35))
    const mineral = mix(color(hsl.integer(185, 80, 38)), color(hsl.integer(140, 35, 66)), facing.mul(0.5).add(tide.mul(0.25)).add(rnd.y.mul(0.15)))
    const gold = mix(color(hsl.integer(67, 70, 49)), color(hsl.integer(84, 65, 82)), grazing.mul(0.3).add(tide.mul(0.35)).add(0.2))
    const powder = beads(p.mul(240), 36)
    const dust = powder.mask.mul(powder.random.z.smoothstep(0.72, 0.9)).mul(intimate).mul(leaf.oneMinus())
    this.colorNode = mix(mix(lacquer, mineral, leaf), gold, goldMask.max(dust))
    this.metalnessNode = mix(float(0.08), float(0.88), goldMask.max(dust))
    this.roughnessNode = mix(float(0.23), float(0.32), leaf).sub(goldMask.mul(0.05))
    const grain = mx_noise_float(p.mul(48))
    this.normalNode = proceduralNormal(leaf.mul(0.00045).add(goldMask.mul(0.0003)).add(grain.mul(0.00005)), 1)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.075
    this.clearcoatNormalNode = normalViewGeometry
    this.iridescenceNode = leaf.mul(goldMask.oneMinus()).mul(0.18)
    this.iridescenceThicknessNode = r.mul(80).add(360)
    this.aoNode = outline.mul(-0.07).add(1)
  }
}
