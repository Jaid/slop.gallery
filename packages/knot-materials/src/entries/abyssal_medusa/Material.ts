import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalView, time, uv, vec3} from 'three/tsl'

import {backlight} from '../../candidates/space_bunny/lib/backlight.ts'
import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A medusa from the bathypelagic dark. The bell is almost pure water, so the piece is really its own nerve net: a mesh of light that fires a wave around the body, twice as fast as you walk away from it, leaving the flesh behind it slowly closing. The plankton caught in the net drifts, and every time a wave passes they answer. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.35)
    this.name = knotData.id
    const tube = uv()
    const {p, facing, grazing, near} = viewerFrame()
// The wave: a pulse running the length of the bell, fired from the nerve ring.
    const travel = tube.x.mul(Math.PI * 6).sub(time.mul(2.4))
    const wave = travel.sin().mul(0.5).add(0.5).pow(3.2)
// The net: two families of cell walls, the canals between them, and a lantern in every node.
    const walls = cellularBoundary(p.mul(15))
    const fine = cellularBoundary(p.mul(41))
    const node = cellularPoints(p.mul(15), 0.02, 0.13, 0.35)
// Radial canals running with the fibres of the bell.
    const radial = tube.y.mul(Math.PI * 12).sin().abs().smoothstep(0.28, 0).oneMinus()
    const net = walls.smoothstep(0.06, 0).oneMinus().add(fine.smoothstep(0.04, 0).oneMinus().mul(0.45)).clamp().mul(wave.mul(1.5).add(0.12))
    const lantern = node.mul(wave.mul(1.8).add(0.15))
// Flesh: cold water, a little protein, and the light that made it through.
    const flesh = cellularPoints(p.mul(9), 0.05, 0.24)
    const scatter = backlight(normalView, 2.2, 0.5)
    this.colorNode = mix(color(hsl.integer(276, 39, 4.4)), color(hsl.integer(287, 69, 10)), facing.pow(0.7)).mul(float(1).add(flesh.mul(0.4)))
    this.metalness = 0
    this.roughnessNode = float(0.18).add(grazing.mul(0.12)).sub(net.mul(0.08)).clamp(0.06, 0.6)
    this.ior = 1.35
    this.clearcoat = 0.7
    this.clearcoatRoughness = 0.12
    this.normalNode = proceduralNormal(flesh.mul(0.0016).add(radial.mul(0.0006)), 0.6)
    this.sheen = 0.5
    this.sheenColor.set(hsl.integer(229, 99, 81))
    this.sheenRoughness = 0.45
// Plankton: what the net caught, each mote answering the wave as it passes.
    const mote = cellularPoints(p.add(vec3(time.mul(0.01), time.mul(0.02), 0)).mul(70), 0.01, 0.09, 0.62)
    this.emissiveNode = color(hsl.integer(214, 99, 81)).mul(net).mul(1.7)
      .add(color(hsl.integer(212, 100, 92.3)).mul(lantern).mul(1.1))
      .add(color(hsl.integer(248, 100, 66.4)).mul(mote).mul(wave.mul(2.4).add(0.5)).mul(0.55))
      .add(color(hsl.integer(286, 99, 53)).mul(scatter).mul(0.22))
      .add(color(hsl.integer(248, 100, 81.4)).mul(radial).mul(wave).mul(0.18))
      .add(color(hsl.integer(223, 100, 92)).mul(grazing.pow(2.6)).mul(0.08))
      .add(color(hsl.integer(285, 79, 19.4)).mul(near.oneMinus()).mul(0.02))
  }
}
