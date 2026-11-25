import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraPosition, color, mix, modelWorldMatrixInverse, normalViewGeometry, positionGeometry, positionView, positionViewDirection, time, vec3, vec4} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    this.envMapIntensity = 0.95
    const p = positionGeometry
    const facing = normalViewGeometry.dot(positionViewDirection).abs().clamp()
    const grazing = facing.oneMinus()
    const rim = grazing.abs().pow(2)
    const view = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz.sub(p).normalize()
    const near = positionView.length().smoothstep(1.25, 5.5).oneMinus()
    const innerA = p.sub(view.mul(0.15))
    const innerB = p.sub(view.mul(0.32))
    const gridA = innerA.dot(vec3(22, 14, -10)).add(time.mul(0.08)).sin()
    const gridB = innerB.dot(vec3(-12, 24, 16)).sub(time.mul(0.06)).sin()
    const threadA = opticalLine(gridA, 0.052)
    const threadB = opticalLine(gridB, 0.045).mul(near)
    const moireBeat = gridA.add(gridB).mul(0.5).cos().abs()
    const starlightNodes = opticalLine(gridA.abs().add(gridB.abs()).sub(0.15), 0.035).mul(near)
    const hyperAxis = innerA.dot(vec3(16, -20, 26)).add(time.mul(0.12))
    const celestialColor = spectralColor(hyperAxis.mul(0.8).add(view.x.mul(3)))
    this.colorNode = mix(color(hsl.integer(303, 67, 4.4)), color(hsl.integer(302, 73, 12)), rim.mul(0.5))
    this.transmission = 0.88
    this.thickness = 0.62
    this.ior = 1.82
    this.dispersion = 0.58
    this.attenuationColor.set(hsl.integer(302, 74, 8))
    this.attenuationDistance = 0.9
    this.roughness = 0.024
    this.clearcoat = 1
    this.clearcoatRoughness = 0.018
    this.emissiveNode = celestialColor.mul(threadA).mul(near.mul(0.5).add(0.3)).add(spectralColor(hyperAxis.add(2.5)).mul(threadB).mul(0.7)).add(color(hsl.integer(0, 0, 100)).mul(starlightNodes).mul(1.4)).add(color(hsl.integer(350, 85, 68)).mul(moireBeat).mul(near).mul(0.4)).add(celestialColor.mul(rim.abs().pow(2)).mul(0.32))
  }
}
