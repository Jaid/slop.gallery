import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalLocal, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

function rootField(tube: Node<'vec2'>) {
  const q = tube.mul(vec2(22, 9))
  const warp = tube.x.mul(TAU * 4).add(tube.y.mul(TAU * 4).sin().mul(0.6)).add(tube.y.mul(TAU * 2).cos().mul(0.25))
  const broad = warp.sin().mul(0.5).add(0.5)
  const rootPhase = tube.x.mul(TAU * 11).add(tube.y.mul(TAU).sin().mul(0.35))
  const roots = rootPhase.sin().abs().smoothstep(0.06, 0.2).oneMinus()
  const fine = tube.x.mul(TAU * 26).add(tube.y.mul(TAU * 3).sin()).sin().abs().smoothstep(0.025, 0.12).oneMinus()
  // Wrap identities and confine their effects to spots clear of the cell boundaries.
  const cell = q.floor().mod(vec2(22, 9))
  const knots = cellNoiseVec3(vec3(cell, 3.7))
  const center = knots.xy.mul(0.5).add(0.25)
  const sporeMask = q.fract().sub(center).length().smoothstep(0.04, 0.18).oneMinus()
  const spore = knots.x.smoothstep(0.69, 0.88).mul(fine.mul(0.6).add(0.4)).mul(sporeMask)
  return {
    q,
    broad,
    roots,
    fine,
    knots,
    spore,
  }
}

/** A living stellar bestiary drawn from connected pinpricks of light. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const tube = uv()
    const {p, view, grazing, near, intimate} = viewerFrame()
    const field = rootField(tube)
    const pulse = time.mul(1.8).add(tube.x.mul(TAU).sin()).sin().mul(0.5).add(0.5)
    const direction = view.dot(vec3(0.5, -0.1, 0.85).normalize()).mul(0.5).add(0.5)
    const rootColor = mix(color(hsl.integer(155, 82, 81)), color(hsl.integer(154, 100, 93)), direction).mul(field.spore.mul(0.8).add(0.25))
    const membrane = mix(color(hsl.integer(183, 63, 10)), color(hsl.integer(195, 85, 29)), field.broad.mul(0.36).add(0.2))
    const height = field.roots.mul(0.035).add(field.fine.mul(0.012)).add(field.spore.mul(0.018))
    this.positionNode = p.add(normalLocal.mul(height.mul(near.mul(0.55).add(0.45)).mul(0.0018)))
    this.colorNode = mix(membrane, rootColor, field.roots.mul(0.82).add(field.fine.mul(0.18)))
    this.metalness = 0.05
    this.roughnessNode = float(0.2).add(field.fine.mul(0.25)).sub(field.roots.mul(0.08)).clamp(0.1, 0.5)
    this.clearcoat = 0.9
    this.clearcoatRoughness = 0.08
    this.normalNode = proceduralNormal(height.mul(1.4), 0.0016)
    this.transmission = 0.08
    this.ior = 1.37
    const glimmer = field.roots.mul(field.spore).mul(pulse).mul(grazing.mul(0.6).add(0.4)).mul(intimate.mul(0.6).add(0.4))
    this.emissiveNode = rootColor.mul(glimmer.mul(1.35)).add(color(hsl.integer(158, 100, 96)).mul(field.fine.mul(near).mul(0.32)))
    this.aoNode = float(0.7).add(field.roots.mul(0.3))
  }
}
