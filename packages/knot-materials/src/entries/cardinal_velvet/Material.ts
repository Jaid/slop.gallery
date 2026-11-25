import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, positionGeometry, positionViewDirection, uv, vec3} from 'three/tsl'

import {premiumBands} from '../../candidates/gpt_astra/lib/premiumBands.ts'
import {premiumDetail} from '../../candidates/gpt_astra/lib/premiumDetail.ts'
import {premiumIntimate} from '../../candidates/gpt_astra/lib/premiumIntimate.ts'
import {premiumLine} from '../../candidates/gpt_astra/lib/premiumLine.ts'
import {premiumView} from '../../candidates/gpt_astra/lib/premiumView.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal as premiumNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const p = positionGeometry
    const st = uv()
    const detail = premiumDetail()
    const intimate = premiumIntimate()
    const view = premiumView()
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const u = st.x.mul(TAU)
    const v = st.y.mul(TAU)
    const nap = mx_noise_float(p.mul(9)).mul(0.5).add(0.5)
    const sweptNap = u.mul(6).add(v.mul(2).sin().mul(2.2)).sin().mul(0.5).add(0.5)
    const damaskField = u.mul(12).sin().mul(v.mul(6).sin()).add(u.mul(6).add(v.mul(3)).cos().mul(0.22))
    const damask = damaskField.smoothstep(0.05, 0.62)
    const napTurn = view.dot(vec3(0.25, 0.92, -0.3).normalize()).mul(0.5).add(0.5)
    const pileColor = mix(color(hsl.integer(2, 77, 7.6)), color(hsl.integer(14, 90, 33)), sweptNap.mul(0.23).add(nap.mul(0.18)).add(damask.mul(napTurn).mul(0.34)).add(0.1))
    const embroideryPhase = v.mul(4).add(u.mul(8).sin().mul(0.34))
    const cord = premiumLine(embroideryPhase.sin(), 0.045)
    const stitches = premiumBands(u.mul(220).add(v.mul(12)))
    const couching = cord.mul(stitches.mul(0.3).add(0.7))
    const warp = premiumBands(u.mul(420))
    const weft = premiumBands(v.mul(144))
    const weave = warp.mul(weft).mul(intimate)
    this.colorNode = mix(pileColor, color(hsl.integer(71, 65, 61)), couching.mul(0.85))
    this.metalnessNode = couching.mul(0.78)
    this.roughnessNode = mix(nap.mul(0.08).add(0.79), float(0.3), couching)
    this.sheen = 1
    this.sheenNode = mix(color(hsl.integer(10, 81, 45.2)), color(hsl.integer(10, 100, 74)), grazing.mul(0.65).add(nap.mul(0.18))).mul(couching.oneMinus()).mul(0.88)
    this.sheenRoughnessNode = damask.mul(0.17).add(0.48)
    this.anisotropy = 0.62
    this.anisotropyRotation = Math.PI * 0.5
    this.specularIntensity = 0.32
    this.normalNode = premiumNormal(weave.mul(0.12).add(cord.mul(0.7)).add(nap.mul(0.1)).mul(detail), 0.00065)
    this.envMapIntensity = 0.8
  }
}
