import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import {starGlints} from '../../candidates/glm/lib/starGlints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    const p = positionGeometry
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const grazing = normalViewGeometry.dot(positionViewDirection).abs().clamp().oneMinus()
    const rim = grazing.pow(2)
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const intimate = positionView.length().smoothstep(0.8, 2.7).oneMinus()
    const axis = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.normalize()
    const band = p.normalize().dot(axis)
    const photonCore = opticalLine(band, 0.016)
    const photon = opticalLine(band, 0.055)
    const corona = opticalLine(band, 0.16)
    const reference = mix(vec3(0.31, 1, 0.13), vec3(1, 0.27, 0.11), axis.y.abs().smoothstep(0.88, 0.97))
    const t1 = axis.cross(reference).normalize()
    const t2 = axis.cross(t1).normalize()
    const spin = time.mul(0.55)
    const orbit = p.dot(t1).mul(spin.cos()).add(p.dot(t2).mul(spin.sin()))
    const streaks = opticalLine(orbit.mul(6.5).add(mx_noise_float(p.mul(9)).mul(0.4)), 0.05).mul(corona)
    const beaming = p.dot(t1).mul(2.4).add(1.3).max(0.15).min(2.6)
    const inner = opticalLine(band.sub(0.3), 0.06).mul(intimate)
    const bodyStars = starGlints(p.mul(64), view, 24)
    const surge = near.mul(1.15).add(0.95)
    this.colorNode = mix(color(hsl.integer(283, 35, 2.4)), color(hsl.integer(277, 42, 7)), grazing)
    this.transmission = 0.5
    this.thickness = 0.9
    this.ior = 1.6
    this.dispersion = 0.3
    this.attenuationColor.set(hsl.integer(275, 36, 4))
    this.attenuationDistance = 0.42
    this.roughness = 0.05
    this.clearcoat = 1
    this.clearcoatRoughness = 0.045
    this.envMapIntensity = 1.15
    this.normalNode = proceduralNormal(mx_noise_float(p.mul(17)).mul(corona), 0.00022)
    this.emissiveNode = color(hsl.integer(82, 100, 98)).mul(photonCore).mul(4.4)
      .add(color(hsl.integer(68, 100, 79)).mul(photon).mul(1.4))
      .add(color(hsl.integer(41, 100, 65.4)).mul(streaks).mul(0.9))
      .mul(beaming).mul(surge)
      .add(color(hsl.integer(290, 100, 58)).mul(inner).mul(1.6))
      .add(color(hsl.integer(276, 100, 77.5)).mul(bodyStars).mul(near.mul(0.5).add(0.5)).mul(0.5))
      .add(color(hsl.integer(275, 61, 60)).mul(rim).mul(0.07))
  }
}
