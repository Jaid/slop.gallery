import type {PortraitFrameId} from '#src/lib/frames/frameParameter.ts'
import type {Quat, Vec3} from '#src/lib/gallery/types.ts'
import type {Shot, Timeline} from './fusionCamera.ts'

import {clamp} from 'math'

import {add, cross, dot, ease, length, mix, mix3, normalize, radians, scale, sub} from './fusionCamera.ts'

/** what the end of a film shows: whatever the camera’s path shows, the ingredient’s effect round the portal, or the result lying on the floor */
export type Emphasis = typeof emphases[number]
/** a sample of the result’s flight, from the probe */
export type ResultSample = {
  position: Vec3
  quaternion: Quat
  time: number
}
/** how the result came to rest, from the probe */
export type Landing = {
  /** the frame it wears, unless the default one */
  frame?: PortraitFrameId
  height: number
  /** the middle of its frame */
  position: Vec3
  quaternion: Quat
  /** seconds into the film it lies still from */
  settled: number
  /** its flight, from the moment it flipped out */
  track: ReadonlyArray<ResultSample>
  width: number
}
/** what --emphasis party has to keep in view from a moment of the film on: where the ingredient’s effect still reaches and the portal’s rim while it glows */
export type PartyView = {
  points: Array<Vec3>
  /** seconds into the film */
  time: number
}
/** a shot --emphasis party frames points with */
export type PartyFraming = {
  /** how far the camera looks down at them, in degrees, up where negative */
  elevation: number
  points: Array<Vec3>
}
/** how --emphasis party ends a film, a moment after the ingredient’s effect is over: looking at everything it reaches round the portal from just far enough to see all of it, then pushing in once, calmly, on the party as it settles, drifting round it a little all the while */
export type PartyClosing = {
  /** the width of the film over its height */
  aspect: number
  /** the party once it has settled */
  close: PartyFraming
  /** how far round the camera drifts over the closing, in degrees, counterclockwise seen from above */
  drift: number
  fov: number
  /** the horizontal direction from the points toward the camera halfway through its drift */
  from: Vec3
  kind: 'party'
  /** seconds the film goes on after the result flipped out: until the effect is over and a moment longer, unless it was told its end */
  lasts: number
  /** seconds into the film the camera pushes in from the wide shot to the close one, which it holds from the result flipping out on unless there is no time to push in without losing sight of anything still to come */
  move?: {
    from: number
    to: number
  }
  /** what it has to keep in view, from moment to moment, ever less, which the push in never loses sight of */
  views: Array<PartyView>
  /** everything the party reaches, from the result flipping out on */
  wide: PartyFraming
}

/** how --emphasis result ends a film: following the result down and craning up over it once it lies still, until the last frame looks straight at its image, upright, which fills the view as when viewing a hung portrait with V */
export type ResultClosing = {
  /** how it ends: straight in front of the image, as far from its middle as it takes the image to fill the view at the field of view */
  aligned: {
    distance: number
    fov: number
  }
  /** the side the camera looks down from while the result falls, at right angles to its front: that of its bottom edge, so it stands upright in the view, or above it, should it stand */
  approach: Vec3
  /** the middle of its image as it lies still */
  center: Vec3
  /** how far from the middle of the image the camera looks down on it from while it falls */
  distance: number
  /** how far over the image’s plane the camera looks down on it from while it falls, in degrees */
  elevation: number
  /** the field of view while it falls */
  fov: number
  kind: 'result'
  landing: Landing
  /** the front of its image as it lies still, or its back, should it lie face down */
  normal: Vec3
  /** the top of its image as it lies still, at right angles to its front */
  top: Vec3
}
/** how the emphasis ends a film, which takes over from the camera’s path as the result flips out */
export type Closing = PartyClosing | ResultClosing

export const emphases = ['neutral', 'party', 'result'] as const

