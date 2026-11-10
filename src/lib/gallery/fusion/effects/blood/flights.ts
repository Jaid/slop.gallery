import type {PortalOffset} from '../base/portalOffset.ts'

import {moments} from '../base/portalOffset.ts'

/** what a piece of the blood is: a drop, a speck of the mist that sprays out with the drops, which the air holds up and takes no splat from, the pool gathering on the floor under the portal or the stream pouring down into it */
export const bloodKinds = {
  drop: 0,
  mist: 1,
  pool: 2,
  pour: 3,
} as const
/** a drop of blood that the portal spurts out as the result flips out or that drips from its bottom afterwards, a speck of its mist, its pool or the stream pouring into the pool */
export type BloodDrop = {
  /** seconds after the result flipped out that it leaves the portal, or that the pool starts gathering or the stream pouring */
  delay: number
  /** seconds it swells hanging from the portal before it drops, for a drip */
  hang: number
  kind: keyof typeof bloodKinds
  /** sets its stain apart from the others’, 0–1 */
  phase: number
  /** how thick it is, in meters */
  size: number
  /** where it leaves the portal */
  start: PortalOffset
  /** how fast it leaves the portal, in m/s */
  velocity: PortalOffset
}
/** a beat of the heart that makes the portal spurt */
export type Heartbeat = {
  /** seconds after the result flipped out */
  at: number
  /** how hard it beats, 1 for the hardest */
  strength: number
}
/** where and when the stream pouring out of the portal strikes the pool, in seconds after the result flipped out, as its sound needs it */
export type BloodPouring = {
  /** when its first blood strikes */
  from: number
  /** where it strikes, from the portal’s middle */
  spot: PortalOffset
  /** when the surge of each beat strikes, and how hard the beat was */
  surges: ReadonlyArray<Heartbeat>
  /** when its last blood strikes */
  to: number
}
/** a drop striking the floor, as its sound needs it */
export type BloodSplat = {
  /** how far along the wall from the portal’s middle it strikes, in meters */
  along: number
  /** seconds after the result flipped out */
  at: number
  /** how thick it is, in meters */
  size: number
  /** how fast it strikes, in m/s */
  speed: number
}

/** how strongly a drop is pulled down, in m/s² */
export const gravity = 9.81
/** how high above the floor its stain lies, in meters */
export const splatLift = 0.004

const goldenRatio = (Math.sqrt(5) - 1) / 2
/** deterministic, evenly spread pseudo-random fractions */
const sequence = (index: number, seed: number) => (index * goldenRatio + seed) % 1
const between = (index: number, seed: number, low: number, high: number) => low + sequence(index, seed) * (high - low)

/** the beats of a racing heart the portal spurts on, each a little weaker */
export const bloodBeats: ReadonlyArray<Heartbeat> = [
  {
    at: 0,
    strength: 1,
  },
  {
    at: 0.62,
    strength: 0.8,
  },
  {
    at: 1.24,
    strength: 0.62,
  },
]
/** seconds after the result flipped out that the stains, fresh and glossy at first, start to dry dark and dull, and how long that takes, the thin edges first */
export const clotting = {
  start: 3,
  seconds: 2,
} as const
/** seconds after the result flipped out that the dried stains start fading away, the first of them, and how long fading them all takes */
export const bloodFading = {
  start: 5.4,
  stagger: 0.4,
  duration: 0.6,
} as const
/**
 * The stream pouring straight down out of the portal’s bottom, in seconds after the result flipped out and meters: it starts as the first beat spurts and runs dry after the second, before the result comes back down through it, surging on its beats and trickling between them, and thins and beads up as it speeds up in its fall, until it strikes the floor and feeds the pool there.
 */
export const bloodPour = {
  /** where it leaves the portal, along the wall, up and out into the room from the portal’s middle: off the front of its bottom, so its pool spreads out before the result, which comes down right under the portal and lies on the pool’s back */
  start: [0, -0.32, 0.25],
  /** how fast it leaves the portal, downward, in m/s */
  speed: 0.6,
  /** how thick it is where it leaves the portal at a beat’s hardest surge, in meters */
  width: 0.09,
  /** seconds after the result flipped out that it starts and stops leaving the portal; each beat’s surge starts as late after the beat as the stream after the first. The result, thrown up out of the portal, comes back down through the stream about 1.05 s after it flipped out, whatever its size, so its last blood has fallen out of the result’s way by then. */
  flowing: [0.04, 0.85],
  /** seconds it takes to run dry before it stops */
  drying: 0.15,
  /** how much trickles out between the beats, against a hardest beat’s surge */
  trickle: 0.45,
  /** how fast a beat’s surge swells and ebbs, as rates per second */
  surge: {
    swell: 40,
    ebb: 5,
  },
} as const
/**
 * The pool gathering on the floor where the pour strikes it, in seconds after the result flipped out and meters: it swells by the blood the pour brought down so far, and creeps on a little as it settles, until it is sucked back toward its middle ever faster and gone.
 */
