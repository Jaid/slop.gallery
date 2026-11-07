import type {PortalOffset} from '../base/portalOffset.ts'

/** what a piece of the blood is: a drop, a speck of the mist that sprays out with the drops, which the air holds up and takes no splat from, or the pool gathering on the floor under the portal */
export const bloodKinds = {
  drop: 0,
  mist: 1,
  pool: 2,
} as const
/** a drop of blood that the portal spurts out as the result flips out or that drips from its bottom afterwards, a speck of its mist, or its pool */
export type BloodDrop = {
  /** seconds after the result flipped out that it leaves the portal, or that the pool starts gathering */
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
 * The pool gathering on the floor under the portal, in seconds after the result flipped out and meters: it swells as the blood of each beat comes down, by the volume the beat brought, and creeps on a little as it settles, until it is sucked back toward its middle ever faster and gone.
 */
export const bloodPool = {
  /** where its middle lies, along the wall and out into the room from the portal’s middle */
  center: [0, 0.4],
  /** its radius once the blood of every beat has come down */
  radius: 0.8,
  /** seconds after a beat that its blood starts and ends coming down into the pool */
  filling: [0.3, 1.1],
  /** how much further it creeps as it settles, a share of its radius, and from when to when */
  creep: {
    share: 0.1,
    start: 1.5,
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

/**
 * A wound’s arterial spurts out of the portal on three beats of a racing heart: each a narrow, pulsing jet that swells and ebbs within a fifth of a second and breaks up into drops, mostly fine and a few thick, among a spray of drops and a mist of specks, while drips fall from the portal after them, into the pool gathering under it, which comes first, so everything else lies on top of it.
 */
export const bloodDrops: ReadonlyArray<BloodDrop> = [
  {
    kind: 'pool',
    delay: bloodBeats[0].at + bloodPool.filling[0],
    hang: 0,
    start: [bloodPool.center[0], 0, bloodPool.center[1]],
    velocity: [0, 0, 0],
    size: 0,
    phase: 0.41,
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
    start: [along, -0.36, 0.06],
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
