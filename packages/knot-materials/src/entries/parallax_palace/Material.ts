import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, time, uv} from 'three/tsl'

import {band} from '../../candidates/gpt_sol/lib/galleryMarks.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {view, near, grazing} = viewerFrame()
    const q = uv()
    const viewPhase = view.x.mul(12).add(view.z.mul(8))
    const bands = band(q.y.mul(6.283185307179586 * 96).add(q.x.mul(6.283185307179586 * 19)).add(viewPhase))
    const shutter = band(q.x.mul(6.283185307179586 * 41).sub(q.y.mul(6.283185307179586 * 17)).sub(viewPhase.mul(1.8)))
    const picture = q.x.mul(6.283185307179586 * 7).add(q.y.mul(6.283185307179586 * 4)).sin().mul(3)
    const architecture = band(q.x.mul(6.283185307179586 * 8).add(q.y.mul(6.283185307179586 * 6)))
    const iridescent = spectralColor(picture.add(viewPhase).add(time.mul(0.14)))
    const aperture = bands.mul(0.76).add(shutter.mul(0.24)).mul(architecture.mul(0.78).add(0.22))
    this.colorNode = mix(color(hsl.integer(274, 61, 7)), iridescent.mul(0.9), aperture)
    this.metalness = 0.76
    this.roughnessNode = bands.mul(-0.1).add(0.23)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.06
    this.emissiveNode = iridescent.mul(aperture.pow(3)).mul(near.mul(0.18).add(grazing.mul(0.32).add(0.08)))
  }
}
