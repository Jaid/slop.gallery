import type {Vec3} from '../types.ts'
import type GatheringMotes from './GatheringMotes.ts'
import type RealityWarp from './RealityWarp.ts'
import type {FusionTiming} from './timing.ts'

import {clamp, fade} from 'math'

/**
 * How a fusion opens, once and never looped, over its first {@link FusionTiming.intro} seconds. Its moments are choreographed in seconds of a {@link choreographed}-second intro and stretch with the timing’s.
 *
 * A singularity tears open in front of the work and sucks at everything around it: a wide stretch of the room bends toward it, twisting like water down a drain and darkening, while the work is torn from its wall and what was thrown into it is dragged along. Full, it collapses and bursts, the room snaps back like jelly and the burst knocks everything loose into the air.
 * The light it flung out streams back in and kindles an ember, which beats like a heart: each beat yanks an ingredient into place beside the ember, the work first, each surfacing in the ember as it arrives, and a last beat ignites the ember into the portal and sets them circling it.
 * At that, the portal lashes a tether out to each and whirls them around itself like a hammer thrower, ever faster and a little pulled in, until the comet trails of fire they leave behind close into a ring around it while the room swirls along. At full speed it lets go: they coast on out into their orbit, two laps further along, while the ring of fire falls into the portal and lands just as the intro ends with a blaze, a shockwave and a burst of sparks, the room rippling out from it, which knocks them out along the wall, from where they drift back into their orbit.
 *
 * It keeps the {@link pulse} of the whole fusion, three of them long: the burst falls on the first, the ignition on the second and the landing on the third, after which the images take their turns on it. The ember’s beats divide the pulse between the burst and the ignition evenly, one for each ingredient: a triplet for two, sixteenths for three, a quintuplet for four.
 *
 * The portal’s envelope, the satellites’ orbit and the fusion’s sound play their parts of it; this module holds its moments and drives the warp, the motes, the tethers and the trails.
 */
export const choreographed = 4.5
/** the pulse every moment of the intro falls on, a third of it */
export const pulse = choreographed / 3
/** when the singularity, full, collapses and bursts: on the first pulse */
export const implosion = pulse
/** when the ember’s last beat ignites the portal: on the second pulse */
export const ignition = 2 * pulse
/** when the pull tears each satellite loose and drags it in, in the order of their ingredients */
export const drags = [0.2, 0.35, 0.5, 0.65] as const
/** how much of its way to the singularity the pull drags a satellite before the burst */
export const dragged = 0.62
/** when the motes start streaming back in and when the last of them is in */
export const gathering = [implosion + 0.05, implosion + 0.8] as const
/** how long after its beat the ember yanks its satellite in */
export const yank = 0.1
/** how long a tether takes to lash out to its satellite */
const lunge = 0.06
/** when the portal starts whirling them around it: as the last beat ignites it */
export const whirl = ignition
/** when it lets go of them at full speed, which leaves the ring of fire to fall into it until the intro ends */
export const release = 4.2
/** how long the room wobbles like jelly after the burst */
const wobble = 1.35

/** the ember’s heartbeat for a number of ingredients */
export type EmberRhythm = {
  /** when the ember beats: once for each ingredient, yanking it in, and a last time igniting the portal */
  beats: ReadonlyArray<number>
  /** how long after each beat its second, softer thump follows */
  dub: number
  /** when each ingredient shows in the ember, from its beat, whose bell rings with the beat, to the next */
  turns: ReadonlyArray<readonly [number, number]>
}
const rhythms = new Map<number, EmberRhythm>
/** The ember’s heartbeat for `ingredients` ingredients: their beats and the ignition divide the pulse after the burst evenly, so each count has a tuplet of the pulse. */
export function emberRhythm(ingredients: number): EmberRhythm {
  let rhythm = rhythms.get(ingredients)
  if (!rhythm) {
    const step = pulse / (ingredients + 1)
    const beats = [...Array.from({length: ingredients}, (_, index) => implosion + (index + 1) * step), ignition]
    rhythm = {
      beats,
      dub: Math.min(0.2, step * 0.4),
      turns: beats.slice(0, -1).map((beat, index) => [beat, beats[index + 1]] as const),
    }
    rhythms.set(ingredients, rhythm)
  }
  return rhythm
}

