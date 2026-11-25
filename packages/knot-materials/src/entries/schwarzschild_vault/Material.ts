import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, mx_noise_float, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    this.envMapIntensity = 0.85
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.abs().pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const intimate = positionView.length().smoothstep(0.8, 2.7).oneMinus()
    const orbitalDir = vec3(p.z.negate(), p.y.mul(0.6), p.x).normalize()
    const doppler = view.dot(orbitalDir)
    const dopplerColor = mix(color(hsl.integer(26, 87, 30)), color(hsl.integer(233, 93, 71)), doppler.mul(0.5).add(0.5))
    const beaming = doppler.max(0).pow(3).mul(1.5)
    const inner = p.sub(view.mul(0.22))
    const deep = p.sub(view.mul(0.44))
    const vortex = inner.xz.length().mul(19).sub(time.mul(1.2))
    const photonRings = opticalLine(vortex.sin(), 0.036)
    const shearFilaments = opticalLine(mx_noise_float(deep.mul(24).add(vec3(0, time.mul(0.5), 0))), 0.026).mul(intimate)
    const einsteinRing = opticalLine(facing.sub(0.42).abs(), 0.042)
    this.colorNode = mix(color(hsl.integer(265, 51, 2.4)), color(hsl.integer(253, 53, 9)), rim.mul(0.5))
    this.transmission = 0.88
    this.thickness = 0.65
    this.ior = 2.42
    this.dispersion = 0.78
    this.attenuationColor.set(hsl.integer(252, 60, 3))
    this.attenuationDistance = 0.38
    this.roughness = 0.014
    this.clearcoat = 1
    this.clearcoatRoughness = 0.012
    this.normalNode = liquidNormal(near, 0.16)
    this.emissiveNode = dopplerColor.mul(photonRings).mul(near.mul(0.7).add(0.3)).mul(beaming.add(0.6)).add(color(hsl.integer(206, 88, 90)).mul(einsteinRing).mul(near.mul(0.8).add(0.3))).add(color(hsl.integer(233, 93, 71)).mul(shearFilaments).mul(1.2)).add(dopplerColor.mul(rim.pow(3)).mul(0.45))
  }
}