export const bloodPool = {
  /** where its middle lies, along the wall and out into the room from the portal’s middle: right under where the pour leaves the portal */
  center: [bloodPour.start[0], bloodPour.start[2]],
  /** its radius once all of the pour has come down */
  radius: 0.8,
  /** how much further it creeps as it settles, a share of its radius, and from when to when */
  creep: {
    share: 0.1,
    start: 2.2,
    end: 5,
  },
  draining: {
    start: 5.3,
    seconds: 1.1,
  },
} as const
/** how long the camera’s shutter stays open, in seconds, which smears a flying drop along its motion */
export const shutter = 1 / 50

/** How strongly the air slows a drop `size` meters thick down, as a rate per second: by gravity over the speed it falls at in the end, which a fine speck reaches at once and a thick drop hardly ever. */
export function airDrag(size: number) {
  return gravity / Math.min(Math.max(size * 1300, 0.7), 9)
}

/** Where a drop is, up from the portal’s middle, and how fast it rises, `seconds` after it left at `up` m/s from `height`, slowed by `drag`. */
function rise(height: number, up: number, drag: number, seconds: number) {
  const decay = Math.exp(-drag * seconds)
  const terminal = gravity / drag
  return {
    height: height + (up + terminal) * (1 - decay) / drag - terminal * seconds,
    speed: (up + terminal) * decay - terminal,
  }
}

/** how many Newton steps refine when a drop lands, from when it would land without the air */
export const landingSteps = 6

/** When a drop slowed by the air splats on a floor `floor` meters below the portal’s middle (negative), in seconds after it left the portal, where along the wall and how fast it hits it, in m/s. `BloodSpray` drops them the same way on the GPU. */
export function bloodLanding({size, start, velocity}: Pick<BloodDrop, 'size' | 'start' | 'velocity'>, floor: number) {
  const drag = airDrag(size)
  const target = floor + splatLift
  const up = velocity[1]
  const drop = Math.max(0, start[1] - target)
  let landing = (up + Math.sqrt(up * up + 2 * gravity * drop)) / gravity
  for (let step = 0; step < landingSteps; step++) {
    const {height, speed} = rise(start[1], up, drag, landing)
    landing = Math.max(0, landing - (height - target) / Math.min(speed, -0.01))
  }
  const decay = Math.exp(-drag * landing)
  return {
    along: start[0] + velocity[0] * (1 - decay) / drag,
    landing,
    speed: Math.hypot(velocity[0] * decay, rise(start[1], up, drag, landing).speed, velocity[2] * decay),
  }
}

/** Where a drop is `seconds` after it left the portal, from the portal’s middle, slowed by the air, as `BloodSpray` flies it on the GPU, and how fast it moves, in m/s along the wall, up and out into the room. */
export function bloodFlight({size, start, velocity}: Pick<BloodDrop, 'size' | 'start' | 'velocity'>, seconds: number) {
  const drag = airDrag(size)
  const decay = Math.exp(-drag * seconds)
  const travel = (1 - decay) / drag
  const {height, speed} = rise(start[1], velocity[1], drag, seconds)
  return {
    offset: [start[0] + velocity[0] * travel, height, start[2] + velocity[2] * travel] as PortalOffset,
    velocity: [velocity[0] * decay, speed, velocity[2] * decay] as PortalOffset,
  }
}

/** How long the pour takes to fall `distance` meters from where it leaves the portal, in seconds; too thick for the air to slow it down. `BloodSpray` lets it fall the same way on the GPU. */
export function pourFall(distance: number) {
  const {speed} = bloodPour
  return (Math.sqrt(speed * speed + 2 * gravity * Math.max(distance, 0)) - speed) / gravity
}

/** How much a beat’s surge has brought out `seconds` after it started, against its strength: `BloodSpray` swells it by `swell` and ebbs it by `ebb` per second. */
export function surgeVolume(seconds: number) {
  const {ebb, swell} = bloodPour.surge
  const since = Math.max(seconds, 0)
  return (1 - Math.exp(-ebb * since)) / ebb - (1 - Math.exp(-(swell + ebb) * since)) / (swell + ebb)
}

