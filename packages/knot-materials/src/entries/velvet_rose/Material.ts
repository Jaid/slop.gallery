import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {beads} from '../../lib/beads.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.35)
    this.name = knotData.id
    const {p, grazing, near, intimate} = viewerFrame()
    const breath = vec3(0, time.mul(0.02), time.mul(0.013))
// Heavy drape folds that push the silhouette as well as the shading.
    const folds = mx_fractal_noise_float(p.mul(2.1).add(breath), 3, 2.05, 0.5)
    const foldHeight = folds.mul(0.022)
    const nap = mx_noise_float(p.mul(54).add(breath.mul(2))).mul(0.002).mul(near)
    const dew = beads(p.mul(13).add(vec3(2.4, 0.7, 5.1)), 1.7)
    const height = foldHeight.add(nap).add(dew.cap.mul(dew.radius).mul(0.5))
    this.positionNode = positionGeometry.add(normalLocal.mul(foldHeight))
    const shadeNormal = proceduralNormal(height, 1.1)
    this.normalNode = shadeNormal
    const shade = folds.mul(0.5).add(0.5)
    const velvet = mix(color(hsl.integer(19, 88, 16.5)), color(hsl.integer(20, 92, 45)), shade)
    const petal = mix(velvet, color(hsl.integer(17, 85, 55)), grazing.mul(0.5))
    this.colorNode = mix(petal, color(hsl.integer(48, 44, 88)).mul(0.55), dew.mask.mul(0.35))
    this.metalness = 0
    this.roughnessNode = mix(float(0.94), float(0.04), dew.mask)
    this.aoNode = shade.mul(0.35).add(0.55)
// Velvet nap steals the light and returns it only at grazing angles.
    this.sheen = 1
    this.sheenColor.set(hsl.integer(18, 100, 62))
    this.sheenRoughness = 0.32
    this.clearcoatNode = dew.mask.mul(0.95).add(0.08)
    this.clearcoatRoughness = 0.05
    const dewGlint = glints(shadeNormal, 48).mul(dew.core).mul(near.mul(0.5).add(0.5))
    const napGlint = glints(shadeNormal, 160).mul(near.mul(intimate.mul(0.5).add(0.5))).mul(0.08)
    this.emissiveNode = color(hsl.integer(23, 100, 58.8)).mul(grazing.pow(3)).mul(intimate.mul(0.5).add(0.5)).mul(0.8).add(color(hsl.integer(46, 100, 90)).mul(dewGlint)).add(color(hsl.integer(34, 100, 82)).mul(napGlint))
  }
}