/** when the portal lashes a tether out to satellite `index`, the work’s first, as the last beat ignites it */
export function grab(index: number) {
  return ignition + 0.03 * index
}

/** how many extra laps the whirl adds to the orbit */
export const laps = 2
/** how the whirl speeds up until the release: as the time since it began to this power, which keeps it slow at first and gathers speed ever faster toward the release */
const rise = 2
/** how fast the whirl peaks, in radians per second of the choreography, so that it adds exactly its {@link laps} by the time the satellites have slowed back to the orbit’s speed as the intro ends */
const whirlPeak = laps * 2 * Math.PI / ((release - whirl) / (rise + 1) + (choreographed - release) / 2)
/** the longest the trails grow, in radians of the orbit: two of them nearly close the ring */
const longestTrail = 2.8
/** how long the room ripples on after the ring of fire landed, in seconds of the choreography */
const aftershock = 0.9
/** how long the satellites take after the last beat to come up to the orbit’s speed */
export const departure = choreographed - ignition
/** how far the view bends around the singularity, in meters */
const warpReach = 4.6
/** how much faster than their own clock the motes stream back in, which takes them about 1.4 s */
const moteRush = 1.85

/** seconds into the choreography, `elapsed` real seconds into the fusion */
export function introClock(elapsed: number, {intro}: Pick<FusionTiming, 'intro'>) {
  return elapsed * choreographed / intro
}

/** real seconds into the fusion of a moment `seconds` into the choreography */
export function introSeconds(seconds: number, {intro}: Pick<FusionTiming, 'intro'>) {
  return seconds * intro / choreographed
}

/** radians the whirl has added to the orbit `t` seconds into the choreography: speeding up ever harder until the release, coasting back to the orbit’s speed after it, exactly its {@link laps} in all */
export function whirled(t: number) {
  if (t <= whirl) {
    return 0
  }
  const up = Math.min(t, release) - whirl
  let angle = whirlPeak * (release - whirl) * (up / (release - whirl)) ** (rise + 1) / (rise + 1)
  if (t > release) {
    const coast = clamp((t - release) / (choreographed - release), 0, 1)
    angle += whirlPeak * (choreographed - release) * (coast - (coast ** 6 - 3 * coast ** 5 + 2.5 * coast ** 4))
  }
  return angle
}

/** how fast the whirl turns `t` seconds into the choreography, as a share of its peak */
export function whirling(t: number) {
  if (t <= whirl) {
    return 0
  }
  if (t <= release) {
    return ((t - whirl) / (release - whirl)) ** rise
  }
  return 1 - fade(clamp((t - release) / (choreographed - release), 0, 1))
}

/** radians per second the whirl adds to the orbit `elapsed` seconds into the fusion */
export function whirlRate(elapsed: number, timing: FusionTiming) {
  return whirlPeak * whirling(introClock(elapsed, timing)) * choreographed / timing.intro
}

/** how far the ring of fire has fallen into the portal `t` seconds into the choreography, from 0 until the release to 1 as the intro ends */
export function ringFall(t: number) {
  return fade(clamp((t - release) / (choreographed - release), 0, 1))
}

