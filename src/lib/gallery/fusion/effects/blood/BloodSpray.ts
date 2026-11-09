import type {BloodDrop} from './flights.ts'
import type {Node} from 'three/webgpu'

import {atan, attribute, cameraPosition, cross, exp, float, max, mix, modelPosition, mx_noise_float, positionGeometry, positionWorld, select, sin, smoothstep, uv, vec2, vec3} from 'three/tsl'
import {PlaneGeometry} from 'three/webgpu'

import {coverage, rgb} from '#src/lib/materials/orb/fill.ts'

import {portalPoint} from '../base/billboards.ts'
import EffectSprites, {instanceAttribute} from '../base/EffectSprites.ts'
import {dropMargin, floorPoint, streakQuad, teardrop, up} from './drops.ts'
import {bloodBeats, bloodFading, bloodKinds, bloodPool, bloodPour, clotting, gravity, landingSteps, pourTotal, shutter, splatLift} from './flights.ts'

/** how far a stain’s quad reaches from where the drop struck, in the stain’s half widths: behind it and to its sides, beyond its elongation, and ahead of it, with room for its tail and its satellites */
const stainQuad = {
  behind: 0.7,
  ahead: 2.6,
  side: 1.8,
} as const
/** how many satellite droplets a stain can fling ahead of it at most */
const satellites = 5
/** how many scallops and spines ring a stain */
const scallops = 15
/** how big a speck of the mist looks, in meters, however fine it is */
const mistSize = 0.014
const colors = {
  core: rgb('#5e0510'),
  body: rgb('#860a16'),
  thin: rgb('#ae121e'),
  highlight: rgb('#fff1ee'),
  mist: rgb('#7a0814'),
  dried: rgb('#4e1610'),
  driedRing: rgb('#2e0906'),
  /** what the wet blood mirrors at grazing angles: the dim room */
  sheen: rgb('#241c20'),
}
/** where the light glinting on the blood hangs, from the portal’s middle: up, like a lamp, and a little toward the room */
const lamp = [0, 1.1, 0.6] as const

/**
 * Arterial blood out of a fusion’s portal, as it behaves: the jets leave as stretched threads that snap into drops, which wobble and slow down in the air the finer they are, smeared by the camera’s shutter and lit like little glossy beads; the mist hangs a moment and settles away. Every drop leaves a stain by the angle it struck at, round from above, stretched with a tail and satellites from the side, ringed with spines the faster it came, glossy and red while fresh, then drying dark and dull from its edges with a darker ring, until the stains fade. Out of the portal’s bottom a stream pours straight down, surging on the first two beats and running dry before the result comes back down through it, thinning and beading up as it falls, into a pool on the floor under it, which swells by the blood the stream brought down, glossy and wet and rippling where the stream strikes it, until it is sucked back into its middle. Animated entirely on the GPU by the clock.
 */
