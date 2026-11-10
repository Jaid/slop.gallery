import type {GhostExpression} from '#src/lib/materials/ghost.ts'
import type {EscapingGhost} from './flights.ts'

import {attribute, cameraWorldMatrix, cos, cross, exp, float, fwidth, max, mix, mx_noise_float, positionGeometry, select, sin, smoothstep, time, uv, vec2, vec3, vec4} from 'three/tsl'
import {PlaneGeometry} from 'three/webgpu'

import {ghostBlink, ghostColors, ghostShape} from '#src/lib/materials/ghost.ts'
import {rgb} from '#src/lib/materials/orb/fill.ts'

import EffectSprites, {instanceAttribute} from '../lib/EffectSprites.ts'

/** seconds a ghost takes to swell to its size once it is out */
const swelling = 0.25
/** where the middle of a ghost’s head sits in its own units, which run from −1 to 1 across it */
const headHeight = 0.22
/** where its quad ends above the middle of its head, in its own units, with room for its halo */
const top = 1.7
/** how far its quad reaches above the middle of its head, in its own units */
const crown = top - headHeight
/** how far its halo reaches out from its outline at most, in its own units, well within its quad */
const haloReach = 0.8
/** how far a ghost’s skirt reaches below the middle of its head down to its hem, in its own units */
const skirt = headHeight + 0.7
/** how far the quad reaches to either side of the ghost’s middle line, in its own units, with room for its halo and its tail’s bend */
const breadth = 2
/** how far its outline blurs once it has faded away, in its own units */
const blur = 0.6
/** the shares of its flight between which its tail lets go of the origin and catches up with its head */
const letGo = [0.35, 0.9] as const

/**
 * Ghosts escaping their origin, the same pale ghosts under sheets that drift through the Spook Orb: each shoots out of the origin smeared like taffy, its head clean and wailing while its sheet stretches back into a tail that tapers and curls into the origin, until the tail lets go, the ghost snaps together, rises on and blurs away into wisps. Animated entirely on the GPU by the clock, each a quad from the tail’s tip to the top of its head, turned toward the camera around that line.
 */
