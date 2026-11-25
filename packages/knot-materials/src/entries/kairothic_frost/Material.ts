import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, normalLocal, normalViewGeometry, positionLocal, time, uv, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Ice that grows as you look - feathered dendrites resolve only when intimate */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, facing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    const drift = time.mul(0.04)
    const frostNoise = mx_fractal_noise_float(p.mul(4.5).add(vec3(drift, float(0), float(0))), 3, 2, 0.6)
    const frostThresh = float(0.35).add(time.mul(0.08).sin().mul(0.12)).sub(near.mul(0.15))
    const frostMask = frostNoise.smoothstep(frostThresh, frostThresh.add(0.18))
    const dendriteDir = tube.x.mul(40).add(tube.y.mul(8))
    const dendrite = opticalLine(dendriteDir.fract().sub(0.5), 0.04).mul(frostMask)
    const feather = opticalLine(tube.x.mul(120).add(tube.y.mul(24).sin().mul(2)).fract().sub(0.5), 0.025).mul(frostMask).mul(intimate)
    // Compact glints confined to growing frost, rather than illuminated spatial cells.
    const sparkle = cellularPoints(p.mul(62).add(vec3(0, time.mul(0.5), 0)), 0.04, 0.22, 0.4).mul(frostMask).mul(near)
    this.positionNode = positionLocal.add(normalLocal.mul(frostMask.mul(0.018).mul(near)))
    this.colorNode = mix(mix(color(hsl.integer(246, 100, 95)), color(hsl.integer(0, 0, 100)), frostMask.mul(0.85)), color(hsl.integer(253, 100, 73)), facing.oneMinus().mul(0.35))
    this.transmission = 0.92
    this.thickness = 0.8
    this.ior = 1.31
    this.attenuationColor.set(hsl.integer(249, 100, 85))
    this.attenuationDistance = 0.6
    this.roughnessNode = float(0.04).add(frostMask.mul(0.42))
    this.metalness = 0
    this.clearcoat = 1
    this.clearcoatRoughness = 0.06
    this.iridescence = 0.8
    this.iridescenceIOR = 1.3
    this.iridescenceThicknessNode = frostMask.mul(180).add(320)
    this.normalNode = proceduralNormal(frostMask.mul(0.6).add(dendrite.mul(0.4)), 0.001)
    this.emissiveNode = color(hsl.integer(225, 100, 87.4)).mul(sparkle).mul(1.2)
      .add(color(hsl.integer(0, 0, 100)).mul(dendrite.add(feather)).mul(0.15).mul(glints(normalViewGeometry, 60)))
      .add(color(hsl.integer(241, 100, 77)).mul(rim.pow(4).mul(frostMask).mul(0.12)))
    this.envMapIntensity = 0.8
  }
}
