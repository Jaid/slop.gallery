import {clamp, fade} from 'math'

import {frameBack} from '#src/frames/base/PortraitFrame.ts'

import portraitLabel from './portraitLabel.ts'

/** how a placard rolls to show its new text, a cartoon’s flick: it winds up, is flung off its wall spinning, slams back onto it and wobbles out */
export const placardRoll = {
  /** the whole turns it rolls round its long axis, its top coming toward the viewer first */
  turns: 3,
  /** how far it tips its top back toward the wall to wind up, in radians, and how long that takes, in seconds */
  windup: {
    angle: 0.35,
    duration: 0.14,
  },
  /** how long the spin takes once flicked, in seconds, and how quickly it slows down, per second, which sets how hard the flick starts it: 3 turns at about 13 turns per second */
  spin: {
    duration: 0.75,
    drag: 4,
  },
  /** the swing past the end of the last turn and back, which the spin’s leftover speed sets off: its frequency in radians per second and how quickly it dies away, per second */
  wobble: {
    frequency: 11,
    decay: 4.5,
  },
  /** how far the flick flings it off its wall, in meters, how long it stays off, in seconds, and how much of that it bounces back off the wall with */
  fling: {
    height: 0.35,
    time: 0.72,
    restitution: 0.3,
  },
  /** how much it hops up as it is flung, against how far it is flung off */
  hop: 0.15,
  /** how far it rocks in the wall’s plane from the off-center flick, in radians, at what frequency, in radians per second, and how quickly that dies away, per second */
  rock: {
    angle: 0.12,
    frequency: 15,
    decay: 3.5,
  },
  /** in seconds */
  duration: 1.6,
  /** how long before its end what is left of the wobble eases out, so it stops right where it hangs */
  settle: 0.25,
  /** how close to its wall any of its edges gets at most, in meters */
  margin: 0.01,
}
const total = placardRoll.turns * 2 * Math.PI
const swept = total + placardRoll.windup.angle
const slowed = 1 - Math.exp(-placardRoll.spin.drag * placardRoll.spin.duration)
/** the spin’s speed as it completes its last turn, which carries it on into the wobble */
const leftover = swept * placardRoll.spin.drag * Math.exp(-placardRoll.spin.drag * placardRoll.spin.duration) / slowed

/** a moment of a roll: seconds after it starts and how fast the placard turns then, in radians per second */
export type PlacardMoment = {
  speed: number
  time: number
}

/** when a rolling placard slams back onto its wall as the fling ends, and when it lands on it again after the bounce, in seconds after the roll starts */
export const placardLandings = {
  slam: placardRoll.windup.duration + placardRoll.fling.time,
  bounce: placardRoll.windup.duration + placardRoll.fling.time * (1 + placardRoll.fling.restitution),
}

/**
 * Every quarter turn of a roll’s spin, the first time it passes each multiple of π/2, in order: the odd ones stand it edge-on to the viewer, the even ones turn its face to the wall or back, the last one being where it hangs as the spin ends.
 * The tenth, where its face points to the wall for the last time, is when its new text goes on.
 */
export function placardQuarters(): Array<PlacardMoment> {
  const {spin, windup} = placardRoll
  const quarters: Array<PlacardMoment> = []
  for (let quarter = 1; ; quarter++) {
    // how much of what the spin slows down by it has used up once it reaches the quarter
    const share = (quarter * Math.PI / 2 + windup.angle) / swept * slowed
    if (share > slowed + 1e-9) {
      return quarters
    }
    const flicked = -Math.log(1 - share) / spin.drag
    quarters.push({
      time: windup.duration + flicked,
      speed: swept * spin.drag * Math.exp(-spin.drag * flicked) / slowed,
    })
  }
}

/** How far a placard turned by `angle` round its x axis must come off where it hangs, so none of it gets nearer than {@link placardRoll.margin} to its wall. */
export function placardClearance(angle: number) {
  const reach = Math.abs(Math.sin(angle)) * portraitLabel.height / 2 + Math.abs(Math.cos(angle)) * portraitLabel.depth / 2
  return Math.max(0, frameBack + placardRoll.margin + reach)
}

/** How far a body thrown off its wall `height` high and back within `time` is off it after `elapsed` seconds, bouncing once more by `restitution`. */
function flung(elapsed: number, {height, time, restitution}: typeof placardRoll.fling) {
  if (elapsed <= 0) {
    return 0
  }
  if (elapsed < time) {
    const share = elapsed / time
    return height * 4 * share * (1 - share)
  }
  const bounce = time * restitution
  if (elapsed < time + bounce) {
    const share = (elapsed - time) / bounce
    return height * restitution ** 2 * 4 * share * (1 - share)
  }
  return 0
}

/**
 * A hung placard rolling round its long axis to show new text: it tips back to wind up, is flicked into {@link placardRoll.turns} quick turns that slow down as it is flung off its wall and falls back, slams onto it, wobbles past the last turn and settles where it hangs.
 * Half a turn before the end of its spin, its face points straight at the wall for the last time: then {@link turned} becomes true, which is when the new text goes on it, unseen.
 * Its sound (`placardVoices`) follows the moments {@link placardQuarters} and {@link placardLandings} work out, so tuning the motion retimes it.
 */
export default class PlacardRoll {
  /** how far it is turned round its x axis, in radians */
  angle = 0
  /** how far it is off where it hangs, straight out of its wall */
  lift = 0
  /** how far it is above where it hangs */
  rise = 0
  /** how far it is rocked round the wall’s normal, in radians, after its roll */
  tilt = 0
  /** whether its face has turned to the wall for the last time, which it stays once it has */
  turned = false
  private elapsed = 0

  /** whether it still moves */
  get running() {
    return this.elapsed < placardRoll.duration
  }

  /** Moves the roll along by `delta` seconds; returns whether it still runs, or else rests where it hangs. */
  update(delta: number) {
    this.elapsed = Math.min(this.elapsed + delta, placardRoll.duration)
    const {duration, fling, hop, rock, settle, spin, windup, wobble} = placardRoll
    const t = this.elapsed
    const flicked = t - windup.duration
    const easing = 1 - fade(clamp((t - duration + settle) / settle, 0, 1))
    if (flicked < 0) {
      this.angle = -windup.angle * fade(t / windup.duration)
    } else if (flicked < spin.duration) {
      // Flicked hard, it slows down as if by drag, just enough to complete its last turn as the spin ends.
      this.angle = -windup.angle + swept * (1 - Math.exp(-spin.drag * flicked)) / slowed
    } else {
      const after = flicked - spin.duration
      this.angle = total + leftover / wobble.frequency * Math.exp(-wobble.decay * after) * Math.sin(wobble.frequency * after) * easing
    }
    if (flicked >= 0 && total - this.angle <= Math.PI) {
      this.turned = true
    }
    const off = flung(flicked, fling)
    // Never so little off its wall that an edge reaches into it.
    this.lift = this.running ? Math.max(off, placardClearance(this.angle)) : 0
    this.rise = hop * off
    this.tilt = flicked > 0 ? rock.angle * Math.exp(-rock.decay * flicked) * Math.sin(rock.frequency * flicked) * easing : 0
    return this.running
  }
}
