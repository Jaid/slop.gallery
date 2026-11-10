import type {FlyingBat} from './flights.ts'
import type {Node} from 'three/webgpu'

import {attribute, exp, float, max, mix, positionGeometry, select, sin, smoothstep, uv, vec2, vec3} from 'three/tsl'
import {PlaneGeometry} from 'three/webgpu'

import {coverage, rgb, turn} from '#src/orbs/lib/fill.ts'

import {cameraRight, partyPoint, screenAxes} from '../lib/billboards.ts'
import EffectSprites, {instanceAttribute} from '../lib/EffectSprites.ts'

/** how far a bat’s quad reaches to either side of its middle and below and above it, in its own units, half its wingspan each, with room for its glow */
const quad = {
  side: 1.45,
  bottom: -1,
  top: 1.2,
} as const
/** seconds a bat takes to grow to its size once it is out */
const growing = 0.3
const silhouetteColor = rgb('#0b0510')
/** the warm light catching its edges */
const rimColor = rgb('#6b2f16')
const glowColor = rgb('#ff7b1c')
const eyeColor = rgb('#ffcf4a')
/** the inside of an ellipse, positive within it, about in units of its smaller radius, optionally tilted by `angle` radians */
function ellipse(point: Node<'vec2'>, center: readonly [number, number], radii: readonly [number, number], angle = 0) {
  const local = turn(point.sub(vec2(...center)), float(-angle))
  return float(1).sub(local.div(vec2(...radii)).length()).mul(Math.min(...radii))
}
/**
 * The inside of a bat seen from the front with its wings spread, positive within it, in its own units, which run from −1 to 1 across its wingspan: a round head with pointed ears on a slim body, and two wings, each stretched from a shoulder over an arched arm to a pointed tip and scalloped between its fingers. `flap` beats them, from −1 with the tips down to 1 with them up.
 */
function batShape(point: Node<'vec2'>, flap: Node<'float'>) {
  const {x, y} = point
  // how far out along the wing, from the shoulder to the tip
  const out = x.abs().sub(0.07).div(0.88)
  const along = out.clamp(0, 1)
  const tip = flap.mul(0.5).add(0.06)
  const arch = sin(along.mul(Math.PI)).mul(flap.mul(0.07).add(0.11))
  const top = mix(float(0.1), tip, along.pow(0.9)).add(arch)
  const depth = float(1).sub(along).pow(0.75).mul(0.36).add(0.03)
  const scallops = sin(along.mul(Math.PI * 3.2)).abs().pow(0.6).mul(depth).mul(0.45)
  const bottom = top.sub(depth).add(scallops)
  const wing = top.sub(y).min(y.sub(bottom)).min(float(1).sub(out).mul(0.88)).min(out.add(0.08))
  const body = ellipse(point, [0, -0.02], [0.085, 0.2])
  const head = float(0.075).sub(point.sub(vec2(0, 0.2)).length())
  const mirrored = vec2(x.abs(), y)
  const ears = ellipse(mirrored, [0.05, 0.29], [0.024, 0.065], -0.35)
  return {
    body: wing.max(body).max(head).max(ears),
    eyes: float(0.014).sub(mirrored.sub(vec2(0.028, 0.205)).length()),
  }
}

/**
 * Bats bursting out of their origin, the Halloween Orb’s bats: a swarm of black silhouettes beating their wings, eyes glinting, with a faint orange glow around them, streams out of the origin, whirls around it while it flies out into the room and climbs off, fading away. Animated entirely on the GPU by the clock, each a quad flat in the view, banking into its turns.
 */
