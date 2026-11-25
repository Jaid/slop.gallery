import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, tangentLocal, time, uv, vec3} from 'three/tsl'

import {chatoyance, studioLamps} from '../../candidates/mimo/lib/chatoyance.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
    const tube = uv()
// Crocidolite fibers combed along the knot; each one is a tiny cylinder of light.
    const fiberPhase = tube.y.mul(TAU * 40).add(mx_noise_float(p.mul(2.6)).mul(1.4))
    const fiberRidge = fiberPhase.cos().mul(0.5).add(0.5)
    const fiberVisible = fiberPhase.fwidth().smoothstep(0.6, 3).oneMinus()
    const height = fiberRidge.mul(0.004).mul(fiberVisible).add(mx_noise_float(p.mul(22)).mul(0.001))
    const surface = proceduralNormal(height, 1.2)
    this.normalNode = surface
    const {glow, hot} = chatoyance(normalLocal, view, tangentLocal, studioLamps, 220)
// Hematite banding across the golden quartz, crawling imperceptibly as the stone breathes.
    const bandField = p.dot(vec3(0.2, 1, 0.15)).mul(2.2).add(mx_noise_float(p.mul(2.4)).mul(1.6)).add(time.mul(0.03))
    const band = opticalBands(bandField.mul(TAU).add(0.4))
    const silk = fiberRidge.mul(0.22).add(0.78)
    const quartz = mix(color(hsl.integer(59, 68, 10)), color(hsl.integer(67, 85, 58)), band.mul(silk))
    const hematite = color(hsl.integer(60, 56, 6.5))
    this.colorNode = mix(hematite, quartz, band.pow(1.5).mul(0.9).add(0.1))
    this.metalness = 0
    this.roughnessNode = mix(float(0.36), float(0.15), fiberRidge.mul(fiberVisible))
    this.clearcoat = 0.65
    this.clearcoatRoughness = 0.07
// The fibers smear every highlight along their length, which is where the silkiness lives.
    this.anisotropy = 0.88
    this.anisotropyRotation = 0
    this.envMapIntensity = 0.85
    this.emissiveNode = color(hsl.integer(89, 100, 94.3)).mul(hot).mul(band.pow(1.3)).mul(2.2).add(color(hsl.integer(69, 88, 71)).mul(glow).mul(band).mul(0.35)).add(color(hsl.integer(91, 100, 97)).mul(hot).mul(near.mul(0.6).add(intimate.mul(0.5)))).add(color(hsl.integer(63, 76, 58)).mul(grazing.pow(2.5)).mul(0.2))
  }
}
