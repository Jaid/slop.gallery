import type {BlizzardParticle} from './flights.ts'
import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, attribute, cos, exp, float, max, min, mix, mod, mx_noise_float, positionGeometry, select, sin, smoothstep, uv, vec2, vec3} from 'three/tsl'
import {PlaneGeometry} from 'three/webgpu'

import {coverage, rgb} from '#src/orbs/lib/fill.ts'

import {cameraRight, cameraUp, partyPoint, screenAxes} from '../lib/billboards.ts'
import EffectSprites, {instanceAttribute} from '../lib/EffectSprites.ts'

/** how far each sprite quad reaches in its own units, leaving room for glow */
const quadRadius = 1.35
const snowWhite = rgb(hsl.integer(212, 26, 97))
const iceCyan = rgb(hsl.integer(216, 96, 70))
const glacierMid = rgb(hsl.integer(226, 90, 44))
const deepGlacier = rgb(hsl.integer(236, 90, 20))
const squallBlue = rgb(hsl.integer(218, 88, 72))
const glintWhite = rgb(hsl.integer(206, 50, 100))
/** Positive inside an angled 60° side-branch rooted on the main arm at `root` with `length` and half-width `width`. */
function dendriteBranch(u: Node<'float'>, v: Node<'float'>, root: Node<'float'>, length: Node<'float'>, width: number) {
  const du = u.sub(root)
  const along = du.mul(0.5).add(v.mul(0.8660254))
  const aside = du.mul(-0.8660254).add(v.mul(0.5)).abs()
  return min(min(float(width).sub(aside), along), length.sub(along))
}
/**
 * Signed inside-distance of a varied 6-fold dendritic snowflake in unit coordinates (−1–1): `phase` shifts smoothly between lacy stellar dendrites, delicate fern stars and faceted hexagonal plates.
 */
function snowflakeShape(point: Node<'vec2'>, phase: Node<'float'>) {
  const radius = point.length()
  const angle = atan(point.y, point.x)
  const sector = mod(angle.add(Math.PI / 6), Math.PI / 3).sub(Math.PI / 6).abs()
  const u = radius.mul(cos(sector))
  const v = radius.mul(sin(sector))
  const morph = sin(phase.mul(2.7)).mul(0.5).add(0.5)
  const spineWidth = mix(float(0.068), float(0.02), u.div(0.9).clamp(0, 1))
  const spine = min(spineWidth.sub(v), float(0.9).sub(u))
  const plateRadius = mix(float(0.11), float(0.28), morph)
  const plate = plateRadius.sub(u)
  const branch1 = dendriteBranch(u, v, sin(phase).mul(0.05).add(0.27), mix(float(0.26), float(0.42), morph.oneMinus()), 0.032)
  const branch2 = dendriteBranch(u, v, cos(phase).mul(0.04).add(0.54), mix(float(0.16), float(0.26), morph.oneMinus()), 0.024)
  return max(max(spine, plate), max(branch1, branch2))
}
/**
 * Signed inside-distance of a bold, faceted hexagonal-diamond glacier crystal shard aligned along +x (its flight direction).
 */
function iceShardShape(point: Node<'vec2'>, phase: Node<'float'>) {
  const halfWidth = sin(phase.mul(2.1)).mul(0.08).add(0.36)
  const peakX = cos(phase.mul(1.3)).mul(0.16)
  const x = point.x
  const taper = float(1).sub(x.sub(peakX).abs().div(select(x.greaterThan(peakX), float(1).sub(peakX), float(1).add(peakX))).clamp(0, 1))
  return min(halfWidth.mul(taper).sub(point.y.abs()), float(0.94).sub(x.abs()))
}

/**
 * A swirling blizzard bursting out of its origin, the Frost Orb’s party effect: turbulent icy-blue and white wind-swept snow squalls, crisp 3D-tumbling dendritic snowflakes, bold faceted glacier-ice shards and a dense flurry of sparkling snow dust, animated in one instanced draw on the GPU.
 */