export default class SwarmingBats extends EffectSprites {
  constructor(bats: ReadonlyArray<FlyingBat>) {
    const geometry = new PlaneGeometry(1, 1)
    instanceAttribute(geometry, 'batFlight', bats.map(({beat, delay, life, phase}) => [delay, life, beat, phase]))
    instanceAttribute(geometry, 'batPath', bats.map(({angle, out, reach, swirl}) => [angle, reach, out, swirl]))
    instanceAttribute(geometry, 'batSize', bats.map(({rise, size}) => [rise, size]))
    super('party-bats', geometry, bats.length)
    const {material} = this
    const {clock, normal, tangent} = this.uniforms
    const flight = attribute<'vec4'>('batFlight', 'vec4')
    const path = attribute<'vec4'>('batPath', 'vec4')
    const sizing = attribute<'vec2'>('batSize', 'vec2')
    const [delay, life, beat, phase] = [flight.x, flight.y, flight.z, flight.w]
    const [angle, reach, out, swirl] = [path.x, path.y, path.z, path.w]
    const [rise, size] = [sizing.x, sizing.y]
    const age = clock.sub(delay)
    const since = age.max(0)
    const progress = since.div(life).clamp(0, 1)
    // As `batOffset` flies it.
    const offset = (seconds: Node<'float'>) => {
      const distance = reach.mul(float(1).sub(exp(seconds.mul(-3.2)))).add(seconds.mul(0.25))
      const around = angle.add(swirl.mul(float(1).sub(exp(seconds.mul(-0.9)))))
      const done = seconds.div(life).clamp(0, 1)
      return partyPoint(tangent, normal, around.cos().mul(distance), around.sin().mul(distance).add(rise.mul(done.pow(2.2))), out.mul(float(1).sub(exp(seconds.mul(-1.8)))).add(0.05))
    }
    const center = offset(since)
    // It wobbles as it beats its wings and banks into its turns, by how fast it moves across the view.
    const wobble = sin(since.mul(beat).mul(Math.PI * 2).add(phase)).mul(0.012)
    const sideways = offset(since.add(0.03)).sub(center).dot(cameraRight).div(0.03)
    const {right, up} = screenAxes(sideways.mul(-0.12).clamp(-0.5, 0.5))
    const grown = smoothstep(0, growing, since).mul(0.75).add(0.25)
    const unit = size.mul(grown).mul(0.5)
    const corner = vec2(positionGeometry.x.mul(quad.side * 2), mix(float(quad.bottom), float(quad.top), positionGeometry.y.add(0.5)))
    const placed = center.add(up.mul(wobble)).add(right.mul(corner.x.mul(unit))).add(up.mul(corner.y.mul(unit)))
    material.positionNode = select(age.greaterThan(0), placed, vec3(0, 0, 0))
    const point = vec2(uv().x.sub(0.5).mul(quad.side * 2), mix(float(quad.bottom), float(quad.top), uv().y))
    const flap = sin(since.mul(beat).mul(Math.PI * 2).add(phase))
    const {body, eyes} = batShape(point, flap)
    const presence = select(age.greaterThan(0), smoothstep(0, 0.05, age).mul(smoothstep(1, 0.7, progress)), float(0))
    const silhouette = coverage(body).mul(presence)
    const glint = coverage(eyes).mul(presence)
    // Its edges catch a warm light, its eyes glint, and a faint glow surrounds it, dying out well within its quad.
    const rim = smoothstep(0.035, 0, body).mul(0.7)
    const outside = body.negate().max(0)
    const inside = smoothstep(quad.side, quad.side - 0.25, point.x.abs()).mul(smoothstep(quad.top, quad.top - 0.25, point.y)).mul(smoothstep(quad.bottom, quad.bottom + 0.25, point.y))
    const halo = exp(outside.mul(-12)).mul(smoothstep(0.3, 0.1, outside)).mul(float(1).sub(silhouette)).mul(presence).mul(0.32)
    const shade = mix(mix(silhouetteColor, rimColor, rim), eyeColor.mul(4), glint)
    const alpha = max(silhouette, glint).add(halo)
    material.colorNode = shade.mul(max(silhouette, glint)).add(glowColor.mul(1.6).mul(halo)).div(alpha.max(0.0001))
    material.opacityNode = alpha.mul(inside)
  }
}
