import type {StaringEye} from './flights.ts'
import type {Node} from 'three/webgpu'

import {atan, attribute, exp, float, hash, max, mix, mx_noise_float, positionGeometry, select, sin, smoothstep, uv, vec2, vec3} from 'three/tsl'
import {PlaneGeometry} from 'three/webgpu'

import {coverage, rgb} from '#src/orbs/lib/fill.ts'

import {partyPoint, uprightAxes} from '../lib/billboards.ts'
import EffectSprites, {instanceAttribute} from '../lib/EffectSprites.ts'
import {opening, shutting, staring} from './flights.ts'

/** how far an eye’s quad reaches to either side of its middle, below and above it, in its own units, half its width each, with room for the skin around it and, below, for its tears */
const quad = {
  side: 1.4,
  bottom: -2.1,
  top: 1.15,
} as const
/** how far its iris reaches from its middle, in its own units */
const irisRadius = 0.34
const colors = {
  sclera: rgb('#cdb98e'),
  vein: rgb('#8a0a10'),
  irisInner: rgb('#d9a21e'),
  irisOuter: rgb('#3f7a1f'),
  limbus: rgb('#120a04'),
  skin: rgb('#3e1212'),
  fold: rgb('#7a2a26'),
  lid: rgb('#0e0303'),
  blood: rgb('#5e0007'),
  shine: rgb('#ffffff'),
}
/** how far the lids of an eye with the given openness, 0–1, stand apart at `x`, in its own units: the upper lid’s height and the lower one’s */
function lids(x: Node<'float'>, openness: Node<'float'>) {
  const curve = float(1).sub(x.mul(x)).max(0).pow(0.85)
  return {
    upper: curve.mul(openness).mul(0.6),
    lower: curve.mul(openness).mul(-0.46),
  }
}

/**
 * Eyes opening in the air around their origin: each opens in a smudge of dark, wrinkled skin, a bloodshot, jaundiced eyeball with a glowing iris that darts about, until all of them snap round at once to stare at whoever watches, their pupils shrinking to pinpricks; some weep blood, they blink now and then and finally slam shut, and the skin fades away. Animated entirely on the GPU by the clock, each a quad standing upright as it turns toward the camera.
 */
