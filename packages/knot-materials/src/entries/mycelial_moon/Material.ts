import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.92)
    this.name = knotData.id
    const p = positionGeometry
    const {view, facing, grazing, near, intimate} = viewerFrame()
    const q = p.sub(view.mul(0.035))
    // Broad hyphae are mixed with a cellular boundary field: from afar the knot reads as mossy bark,
    // but distance reveals a living map of branching paths and tiny fruiting bodies.
    const slowField = mx_noise_float(q.mul(4.8).add(vec3(time.mul(0.018), time.mul(-0.014), time.mul(0.011))))
    const broadVein = opticalLine(slowField.add(mx_noise_float(q.mul(7.4).add(vec3(6.2, -3.4, 8.1))).mul(0.3)), 0.032)
    const boundary = cellularBoundary(q.mul(4.6)).sub(0.07)
    const cellVein = opticalLine(boundary, 0.022).mul(0.72)
    const fineField = mx_noise_float(p.sub(view.mul(0.12)).mul(18).add(vec3(-4.1, 9.3, 2.6)))
    const fineVein = opticalLine(fineField, 0.014).mul(near.mul(0.86).add(0.14))
    const network = broadVein.add(cellVein).add(fineVein.mul(0.72)).clamp()
    const cordHeight = slowField.abs().smoothstep(0.075, 0.018).oneMinus()
    const pulse = p.dot(vec3(3.7, -5.2, 4.4)).mul(2.8).add(time.mul(0.75)).sin().mul(0.5).add(0.5)
    const signal = pulse.mul(0.55).add(facing.mul(0.45)).pow(1.8)
    const spores = cellularPoints(p.sub(view.mul(0.11)).mul(74), 0.018, 0.12, 0.84).mul(near.mul(0.92).add(0.08))
    const sporeHalo = cellularPoints(p.sub(view.mul(0.11)).mul(33), 0.035, 0.19, 0.78).mul(near.mul(0.78).add(0.22))
    const moss = mx_fractal_noise_float(p.mul(3.7), 4, 2.1, 0.54).mul(0.5).add(0.5)
    const bark = mix(color(hsl.integer(170, 43, 7)), color(hsl.integer(146, 40, 19)), moss.mul(0.72).add(grazing.mul(0.18)))
    const umber = mix(color(hsl.integer(41, 38, 11)), color(hsl.integer(80, 52, 27)), moss)
    const substrate = mix(bark, umber, grazing.mul(0.22))
    const moon = mix(color(hsl.integer(168, 86, 79)), color(hsl.integer(127, 77, 91.4)), signal.mul(0.75).add(grazing.mul(0.25)).clamp())
    const liveNetwork = moon.mul(network).mul(signal.mul(0.75).add(0.25))
    const sporeColor = mix(color(hsl.integer(171, 78, 86.4)), color(hsl.integer(85, 100, 90.4)), spores.mul(0.5).add(grazing.mul(0.5)))
    const surface = mix(substrate, liveNetwork.add(color(hsl.integer(176, 74, 23)).mul(network)), network.mul(0.72).clamp())
    const relief = network.mul(0.0015).add(sporeHalo.mul(0.0011))
    this.colorNode = mix(surface, sporeColor, spores.mul(0.82))
    this.metalness = 0.08
    this.roughnessNode = float(0.63).sub(network.mul(0.26)).sub(sporeHalo.mul(0.17)).add(moss.mul(0.06)).clamp(0.12, 0.72)
    this.clearcoatNode = network.mul(0.35).add(grazing.mul(0.2)).clamp(0.12, 0.58)
    this.clearcoatRoughness = 0.1
    this.normalNode = proceduralNormal(relief.add(moss.mul(near).mul(0.0005)), 0.76)
    this.positionNode = p.add(normalLocal.mul(cordHeight.mul(0.00125)))
    this.emissiveNode = liveNetwork.mul(near.mul(0.85).add(0.3)).mul(1.75).add(sporeColor.mul(spores).mul(intimate.mul(1.1).add(0.22)).mul(2.1)).add(color(hsl.integer(168, 100, 91.6)).mul(grazing.pow(4)).mul(0.16))
  }
}