/** How much of the pour had left the portal `seconds` after the result flipped out: the trickle and every beat’s surge so far, as `BloodSpray` lets it flow, in seconds at a flow of 1. */
function poured(seconds: number) {
  const {flowing: [from, to], trickle} = bloodPour
  const left = Math.min(Math.max(seconds, from), to)
  return trickle * (left - from) + bloodBeats.reduce((sum, {at, strength}) => sum + strength * surgeVolume(left - at - from), 0)
}

/** how much the whole pour brings, as {@link poured} measures it */
export const pourTotal = poured(bloodPour.flowing[1])

/** How much of the pour had left the portal `seconds` after the result flipped out, 0–1. `BloodSpray` fills the pool by it once that blood came down. */
export function pourVolume(seconds: number) {
  return poured(seconds) / pourTotal
}

/** Where and when the pour strikes a floor `floor` meters below the portal’s middle (negative), as `pourFall` has it fall. */
export function bloodPouring(floor: number): BloodPouring {
  const {flowing: [from, to], start} = bloodPour
  const fall = pourFall(start[1] - floor - splatLift)
  return {
    from: from + fall,
    to: to + fall,
    spot: [start[0], floor, start[2]],
    surges: bloodBeats.filter(({at}) => at + from < to).map(({at, strength}) => ({
      at: at + from + fall,
      strength,
    })),
  }
}

/**
 * A wound’s arterial spurts out of the portal on three beats of a racing heart: each a narrow, pulsing jet that swells and ebbs within a fifth of a second and breaks up into drops, mostly fine and a few thick, among a spray of drops and a mist of specks, while the stream pours straight down out of the portal’s bottom and drips fall after it, into the pool gathering under it, which comes first, so everything else lies on top of it, and the stream right after it.
 */
export const bloodDrops: ReadonlyArray<BloodDrop> = [
  {
    kind: 'pool',
    delay: bloodPour.flowing[0],
    hang: 0,
    start: [bloodPool.center[0], 0, bloodPool.center[1]],
    velocity: [0, 0, 0],
    size: 0,
    phase: 0.41,
  },
  {
    kind: 'pour',
    delay: bloodPour.flowing[0],
    hang: 0,
    start: bloodPour.start,
    velocity: [0, -bloodPour.speed, 0],
    size: bloodPour.width,
    phase: 0.67,
  },
  ...bloodBeats.flatMap(({at, strength}, beat): Array<BloodDrop> => {
    const seed = beat * 0.237
    const aim = [between(beat, 0.43, -0.45, 0.45), between(beat, 0.19, 1.1, 1.6), between(beat, 0.71, 2.6, 3.1)]
    const jet = Array.from({length: Math.round(110 * strength)}, (_, index): BloodDrop => {
      const share = sequence(index * 3, seed + 0.41)
      // The pressure swells and ebbs within the beat.
      const pressure = Math.sin(Math.PI * share) ** 0.6 * (0.6 + strength * 0.4)
      const scatter = 0.06
      return {
        kind: 'drop',
        delay: at + share * 0.2,
        hang: 0,
        start: [between(index * 5, seed + 0.13, -0.015, 0.015) + aim[0] * 0.02, between(index * 7, seed + 0.59, -0.015, 0.015), 0.05],
        velocity: [aim[0] * pressure + between(index * 11, seed + 0.31, -scatter, scatter) * aim[2], aim[1] * pressure + between(index * 13, seed + 0.67, -scatter, scatter) * aim[2], aim[2] * pressure],
        // mostly fine, now and then thick, as a jet breaks up
        size: 0.007 + sequence(index * 17, seed + 0.07) ** 3 * 0.03,
        phase: sequence(index * 19, seed + 0.83),
      }
    })
    const spray = Array.from({length: Math.round(70 * strength)}, (_, index): BloodDrop => ({
      kind: 'drop',
      delay: at + between(index * 3, seed + 0.23, 0, 0.12),
      hang: 0,
      start: [between(index * 5, seed + 0.67, -0.05, 0.05), between(index * 7, seed + 0.29, -0.05, 0.05), 0.05],
      velocity: [between(index * 11, seed + 0.53, -1.3, 1.3) * strength, between(index * 13, seed + 0.17, 0, 2.2) * strength, between(index * 17, seed + 0.89, 0.8, 2.8) * strength],
      size: 0.005 + sequence(index * 19, seed + 0.37) ** 3 * 0.026,
      phase: sequence(index * 23, seed + 0.11),
    }))
    const mist = Array.from({length: Math.round(32 * strength)}, (_, index): BloodDrop => ({
      kind: 'mist',
      delay: at + between(index * 3, seed + 0.61, 0, 0.18),
      hang: 0,
      start: [between(index * 5, seed + 0.07, -0.04, 0.04), between(index * 7, seed + 0.79, -0.04, 0.04), 0.05],
      velocity: [aim[0] * 0.8 + between(index * 11, seed + 0.47, -0.9, 0.9), aim[1] * 0.8 + between(index * 13, seed + 0.03, -0.6, 0.6), aim[2] * between(index * 17, seed + 0.97, 0.4, 0.9)],
      size: between(index * 19, seed + 0.53, 0.0005, 0.001),
      phase: sequence(index * 23, seed + 0.31),
    }))
    return [...jet, ...spray, ...mist]
  }),
  ...[[1.9, -0.04, 0.014], [2.45, 0.07, 0.011], [3.1, 0.01, 0.013]].map(([delay, along, size], index): BloodDrop => ({
    kind: 'drop',
    delay,
    hang: 0.45,
    start: [bloodPour.start[0] + along, bloodPour.start[1], bloodPour.start[2] - 0.04],
    velocity: [0, -0.05, 0.03],
    size,
    phase: 0.3 + index * 0.27,
  })),
]

