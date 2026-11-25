import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalViewGeometry, uv, vec3} from 'three/tsl'
import {DoubleSide} from 'three/webgpu'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Keep the source concept while avoiding Chromium/Tint failures from its transparent vector-noise path: woven silk, beaded dew and thin-film fire. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    this.side = DoubleSide
    this.envMapIntensity = 0.65
    const {p, grazing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    const silkU = opticalLine(tube.x.mul(220).add(tube.y.mul(6).sin().mul(2.5)).fract().sub(0.5), 0.028)
    const silkV = opticalLine(tube.y.mul(14).add(tube.x.mul(2.5).sin().mul(0.4)).fract().sub(0.5), 0.04)
    const silkFine = opticalLine(tube.x.mul(520).add(mx_noise_float(p.mul(8)).mul(2)).fract().sub(0.5), 0.02).mul(intimate)
    const silk = silkU.max(silkV).add(silkFine.mul(0.7)).clamp()
    const dew = cellularPoints(p.mul(42).add(vec3(17.3, 41.9, 8.2)), 0.08, 0.24, 0.3).mul(near.mul(0.55).add(0.45))
    const film = spectralColor(p.x.mul(1.7).add(p.y.mul(1.1)).add(grazing.mul(2.6)))
    const weave = silk.mul(0.72).add(dew.mul(0.48)).clamp()
    this.colorNode = mix(color(hsl.integer(246, 31, 23)), film, weave.mul(0.65).add(0.12))
    this.metalnessNode = dew.mul(0.18)
    this.roughnessNode = float(0.3).sub(silk.mul(0.18)).sub(dew.mul(0.12)).max(0.035)
    this.ior = 1.38
    this.clearcoat = 1
    this.clearcoatRoughness = 0.025
    this.iridescence = 1
    this.iridescenceIOR = 1.25
    this.iridescenceThicknessNode = grazing.mul(180).add(240)
    this.normalNode = proceduralNormal(silk.mul(0.45).add(dew.mul(0.8)), 0.0025)
    this.emissiveNode = film.mul(silk).mul(0.18).mul(near.mul(0.55).add(0.35))
      .add(color(hsl.integer(79, 100, 97.2)).mul(dew).mul(glints(normalViewGeometry, 110)).mul(1.8))
      .add(color(hsl.integer(259, 100, 84)).mul(rim).mul(0.1))
  }
}
