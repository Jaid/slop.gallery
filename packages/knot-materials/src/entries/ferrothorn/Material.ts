import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn as fn, mix, mx_noise_float, negateOnBackSide, time, transformNormalToView, uv, varying, vec2} from 'three/tsl'

import {bumpNormal} from '../../candidates/gpt_astra/lib/bumpNormal.ts'
import {filteredWave} from '../../candidates/gpt_astra/lib/filteredWave.ts'
import {knotShell} from '../../candidates/gpt_astra/lib/knotShell.ts'
import {viewerFrame} from '../../candidates/gpt_astra/lib/viewerFrame.ts'
import {visibility} from '../../candidates/gpt_astra/lib/visibility.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

function ferroFields(tube: Node<'vec2'>) {
  const U = tube.x.mul(TAU * 28).add(time.mul(0.12))
  const V = tube.y.mul(TAU * 4)
  // Three reciprocal-lattice waves create a hexagonal Rosensweig pattern.
  const lattice = U.add(V.mul(0.5)).cos()
    .add(U.sub(V.mul(0.5)).cos())
    .add(V.cos())
    .add(1.5)
    .div(4.5)
    .clamp()
  const tip = lattice.pow(4.2)
  const pulse = time.mul(0.45)
    .add(tube.x.mul(TAU * 2))
    .sin()
    .mul(0.06)
    .add(0.94)
  return {
    U,
    V,
    tip,
    inset: tip.oneMinus().mul(-0.048).mul(pulse),
  }
}
const ferroPosition = fn(([tube]: [Node<'vec2'>]) => {
  return knotShell(tube, ferroFields(tube).inset)
})

/** Opaque magnetic fluid. Real moving peaks, not painted spikes. Near inspection exposes capillary striations between the peaks. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const tube = uv()
    const {U, V, tip} = ferroFields(tube)
    this.positionNode = ferroPosition(tube)
    const e = 0.0002
    const du = ferroPosition(tube.add(vec2(e, 0)))
      .sub(ferroPosition(tube.sub(vec2(e, 0))))
    const dv = ferroPosition(tube.add(vec2(0, e)))
      .sub(ferroPosition(tube.sub(vec2(0, e))))
    const sculptedNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    const {p, near, grazing} = viewerFrame(sculptedNormal)
    const microVisibility = visibility(p.mul(75).fwidth().length()).mul(near)
    const capillaryPhase = U.mul(4)
      .add(V.mul(4))
      .add(V.sin().mul(0.8))
      .add(time.mul(0.25))
    const microHeight = filteredWave(capillaryPhase)
      .mul(near)
      .mul(0.00006)
      .add(mx_noise_float(p.mul(75))
        .mul(microVisibility)
        .mul(0.000025))
    this.envMapIntensity = 1.3
    this.colorNode = mix(color(hsl.integer(231, 30, 12)), color(hsl.integer(222, 18, 65)), tip.pow(0.6).mul(near.mul(0.5).add(0.28)))
    this.metalness = 0.92
    this.roughnessNode = float(0.145)
      .add(tip.mul(0.035))
      .add(grazing.mul(0.035))
    this.clearcoat = 0.85
    this.clearcoatRoughness = 0.032
    this.normalNode = negateOnBackSide(bumpNormal(microHeight, sculptedNormal))
    this.clearcoatNormalNode = this.normalNode
    this.aoNode = tip.oneMinus().pow(3).mul(-0.28).add(1)
  }
}
