import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, time} from 'three/tsl'

import {band} from '../../candidates/gpt_sol/lib/galleryMarks.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A polished pearlescent shell over three slowly counterflowing internal wavefronts. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    const {p, view, grazing, near} = viewerFrame()
    const deep = p.sub(view.mul(0.16))
    const flow = mx_fractal_noise_float(deep.mul(3.8).add(time.mul(0.022)), 4, 2, 0.5)
    const curl = mx_noise_float(deep.mul(11).add(flow.mul(2.4)).add(time.mul(-0.045)))
    const shell = mx_noise_float(p.mul(5)).mul(0.07)
    const phase = deep.y.mul(39).add(deep.x.mul(18)).add(flow.mul(17)).add(curl.mul(3.5)).add(time.mul(0.23))
    const interference = spectralColor(phase.mul(0.85).add(grazing.mul(7)))
    const nacre = band(phase).mul(0.75).add(band(phase.mul(1.73)).mul(0.25))
    const veins = band(phase.mul(3.1)).mul(near).mul(0.16)
    const sea = mix(color(hsl.integer(205, 91, 46)), color(hsl.integer(334, 53, 54)), flow.mul(0.5).add(0.5))
    this.positionNode = positionGeometry.add(normalLocal.mul(shell.mul(0.017)))
    this.colorNode = mix(color(hsl.integer(234, 70, 24)), sea, nacre.mul(0.8).add(0.1)).add(interference.mul(veins.mul(0.28)))
    this.metalness = 0.22
    this.roughnessNode = nacre.mul(-0.09).add(0.2)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.035
    this.iridescence = 1
    this.iridescenceIOR = 1.34
    this.iridescenceThicknessNode = phase.sin().mul(135).add(flow.mul(65)).add(335)
    this.normalNode = proceduralNormal(flow.mul(0.007).add(curl.mul(0.0025)), 0.75)
    this.emissiveNode = interference.mul(nacre.pow(3)).mul(grazing.pow(1.6).mul(0.85).add(near.mul(0.14))).add(color(hsl.integer(174, 100, 96.5)).mul(veins).mul(0.08))
  }
}
