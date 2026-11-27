import type {PartyOffset} from '../lib/partySite.ts'

/** 0 = swirling glacial snow-squall wisp, 1 = 3D-tumbling dendritic snowflake, 2 = faceted glacier ice shard, 3 = swirling snow dust / sparkling frost mote */
export type BlizzardKind = 0 | 1 | 2 | 3

/** a snow squall, snowflake, ice shard or sparkling snow mote bursting out of its origin */
export type BlizzardParticle = {
  /** where it bursts out toward, as an angle around the origin in the wall’s plane */
  angle: number
  /** seconds after the burst that it appears */
  delay: number
  /** vertical drift over its life in meters */
  drift: number
  kind: BlizzardKind
  /** seconds it swirls out into the room before sublimating away */
  life: number
  /** how far it sweeps out into the room, in meters */
  out: number
  /** per-particle seed for crystal morphology, tumble axis, glint phase and wobble */
  phase: number
  /** how far it fans out from the origin along the wall’s plane, in meters */
  reach: number
  /** its characteristic size in meters */
  size: number
  /** spin or tumble speed in radians per second */
  spin: number
  /** how far it whirls around the origin, in radians */
  swirl: number
}

const goldenRatio = (Math.sqrt(5) - 1) / 2
/** deterministic, evenly spread pseudo-random fractions */
const sequence = (index: number, seed: number) => (index * goldenRatio + seed) % 1
const ribbonCount = 28
const flakeCount = 64
const shardCount = 32
const moteCount = 140
/** Chaotic, translucent icy-blue and white wind-swept snow squall wisps swirling out across varied radii. */
const ribbons: ReadonlyArray<BlizzardParticle> = Array.from({length: ribbonCount}, (_, index) => ({
  kind: 0,
  delay: index / ribbonCount * 0.42 + sequence(index, 0.13) * 0.08,
  life: 1.5 + sequence(index * 3, 0.41) * 1.05,
  angle: index * Math.PI * (3 - Math.sqrt(5)) + sequence(index * 2, 0.7) * 0.9,
  reach: 0.35 + sequence(index * 5, 0.27) * 1.25,
  out: 0.35 + sequence(index * 7, 0.63) * 1.3,
  swirl: (sequence(index * 11, 0.19) < 0.85 ? 1 : -1) * (1.3 + sequence(index * 13, 0.51) * 2.1),
  drift: -0.35 + sequence(index * 17, 0.77) * 0.85,
  size: 0.36 + sequence(index * 19, 0.31) * 0.42,
  spin: (sequence(index * 23, 0.53) < 0.5 ? 1 : -1) * (0.9 + sequence(index * 29, 0.89) * 1.3),
  phase: sequence(index * 31, 0.17) * Math.PI * 2,
}))
/** Crisp, varied 6-pointed dendritic snowflakes tumbling gently in 3D as they spiral outward and settle. */
const flakes: ReadonlyArray<BlizzardParticle> = Array.from({length: flakeCount}, (_, index) => ({
  kind: 1,
  delay: 0.03 + index / flakeCount * 0.7 + sequence(index, 0.47) * 0.07,
  life: 2.3 + sequence(index * 3, 0.23) * 1.5,
  angle: index * Math.PI * (3 - Math.sqrt(5)),
  reach: 0.55 + sequence(index * 5, 0.61) * 1.45,
  out: 0.48 + sequence(index * 7, 0.37) * 2.05,
  swirl: (sequence(index * 11, 0.11) < 0.88 ? 1 : -1) * (1.6 + sequence(index * 13, 0.73) * 2.4),
  drift: -0.95 + sequence(index * 17, 0.43) * 0.95,
  size: index < 24 ? 0.1 + sequence(index * 19, 0.83) * 0.075 : 0.055 + sequence(index * 19, 0.83) * 0.05,
  spin: (sequence(index * 23, 0.29) < 0.5 ? 1 : -1) * (1.4 + sequence(index * 29, 0.67) * 2.8),
  phase: sequence(index * 31, 0.59) * Math.PI * 2,
}))
/** Faceted translucent glacier-ice shards shooting out along their velocity trajectories right as the blizzard erupts. */
const shards: ReadonlyArray<BlizzardParticle> = Array.from({length: shardCount}, (_, index) => ({
  kind: 2,
  delay: index / shardCount * 0.22 + sequence(index, 0.71) * 0.04,
  life: 1.45 + sequence(index * 3, 0.57) * 0.95,
  angle: index * Math.PI * (3 - Math.sqrt(5)) + 1.2,
  reach: 0.35 + sequence(index * 5, 0.39) * 1.85,
  out: 0.65 + sequence(index * 7, 0.15) * 1.75,
  swirl: (sequence(index * 11, 0.91) < 0.82 ? 1 : -1) * (1 + sequence(index * 13, 0.33) * 1.5),
  drift: -0.65 + sequence(index * 17, 0.21) * 0.95,
  size: 0.055 + sequence(index * 19, 0.63) * 0.085,
  spin: (sequence(index * 23, 0.49) < 0.5 ? 1 : -1) * (3 + sequence(index * 29, 0.81) * 4),
  phase: sequence(index * 31, 0.11) * Math.PI * 2,
}))
/** Dense, lively flurry of fine swirling snow dust and twinkling frost motes bridging every scale of the blizzard. */
const motes: ReadonlyArray<BlizzardParticle> = Array.from({length: moteCount}, (_, index) => ({
  kind: 3,
  delay: index / moteCount * 0.85 + sequence(index, 0.29) * 0.06,
  life: 1.9 + sequence(index * 3, 0.67) * 1.9,
  angle: index * Math.PI * (3 - Math.sqrt(5)) + 2.1,
  reach: 0.25 + sequence(index * 5, 0.83) * 1.9,
  out: 0.25 + sequence(index * 7, 0.47) * 2.2,
  swirl: (sequence(index * 11, 0.23) < 0.88 ? 1 : -1) * (2 + sequence(index * 13, 0.59) * 2.8),
  drift: -0.85 + sequence(index * 17, 0.37) * 1.15,
  size: 0.024 + sequence(index * 19, 0.91) * 0.034,
  spin: (sequence(index * 23, 0.17) < 0.5 ? 1 : -1) * (2.5 + sequence(index * 29, 0.43) * 4.5),
  phase: sequence(index * 31, 0.77) * Math.PI * 2,
}))

