import type {Node, Texture} from 'three/webgpu'

import {color, float, mix, negateOnBackSide, normalViewGeometry, positionView, positionViewDirection, time, transformNormalToView, uv, varying, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {glints} from '../../lib/glints.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

const grid: [number, number] = [132, 16]
/** Surface-gradient bump on an explicit base normal, for detail too fine to displace. */
function perturbNormal(base: Node<'vec3'>, height: Node<'float'>, strength: Node<'float'> | number) {
  const dx = positionView.dFdx()
  const dy = positionView.dFdy()
  const rx = dy.cross(base)
  const ry = base.cross(dx)
  const determinant = dx.dot(rx)
  const gradient = rx.mul(height.dFdx()).add(ry.mul(height.dFdy())).mul(determinant.sign()).div(determinant.abs().max(1e-12))
  return base.sub(gradient.mul(strength)).normalize()
}
/** One overlapping wing scale per staggered lattice cell. The field is free of derivatives so it can drive the vertex displacement; the micro-ridges that give Morpho scales their fire are added later as a fragment-only normal perturbation. */
function scaleField(tube: Node<'vec2'>) {
  const q = tube.mul(vec2(...grid))
  const row = q.y.floor()
  const shifted = vec2(q.x.add(row.mod(2).mul(0.5)), q.y)
  const wrapped = wrapCell(shifted.floor(), vec2(...grid))
  const rnd = cellNoiseVec3(vec3(wrapped, 3.7))
  const rnd2 = cellNoiseVec3(vec3(wrapped, 11.9))
  const s = shifted.fract()
  const d = vec2(s.x.sub(0.48).mul(0.95), s.y.sub(0.5).mul(1.45)).length()
  const serration = s.y.mul(44).add(rnd.y.mul(9)).sin().mul(0.02).mul(s.x.smoothstep(0.55, 1))
  const plate = d.add(serration).smoothstep(0.92, 1).oneMinus()
  // The scale must vanish at every cell wall: a disc that crosses into a neighbor
  // would meet a different random tilt there and tear into a lit cliff.
  const window = s.x.smoothstep(0, 0.08).mul(s.x.smoothstep(0.92, 1).oneMinus()).mul(s.y.smoothstep(0, 0.08)).mul(s.y.smoothstep(0.92, 1).oneMinus())
  const dome = d.mul(d).oneMinus().max(0).sqrt()
  const flutter = time.mul(1.7).add(rnd.y.mul(TAU)).add(tube.x.mul(TAU * 3)).sin().mul(0.09).add(1)
  const height = dome.mul(0.003).add(s.x.mul(0.007)).add(s.x.pow(3).mul(0.004)).add(rnd.x.sub(0.5).mul(s.x.sub(0.5)).mul(0.012)).mul(plate).mul(window).mul(flutter)
  return {
    d,
    height,
    plate: plate.mul(window),
    rnd,
    rnd2,
    s,
    window,
  }
}
function scaleShape(tube: Node<'vec2'>) {
  const frame = knotFrame(tube)
  return frame.position.add(frame.normal.mul(scaleField(tube).height))
}
/** A knot shingled with Morpho wing scales. No pigment is blue: each scale is a tiny tilted mirror over black velvet, and its color is pure interference between the scale, its micro-ridges and your eye — so a walk around the knot sends slow weather of blue, teal and violet drifting across the scales. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    this.envMapIntensity = 0.7
    const tube = uv()
    const {near, intimate} = viewerFrame()
    this.positionNode = scaleShape(tube)
    const eps = 0.00035
    const du = scaleShape(tube.add(vec2(eps, 0))).sub(scaleShape(tube.sub(vec2(eps, 0))))
    const dv = scaleShape(tube.add(vec2(0, eps))).sub(scaleShape(tube.sub(vec2(0, eps))))
    const displacedNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
    const f = scaleField(tube)
    const ridgePhase = f.s.y.mul(float(16).add(f.rnd2.y.mul(8))).add(f.rnd.x.mul(TAU))
    const ridgeFade = ridgePhase.fwidth().smoothstep(0.15, 0.5).oneMinus()
    const ridgeHeight = ridgePhase.mul(TAU).sin().mul(f.plate).mul(f.window)
    const scaleNormal = perturbNormal(displacedNormal, ridgeHeight, ridgeFade.mul(0.00055))
    this.normalNode = negateOnBackSide(scaleNormal)
    const cosView = scaleNormal.dot(positionViewDirection).abs().clamp()
    const grazing = cosView.oneMinus()
    // Structural color, kept inside the Morpho family: indigo in shadow, royal
    // blue square-on, cyan as the scale turns, and a violet fringe at the edge of
    // vision. The travel is set by the angle between eye and scale, nudged per
    // scale and swept across each scale from root to tip.
    const travel = grazing.mul(0.85).add(f.rnd.z.mul(0.25)).add(f.s.y.mul(0.18)).add(f.rnd2.y.mul(0.2)).clamp()
    let scaleColor = mix(color('#050d3d'), color('#0826a0'), travel.smoothstep(0.05, 0.45))
    scaleColor = mix(scaleColor, color('#0e8fe0'), travel.smoothstep(0.55, 0.85))
    scaleColor = mix(scaleColor, color('#5c1eb8'), travel.smoothstep(0.8, 1))
    const band = travel.mul(3.5).add(f.rnd.x.mul(3)).sin().mul(0.5).add(0.5)
    scaleColor = scaleColor.mul(band.mul(0.5).add(0.7)).mul(f.rnd2.x.mul(0.45).add(0.8))
    const edge = f.d.smoothstep(0.68, 0.98)
    const border = f.d.smoothstep(0.8, 0.95).mul(f.plate)
    const rootShade = f.s.x.smoothstep(0, 0.35).mul(0.65).add(0.35)
    const albedo = mix(color('#02030a'), scaleColor, f.plate).mul(edge.mul(-0.85).add(1)).mul(border.mul(-0.85).add(1)).mul(rootShade).mul(grazing.mul(-0.55).add(1))
    this.colorNode = albedo
    // Partial metalness tints the reflection itself with the structural color,
    // so the brightest glints stay blue instead of washing to white ceramic.
    this.metalnessNode = f.plate.mul(0.42).add(0.04)
    this.specularIntensity = 0.5
    this.roughnessNode = mix(float(0.85), float(0.3), f.plate.mul(f.s.x.smoothstep(0, 0.4).mul(0.7).add(0.3))).add(edge.mul(0.25))
    this.clearcoatNode = f.plate.mul(rootShade).mul(0.15).add(0.02)
    this.clearcoatRoughness = 0.05
    this.clearcoatNormalNode = normalViewGeometry
    this.aoNode = mix(float(0.38), float(1), f.plate.mul(rootShade))
    const sparkle = glints(scaleNormal, 140).mul(intimate.mul(0.7).add(0.3)).mul(f.plate)
    this.emissiveNode = scaleColor.mul(f.plate).mul(band.mul(0.22).add(0.06)).mul(near.mul(0.4).add(0.75)).mul(grazing.mul(-0.5).add(1))
      .add(color('#cfe6ff').mul(sparkle).mul(0.8))
  }
}
