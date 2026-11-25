import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn as fn, mix, mx_noise_float, negateOnBackSide, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {bumpNormal} from '../../candidates/gpt_astra/lib/bumpNormal.ts'
import {knotShell} from '../../candidates/gpt_astra/lib/knotShell.ts'
import {line} from '../../candidates/gpt_astra/lib/line.ts'
import {viewerFrame} from '../../candidates/gpt_astra/lib/viewerFrame.ts'
import {visibility} from '../../candidates/gpt_astra/lib/visibility.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import knotData from './data.ts'

function roundedTriangle(phase: Node<'float'>) {
  return phase.sin().mul(0.975).asin().div(Math.asin(0.975))
}
function foldFields(tube: Node<'vec2'>) {
  const V = tube.y.mul(TAU * 4)
  const zigzag = roundedTriangle(V)
  const U = tube.x.mul(TAU * 24).add(zigzag.mul(1.2))
  const pleat = roundedTriangle(U)
  return {
    U,
    V,
    pleat,
    zigzag,
    inset: pleat.mul(0.017).add(zigzag.mul(0.006)).sub(0.025),
  }
}
const foldedPosition = fn(([tube]: [Node<'vec2'>]) => {
  return knotShell(tube, foldFields(tube).inset)
})

/** A continuous sheet of folded, vermilion-printed rag paper. The silhouette really pleats. Different slopes carry different pigments, so circling the piece alternately conceals and reveals the red facets without an artificial view-dependent hue shift. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = knotData.id
    const tube = uv()
    const {U, V, pleat} = foldFields(tube)
    this.positionNode = foldedPosition(tube)
    const e = 0.0002
    const du = foldedPosition(tube.add(vec2(e, 0)))
      .sub(foldedPosition(tube.sub(vec2(e, 0))))
    const dv = foldedPosition(tube.add(vec2(0, e)))
      .sub(foldedPosition(tube.sub(vec2(0, e))))
    const foldedNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    const {p, near} = viewerFrame(foldedNormal)
    const fibreQ = p.mul(vec3(160, 32, 160))
    const fibreVisibility = visibility(fibreQ.fwidth().length()).mul(near)
    const fibres = mx_noise_float(fibreQ)
      .add(mx_noise_float(p.mul(vec3(32, 240, 32)))
        .mul(0.3))
      .mul(fibreVisibility)
    const inkFacet = U.cos().smoothstep(0.15, 0.65)
      .mul(V.cos().smoothstep(-0.5, 0.6))
    const score = line(U.cos(), 0.015)
    const valley = pleat.mul(-0.5).add(0.5)
    const paper = color(hsl.integer(89, 41, 92))
      .mul(fibres.mul(0.025).add(0.97))
    const ink = color(hsl.integer(29, 90, 45.4))
      .mul(fibres.mul(0.045).add(0.96))
    this.colorNode = mix(paper, ink, inkFacet)
      .mul(score.mul(-0.1).add(1))
    this.metalness = 0
    this.ior = 1.46
    this.specularIntensity = 0.22
    this.roughnessNode = float(0.88)
      .sub(inkFacet.mul(0.22))
      .add(fibres.mul(0.018))
      .clamp(0.55, 0.95)
    this.normalNode = negateOnBackSide(bumpNormal(fibres.mul(0.00008), foldedNormal))
    this.aoNode = valley.pow(3).mul(-0.28).add(1)
  }
}