/** The horizontal direction turned `degrees` counterclockwise round the world’s up, seen from above. */
export const turnedAboutUp = ([x, y, z]: Vec3, degrees: number): Vec3 => {
  const [cos, sin] = [Math.cos(radians(degrees)), Math.sin(radians(degrees))]
  return [x * cos + z * sin, y, z * cos - x * sin]
}

/** The points of the cloud that lie outermost toward any of `directions` evenly spread directions, which hold it as well as its hull, however many it has. */
export function outermost(points: ReadonlyArray<Vec3>, directions = 160): Array<Vec3> {
  const kept = new Set<Vec3>
  for (let index = 0; index < directions && points.length; index++) {
    const y = 1 - 2 * (index + 0.5) / directions
    const ring = Math.sqrt(1 - y * y)
    const angle = index * Math.PI * (3 - Math.sqrt(5))
    const direction: Vec3 = [Math.cos(angle) * ring, y, Math.sin(angle) * ring]
    let reach = Number.NEGATIVE_INFINITY
    let farthest = points[0]
    for (const point of points) {
      const along = dot(point, direction)
      if (!(along > reach)) {
        continue
      }
      reach = along
      farthest = point
    }
    kept.add(farthest)
  }
  return [...kept]
}

/** how far into the view the points of a fitted shot keep from its edges: within this share of the way from its middle to them */
const fitFill = 0.9
/** how far the camera of a fitted shot keeps in front of the nearest point, in meters */
const nearest = 0.3

/**
 * The shot that looks along `look` at all of the points from as close as it can, each of them within `fill` of the way from the middle of the view to its edges, at the vertical field of view `fov` of a film `aspect` times as wide as it is high: the camera stands where the sides of its view, pulled in to that, touch the outermost points, in the middle between those of the other pair of sides.
 * It looks at the points’ middle and never rolls.
 */
export function fitShot(points: ReadonlyArray<Vec3>, look: Vec3, fov: number, aspect: number, fill = fitFill): Shot {
  const forward = normalize(look)
  const right = normalize(cross(forward, [0, 1, 0]))
  const up = cross(right, forward)
  const vertical = Math.tan(radians(fov / 2)) * fill
  const horizontal = vertical * aspect
  // Each side of the view bounds where the camera may stand by the point furthest out toward it.
  let [left, rightmost, bottom, top] = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]
  let closest = Number.POSITIVE_INFINITY
  for (const point of points) {
    const [x, y, z] = [dot(point, right), dot(point, up), dot(point, forward)]
    left = Math.max(left, x - horizontal * z)
    rightmost = Math.min(rightmost, x + horizontal * z)
    bottom = Math.max(bottom, y - vertical * z)
    top = Math.min(top, y + vertical * z)
    closest = Math.min(closest, z)
  }
  const depth = Math.min((rightmost - left) / (2 * horizontal), (top - bottom) / (2 * vertical), closest - nearest)
  const position = add(add(scale(right, (left + rightmost) / 2), scale(up, (bottom + top) / 2)), scale(forward, depth))
  const middle = scale(points.reduce(add, [0, 0, 0]), 1 / points.length)
  return {
    position,
    target: add(position, scale(forward, Math.max(dot(sub(middle, position), forward), nearest))),
    fov,
    roll: 0,
  }
}

/** The shot of --emphasis party that looks at the framing’s points from `from` turned `swing` degrees round and down by its elevation, see {@link fitShot}. */
export function partyFraming({aspect, fov, from}: Pick<PartyClosing, 'aspect' | 'fov' | 'from'>, {elevation, points}: PartyFraming, swing: number) {
  const horizontal = turnedAboutUp(from, swing)
  const down = radians(elevation)
  return fitShot(points, [-horizontal[0] * Math.cos(down), -Math.sin(down), -horizontal[2] * Math.cos(down)], fov, aspect)
}

/** How far round --emphasis party has drifted `time` seconds into the film, in degrees: from half its drift one way as the result flipped out to half of it the other way at the end of the film. */
export const partySwing = ({drift}: Pick<PartyClosing, 'drift'>, time: number, {emergence, end}: Pick<Timeline, 'emergence' | 'end'>) => drift * (ease((time - emergence) / (end - emergence)) - 0.5)