/** Drives the warp and the motes `elapsed` seconds into the fusion, showing each only while it plays. */
export function decorateIntro({motes, warp}: {
  motes: GatheringMotes
  warp: RealityWarp
}, elapsed: number, timing: FusionTiming, normal: Vec3) {
  const t = introClock(elapsed, timing)
  warp.visible = t < implosion + wobble || t > whirl && t < choreographed + aftershock
  if (warp.visible) {
    const {chroma, darkness, front, pull, reach, ripple, twist} = warp.uniforms
    reach.value = warpReach
    if (t < implosion) {
      // The pull grows ever faster and shudders; the view twists and darkens toward the middle.
      const grip = clamp((t - 0.04) / (implosion - 0.04), 0, 1)
      pull.value = 2.7 * grip ** 1.6 + 0.09 * Math.sin(t * 61) * grip
      twist.value = 2.6 * grip ** 2
      darkness.value = 0.92 * grip ** 1.4
      chroma.value = 0.06 * grip
      ripple.value = 0
      front.value = 0
    } else if (t < implosion + wobble) {
      // The room snaps back, overshoots and wobbles like jelly, while a ripple runs out over it.
      const after = t - implosion
      pull.value = -0.85 * Math.exp(-after * 4.2) * Math.cos(after * 15)
      twist.value = 2.6 * Math.exp(-after * 9) * Math.cos(after * 11)
      darkness.value = 0.92 * Math.exp(-after * 30)
      chroma.value = 0.09 * Math.exp(-after * 3)
      ripple.value = 0.07 * Math.exp(-after * 2)
      front.value = after * 1.3
    } else if (t < choreographed) {
      // The room swirls along with the whirl and is sucked in after the ring of fire.
      const speed = whirling(t)
      const fall = ringFall(t)
      twist.value = 1.5 * speed
      pull.value = 0.3 * speed + 0.6 * fall
      darkness.value = 0.25 * speed + 0.35 * fall
      chroma.value = 0.05 * speed + 0.05 * fall
      ripple.value = 0
      front.value = 0
    } else {
      // The ring of fire lands: the room jolts and ripples out from it.
      const landed = t - choreographed
      twist.value = 0
      pull.value = 0.6 * Math.exp(-landed * 30) - 0.4 * Math.exp(-landed * 5) * Math.sin(landed * 14 + 0.2)
      darkness.value = 0.35 * Math.exp(-landed * 30)
      chroma.value = 0.1 * Math.exp(-landed * 3.5)
      ripple.value = 0.11 * Math.exp(-landed * 2.2) * (1 - fade(clamp((landed - 0.6) / (aftershock - 0.6), 0, 1)))
      front.value = landed * 1.8
    }
  }
  const streaming = (t - gathering[0]) * moteRush
  motes.visible = streaming > 0 && streaming < 1.45
  if (motes.visible) {
    motes.uniforms.clock.value = streaming
    motes.uniforms.energy.value = 1
    motes.uniforms.normal.value.fromArray(normal)
  }
}

/**
 * How the tether of satellite `index` holds it `elapsed` seconds into the fusion, or nothing once it let go: it lashes out from the portal with a flash, grips the satellite with a glowing knot and holds taut while it whirls it, ever brighter and thicker, then lets go at the release and whips back in.
 * `reach` is how far out toward the satellite its knot is, from 0 at the portal’s middle, and `flow` how far the beads have run, in radians of their pattern.
 */
export function introTether(index: number, elapsed: number, timing: FusionTiming) {
  const t = introClock(elapsed, timing)
  const grabbed = t - grab(index)
  const letGo = clamp((t - release) / 0.07, 0, 1)
  if (grabbed < 0 || letGo >= 1) {
    return
  }
  const speed = whirling(t)
  return {
    flow: 9 * (grabbed + 2 * grabbed ** 2),
    glow: 1 + 1.6 * Math.exp(-grabbed * 16) + 0.9 * speed + 1.5 * letGo,
    knot: 0.8 + 0.6 * speed,
    reach: fade(clamp(grabbed / lunge, 0, 1)) * (1 - letGo),
    slack: grabbed < lunge ? 1 : 0.06 + 1.4 * letGo,
    width: 0.55 + 0.25 * speed,
  }
}

/**
 * How the trail of fire behind satellite `index` blazes `elapsed` seconds into the fusion, or nothing outside the whirl: it follows the satellite on the orbit, as long as the way it whirled, and once the satellite is let go falls into the portal as a ring of fire, landing there as the intro ends.
 * `length` is how many radians of the orbit it covers and `reach` how far out it lies, as a share of the satellite’s distance from the portal’s middle.
 */
export function introTrail(index: number, elapsed: number, timing: FusionTiming) {
  const t = introClock(elapsed, timing)
  if (t < grab(index) || t >= choreographed) {
    return
  }
  const speed = whirling(t)
  const fall = ringFall(t)
  return {
    energy: fade(clamp((t - whirl) / 0.1, 0, 1)) * (0.6 + 2.2 * speed + 2.2 * fall),
    length: Math.min(longestTrail, whirled(t)),
    reach: 1 - fall,
    width: 0.8 + 0.6 * speed + 0.8 * fall,
  }
}