export default class BloodSpray extends EffectSprites {
  constructor(drops: ReadonlyArray<BloodDrop>) {
    const geometry = new PlaneGeometry(1, 1)
    instanceAttribute(geometry, 'bloodTimes', drops.map(({delay, hang, phase, size}) => [delay, hang, size, phase]))
    instanceAttribute(geometry, 'bloodStart', drops.map(({kind, start}) => [...start, bloodKinds[kind]]))
    instanceAttribute(geometry, 'bloodVelocity', drops.map(({velocity}) => velocity))
    super('fusion-blood', geometry, drops.length)
    const {material} = this
    const {clock, floor, normal, tangent} = this.uniforms
    const times = attribute<'vec4'>('bloodTimes', 'vec4')
    const placement = attribute<'vec4'>('bloodStart', 'vec4')
    const velocity = attribute<'vec3'>('bloodVelocity', 'vec3')
    const [delay, hang, size, phase] = [times.x, times.y, times.z, times.w]
    const start = placement.xyz
    const isMist = placement.w.greaterThan(0.5).and(placement.w.lessThan(1.5))
    const isPool = placement.w.greaterThan(1.5).and(placement.w.lessThan(2.5))
    const isPour = placement.w.greaterThan(2.5)
    const age = clock.sub(delay)
    const since = age.max(0)
    const shown = clock.greaterThan(delay.sub(hang))
    // A drip swells hanging from the portal before it drops.
    const swelling = select(hang.greaterThan(0), smoothstep(hang.negate(), 0, age).mul(0.7).add(0.3), float(1))
    const radius = select(isMist, float(mistSize / 2), size.mul(0.5).mul(swelling))
    // The air slows it down toward the speed it falls at in the end, which `bloodLanding` solves for the same way.
    const terminal = size.mul(1300).clamp(0.7, 9)
    const drag = float(gravity).div(terminal)
    const rise = (seconds: typeof since) => {
      const decay = exp(drag.negate().mul(seconds))
      return {
        decay,
        height: start.y.add(velocity.y.add(terminal).mul(float(1).sub(decay)).div(drag)).sub(terminal.mul(seconds)),
        speed: velocity.y.add(terminal).mul(decay).sub(terminal),
      }
    }
    const target = floor.add(splatLift)
    const fall = start.y.sub(target).max(0)
    let landing = velocity.y.add(velocity.y.mul(velocity.y).add(fall.mul(2 * gravity)).sqrt()).div(gravity)
    for (let step = 0; step < landingSteps; step++) {
      const {height, speed} = rise(landing)
      landing = landing.sub(height.sub(target).div(speed.min(-0.01))).max(0)
    }
    const at = (seconds: typeof since) => {
      const {decay, height} = rise(seconds)
      const travel = float(1).sub(decay).div(drag)
      return portalPoint(tangent, normal, start.x.add(velocity.x.mul(travel)), height, start.z.add(velocity.z.mul(travel)))
    }
    const heading = (seconds: typeof since) => {
      const {decay, speed} = rise(seconds)
      return portalPoint(tangent, normal, velocity.x.mul(decay), speed, velocity.z.mul(decay))
    }
    const flying = since.lessThan(landing)
    // In flight: a bead smeared along its motion by the shutter, trailing the thread it tore off the jet with at first, and wobbling as it settles into a sphere.
    const head = at(since)
    const motion = heading(since)
    const along = motion.add(vec3(0, -0.001, 0)).normalize()
    const thread = select(isMist, float(0), smoothstep(0.09, 0, since).mul(0.07))
    const wobble = exp(since.mul(-9)).mul(sin(since.mul(Math.PI * 2 * 15).add(phase.mul(6)))).mul(0.3).mul(smoothstep(0.004, 0.012, size))
    const lengthwise = radius.mul(wobble.add(1))
    const blur = select(isMist, float(0), motion.length().mul(shutter))
    const length = lengthwise.mul(2).add(blur).add(thread)
    const width = radius.div(wobble.mul(0.6).add(1)).mul(dropMargin)
    const {corner: streak, side} = streakQuad(head, along, length, lengthwise, width)
    // On the floor: a stain stretched by how flat it struck, ahead along its flight.
    const ground = at(landing)
    const impact = heading(landing)
    const steepness = impact.y.abs().div(impact.length().max(0.0001))
    const elongation = float(1).div(steepness.max(0.28))
    const speed = impact.length()
    const ahead = portalPoint(tangent, normal, velocity.x, 0, velocity.z)
    const forward = select(ahead.length().greaterThan(0.001), ahead.normalize(), normal)
    const across = up.cross(forward)
    const settling = float(1).sub(exp(since.sub(landing).max(0).mul(-50))).mul(0.8).add(0.2)
    const halfWidth = size.mul(speed.mul(0.45).add(2.2)).mul(0.5).mul(settling)
    const reach = vec2(elongation.add(stainQuad.behind).negate(), elongation.add(stainQuad.ahead))
    const stainX = mix(reach.x, reach.y, positionGeometry.x.add(0.5))
    const stain = ground.add(forward.mul(stainX.mul(halfWidth))).add(across.mul(positionGeometry.y.mul(stainQuad.side * 2).mul(halfWidth)))
    // The mist never lands, it settles away.
    const settled = isMist.and(flying.not())
    // The flying bead: shaded as a little sphere lit from above, darker toward its rim, with a sharp highlight, and its smear spread thinner.
    const {inside: beadInside, point, tip} = teardrop(lengthwise, length, width, mix(float(0.35), float(0.12), thread.div(0.07)))
    const bead = vec2(point.x, point.y.sub(tip)).div(radius.max(0.00001))
    const facing = float(1).sub(bead.dot(bead)).max(0).sqrt()
    const light = vec3(up.dot(side), up.dot(along), 0.7).normalize()
    const shading = vec3(bead, facing).dot(light).max(0)
    const halfway = light.add(vec3(0, 0, 1)).normalize()
    const highlight = vec3(bead, facing).dot(halfway).max(0).pow(48).mul(smoothstep(0.2, 0.6, facing))
    const smeared = lengthwise.mul(2).div(length).clamp(0.3, 1)
    const beadColor = mix(colors.thin, mix(colors.core, colors.body, shading), smoothstep(0, 0.5, facing)).add(colors.highlight.mul(highlight).mul(0.9))
    const mistInside = float(1).sub(vec2(point.x, point.y.sub(tip)).length().div(radius)).max(0).pow2()
    const mistFade = smoothstep(0, 0.05, since).mul(smoothstep(landing, landing.mul(0.6), since))
    // The stain, in its half widths from where it struck: an ellipse stretched by the angle it struck at, scalloped and spined around its rim, ahead the more the faster it came, with a tail and satellites flung ahead of it from the side.
    const flatX = mix(reach.x, reach.y, uv().x)
    const flatY = uv().y.sub(0.5).mul(stainQuad.side * 2)
    const squeezed = vec2(flatX.div(elongation), flatY)
    const rimAngle = atan(squeezed.y, squeezed.x)
    const front = rimAngle.cos().max(0)
    const violence = smoothstep(1.5, 5, speed)
    const rimNoise = (frequency: number, salt: number) => mx_noise_float(vec3(rimAngle.cos().mul(frequency), rimAngle.sin().mul(frequency), phase.mul(salt)))
    const spineLength = rimNoise(6, 43).mul(0.5).add(0.5)
    const spines = sin(rimAngle.mul(scallops / 2).add(phase.mul(20)).add(rimNoise(3, 7).mul(2))).abs().pow(12).mul(spineLength.pow2()).mul(violence.mul(0.7).add(0.1)).mul(front.mul(0.8).add(0.2))
    const ragged = rimNoise(2.5, 31).mul(0.06)
    const mainInside = spines.add(ragged).add(1).sub(squeezed.length())
    const oblique = smoothstep(1.25, 1.9, elongation)
    const tailEnd = elongation.mul(1.9).sub(0.5)
    const tailAlong = flatX.clamp(elongation.mul(0.6), tailEnd)
    const tailInside = mix(float(0.32), float(0.06), tailAlong.sub(elongation.mul(0.6)).div(tailEnd.sub(elongation.mul(0.6)).max(0.001))).sub(vec2(flatX.sub(tailAlong), flatY).length()).mul(oblique).sub(float(1).sub(oblique).mul(0.5))
    let stainInside = mainInside.max(tailInside)
    for (let satellite = 0; satellite < satellites; satellite++) {
      const random = (salt: number) => sin(phase.mul(97.3 + satellite * 13.1).add(salt)).mul(43_758.545).fract()
      const spot = vec2(elongation.add(random(1.3).mul(1.6).add(0.5)), random(2.9).sub(0.5).mul(oblique.mul(-0.6).add(1.4)))
      const dropRadius = random(4.1).mul(0.12).add(0.06)
      const flung = random(5.7).lessThan(violence.mul(0.8).add(oblique.mul(0.4)))
      stainInside = stainInside.max(select(flung, dropRadius.sub(vec2(flatX, flatY).sub(spot).length()), float(-1)))
    }
    // Thick and dark in the middle, thin and red at the rim; drying dark and dull from the rim inward, with a darker ring where it dries first.
    const thickness = smoothstep(0, 0.6, stainInside)
    const freshColor = mix(colors.thin, mix(colors.body, colors.core, smoothstep(0.5, 1.3, stainInside)), smoothstep(0, 0.2, stainInside))
    const dryness = smoothstep(clotting.start, clotting.start + clotting.seconds, clock.sub(phase.mul(0.4)))
    const dried = dryness.mul(1.6).sub(thickness.mul(0.6)).clamp(0, 1)
    const ring = smoothstep(0.18, 0.02, stainInside)
    const driedColor = mix(colors.dried, colors.driedRing, ring)
    // Its wet surface bulges up at the rim, mirrors the room at grazing angles and glints where the lamp above the portal reflects in it.
    const outward = forward.mul(flatX.div(elongation)).add(across.mul(flatY)).normalize()
    const surface = up.add(outward.mul(smoothstep(0.2, 0, stainInside).mul(0.35))).normalize()
    const toCamera = cameraPosition.sub(positionWorld).normalize()
    const toLamp = modelPosition.add(portalPoint(tangent, normal, lamp[0], lamp[1], lamp[2])).sub(positionWorld).normalize()
    const glint = max(surface.dot(toLamp.add(toCamera).normalize()), 0).pow(320).mul(0.3).mul(smoothstep(0.1, 0.35, stainInside))
    const fresnel = float(1).sub(max(surface.dot(toCamera), 0)).pow(5).mul(0.96).add(0.04)
    const wet = float(1).sub(dried)
    const stainColor = mix(freshColor, driedColor, dried).add(colors.sheen.mul(fresnel).mul(wet).mul(0.6)).add(colors.highlight.mul(glint).mul(wet))
    // The pour, in meters down from where it leaves the portal, as `pourFall` has it fall: its blood leaves the portal as thick as it flows out then, surging on its beats, and thins and beads up the faster it falls.
    const {drying, flowing: [pourFrom, pourTo], speed: pourSpeed, start: pourStart, surge, trickle, width: pourWidth} = bloodPour
    const fallen = (seconds: Node<'float'>) => {
      const falling = seconds.max(0)
      return falling.mul(pourSpeed).add(falling.pow2().mul(gravity / 2))
    }
    const fallTime = (distance: Node<'float'>) => distance.max(0).mul(2 * gravity).add(pourSpeed ** 2).sqrt().sub(pourSpeed).div(gravity)
    const pourFlow = (left: Node<'float'>) => {
      const surges = bloodBeats.reduce<Node<'float'>>((sum, {at: beat, strength}) => {
        const surging = left.sub(beat + pourFrom).max(0)
        return sum.add(float(1).sub(exp(surging.mul(-surge.swell))).mul(exp(surging.mul(-surge.ebb))).mul(strength))
      }, float(trickle))
      return surges.mul(smoothstep(pourFrom, pourFrom + 0.04, left)).mul(smoothstep(pourTo, pourTo - drying, left))
    }
    const pourDepth = float(pourStart[1]).sub(target)
    const pourLanding = fallTime(pourDepth)
    // A ribbon from its tail to its head, turned toward the camera around the vertical: the tail stays at the portal until the pour stops, then falls after the rest.
    const pourHead = fallen(clock.sub(pourFrom)).min(pourDepth)
    const pourTail = fallen(clock.sub(pourTo)).min(pourDepth)
    const pourSide = cross(cameraPosition.sub(modelPosition.add(portalPoint(tangent, normal, pourStart[0], pourStart[1], pourStart[2]))), up).normalize()
    const pourFront = up.cross(pourSide)
    const pourReach = pourWidth / 2 * Math.sqrt(1.1) * 1.45 * dropMargin + 0.005
    const pourQuad = portalPoint(tangent, normal, pourStart[0], float(pourStart[1]).sub(mix(pourHead, pourTail, positionGeometry.y.add(0.5))), pourStart[2]).add(pourSide.mul(positionGeometry.x.mul(pourReach * 2)))
    // Every height shows the blood that left the portal as long ago as it takes to fall there: thinner the faster it falls by now, beading up the further it fell and wandering a little, splaying out where it strikes the floor.
    const pourDown = mix(pourHead, pourTail, uv().y)
    const pourLeft = clock.sub(fallTime(pourDown))
    const thinning = float(pourSpeed).div(pourDown.mul(2 * gravity).add(pourSpeed ** 2).sqrt()).pow(0.3)
    const beading = sin(pourLeft.mul(Math.PI * 2 * 40).add(sin(pourLeft.mul(Math.PI * 2 * 7)).mul(2)).add(phase.mul(6))).mul(smoothstep(0.1, 1.2, pourDown).mul(0.45)).add(1)
    const splaying = smoothstep(0.04, 0, pourDepth.sub(pourDown)).mul(1.2).add(1)
    const pourHalfWidth = pourFlow(pourLeft).sqrt().mul(pourWidth / 2).mul(thinning).mul(beading).mul(splaying)
    const wander = sin(pourLeft.mul(Math.PI * 2 * 3.1).add(phase.mul(11))).mul(0.6).add(sin(pourLeft.mul(Math.PI * 2 * 5.3).add(phase.mul(5))).mul(0.4)).mul(smoothstep(0, 1, pourDown).mul(0.004))
    const pourAcross = uv().x.sub(0.5).mul(pourReach * 2).sub(wander)
    const pourInside = pourHalfWidth.sub(pourAcross.abs()).sub(0.0003)
    // Shaded as a glossy cylinder of blood: deep in its middle, thin and red at its sides, with a streak of the lamp running down it.
    const pourRim = pourAcross.div(pourHalfWidth.max(0.00001)).clamp(-1, 1)
    const pourFacing = float(1).sub(pourRim.pow2()).max(0).sqrt()
    const pourSurface = pourSide.mul(pourRim).add(pourFront.mul(pourFacing))
    const pourShading = pourSurface.dot(toLamp).mul(0.5).add(0.5)
    const pourGlint = max(pourSurface.dot(toLamp.add(toCamera).normalize()), 0).pow(60)
    const pourColor = mix(colors.thin, mix(colors.core, colors.body, pourShading), smoothstep(0, 0.5, pourFacing)).add(colors.sheen.mul(float(1).sub(pourFacing).pow(3)).mul(0.6)).add(colors.highlight.mul(pourGlint).mul(0.8))
    // The pool, in meters from its middle along the wall and out into the room, on a quad flat on the floor a little under the stains. It spreads by the area of the blood the pour brought down so far and creeps on a little as it settles.
    const {center, creep, draining, radius: poolRadius} = bloodPool
    const poolReach = poolRadius * (1 + creep.share) * 1.3
    const poolMiddle = floorPoint(tangent, normal, floor, center[0], center[1], splatLift / 2)
    const poolQuad = poolMiddle.add(tangent.mul(positionGeometry.x.mul(poolReach * 2))).add(normal.mul(positionGeometry.y.mul(poolReach * 2)))
    // As `pourVolume` has it, by the blood that left the portal as long ago as it takes to come down.
    const landed = clock.sub(pourLanding).clamp(pourFrom, pourTo)
    const volume = bloodBeats.reduce<Node<'float'>>((sum, {at: beat, strength}) => {
      const surging = landed.sub(beat + pourFrom).max(0)
      const surged = float(1).sub(exp(surging.mul(-surge.ebb))).div(surge.ebb).sub(float(1).sub(exp(surging.mul(-(surge.swell + surge.ebb)))).div(surge.swell + surge.ebb))
      return sum.add(surged.mul(strength))
    }, landed.sub(pourFrom).mul(trickle)).div(pourTotal)
    const drain = clock.sub(draining.start).div(draining.seconds).clamp(0, 1)
    const sucked = drain.mul(drain)
    const poolSize = volume.sqrt().mul(poolRadius).mul(smoothstep(creep.start, creep.end, clock).mul(creep.share).add(1)).mul(float(1).sub(sucked))
    const local = uv().sub(0.5).mul(poolReach * 2)
    // Sucked back ever faster, its edge swirls in and frays as it goes.
    const poolAngle = atan(local.y, local.x).add(sucked.mul(2.5))
    const poolEdge = mx_noise_float(vec3(poolAngle.cos().mul(2.4), poolAngle.sin().mul(2.4), clock.mul(drain.mul(1.6).add(0.12)).add(phase.mul(9))))
    const poolInside = poolSize.mul(poolEdge.mul(drain.mul(0.25).add(0.12)).add(1)).sub(local.length())
    // Thin and red at its rim, deep within; it stays wet, bulging up at its rim, mirroring the room and glinting like the stains, and rippling round its middle as long as the pour strikes it, as hard as it strikes.
    const poolOutward = tangent.mul(local.x).add(normal.mul(local.y)).add(normal.mul(0.0001)).normalize()
    const fromMiddle = local.length()
    const ripples = sin(fromMiddle.mul(120).sub(clock.mul(28))).mul(exp(fromMiddle.mul(-7))).mul(smoothstep(0.005, 0.02, fromMiddle)).mul(pourFlow(clock.sub(pourLanding)).mul(0.3))
    const poolSurface = up.add(poolOutward.mul(smoothstep(0.03, 0, poolInside).mul(0.5).add(ripples))).normalize()
    const poolGlint = max(poolSurface.dot(toLamp.add(toCamera).normalize()), 0).pow(320).mul(0.3).mul(smoothstep(0.02, 0.1, poolInside))
    const poolFresnel = float(1).sub(max(poolSurface.dot(toCamera), 0)).pow(5).mul(0.96).add(0.04)
    const poolColor = mix(colors.thin, mix(colors.body, colors.core, smoothstep(0.04, 0.2, poolInside)), smoothstep(0, 0.02, poolInside)).add(colors.sheen.mul(poolFresnel).mul(0.6)).add(colors.highlight.mul(poolGlint))
    const fadeAt = phase.mul(bloodFading.stagger).add(bloodFading.start)
    const presence = select(shown, smoothstep(fadeAt.add(bloodFading.duration), fadeAt, clock), float(0))
    material.positionNode = select(shown.and(settled.not()), select(isPool, poolQuad, select(isPour, pourQuad, select(flying, streak, stain))), vec3(0, 0, 0))
    material.colorNode = select(isPool, poolColor, select(isPour, pourColor, select(isMist, colors.mist, select(flying, beadColor, stainColor))))
    material.opacityNode = select(isPool, coverage(poolInside).mul(select(shown.and(volume.greaterThan(0)), float(1), float(0))), select(isPour, coverage(pourInside), select(isMist, mistInside.mul(mistFade).mul(0.28), select(flying, coverage(beadInside).mul(smeared), coverage(stainInside)))).mul(presence))
  }
}