/** What --emphasis party has to keep in view `time` seconds into the film: the last view that began by then, or the first before it. */
export const partyView = ({views}: Pick<PartyClosing, 'views'>, time: number) => views[Math.max(0, views.findLastIndex(view => view.time <= time))]

/** How far --emphasis party has pushed in from its wide shot to its close one `time` seconds into the film, from 0 to 1. */
export const partyPush = ({move}: Pick<PartyClosing, 'move'>, time: number) => (move ? ease((time - move.from) / (move.to - move.from)) : 0)

/** The closing shot of --emphasis party `time` seconds into the film: its wide shot, pushing in on its close one once, both drifting round. */
export function partyShot(closing: PartyClosing, time: number, timeline: Pick<Timeline, 'emergence' | 'end'>): Shot {
  const swing = partySwing(closing, time, timeline)
  const wide = partyFraming(closing, closing.wide, swing)
  const close = partyFraming(closing, closing.close, swing)
  const push = partyPush(closing, time)
  return {
    position: mix3(wide.position, close.position, push),
    target: mix3(wide.target, close.target, push),
    fov: closing.fov,
    roll: 0,
  }
}

/** Whether the point shows within `share` of the way from the middle of the view of the unrolled shot to its edges, at the vertical field of view of the shot in a film `aspect` times as wide as it is high. */
export function seenWithin({fov, position, target}: Shot, point: Vec3, aspect: number, share: number) {
  const forward = normalize(sub(target, position))
  const right = normalize(cross(forward, [0, 1, 0]))
  const up = cross(right, forward)
  const offset = sub(point, position)
  const depth = dot(offset, forward)
  const reach = Math.tan(radians(fov / 2)) * share * depth
  return depth > 0 && Math.abs(dot(offset, right)) <= reach * aspect && Math.abs(dot(offset, up)) <= reach
}

/** Where the result is `time` seconds into the film, smoothed a little so the camera follows its flight calmly, or undefined before it flipped out. */
export function followResult(track: ReadonlyArray<ResultSample>, time: number) {
  if (!track.length || time < track[0].time) {
    return
  }
  const at = (moment: number): Vec3 => {
    const index = track.findLastIndex(sample => sample.time <= moment)
    const from = track[Math.max(0, index)]
    const to = track[Math.min(track.length - 1, index + 1)]
    return to.time > from.time ? mix3(from.position, to.position, clamp((moment - from.time) / (to.time - from.time), 0, 1)) : from.position
  }
  // a little behind its flight, averaged over a fifth of a second
  const taps = 9
  return scale(Array.from({length: taps}, (_, index) => at(Math.max(track[0].time, time - 0.2 * index / (taps - 1)))).reduce(add), 1 / taps)
}

/** The look of a camera at `position` looking at `target`, and its right and its up with the horizon level. */
const levelView = (position: Vec3, target: Vec3) => {
  const look = normalize(sub(target, position))
  const right = normalize(cross(look, [0, 1, 0]))
  return {
    look,
    right,
    up: cross(right, look),
  }
}

/** The roll in degrees that turns the top of the view of a camera at `position` looking at `target` toward `up`, from where it would be with the horizon level. */
export function rollToward(position: Vec3, target: Vec3, up: Vec3) {
  const {look, right, up: level} = levelView(position, target)
  const wanted = sub(up, scale(look, dot(up, look)))
  // as holdPoint rolls the camera’s up: its level up turned toward its left
  return Math.atan2(-dot(wanted, right), dot(wanted, level)) * 180 / Math.PI
}

/** how close to straight in front of the image the crane of --emphasis result ends, in radians, short of where the horizon’s level would be undefined for an image lying perfectly flat */
const square = Math.PI / 2 - 1e-6

