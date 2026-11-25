import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv} from 'three/tsl'

import {tubeRay} from '../../lib/atelier.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Calcium-carbonate lamellae are read as a stack of shallow, view-shifted pages rather than a metallic rainbow. Their soft color remains milky at rest and flashes only along a moving rim. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.82)
    this.name = knotData.id
    const {grazing, intimate, near, p, rim} = viewerFrame()
    const tube = uv()
    const ray = tubeRay()
    const front = tube.sub(ray.mul(0.026))
    const middle = tube.sub(ray.mul(0.086))
    const deep = tube.sub(ray.mul(0.155))
    const mineral = mx_noise_float(p.mul(3.2)).mul(0.5).add(0.5)
    const broadPhase = front.y.mul(TAU * 5).add(front.x.mul(TAU)).add(mineral.mul(5.5))
    const middlePhase = middle.y.mul(TAU * 7).sub(middle.x.mul(TAU * 2)).add(mineral.mul(8))
    const deepPhase = deep.y.mul(TAU * 4).add(deep.x.mul(TAU * 3)).add(time.mul(0.035))
    const broadLayers = opticalBands(broadPhase)
    const middleLayers = opticalBands(middlePhase)
    const deepLayers = opticalBands(deepPhase)
    const closeGrain = cellularPoints(p.mul(39), 0.028, 0.11, 0.84).mul(intimate)
    const lamella = broadLayers.mul(0.5).add(middleLayers.mul(0.32)).add(deepLayers.mul(0.18))
    // Fractional multiples of the lamella phases would reintroduce a UV seam.
    const interferencePhase = front.y.mul(TAU * 2).add(middle.y.mul(TAU)).add(front.x.mul(TAU).sin().mul(0.6)).add(mineral.mul(3.805)).add(rim.mul(2.4))
    const interference = spectralColor(interferencePhase)
    const ivory = mix(color(hsl.integer(311, 6, 53)), color(hsl.integer(83, 22, 88)), lamella.mul(0.72).add(mineral.mul(0.14)))
    const coolPearl = mix(color(hsl.integer(219, 46, 68)), color(hsl.integer(13, 59, 75)), middleLayers)
    const pearlyBody = mix(ivory, coolPearl, middleLayers.mul(0.14).add(grazing.pow(1.25).mul(0.38)).clamp())
    const nacre = mix(pearlyBody, interference, grazing.pow(1.7).mul(0.58).add(broadLayers.mul(0.045)).add(closeGrain.mul(0.16)).clamp())
    const relief = broadLayers.mul(0.5).add(middleLayers.mul(0.23)).add(closeGrain.mul(0.12))
    this.colorNode = nacre
    this.metalness = 0
    this.roughnessNode = float(0.27).sub(grazing.mul(0.1)).add(mineral.mul(0.08)).sub(closeGrain.mul(0.08)).clamp(0.12, 0.42)
    this.clearcoat = 0.92
    this.clearcoatRoughness = 0.09
    this.iridescenceNode = grazing.mul(0.72).add(closeGrain.mul(0.12)).clamp()
    this.iridescenceIOR = 1.34
    this.iridescenceThicknessNode = interferencePhase.sin().mul(82).add(370)
    this.transmissionNode = float(0.12).add(grazing.mul(0.14))
    this.thickness = 0.22
    this.ior = 1.48
    this.attenuationColor.set(hsl.integer(125, 24, 88))
    this.attenuationDistance = 2.4
    this.normalNode = proceduralNormal(relief, 0.00095)
    this.emissiveNode = mix(color(hsl.integer(207, 47, 76)), color(hsl.integer(39, 70, 80.5)), deepLayers).mul(rim).mul(near.mul(0.18).add(0.035))
      .add(color(hsl.integer(86, 100, 95.5)).mul(closeGrain).mul(intimate).mul(0.08))
  }
}