export default class SwirlingBlizzard extends EffectSprites {
  constructor(particles: ReadonlyArray<BlizzardParticle>) {
    const geometry = new PlaneGeometry(1, 1)
    instanceAttribute(geometry, 'blizzTiming', particles.map(({delay, kind, life, phase}) => [delay, life, kind, phase]))
    instanceAttribute(geometry, 'blizzPath', particles.map(({angle, out, reach, swirl}) => [angle, reach, out, swirl]))
    instanceAttribute(geometry, 'blizzShape', particles.map(({drift, size, spin}) => [drift, size, spin]))
    super('party-blizzard', geometry, particles.length)
    const {material} = this
    const {clock, floor, normal, tangent} = this.uniforms
    const timing = attribute<'vec4'>('blizzTiming', 'vec4')
    const path = attribute<'vec4'>('blizzPath', 'vec4')
    const shape = attribute<'vec3'>('blizzShape', 'vec3')
    const [delay, life, kind, phase] = [timing.x, timing.y, timing.z, timing.w]
    const [angle, reach, out, swirl] = [path.x, path.y, path.z, path.w]
    const [drift, size, spin] = [shape.x, shape.y, shape.z]
    const age = clock.sub(delay)
    const since = age.max(0)
    const progress = since.div(life).clamp(0, 1)
    const isRibbon = kind.lessThan(0.5)
    const isFlake = kind.greaterThanEqual(0.5).and(kind.lessThan(1.5))
    const isShard = kind.greaterThanEqual(1.5).and(kind.lessThan(2.5))
    const isMote = kind.greaterThanEqual(2.5)
    // Exact GPU mirror of `blizzardOffset`.
    const positionAt = (seconds: Node<'float'>) => {
      const done = seconds.div(life).clamp(0, 1)
      const burstRate = select(isShard, float(4.2), select(isRibbon, float(3), select(isMote, float(2.8), float(2.5))))
      const radialDrift = select(isFlake.or(isMote), float(0.18), float(0.12))
      const distance = reach.mul(float(1).sub(exp(seconds.mul(burstRate.negate())))).add(seconds.mul(radialDrift))
      const around = angle.add(swirl.mul(float(1).sub(exp(seconds.mul(-0.9)))))
      const flutterX = select(isFlake.or(isMote), sin(seconds.mul(4.2).add(phase)).mul(0.065), float(0))
      const flutterY = select(isFlake.or(isMote), cos(seconds.mul(3.1).add(phase)).mul(0.045), float(0))
      const along = cos(around).mul(distance).add(flutterX)
      const rawUp = sin(around).mul(distance).add(drift.mul(done.pow(1.45))).add(flutterY)
      const up = max(floor.add(size.mul(0.35)), rawUp)
      const forward = out.mul(float(1).sub(exp(seconds.mul(-1.9)))).add(0.08)
      return partyPoint(tangent, normal, along, up, forward)
    }
    const center = positionAt(since)
    // Align squall wisps and glacier shards along their screen-space flight velocity; snowflakes spin freely.
    const velocity = positionAt(since.add(0.025)).sub(center)
    const velAngle = atan(velocity.dot(cameraUp), velocity.dot(cameraRight))
    const roll = select(isRibbon.or(isShard), velAngle, since.mul(spin).add(phase))
    const {right, up: screenUp} = screenAxes(roll)
    // Squalls stretch smoothly along the wind; snowflakes gently tumble in 3D (keeping arms crisp); shards keep bold crystal proportions.
    const growth = select(isRibbon, smoothstep(0, 0.3, since).mul(0.6).add(0.4).mul(progress.mul(0.65).add(1)), smoothstep(0, 0.12, since).mul(0.7).add(0.3))
    const tumble = cos(since.mul(spin.mul(0.5)).add(phase.mul(2.3))).abs().mul(0.52).add(0.48)
    const halfX = size.mul(growth).mul(select(isRibbon, float(1.15), select(isShard, float(0.72), float(0.5))))
    const halfY = size.mul(growth).mul(select(isRibbon, float(0.55), select(isFlake, tumble.mul(0.5), float(0.5))))
    const corner = vec2(positionGeometry.x, positionGeometry.y).mul(quadRadius * 2)
    const placed = center.add(right.mul(corner.x.mul(halfX))).add(screenUp.mul(corner.y.mul(halfY)))
    material.positionNode = select(age.greaterThan(0).and(progress.lessThan(1)), placed, vec3(0, 0, 0))
    const point = uv().sub(0.5).mul(quadRadius * 2)
    const radius = point.length()
    const insideQuad = smoothstep(quadRadius, quadRadius - 0.22, point.x.abs()).mul(smoothstep(quadRadius, quadRadius - 0.22, point.y.abs()))
    const presence = select(age.greaterThan(0).and(progress.lessThan(1)), smoothstep(0, 0.08, age).mul(smoothstep(1, 0.58, progress)), float(0))
    // 1. Soft, airy icy-blue and white turbulent snow-squall wisp (never gray cobwebs, never a solid opaque cloud).
    const wispCoord = vec2(point.x.mul(1.4).sub(since.mul(1.1)), point.y.mul(2.2).add(phase))
    const cloud1 = mx_noise_float(vec3(wispCoord, phase.mul(0.4))).mul(0.5).add(0.5)
    const cloud2 = mx_noise_float(vec3(wispCoord.mul(2.6), phase.mul(0.9))).mul(0.5).add(0.5)
    const squallEnv = smoothstep(1.15, 0.1, vec2(point.x.mul(0.92), point.y.mul(1.05)).length())
    const ribbonAlpha = squallEnv.mul(cloud1.mul(0.6).add(cloud2.mul(0.4))).pow(1.35).mul(0.21)
    const ribbonColor = mix(squallBlue, mix(iceCyan, snowWhite, float(0.65)), cloud2.mul(0.65).add(0.2)).mul(1.08)
    // 2. Crisp 3D-tumbling dendritic snowflake (kept right under bloom clip so fine branches stay razor-sharp).
    const flakeSdf = snowflakeShape(point, phase)
    const flakeMask = coverage(flakeSdf)
    const flakeOutside = flakeSdf.negate().max(0)
    const flakeHalo = exp(flakeOutside.mul(-18)).mul(smoothstep(0.26, 0.03, flakeOutside)).mul(flakeMask.oneMinus()).mul(0.24)
    const tiltLight = tumble.mul(0.55).add(0.45)
    const flakeColor = mix(iceCyan, snowWhite, smoothstep(-0.01, 0.06, flakeSdf).mul(tiltLight)).mul(tiltLight.mul(0.45).add(0.75))
    const flakeAlpha = flakeMask.mul(mix(float(0.68), float(0.96), tiltLight)).add(flakeHalo)
    const flakeRgb = flakeColor.mul(flakeMask).add(iceCyan.mul(1.15).mul(flakeHalo)).div(flakeAlpha.max(0.0001))
    // 3. Bold 3D faceted glacier-ice shard: deep arctic sapphire lower bevel vs glowing cyan-white upper bevel + crisp center ridge.
    const shardSdf = iceShardShape(point, phase)
    // Soften tail edge for subtle directional motion blur along flight, with translucent icy-blue crystal bevels (never flat white paper diamonds).
    const shardMask = smoothstep(-0.04, 0.08, shardSdf).mul(smoothstep(-0.95, -0.35, point.x).mul(0.55).add(0.45))
    const shardOutside = shardSdf.negate().max(0)
    const upperFacet = point.y.greaterThan(0)
    const frontHalf = point.x.greaterThan(0)
    const flash = sin(since.mul(13).add(phase.mul(5))).mul(0.5).add(0.5).pow(7)
    const darkBevel = select(frontHalf, glacierMid, deepGlacier)
    const litBevel = select(frontHalf, iceCyan, glacierMid.mul(1.35))
    const bevelColor = select(upperFacet, litBevel, darkBevel)
    const ridgeLine = smoothstep(0.04, 0, point.y.abs()).mul(0.5)
    const edgeRim = smoothstep(0.055, 0, shardSdf).mul(0.35)
    const shardHalo = exp(shardOutside.mul(-16)).mul(smoothstep(0.28, 0.03, shardOutside)).mul(shardMask.oneMinus()).mul(0.26)
    const shardAlpha = shardMask.mul(0.74).add(shardHalo).clamp(0, 1)
    const shardRgb = bevelColor.add(glintWhite.mul(ridgeLine.add(edgeRim).add(flash.mul(0.9)))).mul(shardMask.mul(0.74)).add(iceCyan.mul(1.35).mul(shardHalo)).div(shardAlpha.max(0.0001))
    // 4. Crisp swirling snow dust & twinkling frost mote bridging the gale.
    const starCross = exp(point.x.abs().mul(5.5).add(point.y.abs().mul(1.3)).negate()).max(exp(point.y.abs().mul(5.5).add(point.x.abs().mul(1.3)).negate()))
    const moteDot = exp(radius.mul(radius).mul(-3.2))
    const moteTwinkle = sin(since.mul(8.5).add(phase.mul(6.1))).mul(0.5).add(0.5).pow(3)
    const moteAlpha = max(moteDot.mul(0.85), starCross.mul(moteTwinkle)).clamp(0, 0.94)
    const moteRgb = mix(iceCyan, glintWhite, moteDot.mul(0.55).add(moteTwinkle.mul(0.45))).mul(moteTwinkle.mul(0.95).add(0.95))
    const finalColor = select(isRibbon, ribbonColor, select(isFlake, flakeRgb, select(isShard, shardRgb, moteRgb)))
    const finalAlpha = select(isRibbon, ribbonAlpha, select(isFlake, flakeAlpha, select(isShard, shardAlpha, moteAlpha)))
    material.colorNode = finalColor
    material.opacityNode = finalAlpha.mul(presence).mul(insideQuad)
  }
}
