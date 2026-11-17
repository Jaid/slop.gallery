import type {KnifeSmear} from './flights.ts'
import type {Node} from 'three/webgpu'

import {attribute, cameraPosition, cross, exp, float, max, mix, modelPosition, mx_cell_noise_float, mx_noise_float, positionGeometry, select, smoothstep, uv, varying, vec2, vec3} from 'three/tsl'
import {PlaneGeometry} from 'three/webgpu'

import {impastoColor} from '#src/lib/materials/impastoPaints.ts'
import {coverage} from '#src/orbs/lib/fill.ts'

import {partyPoint} from '../lib/billboards.ts'
import EffectSprites, {instanceAttribute} from '../lib/EffectSprites.ts'
import {smearCrumbling, smearDrift, smearFall, smearQuad, smearSlap, smearSpreading} from './flights.ts'

type Float = Node<'float'>

const {caps, margin} = smearQuad
/** how many segments a smear’s quad bends through along its length, with its bow */
const segments = 8
/** how thick the paint lies at its thickest, in meters, which sets how steeply its heaps and ridges catch the light */
const impasto = 0.02
/** where the light falls onto the smears from, as an offset from the origin: steeply from above, a little out of the room and from the left, raking over the paint */
const light = [-0.4, 1, 0.4] as const
/** how far apart the paint’s height is sampled to find which way its surface faces, in half widths across and in meters along */
const normalStep = [0.035, 0.003] as const
/** how large the flakes are that the set paint crumbles into, about, in meters */
const flakeSize = 0.05
/** how far out from its middle a whole flake reaches, in flake sizes, farther than any point of its cell lies from it */
const flakeReach = 1.5

/**
 * Thick smears of heavy paint slapped into the air around their origin, the Impasto Orb’s burst: an unseen palette knife sets them down one after another, each a flat swathe the width of its blade dragged out away from the origin, thin and broken where the knife set down, its sides crisp but for the paint squeezed out from under the blade, planed smooth and scored by the blade’s edge, rippled where it chattered, and heaped into a ragged lip ahead of it where it lifted off; some carry a second paint folded through them unmixed. Lit like impasto from above, glossy while wet, they squash as they are slapped down and spring back, drift out into the room as the burst turns, then set, crack and crumble away flake by flake.
 * Animated entirely on the GPU by the clock, each a straight swathe turned toward the camera along its length.
 */
