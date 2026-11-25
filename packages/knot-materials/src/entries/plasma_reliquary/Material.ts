import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, select, time, uv, vec2, vec3} from 'three/tsl'

import {ramp} from '../../candidates/claude_opus/lib/ramp.ts'
import {knotLength, knotTubeRadius, tubeMetric} from '../../candidates/claude_opus/lib/tubeMetric.ts'
import {tubeSection, wrapAngle} from '../../candidates/claude_opus/lib/tubeSection.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Tendril anchors along the electrode; a whole number keeps the seam closed. */
const count = 76
const spacing = knotLength / count
const radius = knotTubeRadius
/** Candidate tendrils per pixel, around the one whose anchor cell the line of sight crosses at the centerline. */
const candidates = [-2, -1, 0, 1, 2]
/** Gaussian falloff of a distance with a given width. */
const gauss = (distance: Node<'float'>, width: Node<'float'> | number) => distance.div(width).pow2().negate().exp()
/**
 * Plasma globe drawn into a knot of glass. The interior is solved per pixel, without ray marching: every tendril is a
 * wandering radial filament from the central electrode to the wall, so its crossing with the line of sight follows
 * in closed form from the viewer’s position in the tube’s cross-section. Tendrils are drawn toward the viewer, fork
 * near the glass and pool into small coronas where they touch it.
 */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.65)
    this.name = knotData.id
    const tube = uv()
    const {view, grazing, objectDistance} = viewerFrame()
    const section = tubeSection(tube, view)
    const s = tubeMetric(tube).x
    const footprint = s.fwidth().max(0.0002)
// A hand approaching a plasma globe: tendrils gather, brighten and multiply.
    const closeness = ramp(objectDistance, 3.6, 1.1)
    const spread = mix(float(2.25), float(1.05), closeness)
    const activation = mix(float(0.5), float(0.12), closeness)
    const lateral = section.lateral
    const surfaceDepth = section.depth
    const coreS = s.sub(surfaceDepth.mul(radius).mul(section.obliquity))
    const baseCell = coreS.div(spacing).floor()
    let core: Node<'vec3'> = vec3(0)
    let halo: Node<'vec3'> = vec3(0)
    let corona: Node<'vec3'> = vec3(0)
    for (const offset of candidates) {
      const k = baseCell.add(offset)
      const id = k.mod(count).add(count).mod(count)
      const rnd = cellNoiseVec3(vec3(id, 1.7, 3.1))
      const rnd2 = cellNoiseVec3(vec3(id, 8.3, 0.4))
// Each tendril lives for a few seconds, dies and is reborn at a new angle.
      const cycle = time.mul(rnd.z.mul(0.3).add(0.16)).add(rnd.x.mul(17))
      const epoch = cycle.floor()
      const life = cycle.fract()
      const fate = cellNoiseVec3(vec3(id, epoch, 5.5))
      const alive = life.smoothstep(0, 0.07).mul(life.smoothstep(0.72, 1).oneMinus()).mul(fate.x.smoothstep(activation, activation.add(0.12)))
      const sway = time.mul(rnd2.x.sub(0.5).mul(0.9)).add(rnd2.y.mul(TAU)).sin().mul(0.28)
      const angle = fate.y.sub(0.5).mul(2).mul(spread).add(sway)
      const sine = angle.sin()
      const cosine = angle.cos()
      const safeSine = select(sine.lessThan(0), sine.min(-0.03), sine.max(0.03))
// Where the line of sight crosses this tendril, as a fraction of the way from electrode to glass.
      const reach = lateral.div(safeSine)
      const within = reach.smoothstep(-0.03, 0.03).mul(reach.smoothstep(0.97, 1.02).oneMinus())
      const r = reach.clamp(0, 1)
      const travel = surfaceDepth.sub(r.mul(cosine)).max(0).mul(radius)
      const seen = s.sub(travel.mul(section.obliquity))
      const seed = id.mul(7.31).add(epoch.mul(3.7))
      const wander = mx_noise_float(vec3(seed, r.mul(2.4), time.mul(0.75))).mul(0.62)
        .add(mx_noise_float(vec3(seed.add(41), r.mul(7.5), time.mul(2.3))).mul(0.17))
        .add(mx_noise_float(vec3(seed.add(83), r.mul(19), time.mul(4.1))).mul(0.05))
        .mul(spacing).mul(r.pow(0.8))
      const anchor = k.add(0.5).add(rnd.y.sub(0.5).mul(0.6)).mul(spacing)
      const path = anchor.add(wander)
// Near the glass the discharge forks.
      const fork = r.sub(0.5).max(0).mul(radius).mul(rnd2.z.mul(0.9).add(0.5))
      const forked = rnd2.x.smoothstep(0.25, 0.4)
      const distanceA = seen.sub(path.add(fork.mul(0.65)))
      const distanceB = seen.sub(path.sub(fork))
      const width = mix(float(0.0019), float(0.0009), r)
      const effective = width.max(footprint.mul(0.75))
      const energy = width.div(effective)
      const thread = gauss(distanceA, effective).add(gauss(distanceB, effective).mul(forked).mul(0.7)).mul(energy)
      const sheath = gauss(distanceA, 0.009).add(gauss(distanceB, 0.009).mul(forked).mul(0.6))
// Seen end-on, a tendril stacks its glow along the line of sight.
      const endOn = sine.abs().max(0.28).reciprocal().min(2.2)
      const flicker = mx_noise_float(vec2(seed, time.mul(7))).mul(0.25).add(0.9)
      const splash = r.smoothstep(0.78, 1)
      const strength = alive.mul(within).mul(endOn).mul(flicker).mul(rnd.z.mul(0.5).add(0.75))
      const tint = mix(color(hsl.integer(319, 100, 61.6)), color(hsl.integer(278, 100, 48)), r.pow(1.5))
      core = core.add(mix(color(hsl.integer(330, 100, 91)), color(hsl.integer(288, 100, 82)), r).mul(thread).mul(strength).mul(splash.mul(1.6).add(1)))
      halo = halo.add(tint.mul(sheath).mul(strength))
// Where a tendril touches the glass it pools into a small corona, seen on the near wall or through the tube.
      const spotS = path.add(fork.mul(0.65))
      const spotLateral = lateral.sub(sine).mul(radius)
      const spotAxial = s.sub(surfaceDepth.sub(cosine).max(0).mul(radius).mul(section.obliquity)).sub(spotS)
      const front = cosine.smoothstep(-0.1, 0.2).mul(0.6).add(0.4)
      const spot = gauss(spotLateral.pow2().add(spotAxial.pow2()).sqrt(), mix(float(0.0055), float(0.009), closeness))
      corona = corona.add(mix(color(hsl.integer(335, 100, 71.5)), color(hsl.integer(330, 100, 96.6)), spot.pow(3)).mul(spot.add(gauss(spotLateral.pow2().add(spotAxial.pow2()).sqrt(), 0.028).mul(0.12))).mul(alive).mul(front))
// A faint ghost marks where a dead tendril last touched the glass.
      corona = corona.add(color(hsl.integer(305, 81, 30)).mul(gauss(wrapAngle(section.relative.sub(angle)).mul(radius), 0.05)).mul(gauss(s.sub(spotS), 0.05)).mul(life.smoothstep(0.7, 1)).mul(0.15))
    }
