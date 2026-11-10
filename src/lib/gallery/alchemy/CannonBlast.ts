import type {Vec3} from '../types.ts'

import {mulberry32} from 'math/random'
import {atan, attribute, exp, float, mix, positionGeometry, select, sin, smoothstep, step, uv, vec2, vec3} from 'three/tsl'
import {PlaneGeometry} from 'three/webgpu'

import {coverage, rgb} from '#src/lib/materials/orb/fill.ts'
import {screenAxes} from '#src/party_effects/lib/billboards.ts'
import EffectSprites, {instanceAttribute} from '#src/party_effects/lib/EffectSprites.ts'

import {alchemyCannon} from './alchemyMachine.ts'

/** what a sprite of the blast is: the flash of the bang, a puff of smoke or a spark */
const kinds = {
  flash: 0,
  puff: 1,
  spark: 2,
} as const
type Particle = {
  /** seconds after the shot it shows */
  delay: number
  direction: Vec3
  /** how quickly the air slows it down, per second */
  drag: number
  kind: number
  /** seconds it lasts once it shows */
  life: number
  /** a number of its own, which varies its outline */
  seed: number
  /** its radius, in meters */
  size: number
  /** how fast it leaves the muzzle, in m/s */
  speed: number
}

const flashColor = rgb('#fff4b8')
const puffLight = rgb('#f6f0e4')
const puffShade = rgb('#b4a896')
const sparkColor = rgb('#ffb347')
/** A direction within `spread` radians of the barrel’s axis, `around` radians round it. */
function within(spread: number, around: number): Vec3 {
  const [ax, ay, az] = alchemyCannon.axis
  // Square to the axis: across the barrel, level, and the one up from it
  const across: Vec3 = [1, 0, 0]
  const up: Vec3 = [ay * across[2] - az * across[1], az * across[0] - ax * across[2], ax * across[1] - ay * across[0]]
  const [along, out] = [Math.cos(spread), Math.sin(spread)]
  return [0, 1, 2].map(index => alchemyCannon.axis[index] * along + (across[index] * Math.cos(around) + up[index] * Math.sin(around)) * out) as Vec3
}
/** the particles of one blast, the same for every shot */
const particles = (() => {
  const state = mulberry32.create(1873)
  const random = (from: number, to: number) => from + mulberry32.sample(state) * (to - from)
  const list: Array<Particle> = [{
    kind: kinds.flash,
    direction: alchemyCannon.axis,
    speed: 0,
    drag: 1,
    delay: 0,
    life: 0.14,
    size: 0.36,
    seed: 0.3,
  }]
  for (let index = 0; index < 16; index++) {
    list.push({
      kind: kinds.puff,
      direction: within(random(0, 0.6), random(0, Math.PI * 2)),
      speed: random(2.4, 5.2),
      drag: random(4, 6),
      delay: random(0, 0.06),
      life: random(0.7, 1.15),
      size: random(0.12, 0.24),
      seed: random(0, 1),
    })
  }
  for (let index = 0; index < 28; index++) {
    list.push({
      kind: kinds.spark,
      direction: within(random(0, 0.45), random(0, Math.PI * 2)),
      speed: random(4.5, 9),
      drag: random(1, 2),
      delay: random(0, 0.03),
      life: random(0.3, 0.55),
      size: random(0.018, 0.032),
      seed: random(0, 1),
    })
  }
  return list
})()

/**
 * The alchemy machine’s cannon going off, at its muzzle: a cartoonish bang, a spiky star flashing up and gone in a blink, round puffs of smoke billowing out along the barrel, swelling, drifting up and shrinking away, and a spray of sparks falling off in arcs. Animated entirely on the GPU by the clock, the seconds since the shot, each sprite a quad flat in the view.
 */
export default class CannonBlast extends EffectSprites {
  constructor() {
    const geometry = new PlaneGeometry(1, 1)
    instanceAttribute(geometry, 'blastMotion', particles.map(({direction, speed}) => [...direction, speed]))
    instanceAttribute(geometry, 'blastLife', particles.map(({delay, kind, life, size}) => [kind, delay, life, size]))
    instanceAttribute(geometry, 'blastShape', particles.map(({drag, seed}) => [seed, drag]))
    super('alchemy-cannon-blast', geometry, particles.length)
    const {material} = this
    const {clock} = this.uniforms
    const motion = attribute<'vec4'>('blastMotion', 'vec4')
    const timing = attribute<'vec4'>('blastLife', 'vec4')
    const shape = attribute<'vec2'>('blastShape', 'vec2')
    const [kind, delay, life, size] = [timing.x, timing.y, timing.z, timing.w]
    const [seed, drag] = [shape.x, shape.y]
    const flash = float(1).sub(step(0.5, kind))
    const spark = step(1.5, kind)
    const puff = float(1).sub(flash).sub(spark)
    const age = clock.sub(delay)
    const since = age.max(0)
    const progress = since.div(life).clamp(0, 1)
    // Thrown out along its way and slowed by the air, the smoke drifting up and the sparks falling
    const travelled = motion.w.mul(float(1).sub(exp(drag.negate().mul(since)))).div(drag)
    const center = motion.xyz.mul(travelled).add(vec3(0, puff.mul(0.3).sub(spark.mul(4.9)).mul(since.mul(since)), 0))
    // The flash bursts out to its size at once, a puff billows up and shrinks away again toward its end.
    const flashSize = smoothstep(0, 0.03, since).mul(since.mul(5).add(1))
    const puffSize = float(1).sub(exp(since.mul(-7))).mul(0.65).add(0.35).mul(smoothstep(1, 0.55, progress))
    const radius = size.mul(flash.mul(flashSize).add(puff.mul(puffSize)).add(spark))
    const {right, up} = screenAxes()
    const corner = positionGeometry.xy.mul(2)
    const placed = center.add(right.mul(corner.x.mul(radius))).add(up.mul(corner.y.mul(radius)))
    material.positionNode = select(age.greaterThan(0).and(progress.lessThan(1)), placed, vec3(0, 0, 0))
    const point = uv().sub(0.5).mul(2)
    const distance = point.length()
    const angle = atan(point.y, point.x)
    // A star of eight spikes, a lumpy cloud and a round spark
    const star = float(0.5).add(sin(angle.mul(8).add(seed)).mul(0.5).add(0.5).pow(3).mul(0.48)).sub(distance)
    const cloud = float(0.8).add(sin(angle.mul(5).add(seed.mul(Math.PI * 2))).mul(0.08)).add(sin(angle.mul(9).add(seed.mul(11))).mul(0.04)).sub(distance)
    const dot = float(0.6).sub(distance)
    const inside = flash.mul(star).add(puff.mul(cloud)).add(spark.mul(dot))
    // The puff lit from up and to one side, like a cartoon cloud
    const lit = coverage(float(0.62).sub(point.sub(vec2(-0.16, 0.2)).length()))
    const smoke = mix(puffShade, puffLight, lit)
    material.colorNode = flashColor.mul(flash.mul(3)).add(smoke.mul(puff)).add(sparkColor.mul(spark.mul(4)))
    const fading = flash.mul(smoothstep(1, 0.4, progress)).add(puff.mul(smoothstep(1, 0.7, progress))).add(spark.mul(smoothstep(1, 0.3, progress)))
    material.opacityNode = coverage(inside).mul(fading)
  }
}