export default class EscapingGhosts extends EffectSprites {
  constructor(ghosts: ReadonlyArray<EscapingGhost>) {
    const geometry = new PlaneGeometry(1, 1)
    instanceAttribute(geometry, 'ghostFlight', ghosts.map(({delay, life, rise, size}) => [delay, life, rise, size]))
    instanceAttribute(geometry, 'ghostPath', ghosts.map(({angle, curl, phase, reach}) => [angle, reach, phase, curl]))
    super('party-ghosts', geometry, ghosts.length)
    const {material} = this
    const {clock, normal, tangent} = this.uniforms
    const flight = attribute<'vec4'>('ghostFlight', 'vec4')
    const path = attribute<'vec4'>('ghostPath', 'vec4')
    const [delay, life, rise, size] = [flight.x, flight.y, flight.z, flight.w]
    const [angle, reach, phase, curl] = [path.x, path.y, path.z, path.w]
    // seconds since this ghost escaped
    const age = clock.sub(delay)
    const since = age.max(0)
    const progress = since.div(life).clamp(0, 1)
    const up = vec3(0, 1, 0)
    // The head shoots out toward the room, to its side and up, slows down at once and rises ever faster.
    const out = tangent.mul(cos(angle)).add(up.mul(sin(angle))).add(normal.mul(0.3)).normalize()
    const head = out.mul(reach.mul(float(1).sub(exp(since.mul(-4))))).add(up.mul(rise.mul(progress.pow(1.5))))
    // The tail stays in the origin at first, then lets go and catches up with the head.
    const anchor = head.mul(smoothstep(letGo[0], letGo[1], progress))
    const span = head.sub(anchor)
    const along = span.add(up.mul(0.01)).normalize()
    // It swells out of the origin, overshooting a little; half of its width in meters is one of its own units.
    const swell = since.div(swelling).clamp(0, 1).sub(1)
    const grown = swell.mul(swell).mul(swell).mul(2.7).add(swell.mul(swell).mul(1.7)).add(1)
    const unit = size.mul(grown.mul(0.6).add(0.4)).mul(0.5)
    // in its own units: how far the tail’s tip lies below the middle of its head, and the quad’s length in meters
    const tail = span.length().div(unit)
    const length = span.length().add(unit.mul(crown))
    const side = cross(cameraWorldMatrix.mul(vec4(0, 0, 1, 0)).xyz, along).normalize()
    const placed = anchor.add(along.mul(positionGeometry.y.add(0.5).mul(length))).add(side.mul(positionGeometry.x.mul(unit.mul(breadth * 2))))
    material.positionNode = select(age.greaterThan(0), placed, vec3(0, 0, 0))
    // Where on the ghost the fragment lies, in its own units, upright: `top` at the top of the quad, the tail’s tip at its bottom.
    const across = uv().x.sub(0.5).mul(breadth * 2)
    const height = float(top).sub(float(1).sub(uv().y).mul(length).div(unit))
    // How far down the stretched part it lies, from the middle of the head to the tail’s tip. A ghost not yet out of the origin is cut off by it instead.
    const down = float(headHeight).sub(height).div(max(tail, skirt)).clamp(0, 1)
    const stretched = tail.sub(skirt).div(2).clamp(0, 1)
    // Smeared out of the origin like taffy, the sheet keeps its width for a while, then pinches into the tail’s tip, bowing to its side with a wave running down it.
    const narrowing = float(1).sub(down.pow(2.2).mul(stretched).mul(0.9))
    const bow = curl.mul(sin(down.mul(Math.PI)))
    const wave = sin(down.mul(7).sub(time.mul(6)).add(phase)).mul(down).mul(0.15)
    const curling = bow.add(wave).mul(stretched)
    const point = vec2(across.sub(curling).div(narrowing), select(height.greaterThan(headHeight), height, float(headHeight).sub(down.mul(skirt))))
    // Startled as it bursts out, it settles into wailing.
    const expression: GhostExpression = {
      blink: ghostBlink(phase, 2.9),
      glance: vec2(0, 0),
      startle: exp(since.mul(-2.5)),
    }
    const {body, face} = ghostShape(point, phase, expression)
    // Out at once, it starts fading soon and is gone well before the end of its flight.
    const fading = smoothstep(0.85, 0.25, progress)
    const presence = select(age.greaterThan(0), smoothstep(0, 0.08, age).mul(fading.mul(fading)), float(0))
    // As it fades, it blurs away: its outline, its face and its glow soften and spread, and it breaks up into wisps.
    const gone = float(1).sub(fading)
    const blurred = (inside: typeof body) => inside.div(fwidth(inside).max(gone.mul(blur)).max(1e-5)).add(0.5).clamp()
    const dissolve = mx_noise_float(vec3(point.mul(2.5), time.mul(1.2).add(phase.mul(3)))).mul(0.5).add(0.5)
    const wisps = smoothstep(gone.mul(1.2).sub(0.35), gone.mul(1.2), dissolve)
    // The sheet thins out toward its hem, along the tail, and frays into the air.
    const fray = mx_noise_float(vec3(point.mul(vec2(3.5, 1.5)), time.mul(0.8).add(phase))).mul(0.5).add(0.5)
    const fade = point.y.add(0.85).div(0.6).clamp(0, 1).sub(fray.mul(mix(float(0.3), float(0.55), down))).clamp(0, 1)
    // The tail turns ever more see-through toward the origin.
    const cloth = blurred(body).mul(fade.pow(0.7)).mul(float(1).sub(down.mul(stretched).mul(0.45))).mul(wisps)
    const sheet = cloth.mul(presence)
    const hollow = blurred(face).mul(sheet)
    const shading = point.y.add(0.7).mul(0.7).clamp(0, 1)
    // A glow around the sheet that fades out within half its size, and shines through where the sheet frays. It dies out at a set distance from the outline, so it follows the ghost’s shape all the way out.
    const outside = body.negate().max(0)
    const halo = outside.mul(mix(float(-7), float(-3), gone)).exp().mul(smoothstep(haloReach, haloReach * 0.4, outside)).mul(float(1).sub(cloth)).mul(mix(float(1), wisps, 0.5)).mul(presence)
    // Everything fades out before the quad’s sides and top, or the bloom would show the halo cut off there, and toward the tail’s tip in the origin.
    const inside = smoothstep(breadth, breadth - 0.3, across.abs()).mul(smoothstep(top, top - 0.3, height)).mul(smoothstep(0, 0.35, height.sub(float(headHeight).sub(tail))))
    const glow = rgb(ghostColors.glow)
    const ghostAlpha = sheet.mul(0.62).add(hollow.mul(0.25))
    const ghostColor = mix(mix(glow, rgb(ghostColors.sheet), shading).mul(3.2), rgb(ghostColors.hole), hollow.div(ghostAlpha.max(0.001)).clamp(0, 1))
    // The halo behind the ghost.
    const haloAlpha = halo.mul(0.35).mul(float(1).sub(ghostAlpha))
    const alpha = ghostAlpha.add(haloAlpha)
    material.colorNode = ghostColor.mul(ghostAlpha).add(glow.mul(2.5).mul(haloAlpha)).div(alpha.max(0.0001))
    material.opacityNode = alpha.mul(inside)
  }
}