/** Where and when the drops strike a floor `floor` meters below the portal’s middle (negative), as `bloodLanding` has them fall; the mist settles without a sound. */
export function bloodSplats(drops: ReadonlyArray<BloodDrop>, floor: number): Array<BloodSplat> {
  return drops.filter(drop => drop.kind === 'drop').map(drop => {
    const {along, landing, speed} = bloodLanding(drop, floor)
    return {
      along,
      at: drop.delay + landing,
      // These drops are thinner than the sound’s splats expect, which it hears by their size.
      size: drop.size * 2.4,
      speed,
    }
  })
}

/**
 * Where the blood reaches from `since` seconds after the result flipped out until it is gone, above a floor `floor` meters below the portal’s middle (negative), as points from the portal’s middle: every drop’s flight down to where it strikes and its stain round that, stretched the flatter it struck, until the stain has faded, the mist until it settled away, the pour while it flows and the pool at its widest until it is drained.
 */
export function bloodExtent(drops: ReadonlyArray<BloodDrop>, floor: number, since = 0): Array<PortalOffset> {
  const ground = floor + splatLift
  const [along, out] = bloodPool.center
  const widest = bloodPool.radius * (1 + bloodPool.creep.share)
  const pool = since < bloodPool.draining.start + bloodPool.draining.seconds ? Array.from({length: 24}, (_, index): PortalOffset => [along + Math.cos(index / 24 * Math.PI * 2) * widest, ground, out + Math.sin(index / 24 * Math.PI * 2) * widest]) : []
  const {flowing: [, stops], drying, start} = bloodPour
  const pour: Array<PortalOffset> = since < stops + drying + pourFall(start[1] - ground) ? [start, [start[0], ground, start[2]]] : []
  const flights = drops.filter(drop => drop.kind === 'drop' || drop.kind === 'mist').flatMap(drop => {
    const {landing} = bloodLanding(drop, floor)
    const flown = Math.max(0, since - drop.delay)
    if (drop.kind === 'mist') {
      // It has settled away by then.
      return moments(flown, landing * 0.6, 6).map(seconds => bloodFlight(drop, seconds).offset)
    }
    // Its stain fades by its own share of the stagger, as `BloodSpray` fades it.
    const faded = bloodFading.start + bloodFading.stagger * drop.phase + bloodFading.duration
    if (since > faded) {
      return []
    }
    const path = moments(Math.min(flown, landing), landing, 8).map(seconds => bloodFlight(drop, seconds).offset)
    // Its stain, as wide as `BloodSpray` spreads it by how fast it struck and stretched by how flat
    const {velocity} = bloodFlight(drop, landing)
    const speed = Math.hypot(...velocity)
    const elongation = 1 / Math.max(Math.abs(velocity[1]) / Math.max(speed, 0.0001), 0.28)
    const reach = drop.size * (speed * 0.45 + 2.2) / 2 * (elongation + 1)
    const [x, , z] = path.at(-1)!
    return [...path, [x - reach, ground, z], [x + reach, ground, z], [x, ground, z - reach], [x, ground, z + reach]] satisfies Array<PortalOffset>
  })
  return [...pool, ...pour, ...flights]
}
