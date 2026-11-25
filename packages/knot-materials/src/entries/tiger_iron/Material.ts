import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, normalLocal, positionGeometry, vec3} from 'three/tsl'

import {premiumBands} from '../../candidates/gpt_astra/lib/premiumBands.ts'
import {premiumDetail} from '../../candidates/gpt_astra/lib/premiumDetail.ts'
import {premiumIntimate} from '../../candidates/gpt_astra/lib/premiumIntimate.ts'
import {premiumView} from '../../candidates/gpt_astra/lib/premiumView.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal as premiumNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const p = positionGeometry
    const view = premiumView()
    const detail = premiumDetail()
    const intimate = premiumIntimate()
    const n = normalLocal.normalize()
    const broadWarp = mx_noise_float(p.mul(vec3(4, 9, 4)))
    const fold = p.y.mul(32).add(p.x.mul(7)).add(broadWarp.mul(4.5)).add(p.z.mul(8).sin().mul(1.1))
    const layers = premiumBands(fold)
    const fineLayers = premiumBands(fold.mul(4.3).add(p.x.mul(9)))
    const hematite = layers.smoothstep(0.75, 0.92)
    const jasper = fold.mul(0.31).sin().smoothstep(0.2, 0.7).mul(hematite.oneMinus())
    const fiberAxis = vec3(0.18, 1, 0.1).normalize()
    const projectedFiber = fiberAxis.sub(n.mul(n.dot(fiberAxis)))
    const fiber = projectedFiber.div(projectedFiber.length().max(0.001))
    const eyeCoordinate = view.dot(fiber).add(broadWarp.mul(0.1))
    const eye = eyeCoordinate.mul(eyeCoordinate).mul(-85).exp()
    const eyeHalo = eyeCoordinate.mul(eyeCoordinate).mul(-15).exp()
    const fibers = premiumBands(p.dot(vec3(490, 25, -160)).add(broadWarp.mul(9)))
    const gold = mix(color(hsl.integer(58, 65, 17)), color(hsl.integer(63, 80, 57)), layers.mul(0.55).add(fineLayers.mul(0.17)).add(0.12))
    const redStone = mix(gold, color(hsl.integer(30, 74, 27)), jasper.mul(0.7))
    const mineral = mix(redStone, color(hsl.integer(238, 24, 12)), hematite.mul(0.88))
    const catEye = eye.mul(0.72).add(eyeHalo.mul(0.14)).mul(hematite.mul(0.85).oneMinus()).mul(fibers.mul(intimate).mul(0.2).add(0.8))
    this.colorNode = mix(mineral, color(hsl.integer(86, 77, 84)), catEye.clamp())
    this.metalnessNode = hematite.mul(0.63).add(0.08)
    this.roughnessNode = hematite.mul(0.06).add(fineLayers.mul(0.035)).add(0.17)
    this.anisotropy = 0.78
    this.anisotropyRotation = Math.PI * 0.5
    this.ior = 1.56
    this.clearcoat = 1
    this.clearcoatRoughness = 0.045
    this.normalNode = premiumNormal(fineLayers.mul(0.13).add(fibers.mul(intimate).mul(0.06)).mul(detail), 0.00045)
    // A small subsurface-like contribution keeps the narrow eye readable.
    this.emissiveNode = color(hsl.integer(68, 84, 64.4)).mul(eye).mul(hematite.oneMinus()).mul(0.075)
    this.envMapIntensity = 1.05
  }
}
