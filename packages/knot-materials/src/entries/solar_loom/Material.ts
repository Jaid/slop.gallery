import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, normalViewGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function weave(point: Node<'vec2'>, warpCycles: Node<'vec2'>, weftCycles: Node<'vec2'>) {
  // Integer cycles in both directions close the skewed weave across both UV wraps.
  const warpPhase = point.dot(warpCycles).mul(TAU)
  const weftPhase = point.dot(weftCycles).mul(TAU)
  const warpFootprint = warpPhase.fwidth()
  const weftFootprint = weftPhase.fwidth()
  const warp = warpPhase.sin().mul(warpFootprint.smoothstep(1.5, 5).oneMinus())
  const weft = weftPhase.sin().mul(weftFootprint.smoothstep(1.5, 5).oneMinus())
  const crossingPhase = warpPhase.add(weftPhase)
  const crossingFootprint = crossingPhase.fwidth()
  const aa = crossingFootprint.max(0.02).min(1)
  const overUnder = mix(float(0.5), crossingPhase.sin().smoothstep(aa.negate(), aa), crossingFootprint.smoothstep(1.5, 5).oneMinus())
  const height = mix(weft.mul(0.62), warp.mul(0.62), overUnder)
  const detail = warpFootprint.max(weftFootprint).smoothstep(0.25, 1).oneMinus()
  return {
    height: height.mul(detail),
    warp,
    weft,
    overUnder,
  }
}

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.15)
    this.name = knotData.id
    const {p, view, facing, rim, near, intimate} = viewerFrame()
    const tube = uv()
    const slow = mx_fractal_noise_float(p.mul(2.05).add(vec3(0, time.mul(0.012), 0)), 3, 2.1, 0.55)
    const wisp = mx_fractal_noise_float(p.mul(5.3).add(vec3(time.mul(0.016), 0, time.mul(-0.01))), 2, 2.2, 0.48)
    const fineA = weave(tube, vec2(89, 3), vec2(-12, 15))
    const fineB = weave(tube.add(0.317), vec2(146, 4), vec2(-19, 24))
    const filament = slow.mul(1.6).add(wisp.mul(0.3)).sin().abs().smoothstep(0.08, 0.8)
    const interference = slow.mul(3.2).add(wisp.mul(1.1)).add(facing.mul(2.8)).add(view.x.mul(0.4)).add(time.mul(0.006))
    const spectral = cosinePalette(interference, [0.52, 0.33, 0.16], [0.47, 0.44, 0.38], [1, 1, 1], [0.02, 0.27, 0.58])
    const gold = mix(color(hsl.integer(49, 79, 20)), color(hsl.integer(81, 100, 82)), filament.pow(0.55).mul(0.78).add(0.12))
    const carbon = mix(color(hsl.integer(266, 26, 6)), color(hsl.integer(262, 32, 18)), wisp.mul(0.5).add(0.5))
    const threadColor = mix(carbon, gold, mix(float(0.72), float(0.18), fineA.overUnder))
    this.colorNode = mix(threadColor, spectral.mul(0.72), filament.mul(0.36).mul(facing.oneMinus().mul(0.65).add(0.35)))
    this.metalnessNode = mix(float(0.82), float(0.18), fineA.overUnder).mul(filament.mul(0.42).add(0.58))
    this.roughnessNode = float(0.2).add(fineB.height.abs().mul(0.1)).add(rim.mul(0.08))
    this.anisotropy = 0.92
    this.anisotropyNode = vec2(mix(float(0.92), float(0.08), fineA.overUnder), mix(float(0.08), float(0.92), fineA.overUnder))
    this.normalNode = proceduralNormal(fineA.height.mul(0.0014).add(fineB.height.mul(0.00055)).add(filament.mul(0.0011)), 0.0024)
    this.clearcoat = 0.48
    this.clearcoatRoughnessNode = float(0.09).add(fineB.height.abs().mul(0.08))
    this.iridescenceNode = filament.mul(0.52).mul(rim.mul(0.58).add(0.25))
    this.iridescenceThicknessNode = facing.mul(510).add(slow.mul(260)).add(180)
    this.emissiveNode = spectral.mul(filament.mul(0.24).mul(intimate.mul(0.42).add(0.2))).add(color(hsl.integer(94, 100, 95)).mul(glints(normalViewGeometry, 120).mul(0.3).mul(near)))
  }
}
