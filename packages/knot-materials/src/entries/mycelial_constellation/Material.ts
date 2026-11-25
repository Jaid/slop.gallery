import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, normalLocal, time} from 'three/tsl'

import {beads} from '../../lib/beads.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A nocturnal lichen crust: fungal caps rise from peat-black terrain while the connected mycelium pulses in private rhythms. It reads as a landscape at close range and a constellation at a distance. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.52)
    this.name = knotData.id
    const {grazing, intimate, near, p, rim, view} = viewerFrame()
    const rootSpace = p.mul(4.15).add(view.mul(0.03))
    const broadRootField = cellularBoundary(rootSpace)
    const broadRoots = filteredRibbon(broadRootField, 0.018)
    const fineRoots = filteredRibbon(cellularBoundary(p.mul(12.5).sub(view.mul(0.04))), 0.009).mul(near)
    const colony = beads(p.mul(10.5), 4.7)
    const capGate = colony.random.y.smoothstep(0.34, 0.47)
    const caps = colony.core.mul(capGate)
    const capRim = colony.cap.mul(caps)
    const spores = cellularPoints(p.mul(35), 0.02, 0.09, 0.9).mul(intimate)
    const soil = mx_fractal_noise_float(p.mul(5.7), 4, 2, 0.53).mul(0.5).add(0.5)
    const pulseIdentity = cellNoiseVec3(p.mul(4.15).floor())
    const pulse = time.mul(pulseIdentity.z.mul(0.9).add(0.65)).add(pulseIdentity.x.mul(TAU)).sin().mul(0.34).add(0.66)
    const livingRoot = broadRoots.mul(pulse.mul(0.44).add(0.56)).add(fineRoots.mul(0.72))
    const fertile = caps.mul(pulse.mul(0.32).add(0.68))
    const moss = mix(color(hsl.integer(160, 37, 7)), color(hsl.integer(145, 58, 29)), soil.mul(0.45).add(grazing.mul(0.12)))
    const capColor = mix(color(hsl.integer(138, 63, 47)), color(hsl.integer(78, 63, 71)), colony.random.x.mul(0.62).add(capRim.mul(0.2)))
    const rootColor = mix(color(hsl.integer(121, 54, 56)), color(hsl.integer(99, 56, 75)), pulseIdentity.y)
    const relief = soil.mul(0.2).add(caps.mul(0.74)).add(broadRoots.mul(0.26)).add(fineRoots.mul(0.12))
    const rootedMoss = mix(moss, rootColor, livingRoot.mul(0.46))
    const mycelialSkin = mix(rootedMoss, capColor, fertile)
    this.colorNode = mycelialSkin
    this.metalness = 0
    this.roughnessNode = float(0.72).add(soil.mul(0.14)).sub(caps.mul(0.22)).clamp(0.34, 0.92)
    this.sheen = 0.36
    this.sheenColor.set(hsl.integer(126, 51, 63))
    this.sheenRoughness = 0.78
    this.clearcoatNode = caps.mul(0.2)
    this.clearcoatRoughness = 0.26
    this.normalNode = proceduralNormal(relief, 0.00145)
    this.positionNode = p.add(normalLocal.mul(colony.core.mul(capGate).mul(0.0052).add(soil.sub(0.5).mul(0.0013))))
    this.emissiveNode = rootColor.mul(livingRoot).mul(near.mul(0.16).add(0.035))
      .add(color(hsl.integer(84, 100, 87.5)).mul(fertile).mul(intimate).mul(pulse).mul(0.19))
      .add(color(hsl.integer(129, 59, 87)).mul(spores).mul(intimate).mul(0.18))
      .add(color(hsl.integer(155, 34, 47)).mul(rim).mul(grazing).mul(0.06))
  }
}