/** Every snow squall, snow mote, snowflake and glacier shard of the blizzard burst. */
export const blizzardParticles: ReadonlyArray<BlizzardParticle> = [...ribbons, ...motes, ...flakes, ...shards]

/** seconds until the last snowflake has faded away */
export const blizzardDone = Math.max(...blizzardParticles.map(({delay, life}) => delay + life))

/**
 * Where a blizzard particle lies `seconds` after it burst out: it whips outward on the freezing gale, spirals through a turbulent vortex while sweeping out into the room and drifts gently without sinking below `floor`.
 * `SwirlingBlizzard` flies them the same way on the GPU.
 */
export function blizzardOffset({angle, drift, kind, life, out, phase, reach, size, swirl}: BlizzardParticle, seconds: number, floor: number): PartyOffset {
  const since = Math.max(0, seconds)
  const progress = Math.min(1, since / life)
  const burstRates = [3, 2.5, 4.2, 2.8] as const
  const burstRate = burstRates[kind]
  const distance = reach * (1 - Math.exp(-burstRate * since)) + (kind === 1 || kind === 3 ? 0.18 : 0.12) * since
  const around = angle + swirl * (1 - Math.exp(-0.9 * since))
  const flutter = kind === 1 || kind === 3 ? Math.sin(since * 4.2 + phase) * 0.065 : 0
  const along = Math.cos(around) * distance + flutter
  const rawUp = Math.sin(around) * distance + drift * progress ** 1.45 + (kind === 1 || kind === 3 ? Math.cos(since * 3.1 + phase) * 0.045 : 0)
  const up = Math.max(floor + size * 0.35, rawUp)
  const forward = out * (1 - Math.exp(-1.9 * since)) + 0.08
  return [along, up, forward]
}