export default class StaringEyes extends EffectSprites {
  constructor(eyes: ReadonlyArray<StaringEye>) {
    const geometry = new PlaneGeometry(1, 1)
    instanceAttribute(geometry, 'eyeTimes', eyes.map(({close, open, phase, size}) => [open, close, phase, size]))
    instanceAttribute(geometry, 'eyeSpot', eyes.map(({slit, spot, weeps}) => [...spot, (slit ? 1 : 0) + (weeps ? 2 : 0)]))
    super('party-eyes', geometry, eyes.length)
    const {material} = this
    const {clock, normal, tangent} = this.uniforms
    const times = attribute<'vec4'>('eyeTimes', 'vec4')
    const placing = attribute<'vec4'>('eyeSpot', 'vec4')
    const [openAt, closeAt, phase, size] = [times.x, times.y, times.z, times.w]
    const traits = placing.w
    const slit = traits.mod(2).greaterThan(0.5)
    const weeps = traits.greaterThan(1.5)
    const age = clock.sub(openAt.sub(0.15))
    const center = partyPoint(tangent, normal, placing.x, placing.y.add(sin(clock.mul(1.3).add(phase.mul(9))).mul(0.015)), placing.z)
    const unit = size.mul(0.5)
    const {right, up} = uprightAxes(center)
    const corner = vec2(positionGeometry.x.mul(quad.side * 2), mix(float(quad.bottom), float(quad.top), positionGeometry.y.add(0.5)))
    const placed = center.add(right.mul(corner.x.mul(unit))).add(up.mul(corner.y.mul(unit)))
    material.positionNode = select(age.greaterThan(0), placed, vec3(0, 0, 0))
    const point = vec2(uv().x.sub(0.5).mul(quad.side * 2), mix(float(quad.bottom), float(quad.top), uv().y))
    const {x, y} = point
    // It opens with a twitch, blinks once while it stares and slams shut.
    const opened = smoothstep(0, opening, clock.sub(openAt))
    const twitch = sin(clock.sub(openAt).mul(40)).mul(smoothstep(opening * 1.6, opening, clock.sub(openAt))).mul(0.12).mul(opened)
    const blinkAt = phase.mul(0.7).add(staring + 0.45)
    const blink = smoothstep(0.09, 0, clock.sub(blinkAt).abs())
    const shut = smoothstep(closeAt, closeAt.add(shutting.lids), clock)
    const openness = opened.sub(twitch).mul(float(1).sub(blink)).mul(float(1).sub(shut)).clamp(0, 1)
    const {lower, upper} = lids(x, openness)
    const almond = upper.sub(y).min(y.sub(lower)).min(float(1).sub(x.abs()))
    // It darts about from one spot to the next until everything snaps round to stare.
    const darting = clock.mul(3.2).add(phase.mul(11))
    const step = darting.floor()
    const glanceAt = (index: Node<'float'>) => vec2(hash(index.add(phase.mul(37))).sub(0.5), hash(index.add(phase.mul(37)).add(0.5)).sub(0.5).mul(0.6)).mul(1.4)
    const glance = mix(glanceAt(step), glanceAt(step.add(1)), smoothstep(0.75, 0.95, darting.fract()))
    const stares = smoothstep(staring, staring + 0.05, clock)
    const tremor = vec2(sin(clock.mul(31).add(phase.mul(5))), sin(clock.mul(27).add(phase.mul(3)))).mul(0.01)
    const gaze = mix(glance, tremor, stares).mul(0.32)
    const pupilRadius = mix(float(0.17), float(0.075).add(sin(clock.mul(5).add(phase.mul(6))).mul(0.008)), smoothstep(staring, staring + 0.15, clock))
    // The eyeball: a bloodshot, jaundiced white, darkened under the upper lid, a glowing iris of fibers and a pupil, round or a slit, with a wet shine.
    const seen = point.sub(gaze)
    const radial = seen.length().div(irisRadius)
    const around = atan(seen.y, seen.x)
    const fibers = mx_noise_float(vec3(around.cos().mul(6), around.sin().mul(6), radial.mul(2).add(phase.mul(9)))).mul(0.5).add(0.5)
    const iris = mix(colors.irisInner, colors.irisOuter, radial.smoothstep(0.35, 0.9)).mul(fibers.mul(0.8).add(0.45)).mul(1.5)
    const irisMask = coverage(float(1).sub(radial).mul(irisRadius))
    const limbus = radial.smoothstep(0.8, 1)
    const pupilShape = select(slit, vec2(seen.x.div(0.3), seen.y.div(1.9)), seen).length()
    const pupilMask = coverage(pupilRadius.sub(pupilShape))
    const veinPoint = point.mul(3.5).add(phase.mul(7))
    const veins = float(1).sub(mx_noise_float(vec3(veinPoint, 0.5)).abs().mul(12)).max(0).pow(2).mul(smoothstep(0.15, 0.8, x.abs()))
      .add(float(1).sub(mx_noise_float(vec3(veinPoint.mul(2.3), 4.5)).abs().mul(14)).max(0).pow(2).mul(smoothstep(0.45, 1, x.abs())).mul(0.7))
    const blush = smoothstep(0.2, 1, x.abs()).mul(0.7)
    const lidShadow = smoothstep(0, 0.22, upper.sub(y)).mul(0.55).add(0.45)
    const sclera = mix(mix(colors.sclera, colors.vein, blush), colors.vein.mul(0.8), veins.clamp(0, 1)).mul(lidShadow)
    const shine = exp(point.sub(gaze).sub(vec2(-0.12, 0.13)).length().div(0.055).pow2().negate()).mul(0.9)
    const eyeball = mix(mix(sclera, mix(iris, colors.limbus, limbus), irisMask), vec3(0.003), pupilMask).add(colors.shine.mul(shine))
    // Around it, a smudge of dark, wrinkled skin with a fold above, and a dark rim along the lids.
    const skinShape = float(1.12).sub(vec2(x.div(1.3), y.add(0.02).div(0.9)).length())
    const wrinkles = sin(y.mul(26).add(mx_noise_float(vec3(point.mul(3), phase.mul(13))).mul(4))).mul(0.5).add(0.5)
    const fold = smoothstep(0.12, 0, y.sub(upper.add(0.17)).abs()).mul(smoothstep(1, 0.4, x.abs()))
    const skin = mix(colors.skin.mul(wrinkles.mul(0.5).add(0.6)), colors.fold, fold.mul(0.6))
    const rim = smoothstep(0.06, 0, almond.abs()).mul(opened)
    const skinAlpha = smoothstep(0, 0.35, skinShape).mul(0.92)
    // Once it stares, a weeping eye sheds a tear of blood that runs down from its lower lid.
    const weeping = clock.sub(staring + 0.2).max(0)
    const trail = select(weeps, float(1), float(0))
    const tearX = float(0.22).add(sin(y.mul(5).add(phase.mul(4))).mul(0.03))
    const tearEnd = float(-0.25).sub(weeping.mul(0.95).min(1.65))
    const tearWidth = smoothstep(tearEnd, float(-0.25), y).mul(0.02).add(0.025)
    const tear = tearWidth.sub(x.sub(tearX).abs()).min(lower.sub(y).add(0.05)).min(y.sub(tearEnd))
    const bead = float(0.05).sub(vec2(x.sub(tearX), y.sub(tearEnd)).length())
    const tearInside = tear.max(bead).mul(trail).sub(float(1).sub(trail))
    const tearMask = coverage(tearInside).mul(smoothstep(0, 0.1, weeping))
    const eyeMask = coverage(almond)
    const surface = mix(mix(skin, colors.lid, rim), eyeball, eyeMask)
    const presence = select(age.greaterThan(0), smoothstep(0, 0.2, age).mul(smoothstep(closeAt.add(shutting.lids + shutting.fading), closeAt.add(shutting.lids), clock)), float(0))
    const body = max(skinAlpha, eyeMask)
    const alpha = max(body, tearMask)
    material.colorNode = mix(surface, colors.blood.add(colors.shine.mul(smoothstep(0.012, 0, x.sub(tearX).add(0.01).abs()).mul(0.2))), tearMask)
    material.opacityNode = alpha.mul(presence)
  }
}
