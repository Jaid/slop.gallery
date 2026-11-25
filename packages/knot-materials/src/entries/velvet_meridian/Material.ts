import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, Fn as fn, mix, mx_fractal_noise_float, negateOnBackSide, positionView, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Surface-gradient bump mapping around the displaced normal, with resolution-independent unnormalized derivatives. */
const detailNormal = (base: Node<'vec3'>, height: Node<'float'>, strength: number) => {
  const dx = positionView.dFdx()
  const dy = positionView.dFdy()
  const rx = dy.cross(base)
  const ry = base.cross(dx)
  const determinant = dx.dot(rx)
  const gradient = rx.mul(height.dFdx()).add(ry.mul(height.dFdy())).mul(determinant.sign()).div(determinant.abs().max(1e-12))
  return negateOnBackSide(base.sub(gradient.mul(strength)).normalize())
}
/** Smooth periodic noise coordinates with independent along/across scales. */
const textileCoordinate = (tube: Node<'vec2'>, along: number, around: number) => {
  const u = tube.x.mul(TAU)
  const v = tube.y.mul(TAU)
  return vec3(u.cos().mul(along), u.sin().mul(along).add(v.cos().mul(around)), v.sin().mul(around)).div(TAU)
}
const silkField = (tube: Node<'vec2'>) => {
  const drift = mx_fractal_noise_float(textileCoordinate(tube, 5.2, 2.1).add(vec3(0, 0, time.mul(0.024))), 3, 2.03, 0.52)
  const fold = tube.x.mul(TAU * 18).add(drift.mul(1.3)).add(tube.y.mul(TAU).sin().mul(0.55)).sin()
  const crossFold = tube.y.mul(TAU).add(drift.mul(0.8)).sin()
  return {
    drift,
    fold,
    relief: fold.mul(0.012).add(crossFold.mul(0.0035)),
  }
}
const displacedSilk = fn(([tube]: [Node<'vec2'>]) => {
  const {position, normal} = knotFrame(tube)
  const {relief} = silkField(tube)
  return position.add(normal.mul(relief))
})

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const tube = uv()
    const {drift} = silkField(tube)
    const {view, grazing, near, intimate} = viewerFrame()
    const epsilon = 0.0001
    const du = displacedSilk(tube.add(vec2(epsilon, 0))).sub(displacedSilk(tube.sub(vec2(epsilon, 0))))
    const dv = displacedSilk(tube.add(vec2(0, epsilon))).sub(displacedSilk(tube.sub(vec2(0, epsilon))))
    const displacedNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    this.positionNode = displacedSilk(tube)
    const warp = tube.x.mul(TAU * 310).add(drift.mul(2.2))
    const weft = tube.y.mul(TAU * 47).sub(drift.mul(1.4))
    const warpFootprint = warp.fwidth()
    const weftFootprint = weft.fwidth()
    const warpThread = warp.sin().abs().oneMinus().pow(0.38).mul(warpFootprint.smoothstep(0.35, 1.4).oneMinus())
    const weftThread = weft.sin().abs().oneMinus().pow(0.42).mul(weftFootprint.smoothstep(0.28, 1.2).oneMinus())
    const overUnder = warp.sin().mul(weft.sin()).smoothstep(-0.12, 0.12)
    const weave = mix(warpThread, weftThread, overUnder)
    const fiber = mx_fractal_noise_float(textileCoordinate(tube, 620, 82).add(vec3(0, 0, drift.mul(2.4))), 2, 2.1, 0.48).mul(0.5).add(0.5)
    const fiberResolved = vec2(tube.x.mul(620), tube.y.mul(82)).fwidth().length().smoothstep(0.18, 0.72).oneMinus()
    const viewPhase = view.dot(vec3(0.72, 0.17, -0.67)).mul(0.5).add(0.5)
    const moirePhase = tube.x.mul(TAU * 9).add(tube.y.mul(TAU * 2)).add(viewPhase.mul(2.4)).add(drift.mul(2.8)).add(time.mul(0.035))
    const moireA = moirePhase.sin().mul(0.5).add(0.5).pow(5)
    const moireB = tube.x.mul(TAU * 10).add(tube.y.mul(TAU * 2)).add(viewPhase.mul(2.5704)).add(drift.mul(2.9988)).add(time.mul(0.037485)).add(0.7).sin().mul(0.5).add(0.5).pow(7)
    const moire = moireA.mul(moireB).mul(moirePhase.fwidth().smoothstep(0.5, 1.8).oneMinus())
    const angleTint = spectralColor(tube.x.mul(TAU).add(tube.y.mul(TAU).sin().mul(0.22)).add(drift.mul(0.308)).add(time.mul(0.00385)).add(viewPhase.mul(0.634)))
    const ink = mix(color(hsl.integer(287, 56, 5)), color(hsl.integer(302, 62, 13)), drift.mul(0.5).add(0.5))
    this.colorNode = mix(ink, angleTint.mul(0.38), grazing.pow(1.7).mul(0.58)).mul(weave.mul(0.22).add(0.88))
    this.metalnessNode = weave.mul(0.08)
    this.roughnessNode = float(0.52).sub(weave.mul(0.21)).sub(grazing.mul(0.1)).add(mix(float(0.5), fiber, fiberResolved).mul(0.08)).clamp(0.19, 0.64)
    this.sheen = 1
    this.sheenColor.set(hsl.integer(293, 100, 67))
    this.sheenRoughnessNode = float(0.26).add(grazing.mul(0.22)).sub(weave.mul(0.08))
    this.anisotropy = 0.82
    this.anisotropyRotation = 0
    this.clearcoat = 0.18
    this.clearcoatRoughness = 0.32
    this.iridescenceNode = grazing.mul(0.28).add(moire.mul(0.16))
    this.iridescenceThicknessNode = viewPhase.mul(210).add(moire.mul(130)).add(220)
    this.normalNode = detailNormal(displacedNormal, weave.mul(0.00075).add(fiber.mul(0.00022).mul(fiberResolved)), 0.85)
    this.emissiveNode = mix(color(hsl.integer(290, 76, 40)), color(hsl.integer(202, 85, 68)), viewPhase).mul(moire).mul(grazing.mul(0.7).add(0.18)).mul(0.28)
      .add(color(hsl.integer(308, 100, 85)).mul(weave).mul(weave.pow(2)).mul(grazing).mul(near.mul(0.26).add(0.05)))
      .add(color(hsl.integer(288, 100, 58.4)).mul(intimate.mul(0.018)))
  }
}
