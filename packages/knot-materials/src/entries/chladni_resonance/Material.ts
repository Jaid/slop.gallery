import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, normalViewGeometry, positionGeometry, time, uv} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A vibrating indigo enamel plate. Fine sand gathers on the nodal lines of a Chladni mode; step closer and the plate rises through higher modes, the sand re-drawing itself into denser figures. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, near, intimate, objectDistance} = viewerFrame()
    const tube = uv()
    const X = tube.x.mul(16)
    const Y = tube.y.mul(2)
    const chladni = (n: number, m: number) => X.mul(n * Math.PI).cos().mul(Y.mul(m * Math.PI).cos()).sub(X.mul(m * Math.PI).cos().mul(Y.mul(n * Math.PI).cos()))
    const modes: Array<[number, number]> = [[1, 3], [2, 5], [3, 7], [4, 9], [5, 12]]
    const drift = time.mul(0.11).sin().mul(0.45)
    const s = objectDistance.smoothstep(1.2, 6).oneMinus().mul(modes.length - 1).add(drift).clamp(0, modes.length - 1)
    let field: Node<'float'> = float(0)
    for (const [k, [n, m]] of modes.entries()) {
      field = field.add(chladni(n, m).mul(s.sub(k).abs().oneMinus().clamp()))
    }
    const fw = field.fwidth().max(0.002)
    const nodal = field.abs().smoothstep(0.02, fw.mul(1.5).add(0.09)).oneMinus()
    const grainCoord = p.mul(260)
    const grainRnd = cellNoiseVec3(grainCoord)
    const grainDist = grainCoord.fract().sub(grainRnd.mul(0.5).add(0.25)).length()
    const grainFoot = grainCoord.fwidth().length().max(0.001)
    const grainSharp = grainFoot.smoothstep(0.35, 1.2).oneMinus()
    const grain = grainDist.smoothstep(0.18, grainFoot.mul(0.7).add(0.28)).oneMinus().mul(grainSharp).add(grainSharp.oneMinus().mul(0.6))
    const stray = grainRnd.y.smoothstep(0.93, 0.95).mul(grain).mul(field.abs().smoothstep(0.05, 0.5)).mul(0.6)
    const sand = nodal.mul(grain.mul(0.7).add(0.3)).add(stray).clamp()
    const plate = mix(color(hsl.integer(271, 63, 10)), color(hsl.integer(269, 71, 23)), mx_noise_float(p.mul(3)).mul(0.5).add(0.5).mul(0.35))
    const sandColor = mix(color(hsl.integer(87, 37, 81)), color(hsl.integer(86, 100, 96.8)), grainRnd.x)
    const vibration = time.mul(42).sin()
    this.colorNode = mix(plate, sandColor, sand)
    this.metalnessNode = sand.oneMinus().mul(0.7)
    this.roughnessNode = float(0.22).mix(0.85, sand)
    this.clearcoatNode = sand.oneMinus().mul(0.9)
    this.clearcoatRoughness = 0.06
    this.normalNode = proceduralNormal(sand.mul(0.9).add(grain.mul(nodal).mul(0.6)).add(field.mul(vibration).mul(0.4)), 0.0016)
    this.positionNode = positionGeometry.add(normalLocal.mul(field.mul(vibration).mul(near.mul(0.6).add(0.4)).mul(0.003)))
    const grainNormal = normalViewGeometry.add(grainRnd.sub(0.5).mul(0.5)).normalize()
    const sparkle = glints(grainNormal, 120).mul(sand).mul(grain).mul(near).mul(0.35)
    const hum = field.abs().smoothstep(0.3, 1.6).mul(vibration.mul(0.5).add(0.5))
    this.emissiveNode = color(hsl.integer(85, 100, 96)).mul(sparkle).add(color(hsl.integer(268, 92.7, 41)).mul(hum).mul(intimate).mul(0.08))
  }
}