export default class SlappedSmears extends EffectSprites {
  constructor(smears: ReadonlyArray<KnifeSmear>) {
    const geometry = new PlaneGeometry(1, 1, 1, segments)
    instanceAttribute(geometry, 'smearTimes', smears.map(({delay, duration, phase, width}) => [delay, duration, phase, width]))
    instanceAttribute(geometry, 'smearPath', smears.map(({angle, reach, slant}) => [angle, slant, ...reach]))
    instanceAttribute(geometry, 'smearLook', smears.map(({crumble, out, paint}) => [out, ...paint, crumble]))
    instanceAttribute(geometry, 'smearBend', smears.map(({bend}) => [bend]))
    super('party-smears', geometry, smears.length)
    const {material} = this
    const {clock, normal, tangent} = this.uniforms
    const times = attribute<'vec4'>('smearTimes', 'vec4')
    const path = attribute<'vec4'>('smearPath', 'vec4')
    const look = attribute<'vec4'>('smearLook', 'vec4')
    const [delay, duration, phase, width] = [times.x, times.y, times.z, times.w]
    const [angle, slant, startReach, endReach] = [path.x, path.y, path.z, path.w]
    const [out, paint, folded, crumble] = [look.x, look.y, look.z, look.w]
    const bend = attribute<'float'>('smearBend', 'float')
    const age = clock.sub(delay)
    const since = age.max(0)
    // how much of the smear the knife has dragged out so far, quick off the mark and easing as it lifts
    const laid = smoothstep(0, duration, age).sqrt()
    // As `smearPoint` lays it out.
    const swell = since.mul(smearDrift.swell).add(1)
    const around = angle.add(since.mul(smearDrift.spin))
    const heading = around.add(slant)
    const length = endReach.sub(startReach).mul(swell)
    const slide = float(1).sub(exp(since.div(-smearDrift.sliding))).mul(smearDrift.slide)
    const falling = clock.sub(crumble).max(0)
    const startDistance = startReach.mul(swell).add(slide)
    const start = partyPoint(tangent, normal, around.cos().mul(startDistance), around.sin().mul(startDistance).sub(falling.mul(falling).mul(smearFall / 2)), out.add(since.mul(smearDrift.out)))
    const along = partyPoint(tangent, normal, heading.cos(), heading.sin(), 0)
    const aside = partyPoint(tangent, normal, heading.sin().negate(), heading.cos(), 0)
    // Slapped down, the paint spreads wider than the blade and springs back; toward where the knife lifted off, it spreads a little more.
    const slap = exp(since.div(-smearSlap.seconds)).mul(smearSlap.overshoot).add(1)
    const halfWidth = (share: Float) => width.mul(0.5).mul(slap).mul(mix(float(smearSpreading[0]), float(smearSpreading[1]), share))
    // How far along the vertex lies, in meters from where the knife set down, never farther ahead than the knife has come.
    const capped = width.mul(caps)
    const lengthwise = mix(capped.negate(), length.add(capped), positionGeometry.y.add(0.5)).min(laid.mul(length).add(capped))
    // As `smearBow` bows it, the way along it turning with the bow; past either end, it runs on straight.
    const share = lengthwise.div(length).clamp(0, 1)
    const within = lengthwise.greaterThan(0).and(lengthwise.lessThan(length))
    const point = start.add(along.mul(lengthwise)).add(aside.mul(bend.mul(4).mul(share).mul(share.oneMinus()).mul(swell)))
    const direction = along.add(aside.mul(select(within, bend.mul(4).mul(share.mul(-2).add(1)).mul(swell).div(length), float(0)))).normalize()
    const side = cross(cameraPosition.sub(modelPosition.add(point)), direction).normalize()
    const placed = point.add(side.mul(positionGeometry.x.mul(2 * margin).mul(halfWidth(share))))
    material.positionNode = select(age.greaterThan(0), placed, vec3(0, 0, 0))
    // Where on the smear the fragment lies: in meters along it and in half widths across it, the edge at ±1.
    const meters = varying(lengthwise)
    const sideways = varying(side)
    const forward = varying(direction)
    const at = meters.div(length).clamp(0, 1)
    const half = halfWidth(at)
    const across = uv().x.sub(0.5).mul(2 * margin)
    const head = laid.mul(length)
    // The blade’s edge scores fine lines along the way it was drawn, and it chattered over the paint in ripples across it.
    const scoringAt = (crosswise: Float, lengthways: Float) => mx_noise_float(vec3(crosswise.mul(9), lengthways.mul(0.8), phase.mul(17))).mul(0.6).add(mx_noise_float(vec3(crosswise.mul(26), lengthways.mul(2), phase.mul(29))).mul(0.4))
    const chatterAt = (crosswise: Float, lengthways: Float) => lengthways.mul(Math.PI * 2 / 0.024).add(mx_noise_float(vec3(crosswise.mul(1.5), lengthways.mul(6), phase.mul(11))).mul(2)).sin().mul(smoothstep(0.15, 0.6, lengthways.div(length)))
    // the heap of paint the blade pushes ahead while it moves, which stays as a lip where it lifted off
    const ragged = mx_noise_float(vec3(across.mul(3.5), phase.mul(13), 0.5)).mul(0.25)
    // How thick the paint lies: planed flat by the blade and thinner where it set down, where it scraped the paint off, squeezed up into ridges along both sides, scored, rippled and heaped into the lip ahead of it.
    const height = (crosswise: Float, lengthways: Float) => {
      const plane = smoothstep(1.02, 0.82, crosswise.abs())
      const load = mix(float(0.3), float(1), smoothstep(0, 0.55, lengthways.div(length).clamp(0, 1)))
      const ridges = exp(crosswise.abs().sub(0.95).div(0.08).pow2().negate()).mul(0.55)
      const lip = exp(head.sub(lengthways).div(half.mul(0.45)).sub(0.4).add(ragged).pow2().negate()).mul(1.1).mul(smoothstep(1.05, 0.55, crosswise.abs()))
      return plane.mul(load).add(ridges).add(lip).add(scoringAt(crosswise, lengthways).mul(0.09)).add(chatterAt(crosswise, lengthways).mul(0.022))
    }
    const surface = height(across, meters)
    const slopeAcross = height(across.add(normalStep[0]), meters).sub(surface).div(half.mul(normalStep[0]))
    const slopeAlong = height(across, meters.add(normalStep[1])).sub(surface).div(normalStep[1])
    // which way the paint faces, in the smear’s own frame: across it, along it and toward the camera
    const facing = vec3(slopeAcross.mul(-impasto), slopeAlong.mul(-impasto), 1).normalize()
    const toLight = partyPoint(tangent, normal, light[0], light[1], light[2]).normalize()
    const lightLocal = vec3(toLight.dot(sideways), toLight.dot(forward), toLight.dot(cross(forward, sideways))).normalize()
    // Its outline: crisp along the blade’s sides but for the paint squeezed out from under them, cut straight where the knife set down and ragged and round along the lip ahead of it.
    const squeezed = mx_noise_float(vec3(meters.mul(11), across.sign().mul(3), phase.mul(7))).max(0).mul(0.12)
    const crown = float(1).sub(across.mul(across)).max(0)
    const sides = float(1).add(squeezed).sub(across.abs()).mul(half)
    const setDown = meters.add(half.mul(0.08).mul(crown)).add(mx_noise_float(vec3(across.mul(4), phase.mul(5), 1.5)).mul(half.mul(0.06)))
    const front = head.sub(meters).add(half.mul(0.4).mul(crown.sqrt())).add(ragged.mul(half).mul(0.5))
    const inside = sides.min(setDown).min(front)
    // Where the knife set down, it scraped the paint off thin, so it breaks up into scored streaks there.
    const scraped = smoothstep(0.32, 0, at)
    const broken = smoothstep(scraped.mul(0.9).sub(0.15), scraped.mul(0.9).sub(0.05), scoringAt(across, meters).mul(0.5).add(0.5))
    // The paint folded through the knife’s load streaks along the way it was drawn without mixing in, and its tone wavers.
    const fold = smoothstep(-0.08, 0.08, mx_noise_float(vec3(meters.mul(4), across.mul(1.4), phase.mul(19))).add(across.mul(0.35)).sub(0.1))
    const tone = mx_noise_float(vec3(meters.mul(5), across.mul(1.1), phase.mul(23))).mul(0.1).add(1)
    const color = mix(impastoColor(paint), impastoColor(folded), fold).mul(tone)
    // Set at last, the paint cracks into flakes, which open apart and drop out one after another, each at a moment of its own.
    const crumbling = clock.sub(crumble).div(smearCrumbling.seconds).clamp(0, 1)
    const flat = vec2(across.mul(half), meters).div(flakeSize)
    const base = flat.floor()
    let nearest: Float = float(9)
    let second: Float = float(9)
    let flake: Node<'vec2'> = vec2(0)
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        const cell = base.add(vec2(dx, dy))
        const center = cell.add(vec2(mx_cell_noise_float(vec3(cell, phase.mul(41))), mx_cell_noise_float(vec3(cell, phase.mul(41).add(1)))).mul(0.8).add(0.1))
        const distance = flat.sub(center).length()
        const closer = distance.lessThan(nearest)
        second = select(closer, nearest, second.min(distance))
        flake = select(closer, cell, flake)
        nearest = nearest.min(distance)
      }
    }
    const seam = second.sub(nearest).mul(flakeSize * 0.5)
    const crack = smoothstep(0, 0.4, crumbling).mul(0.0022)
    // Before it cracks, the seams between the flakes-to-be don’t show at all.
    const cracked = mix(float(1), coverage(seam.sub(crack)), smoothstep(0, 0.15, crumbling))
    const drops = mx_cell_noise_float(vec3(flake, phase.mul(41).add(2))).mul(0.6).add(0.35)
    // A flake breaking away curls up off the paint beneath it, darkening, and shrinks into its middle until it is gone; whole, it reaches past every point of its cell.
    const curling = smoothstep(drops.sub(0.3), drops, crumbling)
    const kept = coverage(float(flakeReach).mul(curling.oneMinus()).sub(nearest).mul(flakeSize))
    // Raking light from above like on impasto, so every heap, ridge and score shows, glossy and glinting while wet, dulling as it sets.
    const wet = float(1).sub(smoothstep(-0.5, 0.2, clock.sub(crumble).div(smearCrumbling.seconds)))
    const lit = max(facing.dot(lightLocal), 0).mul(0.9).add(0.28)
    const halfway = lightLocal.add(vec3(0, 0, 1)).normalize()
    const sheen = max(facing.dot(halfway), 0)
    const gloss = sheen.pow(50).mul(0.6).add(sheen.pow(9).mul(0.07)).mul(wet)
    material.colorNode = color.mul(lit).mul(wet.mul(0.12).add(0.88)).mul(curling.mul(-0.35).add(1)).add(vec3(gloss))
    const gone = clock.greaterThan(crumble.add(smearCrumbling.seconds + 0.1))
    material.opacityNode = select(age.greaterThan(0).and(gone.not()), coverage(inside).mul(broken).mul(cracked).mul(kept), float(0))
  }
}
