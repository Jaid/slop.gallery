import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, transformNormalToView, uv, vec2, vec3} from 'three/tsl'

import {tubeFrame} from '../../candidates/claude_haiku/lib/knotFrame.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Damask lattice: integer counts keep the diamonds periodic around both the knot and the tube. */
const weave = vec2(84, 10)
/** Velvet with a crushed damask: the pile lies along the knot, and each diamond reverses its nap, so it brightens from the opposite side. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.7)
    this.name = knotData.id
    const {p, view, grazing} = viewerFrame()
    const tube = uv()
    const frame = tubeFrame(tube)
    const weaveUv = tube.mul(weave)
    const cell = wrapCell(weaveUv.floor(), weave)
    const local = weaveUv.fract().sub(0.5).abs()
    const diamond = local.x.add(local.y)
    const motif = diamond.smoothstep(0.46, 0.5).oneMinus()
    const crush = cellNoiseVec3(vec3(cell, 2.2)).x.sub(0.5).sign()
// Pile brightens when it runs across the view and darkens when it points straight at you.
    const alignment = frame.along.dot(view)
    const pile = alignment.abs().oneMinus().pow(1.6)
    const crushedLight = alignment.mul(crush).mul(0.5).add(0.5)
    const light = mix(pile, crushedLight, motif.mul(0.85))
    const fibers = mx_noise_float(positionGeometry.mul(140))
    const cloud = mx_noise_float(p.mul(1.7)).mul(0.5).add(0.5)
    this.colorNode = mix(mix(color(hsl.integer(280, 57, 6.6)), color(hsl.integer(335, 57, 7.4)), cloud), color(hsl.integer(352, 65, 24)), light.mul(0.75))
    this.metalness = 0
    this.roughness = 0.75
    this.sheenNode = mix(color(hsl.integer(302, 65, 50)), color(hsl.integer(73, 68, 82.4)), grazing)
    this.sheenRoughnessNode = float(0.32)
    this.normalNode = transformNormalToView(normalLocal.normalize().add(frame.along.mul(fibers.mul(0.15))).normalize())
  }
}