/**
 * The closing shot of --emphasis result `time` seconds into the film: while the result falls, it looks down on where it will lie from the side of its bottom edge, following it with its look, then cranes up over it, pushing in and turning it upright, until the end of the film looks straight at its image, which fills the view.
 */
export function resultShot(closing: ResultClosing, time: number, {end}: Pick<Timeline, 'end'>): Shot {
  const {aligned, approach, center, landing, normal, top} = closing
  const {settled} = landing
  const crane = ease((time - settled) / Math.max(end - settled, 1e-3))
  const elevation = mix(radians(closing.elevation), square, crane)
  const position = add(center, scale(add(scale(approach, Math.cos(elevation)), scale(normal, Math.sin(elevation))), mix(closing.distance, aligned.distance, crane)))
  // It follows the result’s flight with its look from where it flips out until it lies still, then settles on the middle of its image.
  const flown = followResult(landing.track, time) ?? landing.track.at(0)?.position ?? center
  const settling = ease((time - settled) / Math.max(Math.min(1, (end - settled) / 2), 1e-3))
  const target = mix3(flown, center, settling)
  // The horizon stays level while it follows the result and as it cranes up, the image’s top ahead, measured round the image once it looks at it, where the horizon gives out as it looks ever more straight down; then the image turns upright in the view, should the room have kept the camera from its bottom edge.
  const start = radians(closing.elevation)
  const side = Math.sign(sub(scale(normal, Math.cos(start)), scale(approach, Math.sin(start)))[1]) || 1
  const level = scale(sub(scale(normal, Math.cos(elevation)), scale(approach, Math.sin(elevation))), side)
  return {
    position,
    target,
    fov: mix(closing.fov, aligned.fov, crane),
    roll: rollToward(position, target, mix3(levelView(position, target).up, mix3(level, top, crane), settling)),
  }
}

/** How far the closing of the emphasis has taken over from the camera’s path `time` seconds into the film, from 0 to 1: where the camera stands, how wide it looks and how it rolls, and what it looks at, which the result’s closing turns to follow at once as it flips up out of the portal. */
export function closingWeight(closing: Closing, time: number, {emergence, end}: Pick<Timeline, 'emergence' | 'end'>) {
  if (closing.kind === 'party') {
    const weight = ease((time - emergence - 0.1) / 2.2)
    return {
      position: weight,
      target: weight,
    }
  }
  // Over the result, the camera only sets off once it has risen to the top of its flip, so it never flies into it, and has taken over well before the end.
  const span = Math.min(clamp(closing.landing.settled - emergence + 0.5, 2.6, 4), Math.max(end - emergence - 1, 0.5))
  return {
    position: ease((time - emergence - 0.5) / span),
    target: ease((time - emergence) / 0.45),
  }
}

/**
 * The shot `time` seconds into the film as the emphasis’ closing ends it: the camera’s path, `base`, until the result flips out, from where the closing takes over, without one the path all along.
 * `hold` shakes and sways the party’s closing shot as the path is held by hand; the result’s is steady, so its last frame looks straight at its image.
 */
export function emphasized(base: Shot, closing: Closing | undefined, time: number, timeline: Pick<Timeline, 'emergence' | 'end'>, hold: (shot: Shot) => Shot = shot => shot): Shot {
  if (!closing || time <= timeline.emergence) {
    return base
  }
  const weight = closingWeight(closing, time, timeline)
  if (!weight.position && !weight.target) {
    return base
  }
  const closed = closing.kind === 'party' ? hold(partyShot(closing, time, timeline)) : resultShot(closing, time, timeline)
  return {
    position: mix3(base.position, closed.position, weight.position),
    target: mix3(base.target, closed.target, weight.target),
    fov: mix(base.fov, closed.fov, weight.position),
    roll: mix(base.roll, closed.roll, weight.position),
  }
}

/** how far the camera of a shot is from what it looks at, in meters */
export const shotReach = (shot: Shot) => length(sub(shot.target, shot.position))
