import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2} from 'three/tsl'

import {inkLine} from '../../lib/atelier.ts'
import {opticalBands, proceduralNormal, TAU, viewerFrame} from '../../lib/index.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import data from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = data.id
    const {p, view, near, grazing, facing} = viewerFrame()
    // Continuous scalloped rows. Integer winding closes both UV seams without a stagger discontinuity.
    const q = uv().mul(vec2(36, 5))
    const arch = q.x.mul(TAU).cos().mul(0.23)
    const shellCoordinate = q.y.add(arch).add(mx_noise_float(p.mul(8)).mul(0.9))
    const shell = shellCoordinate.fract()
    const aa = shellCoordinate.fwidth().max(0.0001)
    const edge = inkLine(shell.sub(0.055), 0.025, aa)
    const lip = inkLine(shell.sub(0.115), 0.014, aa)
    const ribPhase = shellCoordinate.mul(TAU * 13).add(q.x.mul(TAU).sin().mul(0.4))
    const ribs = opticalBands(ribPhase)
    const mineral = mx_noise_float(p.mul(17)).mul(0.5).add(0.5)
    const phase = shell.mul(5).add(view.x.mul(4)).add(view.y.mul(3)).add(mineral.mul(2))
    const green = phase.sin().smoothstep(-0.35, 0.5)
    const pink = phase.add(2.1).sin().smoothstep(-0.4, 0.6)
    const interference = mix(mix(color(hsl.integer(176, 100, 62)), color(hsl.integer(308, 76, 32)), pink), color(hsl.integer(80, 80, 68)), green.mul(0.85))
    const pearl = mix(color(hsl.integer(195, 76, 9)), interference, grazing.mul(0.3).add(0.5))
    const shadow = edge.mul(0.92).add(shell.smoothstep(0.7, 1).mul(0.12)).clamp()
    this.colorNode = mix(pearl.mul(ribs.mul(0.07).add(0.93)), color(hsl.integer(215, 51, 10)), shadow)
    this.metalnessNode = float(0.35).add(grazing.mul(0.12))
    this.roughnessNode = float(0.23).add(edge.mul(0.12)).sub(lip.mul(0.07))
    this.clearcoat = 0.65
    this.clearcoatRoughness = 0.1
    this.iridescence = 0.3
    this.iridescenceIOR = 1.34
    this.iridescenceThicknessNode = mineral.mul(160).add(shell.mul(240)).add(210)
    this.anisotropy = 0.35
    // A periodic smooth shell profile avoids artificial cliffs at the repeated row boundaries.
    const height = shellCoordinate.mul(TAU).cos().mul(0.0025).add(ribs.mul(near).mul(0.00004)).add(lip.mul(0.0004))
    this.normalNode = proceduralNormal(height, 1)
    this.clearcoatNormalNode = this.normalNode
    const tide = shellCoordinate.mul(TAU / 5).sub(time.mul(0.3)).add(view.z.mul(2)).sin().mul(0.5).add(0.5)
    this.emissiveNode = interference.mul(lip.mul(0.4).add(0.2)).mul(tide.mul(0.2).add(0.8)).mul(facing).mul(near).mul(0.45)
  }
}
