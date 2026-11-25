import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, mx_noise_vec3, normalLocal, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Drowned tesserae under a skin of water. Caustics stay soft at a distance, draw themselves sharp up close, and slide when the eye changes angle. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {p, view, facing, grazing, objectDistance} = viewerFrame()
    const proximity = objectDistance.smoothstep(1.5, 4.6).oneMinus()
    const q = p.add(view.mul(facing.mul(0.18).add(0.03)))
    const travel = time.mul(0.48)
    const n1 = mx_noise_float(q.mul(1.4).add(vec3(travel, travel.mul(0.25), 0.2)))
    const n2 = mx_noise_float(q.mul(1.9).add(vec3(2.8, travel.mul(-0.55), 1.1)))
    const phaseA = q.dot(vec3(7.2, 1.4, 3.6)).add(n1.mul(2.2)).add(travel.mul(1.4))
    const phaseB = q.dot(vec3(-2.8, 6.4, 4.4)).add(n2.mul(2)).sub(travel.mul(1.15))
    const phaseC = q.dot(vec3(2.2, -5.5, 7.6)).add(n1).add(n2.mul(0.7)).add(travel.mul(0.7))
    const s1 = phaseA.sin()
    const s2 = phaseB.sin()
    const s3 = phaseC.sin()
    const net = s1.mul(s2).add(s2.mul(s3)).add(s3.mul(s1))
    const fine = q.mul(2.4).dot(vec3(4.6, 7.2, -3.1)).sub(travel.mul(1.7)).add(n2.mul(1.4)).sin().mul(s1).mul(0.5).add(0.5)
    const light = net.mul(0.33).add(0.5).clamp(0, 1).pow(2.4).add(fine.pow(3).mul(proximity).mul(0.55))
    const caustic = light.clamp(0, 1.2).div(1.2).pow(proximity.mul(1.8).add(0.55))
    const warp = mx_noise_vec3(p.mul(0.7)).mul(0.12)
    const grid = p.add(warp).mul(5.4)
    const rnd = cellNoiseVec3(grid.floor())
    const local = grid.fract().sub(0.5).abs()
    const edge = local.x.max(local.y).max(local.z)
    const fw = edge.fwidth().max(0.0015)
    const inner = float(0.43).sub(fw.mul(0.7)).min(0.47)
    const grout = edge.smoothstep(inner, inner.add(fw.add(0.02)))
    const choice = rnd.x.mul(3.999)
    const tile = choice.lessThan(1).select(color(hsl.integer(82, 45, 85)), choice.lessThan(2).select(color(hsl.integer(49, 60, 54)), choice.lessThan(3).select(color(hsl.integer(188, 45, 60)), color(hsl.integer(27, 55, 57)))))
    const tileColor = mix(tile.mul(0.72), tile, rnd.y.mul(0.35).add(0.62))
    const wet = mix(tileColor.mul(0.62), tileColor, facing.pow(0.5))
    const shaded = wet.mul(caustic.mul(0.85).add(0.28))
    const axis = rnd.sub(0.5)
    const align = axis.dot(view).div(axis.length().max(0.2)).smoothstep(0.28, 0.82)
    const glass = rnd.z.smoothstep(0.74, 0.86).mul(align).mul(grout.oneMinus())
    const glassColor = mix(color(hsl.integer(236, 99, 79)), color(hsl.integer(78, 100, 86.7)), rnd.y)
    const fresco = mix(shaded, color(hsl.integer(67, 12, 8)), grout.mul(0.92))
    this.colorNode = mix(fresco, glassColor, glass.mul(0.8)).mul(grazing.pow(1.25).mul(0.32).oneMinus())
    this.metalnessNode = glass.mul(0.25)
    this.roughnessNode = float(0.62).sub(glass.mul(0.36)).sub(caustic.mul(0.08)).clamp(0.12, 0.8)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.04
    this.ior = 1.38
    const causticColor = mix(color(hsl.integer(187, 65, 82)), color(hsl.integer(87, 100, 92.3)), caustic.clamp(0, 1))
    this.emissiveNode = causticColor.mul(caustic.pow(1.15)).mul(grout.oneMinus().mul(0.78).add(0.22)).mul(facing.pow(0.45)).mul(1.25)
      .add(glassColor.mul(glass).mul(0.85))
    const raised = edge.smoothstep(0.14, 0.46).oneMinus()
    this.normalNode = proceduralNormal(raised.sub(grout.mul(0.4)), 0.014)
    this.clearcoatNormalNode = liquidNormal(proximity.mul(1.2).add(0.25), 0.7)
    this.positionNode = p.add(normalLocal.mul(raised.mul(0.006)))
  }
}
