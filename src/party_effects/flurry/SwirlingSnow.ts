import type {Snowflake} from './flights.ts'

import hsl from 'okhsl'
import {attribute, exp, float, max, mix, positionGeometry, select, sin, smoothstep, uv, vec2, vec3} from 'three/tsl'
import {PlaneGeometry} from 'three/webgpu'

import {snowColors, snowflakeShape} from '#src/lib/materials/snowflake.ts'
import {coverage, rgb} from '#src/orbs/lib/fill.ts'

import {partyPoint, screenAxes} from '../lib/billboards.ts'
import EffectSprites, {instanceAttribute} from '../lib/EffectSprites.ts'
import {snowFlight} from './flights.ts'

/** how far a flake’s quad reaches to either side of its middle, in its own units, which run from −1 to 1 across it, with room for its glow */
const quad = 1.3
/** seconds a flake takes to grow to its size once it is out */
const growing = 0.22
const brightColor = rgb(snowColors.bright)
const glowColor = rgb(snowColors.glow)
const shadowColor = rgb(hsl.integer(238, 58, 66))

/** Snow bursting out of its origin, the Frost Orb’s flurry: a swirling gust of fine snow and great stellar flakes, each a perfect sixfold crystal glinting as it turns over, whirled around the origin into the room, then fluttering down to the floor, where it rests a moment and melts away. Animated entirely on the GPU by the clock, each a quad flat in the view, tumbling as it falls. */
export default class SwirlingSnow extends EffectSprites {
  constructor(flakes: ReadonlyArray<Snowflake>) {
    const geometry = new PlaneGeometry(1, 1)
    instanceAttribute(geometry, 'flakeFlight', flakes.map(({delay, flutter, life, phase}) => [delay, life, flutter, phase]))
    instanceAttribute(geometry, 'flakePath', flakes.map(({angle, out, reach, swirl}) => [angle, reach, out, swirl]))
    instanceAttribute(geometry, 'flakeFall', flakes.map(({fall, size, spin}) => [fall, size, spin]))
    super('party-flurry', geometry, flakes.length)
    const {material} = this
    const {clock, floor, normal, tangent} = this.uniforms
    const flight = attribute<'vec4'>('flakeFlight', 'vec4')
    const path = attribute<'vec4'>('flakePath', 'vec4')
    const falling = attribute<'vec3'>('flakeFall', 'vec3')
    const [delay, life, flutter, phase] = [flight.x, flight.y, flight.z, flight.w]
    const [angle, reach, out, swirl] = [path.x, path.y, path.z, path.w]
    const [fall, size, spin] = [falling.x, falling.y, falling.z]
    const age = clock.sub(delay)
    const since = age.max(0)
    const progress = since.div(life).clamp(0, 1)
    // As `flakeOffset` flies it.
    const {burst, drift, flutterAcross, flutterUp, out: outRate, settle} = snowFlight
    const distance = reach.mul(float(1).sub(exp(since.mul(-burst)))).add(since.mul(drift))
    const around = angle.add(swirl.mul(float(1).sub(exp(since.mul(-0.7)))))
    const fallen = fall.mul(since.sub(float(1).sub(exp(since.mul(-settle))).div(settle)))
    const fluttering = since.min(1)
    const across = sin(since.mul(flutter).mul(Math.PI * 2).add(phase)).mul(flutterAcross).mul(fluttering)
    const along = around.cos().mul(distance).sub(around.sin().mul(across))
    const up = around.sin().mul(distance).add(around.cos().mul(across)).sub(fallen).add(sin(since.mul(flutter).mul(1.31 * Math.PI * 2).add(phase.mul(1.7))).mul(flutterUp).mul(fluttering)).max(floor.add(size.mul(0.5)))
    const center = partyPoint(tangent, normal, along, up, out.mul(float(1).sub(exp(since.mul(-outRate)))).add(0.05))
    // It turns over as it falls; toward the end it melts, shrinking as it goes.
    const {right, up: quadUp} = screenAxes(phase.add(since.mul(spin)))
    const grown = smoothstep(0, growing, since).mul(0.7).add(0.3)
    const melted = mix(float(1), float(0.3), smoothstep(0.82, 1, progress))
    const unit = size.mul(grown).mul(melted).mul(0.5)
    const corner = vec2(positionGeometry.x, positionGeometry.y).mul(quad * 2)
    const placed = center.add(right.mul(corner.x.mul(unit))).add(quadUp.mul(corner.y.mul(unit)))
    material.positionNode = select(age.greaterThan(0), placed, vec3(0, 0, 0))
    const point = uv().sub(0.5).mul(quad * 2)
    const inside = snowflakeShape(point)
    const presence = select(age.greaterThan(0), smoothstep(0, 0.06, age).mul(smoothstep(1, 0.8, progress)), float(0))
    // Fine snow too small for its arms to resolve still reads as a soft speck of its heart.
    const speck = smoothstep(0.4, 0.05, point.length()).mul(0.4)
    const crystal = max(coverage(inside), speck).mul(presence)
    const ridge = inside.mul(9).clamp()
    // As it turns over, its faces catch the light in a glint three times a turn, like real snow glitter.
    const glint = sin(since.mul(spin).mul(3).add(phase)).mul(0.5).add(0.5).pow(6)
    const outside = inside.negate().max(0)
    const halo = exp(outside.mul(-9)).mul(smoothstep(0.35, 0.12, outside)).mul(float(1).sub(crystal)).mul(presence).mul(0.3)
    const atEdge = smoothstep(quad, quad - 0.2, point.x.abs().max(point.y.abs()))
    const shade = mix(shadowColor, brightColor.mul(glint.mul(1.6).add(1.15)), ridge.mul(0.75).add(0.25))
    const alpha = crystal.add(halo)
    material.colorNode = shade.mul(crystal).add(glowColor.mul(1.7).mul(halo)).div(alpha.max(0.0001))
    material.opacityNode = alpha.mul(atEdge)
  }
}
