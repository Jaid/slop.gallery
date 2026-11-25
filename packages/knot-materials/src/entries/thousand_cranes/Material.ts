import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {cameraViewMatrix, color, float, Fn, mix, mx_noise_float, normalWorld, time, transformNormalToView, uv, varying, vec2, vec3, vec4} from 'three/tsl'

import {detailNormal} from '../../candidates/deepseek/lib/detailNormal.ts'
import {filament} from '../../lib/filament.ts'
import {knotFrame} from '../../lib/knotFrame.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A triangle wave with genuinely sharp creases, which is what folded paper is made of. */
const tent = (phase: Node<'float'>) => phase.sin().asin().mul(2 / Math.PI)
/** A knot folded out of washi. Pleats of two families cross into diamonds, the creases standing up as you come closer, and the print runs along the paper in broad indigo brush strokes with vermilion seals where the calligrapher signed. Hold it against the light and the whole sheet fills with a warm haze, because paper has always been more air than fibre. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.85)
    this.name = knotData.id
    const tube = uv()
    const {p, near, intimate, grazing} = viewerFrame()
    const breath = time.mul(0.19).sin().mul(0.14).add(0.9)
    const pleat = Fn(([coordinate]: [Node<'vec2'>]) => {
      const {position, normal} = knotFrame(coordinate)
      const u = coordinate.x
      const v = coordinate.y
      const folds = tent(u.mul(TAU * 7).add(v.mul(TAU * 4))).mul(0.6).add(tent(u.mul(TAU * 3).sub(v.mul(TAU * 5))).mul(0.4))
      return position.add(normal.mul(folds.mul(0.028).mul(near.mul(0.45).add(0.55)).mul(breath)))
    })
    this.positionNode = pleat(tube)
    const epsilon = 0.0005
    const du = pleat(tube.add(vec2(epsilon, 0))).sub(pleat(tube.sub(vec2(epsilon, 0))))
    const dv = pleat(tube.add(vec2(0, epsilon))).sub(pleat(tube.sub(vec2(0, epsilon))))
    const pleatNormal = varying(transformNormalToView(du.cross(dv).normalize())).normalize()
// The creases themselves: the lines where the sheet was pressed.
    const folds = tent(tube.x.mul(TAU * 7).add(tube.y.mul(TAU * 4))).mul(0.6).add(tent(tube.x.mul(TAU * 3).sub(tube.y.mul(TAU * 5))).mul(0.4))
    const crease = filament(folds.sub(0.35), 0.03)
// Paper: kozo fibres, laid by hand, and the fuzz that catches the light at a grazing glance.
    const fibre = filament(mx_noise_float(vec3(p.x.mul(9), p.y.mul(240), p.z.mul(9))).mul(1.5), 0.06).mul(near)
    const speck = mx_noise_float(p.mul(150)).mul(0.5).add(0.5).smoothstep(0.72, 0.9).mul(near)
// Print: indigo strokes carried around the knot, broken where the brush ran dry, and three seals.
    const surface = vec2(tube.x.mul(3.59), tube.y.mul(0.82))
    const stroke = surface.x.mul(4.2).add(surface.y.mul(1.1).mul(3.4).sin()).add(mx_noise_float(p.mul(3.1)).mul(0.6))
    const dryBrush = mx_noise_float(vec3(surface.x.mul(26), surface.y.mul(80), 0)).mul(0.5).add(0.5)
    const inkDeep = filament(stroke.sin(), 0.3).mul(dryBrush.smoothstep(0.18, 0.3))
    const inkWash = filament(stroke.mul(0.36).sin(), 0.62).mul(0.88)
    const seal = (offset: number) => surface.sub(vec2(2.1, 0.29).add(vec2(offset, offset * 0.4))).abs().sub(vec2(0.085, 0.06)).max(vec2(0)).length().smoothstep(0.02, 0.005)
    const seals = seal(0).max(seal(3.1)).max(seal(6.2))
// Foil-thin paper lets the room through: the haze is strongest where the light is behind the sheet.
    const keyLight = cameraViewMatrix.mul(vec4(-3, 9, -16, 0)).xyz.normalize()
    const through = normalWorld.dot(keyLight).negate().clamp().pow(1.3)
// The valleys of a fold sit in their own shade, which is most of what folded paper looks like.
    const valley = folds.mul(0.5).add(0.5)
    const paper = mix(color(hsl.integer(88, 18, 25)), color(hsl.integer(94, 15, 14)), crease.mul(0.34)).add(color(hsl.integer(86, 17, 38)).mul(speck).mul(0.16)).mul(valley.mul(0.6).add(0.42))
    const sheet = mix(mix(paper, color(hsl.integer(267, 59, 19)), inkWash), color(hsl.integer(271, 68, 8)), inkDeep)
    this.colorNode = sheet.add(color(hsl.integer(34, 75, 44)).mul(seals))
    this.metalness = 0
    this.roughnessNode = float(0.72).add(fibre.mul(0.14)).add(inkDeep.mul(0.06)).sub(crease.mul(0.05)).clamp(0.2, 1)
    this.sheen = 0.42
    this.sheenRoughness = 0.62
    this.sheenColor.set(hsl.integer(85, 100, 95.3))
    this.clearcoatNode = crease.mul(grazing).mul(0.12)
    this.clearcoatRoughness = 0.3
    this.normalNode = detailNormal(pleatNormal, fibre.mul(0.0006).add(speck.mul(0.0004)), 0.4)
// Light that crossed the sheet carries the paper’s own colour, so the ink stays dark inside the haze.
    this.emissiveNode = sheet.mul(through).mul(near.mul(0.4).add(0.6)).mul(1.9)
      .add(sheet.mul(through).mul(crease).mul(0.5))
      .add(color(hsl.integer(87, 100, 97)).mul(fibre).mul(0.05))
      .add(color(hsl.integer(44, 100, 76)).mul(intimate).mul(through).mul(0.06))
  }
}
