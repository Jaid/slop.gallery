import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function fissure(boundary: Node<'float'>, width: number, softness = 1.2) {
  const footprint = boundary.fwidth().max(0.0001)
  return boundary.smoothstep(width, footprint.mul(1.15).add(width * (1 + softness))).oneMinus()
}
/** Glazed midnight porcelain with a genuinely recessed, parallax-shifted gold repair. Large seams remain legible across the gallery while a second hairline crazing network and oracle sparks only resolve at conversational distance. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const marble = mx_fractal_noise_float(p.mul(4.2).add(vec3(0.2, -0.7, 1.1)), 4, 2.05, 0.52).mul(0.5).add(0.5)
    const cloud = mx_noise_float(p.mul(13).add(marble.mul(1.8))).mul(0.5).add(0.5)
    const outerBoundary = cellularBoundary(p.mul(7.5).add(vec3(0.4, 1.7, -0.8)))
    const channel = fissure(outerBoundary, 0.07, 1.55)
    const channelCore = fissure(outerBoundary, 0.028, 0.9)
// The metal lies below the glaze. Its network moves within the wider channel as the viewer circles.
    const buriedPoint = p.sub(view.mul(0.026).div(facing.max(0.28)))
    const buriedBoundary = cellularBoundary(buriedPoint.mul(7.5).add(vec3(0.4, 1.7, -0.8)))
    const gold = fissure(buriedBoundary, 0.046, 1.1).mul(channel)
    const shadow = channel.mul(gold.oneMinus())
    const fineBoundary = cellularBoundary(p.mul(23).add(vec3(3.1, -5.2, 2.4)))
    const fine = fissure(fineBoundary, 0.023, 1).mul(near).mul(channel.oneMinus())
    const oldRepair = mx_noise_float(p.mul(5.7).add(9.3)).mul(0.5).add(0.5)
    const porcelain = mix(color(hsl.integer(266, 55, 3.4)), color(hsl.integer(282, 44, 12)), marble.mul(0.68).add(cloud.mul(0.12)))
    const cobaltWash = color(hsl.integer(265, 72, 26)).mul(cloud.pow(3).mul(0.36))
    const goldColor = mix(color(hsl.integer(48, 89, 37)), color(hsl.integer(84, 100, 88.2)), oldRepair.mul(0.72).add(facing.mul(0.28)))
    let surface: Node<'vec3'> = porcelain.add(cobaltWash)
    surface = mix(surface, color(hsl.integer(283, 35, 2.4)), shadow.mul(0.92))
    surface = mix(surface, goldColor, gold)
    surface = mix(surface, color(hsl.integer(319, 17, 20)), fine.mul(0.45))
    this.colorNode = surface
    this.metalnessNode = gold.mul(0.98).add(fine.mul(0.22)).add(0.035).clamp()
    this.roughnessNode = mix(float(0.245), float(0.085), gold).add(fine.mul(0.12)).add(shadow.mul(0.09))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.045
    this.iridescence = 0.22
    this.iridescenceThicknessNode = marble.mul(75).add(95)
    const relief = gold.mul(0.0045).sub(channel.mul(0.0065)).sub(fine.mul(0.0013)).add(cloud.mul(0.00035))
    this.normalNode = proceduralNormal(relief, 1)
    this.clearcoatNormalNode = proceduralNormal(cloud, 0.00025)
// A slow heat signal runs only through the buried repair and blooms at crack junctions up close.
    const current = p.dot(vec3(7.3, -4.1, 5.7)).sub(time.mul(0.72)).add(marble.mul(4.5)).sin().mul(0.5).add(0.5).pow(10)
    const crossing = gold.mul(channelCore).mul(fine.add(0.12)).mul(intimate)
    const oracle = current.mul(gold).mul(near.mul(0.75).add(0.25))
    this.emissiveNode = goldColor.mul(gold).mul(0.045).add(goldColor.mul(oracle).mul(0.5)).add(color(hsl.integer(94, 100, 94.8)).mul(crossing).mul(current).mul(0.85)).add(color(hsl.integer(265, 83, 44)).mul(grazing.pow(4)).mul(0.035))
    this.envMapIntensity = 0.76
  }
}
