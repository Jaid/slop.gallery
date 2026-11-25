import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, Fn, Loop, mix, mx_noise_float, normalViewGeometry, time, vec2, vec3} from 'three/tsl'

import {rgb} from '../../candidates/claude_fable/lib/rgb.ts'
import {filamentSegment} from '../../candidates/claude_fable/lib/segmentGlow.ts'
import {knotLength, loopCoordinate, tubeCoordinates} from '../../candidates/claude_fable/lib/tubeCoordinates.ts'
import {tubeInterior, tubeRadius} from '../../candidates/claude_fable/lib/tubeInterior.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const steps = 16
const electrodeRadius = 0.012
/** Each filament has its own rhythm: wander speed, radial breathing and a tint for its halo. */
const filaments = [{
  seed: 4.1,
  wanderRate: 1.1,
  breathRate: 1.7,
  tint: rgb(hsl.integer(291, 100, 55)),
}, {
  seed: 21.4,
  wanderRate: 1.47,
  breathRate: 1.93,
  tint: rgb(hsl.integer(336, 100, 68.8)),
}, {
  seed: 38.7,
  wanderRate: 1.84,
  breathRate: 2.16,
  tint: rgb(hsl.integer(233, 100, 76)),
}, {
  seed: 56,
  wanderRate: 2.21,
  breathRate: 2.39,
  tint: rgb(hsl.integer(300, 100, 72.5)),
}]
/** Where a filament sits in the cross-section at a place along the knot – a curve that dances on the viewer's side. */
function filamentPoint(index: number, loop: Node<'vec2'>, cameraAngle: Node<'float'>, attraction: Node<'float'>) {
  const {seed, wanderRate, breathRate} = filaments[index]
  const wander = mx_noise_float(vec3(loop.mul(1.6), time.mul(wanderRate).add(seed))).mul(2.4).add(mx_noise_float(vec3(loop.mul(7), time.mul(wanderRate * 2.3).add(seed))).mul(0.5))
  const spread = mx_noise_float(vec3(loop.mul(0.7).add(31), time.mul(0.3).add(seed))).mul(TAU * 0.5)
// Far away, the filaments roam the whole tube; near the glass they lean toward the viewer's hand.
  const angle = cameraAngle.add(wander.mul(attraction.mul(-0.55).add(1))).add(spread.mul(attraction.oneMinus()))
  const breath = mx_noise_float(vec3(loop.mul(1.3).add(77), time.mul(breathRate).add(seed * 1.7))).mul(0.5).add(0.5).add(mx_noise_float(vec3(loop.mul(6).add(9), time.mul(breathRate * 3))).mul(0.12))
  const radius = breath.clamp().pow(1.4).mul(0.9).add(electrodeRadius / tubeRadius).mul(tubeRadius)
  return {
    angle,
    radius,
    point: vec2(angle.cos(), angle.sin()).mul(radius),
    reach: breath,
  }
}
/** A plasma globe bent into a knot: a glass tube whose lightning seeks whoever stands closest. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.35)
    this.name = knotData.id
    const {grazing, near, intimate} = viewerFrame()
    const interior = tubeInterior(1.42)
    const {along} = tubeCoordinates()
// Attraction grows as the viewer leans in: roaming arcs at gallery distance, a hand on the glass up close.
    const attraction = intimate.mul(0.75).add(0.1)
    const loopAt = (alongOffset: Node<'float'>) => loopCoordinate(along.add(alongOffset.div(knotLength)), knotLength * 1.1)
    const volume = Fn(() => {
      const length = interior.chord.max(0.03)
      const step = length.div(steps)
      const glow = vec3(0).toVar()
      const transmittance = float(1).toVar()
      Loop({
        start: 0,
        end: steps,
        type: 'int',
      }, ({i}) => {
        const start = interior.section(interior.at(float(i).mul(step)))
        const end = interior.section(interior.at(float(i).add(1).mul(step)))
        const from = vec2(start.x, start.y)
        const to = vec2(end.x, end.y)
        const middle = from.add(to).mul(0.5)
        const radial = middle.length()
        const loop = loopAt(start.along.add(end.along).mul(0.5))
// Central electrode: a dark rod wrapped in a violet corona, plus the faint glow of low-pressure gas.
        const corona = filamentSegment(from, to, 0.03)
        glow.addAssign(rgb(hsl.integer(280, 100, 43.7)).mul(corona).mul(0.5).add(rgb(hsl.integer(284, 84, 9)).mul(0.35)).mul(transmittance).mul(step))
        for (const [index, filament_] of filaments.entries()) {
          const filament = filamentPoint(index, loop, interior.cameraAngle, attraction)
          const flicker = mx_noise_float(vec3(time.mul(23), filament_.seed, loop.x.mul(0.5))).mul(0.45).add(0.75)
          const alive = mx_noise_float(vec3(time.mul(0.9).add(filament_.seed), 3.3, 0)).smoothstep(-0.35, -0.05)
          const presence = index < 3 ? alive : alive.mul(near)
          const core = filamentSegment(from.sub(filament.point), to.sub(filament.point), 0.0022)
          const halo = filamentSegment(from.sub(filament.point), to.sub(filament.point), 0.009)
          const body = rgb(hsl.integer(251, 100, 96.5)).mul(core.mul(3.5)).add(filament_.tint.mul(halo.mul(1.3)))
          glow.addAssign(body.mul(flicker).mul(presence).mul(transmittance).mul(step))
        }
        transmittance.mulAssign(radial.smoothstep(electrodeRadius * 0.7, electrodeRadius * 1.3).oneMinus().mul(step).mul(-80).exp())
      })
      return glow
    })
// Where a filament touches the glass it blooms into a soft electric contact spot.
    let touch: Node<'vec3'> = vec3(0)
    for (const [index, filament_] of filaments.entries()) {
      const filament = filamentPoint(index, loopAt(float(0)), interior.cameraAngle, attraction)
// 1 where the filament's angle lines up with this spot on the glass, 0 on the far side of the tube.
      const angular = filament.angle.div(TAU).fract().sub(0.5).abs().mul(2)
      const contact = filament.reach.smoothstep(0.8, 1).mul(angular.smoothstep(0.94, 0.997))
      const bloom = filament_.tint.mul(0.5).add(rgb(hsl.integer(0, 0, 100)).mul(0.5)).mul(contact).mul(index < 3 ? float(1) : near)
      touch = touch.add(bloom)
    }
    const glass = interior.facing.pow(0.35).mul(0.9).add(0.1)
    const violetRim = rgb(hsl.integer(280, 100, 44)).mul(grazing.pow(3)).mul(0.3)
    this.colorNode = rgb(hsl.integer(295, 60, 4))
    this.metalness = 0
    this.roughness = 0.03
    this.ior = 1.5
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.emissiveNode = volume().mul(glass).mul(mix(float(0.85), float(1.15), intimate)).add(touch.mul(2)).add(violetRim).add(rgb(hsl.integer(268, 100, 86)).mul(glints(normalViewGeometry, 220)).mul(0.12))
  }
}
