import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, time, uv, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Liquid mirror that remembers - perfect chrome with memory droplets and fingerprint whorls when intimate */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, grazing, rim, near, intimate} = viewerFrame()
    const baseSilver = color(hsl.integer(237, 21, 94))
    const flow = mx_fractal_noise_float(p.mul(1.15).add(vec3(time.mul(0.07), float(0), time.mul(0.04))), 3, 2, 0.55).mul(0.5).add(0.5)
    const mercuryNormal = liquidNormal(near.mul(0.4).add(0.3), 0.9)
    const cell = cellNoiseVec3(p.mul(38))
    const beadThresh = float(0.86).sub(intimate.mul(0.18))
    const bead = cell.x.smoothstep(beadThresh, beadThresh.add(0.035))
    const beadShape = p.mul(38).fract().sub(cell.mul(0.4).add(0.3)).length().smoothstep(0.28, 0.42).oneMinus()
    const droplets = bead.mul(beadShape).mul(intimate)
    const fingerprint = opticalLine(uv().x.mul(80).add(uv().y.mul(10).sin().mul(3)).fract().sub(0.5), 0.02).mul(intimate).mul(0.55)
    this.colorNode = mix(color(hsl.integer(234, 20, 89)), baseSilver, flow)
    this.metalness = 1
    this.roughnessNode = float(0.04).add(droplets.mul(0.18)).add(grazing.mul(0.06))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.normalNode = mercuryNormal.add(proceduralNormal(droplets.add(fingerprint).mul(0.9), 0.0025)).normalize()
    this.emissiveNode = color(hsl.integer(225, 100, 88)).mul(rim.pow(4).mul(0.12))
    this.envMapIntensity = 1.45
    this.ior = 1.8
  }
}
