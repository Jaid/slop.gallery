import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, reflect, time, vec3} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A smooth, slow metal flow with a razor-thin oxide skin. */
function chromeField(point: Node<'vec3'>) {
  const slow = mx_fractal_noise_float(point.mul(2.15).add(vec3(0, time.mul(0.026), 0)), 3, 2.1, 0.52)
  const folds = mx_fractal_noise_float(point.mul(4.4).add(vec3(time.mul(0.018), 0, time.mul(-0.014))), 2, 2.25, 0.48)
  const height = slow.mul(0.7).add(folds.mul(0.22))
  const oxideBand = slow.sub(folds.mul(0.23)).abs().smoothstep(0.03, 0.13).oneMinus()
  return {
    height,
    oxideBand,
    slow,
    folds,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.65)
    this.name = knotData.id
    const {p, view, facing, rim, near} = viewerFrame()
    const {height, oxideBand, slow, folds} = chromeField(p)
    const flowNormal = proceduralNormal(height.add(mx_noise_float(p.mul(13).add(time.mul(0.01))).mul(0.13)), 0.018)
    const reflected = reflect(view.negate(), flowNormal).normalize()
    const studio = reflected.y.mul(0.5).add(0.5).pow(2.2)
    const horizon = mix(color(hsl.integer(267, 32, 7)), color(hsl.integer(234, 100, 95)), studio)
    const coolEdge = color(hsl.integer(229, 100, 83)).mul(facing.oneMinus().pow(2.4)).mul(1.5)
    const oxide = cosinePalette(slow.mul(0.82).add(folds.mul(0.26)).add(facing.mul(0.42)), [0.45, 0.33, 0.56], [0.52, 0.45, 0.4], [1, 1, 1], [0.02, 0.35, 0.67])
    const oxideMask = oxideBand.mul(rim.mul(0.38).add(0.2)).mul(near.mul(0.62).add(0.38))
    this.colorNode = mix(horizon.add(coolEdge), oxide.mul(0.85), oxideMask.mul(0.52))
    this.metalness = 1
    this.roughnessNode = float(0.055).add(oxideMask.mul(0.24)).add(rim.mul(0.035))
    this.normalNode = flowNormal
    this.anisotropy = 0.36
    this.anisotropyNode = vec3(flowNormal.z, flowNormal.x, 0).xy
    this.clearcoat = 0.65
    this.clearcoatRoughnessNode = float(0.04).add(oxideMask.mul(0.12))
    this.iridescenceNode = oxideMask.mul(0.68)
    this.iridescenceThicknessNode = facing.mul(420).add(slow.mul(190)).add(240)
    this.emissiveNode = oxide.mul(oxideMask.mul(oxideMask).mul(0.34)).add(color(hsl.integer(216, 100, 95.7)).mul(glints(flowNormal, 96).mul(rim).mul(0.32)))
  }
}
