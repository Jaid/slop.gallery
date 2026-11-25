import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, positionView, tangentView, uv, vec2} from 'three/tsl'

import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 8. TEMPORAL JACQUARD: Woven Photonic Brocade & Dynamic Moiré Loom */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    // Warp (longitudinal gold) and Weft (transverse silver) thread coordinates
    const u = tube.x.mul(190)
    const v = tube.y.mul(70)
    const warpMask = u.mul(Math.PI).sin().mul(v.mul(Math.PI).sin()).greaterThan(0)
    const threadCurve = u.mul(Math.PI).cos().abs().max(v.mul(Math.PI).cos().abs())
    // Dynamic holographic moiré interference between weave and viewing vector
    const moirePhase = u.mul(0.3).add(positionView.x.mul(80)).add(facing.mul(30))
    const moireFringes = opticalBands(moirePhase).mul(near)
    // Orthogonal anisotropic reflection between woven yarns
    const goldYarn = color(hsl.integer(87, 89, 86.7))
    const silverSilk = color(hsl.integer(250, 54, 89))
    const brocadeColor = warpMask.select(goldYarn, silverSilk)
    this.colorNode = brocadeColor
    this.metalnessNode = warpMask.select(float(0.94), float(0.82))
    this.roughnessNode = threadCurve.mul(0.12).add(0.18)
    // Heavy jacquard silk sheen
    this.sheen = 1
    this.sheenRoughnessNode = float(0.32)
    this.sheenNode = color(hsl.integer(85, 100, 95.5))
    // Woven thread relief normal
    this.normalNode = proceduralNormal(threadCurve.mul(0.35), 0.005)
    // Warp yarn anisotropic direction
    this.anisotropy = 0.9
    this.anisotropyNode = vec2(warpMask.select(tangentView.x, tangentView.y.negate()), warpMask.select(tangentView.y, tangentView.x))
    this.emissiveNode = mix(color(hsl.integer(89, 100, 90.8)), color(hsl.integer(260, 100, 74)), moireFringes)
      .mul(moireFringes).mul(0.45).mul(intimate.mul(0.6).add(0.4))
      .add(goldYarn.mul(grazing.pow(3)).mul(0.2))
  }
}
