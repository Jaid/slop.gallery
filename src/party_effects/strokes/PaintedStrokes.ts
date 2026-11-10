import type {BrushStroke} from './flights.ts'
import type {Node} from 'three/webgpu'

import {attribute, cameraPosition, cross, exp, float, max, mix, modelPosition, mx_noise_float, positionGeometry, select, sin, smoothstep, uv, varying, vec3} from 'three/tsl'
import {PlaneGeometry} from 'three/webgpu'

import {paintColor} from '#src/lib/materials/oilPaints.ts'
import {coverage} from '#src/orbs/lib/fill.ts'

import {partyPoint} from '../lib/billboards.ts'
import EffectSprites, {instanceAttribute} from '../lib/EffectSprites.ts'
import {strokeDrift, strokeDrying} from './flights.ts'

type Float = Node<'float'>

/** how many segments a stroke’s ribbon bends through along its length */
const segments = 48
/** how far a stroke’s quad reaches to either side of its middle line, in its half widths, with room for its ragged edges and their antialiasing */
const margin = 1.3
/** how far its quad reaches beyond where the brush set down and lifted off, in its widths, with room for the round ends */
const caps = 0.6
/** how many grooves the bristles drag into the paint across a stroke, about */
const grooves = 11
/** how thick the paint lies at its thickest, in meters, which sets how steeply its ridges and grooves catch the light */
const impasto = 0.014
/** where the light falls onto the strokes from, as an offset from the origin: steeply from above, a little out of the room and from the left, raking over the paint */
const light = [-0.35, 1, 0.35] as const
/** how far apart the paint’s height is sampled to find which way its surface faces, in half widths across and in meters along */
const normalStep = [0.04, 0.004] as const

/**
 * Broad strokes of oil paint laid into the air around their origin, the Paint Orb’s flourish: unseen brushes set them down one after another, each a ribbon that grows along its curve from a blunt round start behind a wet bead of paint the bristles push ahead, pressed down where it sets out and tapering where the brush lifts off, its edges ragged where single bristles reach out or fall short, its paint dragged into grooves, thick and glossy where the brush was full and breaking up into dry streaks where it ran out. Lit like impasto from above, so every ridge and groove catches the light and glints wet, they turn on around the origin and drift out into the room, then dry away into bristle streaks from where they were set down to where the brush lifted off, dulling as they go.
 * Animated entirely on the GPU by the clock, each a ribbon turned toward the camera along its curve.
 */
