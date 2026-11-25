import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, uv, vec3} from 'three/tsl'

import {ridge} from '../../candidates/claude_fable/lib/ridge.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const wrap = (x: Node<'float'>) => x.sub(x.add(0.5).floor())

/** A knot of hand-made paper lit from within by six guttering candles. Ink-painted plum branches and blossoms on the inner skin show as silhouettes that slide with parallax, and when you come close a moth's shadow flutters along the inside of the lantern. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const fibres = mx_fractal_noise_float(vec3(tube.x.mul(520), tube.y.mul(14), 2.5), 3, 2.3, 0.55).mul(0.5).add(0.5)
    const fibres2 = mx_fractal_noise_float(vec3(tube.x.mul(60), tube.y.mul(180), 7.1), 2, 2, 0.5).mul(0.5).add(0.5)
    const pulp = mx_fractal_noise_float(p.mul(7), 3, 2, 0.5).mul(0.5).add(0.5)
    const thickness = pulp.mul(0.5).add(fibres.mul(0.3)).add(fibres2.mul(0.2))
    const transmittance = thickness.mul(-0.55).add(1.05).clamp()
    const candles = 6
    const candleId = tube.x.mul(candles).floor()
    const along = tube.x.mul(candles).fract().sub(0.5).abs()
    const flicker = mx_noise_float(vec3(time.mul(2.7), candleId.mul(7.31), time.mul(1.3))).mul(0.3)
      .add(mx_noise_float(vec3(time.mul(9), candleId.mul(3.7), 0)).mul(0.12)).add(0.8)
    const flame = along.mul(3).pow(2).negate().exp()
    const inner = p.sub(view.mul(0.025))
    const branchField = mx_noise_float(inner.mul(3.2).add(mx_noise_float(inner.mul(1.4)).mul(0.5)))
    const branchWidth = mx_noise_float(inner.mul(2.1).add(9)).mul(0.5).add(0.5).mul(0.05).add(0.006)
    const branch = branchField.abs().div(branchWidth.max(branchField.fwidth().mul(1.5))).oneMinus().clamp().pow(0.7)
    const twigField = mx_noise_float(inner.mul(9).add(branchField.mul(1.5)))
    const twig = ridge(twigField, 0.01).mul(branchField.abs().smoothstep(0.02, 0.25).oneMinus())
    const ink = branch.max(twig.mul(0.8))
    const bq = inner.mul(22)
    const br = cellNoiseVec3(bq)
    const bdist = bq.fract().sub(br.mul(0.5).add(0.25)).length()
    const blossom = bdist.smoothstep(0.1, 0.2).oneMinus().mul(br.z.smoothstep(0.6, 0.65)).mul(branchField.abs().smoothstep(0.02, 0.2).oneMinus())
    const du = wrap(tube.x.sub(time.mul(0.045).fract()))
    const dv = wrap(tube.y.sub(time.mul(0.31).sin().mul(0.18).add(0.5)))
    const flap = time.mul(14).sin().mul(0.5).add(0.5)
    const moth = du.mul(du).mul(1800).add(dv.mul(dv).mul(flap.mul(40).add(60))).negate().exp().mul(intimate.mul(0.6).add(0.4))
    const shade = ink.mul(0.9).add(blossom.mul(0.35)).add(moth.mul(0.7)).clamp().oneMinus()
    const lit = flame.mul(flicker).mul(transmittance).mul(facing.mul(0.45).add(0.55))
    const flameColor = mix(color(hsl.integer(49, 100, 68)), color(hsl.integer(78, 100, 89)), flame.mul(flicker).clamp())
    this.colorNode = mix(color(hsl.integer(83, 48, 91)), color(hsl.integer(84, 35, 81)), thickness).mul(ink.mul(0.55).oneMinus())
    this.roughnessNode = float(0.85).sub(pulp.mul(0.1))
    this.metalness = 0
    this.sheen = 1
    this.sheenNode = color(hsl.integer(82, 100, 97.2)).mul(0.5)
    this.sheenRoughnessNode = float(0.85)
    this.normalNode = proceduralNormal(thickness.mul(0.8).add(fibres.mul(0.4)), 0.0009)
    this.emissiveNode = flameColor.mul(lit).mul(shade).mul(1.6).mul(near.mul(0.25).add(0.85))
      .add(color(hsl.integer(4, 99, 77.3)).mul(blossom).mul(lit))
      .add(color(hsl.integer(63, 100, 79.5)).mul(grazing.pow(2)).mul(flame).mul(flicker).mul(0.15))
  }
}
