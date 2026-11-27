import type {BlownFlake} from './flights.ts'

import {attribute, exp, float, mix, positionGeometry, select, sin, smoothstep, time, uv, vec2, vec3} from 'three/tsl'
import {PlaneGeometry} from 'three/webgpu'

import {frostColors} from '#src/lib/materials/frostColors.ts'
import {fernStar, snowflakeShape, stellarDendrite} from '#src/lib/materials/snowflake.ts'
import {coverage, rgb, turn} from '#src/orbs/lib/fill.ts'

import {partyPoint, screenAxes} from '../lib/billboards.ts'
import EffectSprites, {instanceAttribute} from '../lib/EffectSprites.ts'
import {flakeRest} from './flights.ts'

/** how far a flake’s quad reaches to either side of its middle, in radii of the crystal, with room for its glow */
const quadReach = 1.35
/** seconds a flake takes to grow to its size once it is out */
const growing = 0.25
/** the share of its life after which a flake fades away, and after which, lying on the floor, it melts */
const fading = 0.7
const snowColor = rgb(frostColors.snow)
const iceColor = rgb(frostColors.ice)
const glowColor = rgb(frostColors.glow)
const glintColor = rgb(frostColors.glint)

/**
 * A blizzard bursting out of its origin, the Frost Orb’s: little snowflakes and large crystals of ice, each flat in the view and spinning round in it, blow out all round the origin, whirl round it while they sail out into the room and sink, glittering, until they fade away, and those that reach the floor settle on it and melt. Animated entirely on the GPU by the clock, every flake a quad whose crystal the fragment shader draws.
 */
export default class BlowingSnow extends EffectSprites {
  constructor(flakes: ReadonlyArray<BlownFlake>) {
    const geometry = new PlaneGeometry(1, 1)
    instanceAttribute(geometry, 'flakeFlight', flakes.map(({delay, fall, life, phase}) => [delay, life, fall, phase]))
    instanceAttribute(geometry, 'flakePath', flakes.map(({angle, out, reach, swirl}) => [angle, reach, out, swirl]))
    instanceAttribute(geometry, 'flakeLook', flakes.map(({design, size, spin}) => [design, size, spin]))
    super('party-blizzard', geometry, flakes.length)
    const {material} = this
    const {clock, floor, normal, tangent} = this.uniforms
    const flight = attribute<'vec4'>('flakeFlight', 'vec4')
    const path = attribute<'vec4'>('flakePath', 'vec4')
    const look = attribute<'vec3'>('flakeLook', 'vec3')
    const [delay, life, fall, phase] = [flight.x, flight.y, flight.z, flight.w]
    const [angle, reach, out, swirl] = [path.x, path.y, path.z, path.w]
    const [design, size, spin] = [look.x, look.y, look.z]
    const age = clock.sub(delay)
    const since = age.max(0)
    const progress = since.div(life).clamp(0, 1)
    // As `flakeOffset` flies it.
    const distance = reach.mul(float(1).sub(exp(since.mul(-2.6))))
    const around = angle.add(swirl.mul(float(1).sub(exp(since.mul(-1.1)))))
    const flutter = sin(since.mul(3.1).add(phase)).mul(0.06).mul(float(1).sub(exp(since.mul(-2))))
    const sinking = around.sin().mul(distance).sub(fall.mul(since.pow(1.4)))
    const up = sinking.max(floor.add(flakeRest))
    const landed = smoothstep(0, 0.02, floor.add(flakeRest).sub(sinking))
    const center = partyPoint(tangent, normal, around.cos().mul(distance).add(flutter), up, out.mul(float(1).sub(exp(since.mul(-1.6)))).add(0.05))
    // Flat in the view, spinning round as it goes.
    const {right, up: upward} = screenAxes()
    const grown = smoothstep(0, growing, since).mul(0.7).add(0.3)
    const radius = size.mul(grown).mul(0.5)
    const corner = positionGeometry.xy.mul(quadReach * 2)
    const placed = center.add(right.mul(corner.x.mul(radius))).add(upward.mul(corner.y.mul(radius)))
    material.positionNode = select(age.greaterThan(0), placed, vec3(0, 0, 0))
    const spun = since.mul(spin).mul(Math.PI * 2).add(phase)
    // It tumbles as it goes, turning edge-on and back about an axis in its plane, which squashes it across that axis.
    const tumbling = sin(since.mul(spin.abs().mul(4).add(0.6)).add(phase.mul(2))).abs().mul(0.75).add(0.25)
    const flat = turn(uv().sub(0.5).mul(quadReach * 2), spun)
    const point = vec2(flat.x, flat.y.div(tumbling)).toVar('flakePoint')
    const dendrite = snowflakeShape(point, stellarDendrite)
    const fern = snowflakeShape(point, fernStar)
    const inside = select(design.lessThan(0.5), dendrite.inside, fern.inside).mul(tumbling)
    const ridge = select(design.lessThan(0.5), dendrite.ridge, fern.ridge)
    // It fades away toward the end of its life, and melts away faster once it lies on the floor.
    const melting = smoothstep(fading, 1, progress).max(landed.mul(smoothstep(0, 0.6, since.sub(life.mul(0.35)))))
    const presence = select(age.greaterThan(0), smoothstep(0, 0.05, age).mul(melting.oneMinus()), float(0))
    const crystal = coverage(inside).mul(presence)
    // Its facets flash as it tumbles in the light, every flake at its own moments, each a little brighter or dimmer than the next.
    const flash = sin(since.mul(spin.abs().mul(4).add(0.6)).add(phase.mul(2))).abs().oneMinus().pow(12).add(sin(time.mul(0.1).add(spun.mul(3)).add(phase.mul(5))).max(0).pow(24))
    const rim = smoothstep(0.05, 0, inside)
    const brightness = sin(phase.mul(7.3)).mul(0.25).add(1.1)
    const shade = mix(iceColor, snowColor, ridge.mul(0.6).add(rim.mul(0.5)).add(0.25).clamp()).mul(brightness).add(glintColor.mul(flash.mul(3)))
    // A cold glow round it, dying out well within its quad.
    const outside = inside.negate().max(0)
    const halo = exp(outside.mul(-14)).mul(smoothstep(0.3, 0.12, outside)).mul(float(1).sub(crystal)).mul(presence).mul(0.35)
    const within = smoothstep(quadReach, quadReach - 0.2, vec2(point.x.abs(), point.y.abs()).length())
    const alpha = crystal.mul(0.92).add(halo)
    material.colorNode = shade.mul(crystal.mul(0.92)).add(glowColor.mul(1.4).mul(halo)).div(alpha.max(0.0001))
    material.opacityNode = alpha.mul(within)
  }
}