export default class PaintedStrokes extends EffectSprites {
  constructor(strokes: ReadonlyArray<BrushStroke>) {
    const geometry = new PlaneGeometry(1, 1, 1, segments)
    instanceAttribute(geometry, 'strokeTimes', strokes.map(({delay, duration, phase, width}) => [delay, duration, phase, width]))
    instanceAttribute(geometry, 'strokePath', strokes.map(({angle, reach, sweep}) => [angle, sweep, ...reach]))
    instanceAttribute(geometry, 'strokeDepth', strokes.map(({out, paint, turn}) => [...out, turn, paint[0]]))
    instanceAttribute(geometry, 'strokeShape', strokes.map(({bend, paint}) => [paint[1], bend]))
    super('party-strokes', geometry, strokes.length)
    const {material} = this
    const {clock, normal, tangent} = this.uniforms
    const times = attribute<'vec4'>('strokeTimes', 'vec4')
    const path = attribute<'vec4'>('strokePath', 'vec4')
    const depth = attribute<'vec4'>('strokeDepth', 'vec4')
    const shape = attribute<'vec2'>('strokeShape', 'vec2')
    const [streak, bend] = [shape.x, shape.y]
    const [delay, duration, phase, width] = [times.x, times.y, times.z, times.w]
    const [angle, sweep, startReach, endReach] = [path.x, path.y, path.z, path.w]
    const [startOut, endOut, turn, paint] = [depth.x, depth.y, depth.z, depth.w]
    const age = clock.sub(delay)
    const since = age.max(0)
    // how much of the stroke the brush has laid so far, speeding up and slowing down again like a hand does
    const laid = smoothstep(0, duration, age)
    // As `strokePoint` lays it out.
    const swell = since.mul(strokeDrift.swell).add(1)
    const spin = sweep.sign().mul(turn).mul(since)
    const reachChange = endReach.sub(startReach).mul(swell)
    const outChange = endOut.sub(startOut)
    const length = vec3(sweep.mul(startReach.add(endReach).mul(0.5).mul(swell)), reachChange, outChange).length()
    // The brush is pressed down as it sets out, then eases off and tapers toward where it lifts off, its pressure wavering a little.
    const halfWidth = (share: Float) => width.mul(0.5).mul(mix(float(0.72), float(1), smoothstep(0, 0.22, share))).mul(mix(float(1), float(0.55), smoothstep(0.45, 1, share))).mul(sin(share.mul(7).add(phase.mul(30))).mul(0.05).add(1))
    // How far along its curve the vertex lies, in meters from where the brush set down, never farther ahead than the brush has come, so nothing of the ribbon lies ahead of it.
    const capped = width.mul(caps)
    const lengthwise = mix(capped.negate(), length.add(capped), positionGeometry.y.add(0.5)).min(laid.mul(length).add(capped))
    const share = lengthwise.div(length).clamp(0, 1)
    const around = angle.add(sweep.mul(share)).add(spin)
    const distance = mix(startReach, endReach, share).add(bend.mul(share.mul(Math.PI).sin())).mul(swell)
    const distanceChange = reachChange.add(bend.mul(Math.PI).mul(share.mul(Math.PI).cos()).mul(swell))
    const onCurve = partyPoint(tangent, normal, around.cos().mul(distance), around.sin().mul(distance), mix(startOut, endOut, share).add(since.mul(strokeDrift.out)))
    const along = partyPoint(tangent, normal, around.cos().mul(distanceChange).sub(around.sin().mul(distance).mul(sweep)), around.sin().mul(distanceChange).add(around.cos().mul(distance).mul(sweep)), outChange).normalize()
    // Past either end, the ribbon runs straight on.
    const point = onCurve.add(along.mul(lengthwise.sub(share.mul(length))))
    const side = cross(cameraPosition.sub(modelPosition.add(point)), along).normalize()
    const placed = point.add(side.mul(positionGeometry.x.mul(2 * margin).mul(halfWidth(share))))
    material.positionNode = select(age.greaterThan(0), placed, vec3(0, 0, 0))
    // Where on the stroke the fragment lies: in meters along it and in half widths across it, the edge at ±1.
    const meters = varying(lengthwise)
    const sideways = varying(side)
    const forward = varying(along)
    const at = meters.div(length).clamp(0, 1)
    const half = halfWidth(at)
    const across = uv().x.sub(0.5).mul(2 * margin)
    // The bristles drag grooves along the stroke, wandering a little, coarse and fine.
    const bristlesAt = (crosswise: Float, lengthways: Float) => mx_noise_float(vec3(crosswise.mul(grooves / 2), lengthways.mul(1.5), phase.mul(17))).mul(0.35).add(mx_noise_float(vec3(crosswise.mul(grooves * 1.3), lengthways.mul(4), phase.mul(31))).mul(0.2)).add(0.5).clamp(0.02, 1)
    // the wet bead of paint the brush pushes ahead while it moves, gone once it lifted off
    const pushing = float(1).sub(laid.pow(6))
    // How thick the paint lies: rounded across, pushed up into ridges along both edges by the brush, thinner the farther the brush came, grooved by its bristles and swollen into the bead at its head.
    const height = (crosswise: Float, lengthways: Float) => {
      const rounded = float(1).sub(crosswise.mul(crosswise)).max(0).sqrt().mul(0.7)
      const ridges = exp(crosswise.abs().sub(0.86).div(0.1).pow2().negate()).mul(0.45)
      const load = mix(float(1), float(0.4), lengthways.div(length).clamp(0, 1))
      const bead = exp(laid.mul(length).sub(lengthways).div(half.mul(0.7)).pow2().negate()).mul(0.7).mul(pushing)
      return rounded.add(ridges).mul(load).add(bristlesAt(crosswise, lengthways).sub(0.5).mul(0.6)).add(bead)
    }
    const surface = height(across, meters)
    const slopeAcross = height(across.add(normalStep[0]), meters).sub(surface).div(half.mul(normalStep[0]))
    const slopeAlong = height(across, meters.add(normalStep[1])).sub(surface).div(normalStep[1])
    // which way the paint faces, in the stroke’s own frame: across it, along it and toward the camera
    const facing = vec3(slopeAcross.mul(-impasto), slopeAlong.mul(-impasto), 1).normalize()
    const toLight = partyPoint(tangent, normal, light[0], light[1], light[2]).normalize()
    const lightLocal = vec3(toLight.dot(sideways), toLight.dot(forward), toLight.dot(cross(forward, sideways))).normalize()
    // Its outline: ragged along both edges, where single bristles reach out or fall short, blunt and round where the brush set down and at the head where it is or lifted off.
    const crown = float(1).sub(across.mul(across)).max(0)
    const bristles = bristlesAt(across, meters)
    const ragged = mx_noise_float(vec3(meters.mul(9), across.sign().mul(3), phase.mul(13))).mul(0.08)
    const edges = ragged.add(1).sub(across.abs()).mul(half)
    const start = meters.add(half.mul(0.55).mul(crown))
    const head = laid.mul(length).sub(meters).add(half.mul(0.35).mul(crown))
    const inside = edges.min(start).min(head)
    // The brush runs dry toward the stroke’s end and along its edges, leaving bristle streaks; at last the whole stroke dries away into them, from where the brush set down on.
    const dryAt = phase.mul(strokeDrying.stagger).add(strokeDrying.start)
    const drying = clock.sub(dryAt).div(strokeDrying.seconds).mul(1.6).sub(at.mul(0.6)).clamp(0, 1)
    const fringe = smoothstep(0.7, 1.05, across.abs()).mul(0.55)
    const dry = smoothstep(0.55, 1, at).mul(0.7).add(fringe).add(drying.mul(1.25)).sub(0.12)
    const streaks = smoothstep(dry.sub(0.06), dry.add(0.06), bristles)
    // Some brushes were dipped into a second paint on one side, which streaks the stroke along its bristles there without mixing in; the paint’s tone wavers along the stroke.
    const dipped = smoothstep(-0.2, 0.5, across.add(mx_noise_float(vec3(meters.mul(2.5), phase.mul(7), 0)).mul(0.35)))
    const second = smoothstep(0.42, 0.52, bristlesAt(across.mul(0.8).add(3.1), meters.mul(0.7))).mul(dipped)
    const tone = mx_noise_float(vec3(meters.mul(1.8), across.mul(0.8), phase.mul(23))).mul(0.12).add(1)
    const color = mix(paintColor(paint), paintColor(streak), second).mul(tone)
    // Raking light from above like on impasto, so every ridge and groove shows, glossy and glinting while wet, dulling as it dries.
    const wet = float(1).sub(drying)
    const lit = max(facing.dot(lightLocal), 0).mul(0.9).add(0.3)
    const halfway = lightLocal.add(vec3(0, 0, 1)).normalize()
    const gloss = max(facing.dot(halfway), 0).pow(60).mul(0.5).add(max(facing.dot(halfway), 0).pow(10).mul(0.05)).mul(wet)
    material.colorNode = color.mul(lit).mul(wet.mul(0.15).add(0.85)).add(vec3(gloss))
    const gone = clock.greaterThan(dryAt.add(strokeDrying.seconds).add(0.1))
    material.opacityNode = select(age.greaterThan(0).and(gone.not()), coverage(inside).mul(streaks), float(0))
  }
}