// The electrode: a white-hot wire with current beading along it.
    const wireDistance = lateral.abs().mul(radius)
    const current = s.mul(52).sub(time.mul(3.1)).sin().mul(0.5).add(0.5).pow(3).mul(0.4).add(0.8)
    const wireWidth = float(0.0021).max(lateral.mul(radius).fwidth().mul(0.75))
    const wire = gauss(wireDistance, wireWidth).mul(float(0.0021).div(wireWidth)).mul(current)
    const wireHalo = gauss(wireDistance, 0.03)
// Low-pressure gas glows faintly along the chord through the tube.
    const chord = lateral.pow2().oneMinus().max(0).sqrt()
    const gas = mx_noise_float(vec3(s.mul(9), section.relative.mul(1.4), time.mul(0.35))).mul(0.5).add(0.5)
    this.colorNode = color(hsl.integer(293, 50, 3))
    this.metalness = 0
    this.roughness = 0.08
    this.specularIntensity = 0.8
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    const intensity = closeness.mul(0.55).add(0.85)
    this.emissiveNode = core.mul(3.4).mul(intensity)
      .add(halo.mul(0.55).mul(intensity))
      .add(corona.mul(1.1).mul(intensity))
      .add(color(hsl.integer(326, 100, 96.6)).mul(wire).mul(2.6))
      .add(color(hsl.integer(303, 100, 55.3)).mul(wireHalo).mul(0.22))
      .add(color(hsl.integer(301, 83, 14)).mul(chord).mul(gas.mul(0.5).add(0.5)).mul(0.22))
      .add(color(hsl.integer(229, 99, 81)).mul(grazing.pow(5)).mul(0.12))
  }
}
