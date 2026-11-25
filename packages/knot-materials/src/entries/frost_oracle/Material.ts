import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, time, vec3} from 'three/tsl'

import {beads} from '../../lib/beads.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A solid piece of blue ice where frost lives on the skin and slow, prismatic weather remains suspended underneath. The warm inclusions only resolve when the visitor comes close. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.76)
    this.name = knotData.id
    const {grazing, intimate, near, p, rim, view} = viewerFrame()
    const iceSpace = p.mul(5.1).sub(view.mul(0.13))
    const crystalBoundary = cellularBoundary(iceSpace)
    const broadFacet = filteredRibbon(crystalBoundary, 0.028)
    const fineFacet = filteredRibbon(cellularBoundary(p.mul(17).add(view.mul(0.08))), 0.014).mul(near)
    const wind = mx_fractal_noise_float(p.mul(4.2).add(vec3(time.mul(0.025), 0, 0)), 4, 2, 0.5).mul(0.5).add(0.5)
    const frostGrain = mx_noise_float(p.mul(38)).mul(0.5).add(0.5)
    const frost = broadFacet.mul(0.72).add(fineFacet.mul(0.32)).add(wind.smoothstep(0.62, 0.83).mul(0.28)).clamp()
    const bubbles = beads(p.mul(15), 6.4)
    const trappedAir = bubbles.core.mul(near).mul(0.65)
    const buriedPhase = p.dot(vec3(5.2, -2.1, 4.1)).add(view.dot(vec3(2.2, 3.1, -1.7))).add(time.mul(0.065))
    const buriedColor = spectralColor(buriedPhase.mul(0.68).add(wind.mul(2.5)))
    const glacier = mix(color(hsl.integer(242, 87, 32)), color(hsl.integer(207, 68, 88)), wind.mul(0.45).add(grazing.mul(0.2)))
    const iceBody = mix(glacier, color(hsl.integer(196, 100, 98)), frost.mul(0.68).add(trappedAir.mul(0.22)))
    const relief = frost.mul(0.74).add(frostGrain.mul(near).mul(0.11)).add(bubbles.cap.mul(0.1))
    this.colorNode = mix(iceBody, color(hsl.integer(201, 100, 96)), rim.mul(0.28))
    this.metalness = 0
    this.roughnessNode = float(0.075).add(frost.mul(0.42)).add(frostGrain.mul(0.065)).clamp(0.055, 0.58)
    this.transmissionNode = float(0.78).sub(frost.mul(0.42)).sub(trappedAir.mul(0.1)).clamp(0.28, 0.8)
    this.thicknessNode = float(0.44).add(wind.mul(0.2))
    this.ior = 1.31
    this.dispersion = 0.16
    this.attenuationColor.set(hsl.integer(217, 66, 70))
    this.attenuationDistance = 0.72
    this.clearcoatNode = frost.oneMinus().mul(0.92)
    this.clearcoatRoughness = 0.055
    this.normalNode = proceduralNormal(relief, 0.00135)
    this.positionNode = p.add(normalLocal.mul(crystalBoundary.oneMinus().clamp().mul(0.0011).add(wind.mul(0.00045))))
    this.emissiveNode = buriedColor.mul(fineFacet).mul(intimate).mul(0.22)
      .add(color(hsl.integer(92, 100, 95)).mul(trappedAir).mul(intimate).mul(0.46))
      .add(color(hsl.integer(209, 100, 93.8)).mul(broadFacet).mul(grazing).mul(0.09))
  }
}
