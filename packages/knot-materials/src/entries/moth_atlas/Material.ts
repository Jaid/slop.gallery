import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2} from 'three/tsl'

import {segment, stroke, tile} from '../../candidates/gpt_sol/lib/ornament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Giant mirrored silk-moth wings, with false eyes that seem to watch an approaching viewer. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.42)
    this.name = knotData.id
    const {p, grazing, near, view} = viewerFrame()
    const q = tile(uv(), 5, 2).sub(vec2(0.5, 0.5))
    const x = q.x.abs()
    const upper = vec2(x.sub(0.235).div(0.235), q.y.sub(0.155).div(0.285)).length().sub(1)
    const lower = vec2(x.sub(0.21).div(0.21), q.y.add(0.195).div(0.23)).length().sub(1)
    const wingField = upper.min(lower)
    const wing = wingField.smoothstep(-0.01, 0.025).oneMinus()
    const rim = stroke(wingField, 0.025)
    const body = x.div(0.038).pow2().add(q.y.div(0.29).pow2()).sqrt().smoothstep(0.8, 1).oneMinus()
    const eyes = vec2(x.sub(0.26), q.y.sub(0.16)).length()
    const ocellus = eyes.smoothstep(0.081, 0.091).oneMinus().mul(wing)
    const iris = stroke(eyes.sub(0.071), 0.012).mul(wing)
    const pupil = eyes.smoothstep(0.029, 0.041).oneMinus().mul(wing)
    const veins = stroke(q.y.sub(x.mul(0.85)).add(0.1), 0.007).add(stroke(q.y.add(x.mul(0.75)).add(0.08), 0.007)).mul(wing)
    const antennae = stroke(segment(q, [-0.025, 0.24], [-0.13, 0.42]), 0.006).add(stroke(segment(q, [0.025, 0.24], [0.13, 0.42]), 0.006))
    const pattern = x.mul(27).add(q.y.mul(14)).add(time.mul(0.16)).sin().mul(0.5).add(0.5)
    const silk = mx_noise_float(p.mul(23)).mul(0.5).add(0.5)
    const eyeShift = view.x.mul(1.4).add(time.mul(0.25)).sin().mul(0.5).add(0.5)
    this.colorNode = mix(mix(mix(mix(color(hsl.integer(210, 36, 14)), mix(color(hsl.integer(186, 69, 41)), color(hsl.integer(41, 77, 62.6)), pattern.mul(0.52).add(q.y.mul(0.45).add(0.24)).clamp()), wing), color(hsl.integer(89, 72, 81)), rim.mul(0.62).add(iris).add(veins.mul(0.21)).clamp()), color(hsl.integer(280, 49, 11)), ocellus.mul(0.78).add(body).clamp()), color(hsl.integer(173, 50, 90)), pupil)
    this.metalnessNode = iris.mul(0.9).add(rim.mul(0.48)).add(0.12)
    this.roughnessNode = float(0.71).add(silk.mul(0.08)).sub(iris.mul(0.36))
    this.sheenNode = float(0.3)
    this.sheenRoughness = 0.7
    this.iridescenceNode = iris.mul(0.85).add(grazing.mul(0.33))
    this.iridescenceThicknessNode = float(130).add(eyeShift.mul(230))
    this.normalNode = proceduralNormal(wing.mul(0.24).add(veins.mul(0.3)).add(silk.mul(0.13)), 0.0014)
    this.emissiveNode = color(hsl.integer(177, 71, 78)).mul(pupil).mul(eyeShift.mul(0.4).add(0.48)).add(color(hsl.integer(76, 81, 87)).mul(rim.add(antennae)).mul(0.14)).add(color(hsl.integer(42, 75, 75)).mul(iris).mul(near).mul(0.17))
  }
}
