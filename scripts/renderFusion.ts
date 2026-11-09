import type {PortraitSlot, Quat, Vec3} from '#src/lib/gallery/types.ts'
import type {PortraitDump} from '#src/lib/webmcp/dumpPortraits.ts'

import {tmpdir} from 'node:os'
import {join, parse, relative, resolve} from 'node:path'
import {parseArgs} from 'node:util'

import fs from 'fs-extra'
import {av1Crf} from 'knot-materials/scripts/lib/encodeAnimation.ts'
import {clamp, fade} from 'math'

import {parseSeed} from '#src/lib/environmentSeed.ts'
import {hangDefaultWorks} from '#src/lib/gallery/defaultPortraits.ts'
import {portalIn} from '#src/lib/gallery/fusion/portalFrame.ts'
import {fusionTiming} from '#src/lib/gallery/fusion/timing.ts'
import {orbRadius, orbs} from '#src/lib/gallery/orbs/index.ts'
import {throwSpeed} from '#src/lib/physics/GrabbableBody.ts'
import {aimThrow, gravity} from '#src/lib/webmcp/throwProp.ts'
import world from '#src/worlds/gallery/index.ts'

import film from './film.ts'
import {galleryHelp, galleryOptions, parseNumbers, repositoryRoot, resolveSettle, serveFile, timestamp} from './lib/headlessGallery.ts'

/** what the closing shot shows: the result lying on the floor, or the ingredient’s effect round the portal */
export type Emphasis = typeof emphases[number]
/** where the camera is and what it looks at, at a moment of the film */
export type Shot = {
  /** vertical field of view in degrees */
  fov: number
  position: Vec3
  /** degrees, positive tilts the camera counterclockwise */
  roll: number
  target: Vec3
}
/** a sample of the result’s flight, from the probe */
export type ResultSample = {
  position: Vec3
  quaternion: Quat
  time: number
}
/** how the result came to rest, from the probe */
export type Landing = {
  height: number
  position: Vec3
  quaternion: Quat
  /** seconds into the film it lies still from */
  settled: number
  /** its flight, from the moment it flipped out */
  track: ReadonlyArray<ResultSample>
  width: number
}
/** the fusion’s moments, in seconds into the film */
export type Timeline = {
  /** when the result flips out of the portal */
  emergence: number
  /** the end of the film */
  end: number
  /** when the orb strikes the work and the fusion begins */
  strike: number
  /** when the orb is thrown */
  throwAt: number
}
type PortalFrame = ReturnType<typeof portalIn>
/** a key of the camera’s path round the portal: degrees round from straight out of the wall toward its tangent, meters out from the portal’s middle and above its floor, the field of view in degrees and the roll in degrees */
type OrbitKey = [time: number, angle: number, radius: number, height: number, fov: number, roll: number]

const emphases = ['party', 'result'] as const
const videoSize = 2160
/** rows the probe renders, which only has to get the physics right */
const probeSize = 360
const help = `Usage: bun scripts/renderFusion.ts [options]

Films a fusion: an ingredient, like an orb, is thrown into a work hung in a room of the gallery, whose portal opens, swallows both and flips out the result, while the camera follows the ingredient a little as it flies, is knocked back by its strike, rushes in on the singularity, is knocked back again by its burst, cranes and sweeps round the portal as it brews, pushes in through the climax and, depending on --emphasis, follows the result down or pulls back for the ingredient’s effect. By default ${videoSize}×${videoSize} at 60 fps into an AV1 video with the game’s sound.
Starts a private Vite dev server (or serves --target) and a private headless browser; never touches the visible browser. The engine clock is virtual, see scripts/film.ts, which renders the film.
With --emphasis result, a probe renders the fusion small first to learn where the result lands, which the camera of the film then plans for.

Options:
  --ingredient <orb|prop> what is thrown: a kind of orb, which enters the world just for the throw, or the id of a prop already in the world, like prop-cube. Default: spook
                          ${orbs.map(orb => orb.id).join(', ')}
  --portrait <id|file|url>
                          the work it is thrown into: a default work by its id, which hangs where the seed hangs it, or an image file or URL, which hangs in a portrait slot of --room as an imported work. Default: the first work hung in --room
  --room <id>             the room of the work, which the page opens in; for a default work, where it hangs. Default: banquet
  --slot <id>             the portrait slot an image hangs in, in place of what hangs there. Default: a free slot of --room with the most room in front and to its sides
  --emphasis <kind>       what the closing shot shows: party pulls back a little for the ingredient’s effect, like the Halloween Orb’s bats or the Horror Orb’s blood, round the portal and on the floor; result follows the result down and cranes up close over it lying on the floor. Default: party
  --hold <seconds>        how long the film goes on after the result lies still (result) or after the ingredient’s effect is over (party). Default: 3.5 for result, 1 for party
  --fps <number>          frames per second. Default: 60
  --settle <frames>       wall-clock frames to render before recording. Default: 2
  --output-file <file>    the extension picks the format: .webm or .mkv for AV1 video, .jxl for an animated JPEG XL, .png for one PNG per frame. Default: out/fusion/<portrait>-<ingredient>-<timestamp>.webm
  --crf <number>          AV1 quality for .webm and .mkv, lower is better. Default: ${av1Crf}
  --jxl-distance <number> cjxl Butteraugli distance for .jxl, 0 is lossless. Default: 1
${galleryHelp(videoSize, {ratio: 1})}
  -h, --help              show this help

--graphics defaults to cinematic and --audio to true here.
Set BROWSER to a Chromium executable with WebGPU support. ffmpeg (and cjxl for .jxl) must be on PATH.`
const fusionRoot = join(repositoryRoot, 'out', 'fusion')
const renderFusionOptions = {
  ...galleryOptions,
  crf: {type: 'string'},
  emphasis: {
    type: 'string',
    default: 'party',
  },
  fps: {
    type: 'string',
    default: '60',
  },
  graphics: {
    type: 'string',
    default: 'cinematic',
  },
  hold: {type: 'string'},
  ingredient: {
    type: 'string',
    default: 'spook',
  },
  'jxl-distance': {
    type: 'string',
    default: '1',
  },
  'output-file': {type: 'string'},
  portrait: {type: 'string'},
  settle: {
    type: 'string',
    default: '2',
  },
  slot: {type: 'string'},
} as const

/** the command line options without --help, as parsed strings */
export type RenderFusionOptions = Partial<Record<string, boolean | string>> & {
  emphasis: string
  fps: string
  graphics: string
  ingredient: string
  'jxl-distance': string
  seed: string
  settle: string
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: Vec3, factor: number): Vec3 => [a[0] * factor, a[1] * factor, a[2] * factor]
const length = (a: Vec3) => Math.hypot(...a)
const normalize = (a: Vec3) => scale(a, 1 / (length(a) || 1))
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]
const ease = (t: number) => fade(clamp(t, 0, 1))
const radians = (degrees: number) => degrees * Math.PI / 180
/** The vector turned by the quaternion [x, y, z, w]. */
const rotate = ([x, y, z]: Vec3, [qx, qy, qz, qw]: Quat): Vec3 => {
  const tx = 2 * (qy * z - qz * y)
  const ty = 2 * (qz * x - qx * z)
  const tz = 2 * (qx * y - qy * x)
  return [x + qw * tx + qy * tz - qz * ty, y + qw * ty + qz * tx - qx * tz, z + qw * tz + qx * ty - qy * tx]
}
/** The horizontal direction `degrees` round from `from` toward `toward`, both horizontal and at right angles. */
const turned = (from: Vec3, toward: Vec3, degrees: number): Vec3 => add(scale(from, Math.cos(radians(degrees))), scale(toward, Math.sin(radians(degrees))))

/** Cubic Hermite through the keys’ values over their times, its slopes from the neighbors (Catmull–Rom), so the camera never stops at a key; it holds still before the first and after the last. */
export function throughKeys(keys: ReadonlyArray<ReadonlyArray<number>>, time: number) {
  if (time <= keys[0][0]) {
    return keys[0].slice(1)
  }
  const last = keys.length - 1
  if (time >= keys[last][0]) {
    return keys[last].slice(1)
  }
  const index = keys.findLastIndex(key => key[0] <= time)
  const slope = (at: number, value: number) => {
    if (at === 0 || at === last) {
      return 0
    }
    return (keys[at + 1][value] - keys[at - 1][value]) / (keys[at + 1][0] - keys[at - 1][0])
  }
  const [from, to] = [keys[index], keys[index + 1]]
  const span = to[0] - from[0]
  const u = (time - from[0]) / span
  return from.slice(1).map((value, field) => {
    const column = field + 1
    return (2 * u ** 3 - 3 * u ** 2 + 1) * value + (u ** 3 - 2 * u ** 2 + u) * span * slope(index, column) + (-2 * u ** 3 + 3 * u ** 2) * to[column] + (u ** 3 - u ** 2) * span * slope(index + 1, column)
  })
}

/** how a blow hits the camera `since` seconds after it: a jolt that peaks within a few frames and dies away over `decay` seconds */
const jolt = (since: number, decay: number) => (since < 0 ? 0 : (1 - Math.exp(-since / 0.05)) * Math.exp(-since / decay))
/** the blows the fusion deals the camera: when, how far it is pushed back in meters, how hard it shakes in degrees and how fast both die away in seconds */
const blows = ({emergence, strike}: Timeline) => [
  // the orb strikes the work, which knocks the camera back for good, see throwMotion
  [strike, 0, 0.55, 0.35],
  // the singularity collapses and bursts
  [strike + 1.5, 0.34, 0.95, 0.7],
  // the ring of fire lands
  [strike + 4.5, 0.08, 0.45, 0.5],
  // the result flips out with a blaze
  [emergence, 0.2, 0.7, 0.6],
] as const
/** how far a recoil has kicked in `since` seconds after its blow, from 0 to 1 within a third of a second, starting from rest so it never jumps between frames */
const kick = (since: number) => (since < 0 ? 0 : 1 - Math.exp(-((since / 0.16) ** 2)))
/** how far the camera dollies after the orb by the time it strikes, in meters */
const followReach = 0.6
/** how far the strike knocks the camera back beyond its path, in meters, until the singularity’s pull draws it in again */
const recoilReach = 1.5

/** How the throw moves the camera on top of its path `time` seconds into the film, as offsets of its radius and height in meters and its field of view in degrees: it dollies after the orb as it flies, rising a little with its arc, and the strike knocks it back, further than it stood when it threw, until the singularity’s pull draws it in again for the burst. */
export function throwMotion(time: number, {strike, throwAt}: Pick<Timeline, 'strike' | 'throwAt'>) {
  const flight = clamp((time - throwAt) / (strike - throwAt), 0, 1)
  const struck = kick(time - strike)
  const recoil = struck * (1 - ease((time - strike - 0.35) / 1.1))
  return {
    radius: -followReach * ease(flight) * (1 - struck) + recoilReach * recoil,
    height: 0.12 * Math.sin(Math.PI * flight) + 0.2 * recoil,
    fov: 5 * recoil,
  }
}

/** The camera’s path round the portal through the fusion until the closing shot takes over: it creeps toward the work, rushes in low and tilted on the singularity, is knocked back by its burst, cranes up and round while the ember beats, sweeps back across while the images take their turns and pushes in through the climax. */
export function orbitKeys({emergence, strike, throwAt}: Timeline): Array<OrbitKey> {
  return [
    [0, -26, 3.5, 1.62, 50, 0],
    [throwAt, -24, 3.4, 1.62, 50, 0],
    [strike, -19, 3.1, 1.58, 50, 0],
    [strike + 1.45, -7, 2.2, 1.45, 60, -5],
    [strike + 2.6, -4, 2.9, 1.65, 52, -1],
    [strike + 4.6, 30, 3, 2.3, 48, 2],
    [strike + 8.5, 8, 2.7, 1.95, 46, 0],
    [emergence - 1.5, -30, 3.1, 1.6, 46, 0],
    [emergence, -20, 2.8, 1.5, 44, -2],
    // Out of the way of the result, which flips up toward the room
    [emergence + 1.6, -25, 3.5, 1.9, 50, 0],
  ]
}

/** The point `radius` meters out from the portal’s middle, `angle` degrees round from straight out toward its tangent, `height` above its floor, but no closer to a wall than half a meter. */
const aroundPortal = (portal: PortalFrame, angle: number, radius: number, height: number): Vec3 => {
  const direction = turned(portal.normal, portal.tangent, angle)
  const at: Vec3 = [portal.center[0], portal.floor + height, portal.center[2]]
  const room = world.wallDistance(at, direction) - 0.5
  return add(at, scale(direction, Math.max(0.5, Math.min(radius, room))))
}
/** The closing shot of --emphasis party: pulled back a little and up, looking at the portal and the floor in front of it, where effects like bats whirl and blood spills, drifting round a little. */
const partyShot = (portal: PortalFrame, {emergence, end}: Timeline, time: number): Shot => {
  const drift = ease((time - emergence) / (end - emergence))
  return {
    position: aroundPortal(portal, mix(-14, 4, drift), mix(4.6, 4.9, drift), mix(2.3, 2.45, drift)),
    target: [portal.center[0] + portal.normal[0] * 0.45, portal.floor + 1.2, portal.center[2] + portal.normal[2] * 0.45],
    fov: 56,
    roll: 0,
  }
}
/** how much of the view the result lying on the floor takes, across its longer side as seen from its middle; its near edge, closer to the camera, takes more */
const resultFill = 0.66
/** how far a frame reaches out round its work on every side, in meters, about */
const frameReach = 0.15
/** the field of view the closing shot of --emphasis result looks down at the result with */
const resultFov = 46
/**
 * Where the camera of --emphasis result looks down on the result lying still: from the side of its bottom edge, so its image stands upright in the view, as close as it can with all of it in view, looking down steeply, or from in front a little above, should it stand or lean.
 * Of the directions round it, the one nearest that side with room for the camera before the next wall.
 */
export function resultView({height, position, quaternion, width}: Pick<Landing, 'height' | 'position' | 'quaternion' | 'width'>, ceiling: number) {
  const front = rotate([0, 0, 1], quaternion)
  const top = rotate([0, 1, 0], quaternion)
  const lying = Math.abs(front[1]) > 0.5
  const side = lying ? scale(top, -1) : front
  const preferred = normalize([side[0], 0, side[2]])
  const distance = (Math.max(width, height) / 2 + frameReach) / Math.tan(radians(resultFov / 2)) / resultFill
  let elevation = radians(lying ? 62 : 30)
  // Below the ceiling, it looks down less steeply from further away.
  const rise = Math.min(distance * Math.sin(elevation), ceiling - 0.4 - position[1])
  elevation = Math.asin(clamp(rise / distance, 0.2, 1))
  const back = distance * Math.cos(elevation)
  const across: Vec3 = [-preferred[2], 0, preferred[0]]
  const eye = position[1] + distance * Math.sin(elevation)
  const offsets = [0, ...Array.from({length: 17}, (_, index) => (index % 2 ? 1 : -1) * Math.ceil((index + 1) / 2) * 10)]
  const angle = offsets.find(offset => world.wallDistance([position[0], eye, position[2]], turned(preferred, across, offset)) > back + 0.45) ?? 0
  return {
    direction: turned(preferred, across, angle),
    across: turned(across, scale(preferred, -1), angle),
    back,
    eye,
    faceDown: front[1] < -0.5,
  }
}

/** The closing shot of --emphasis result: up and close over the result lying on the floor, drifting round it a little and pushing in. */
const resultShot = (landing: Landing, view: ReturnType<typeof resultView>, {emergence, end}: Timeline, time: number): Shot => {
  const drift = ease((time - emergence) / (end - emergence))
  const direction = turned(view.direction, view.across, mix(-7, 7, drift))
  const reach = mix(1.06, 0.97, drift)
  const {position} = landing
  return {
    position: [position[0] + direction[0] * view.back * reach, position[1] + (view.eye - position[1]) * reach, position[2] + direction[2] * view.back * reach],
    target: position,
    fov: resultFov,
    roll: 0,
  }
}
/** Where the result is `time` seconds into the film, smoothed a little so the camera follows its flight calmly, or undefined before it flipped out. */
const followResult = (track: ReadonlyArray<ResultSample>, time: number) => {
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

/**
 * Where the camera is and what it looks at `time` seconds into the film: the path round the portal, which the closing shot takes over from the result flipping out, with the blows of the fusion and a slight sway as if held by hand.
 * With the result’s landing, which the probe learns, and where to look down on it from, it closes on the result as --emphasis result does; without, on the party round the portal.
 */
export function shotAt(time: number, {closing: closeUp, flight, portal, timeline, work}: {
  closing?: {
    landing: Landing
    view: ReturnType<typeof resultView>
  }
  /** where the orb leaves from and how fast, which the camera’s look follows a little while it flies */
  flight?: {
    from: Vec3
    velocity: Vec3
  }
  portal: PortalFrame
  timeline: Timeline
  work: Vec3
}): Shot {
  const {emergence, strike, throwAt} = timeline
  const [angle, radius, height, fov, roll] = throughKeys(orbitKeys(timeline), time)
  const thrown = throwMotion(time, timeline)
  const eye = aroundPortal(portal, angle, radius + thrown.radius, height + thrown.height)
  // The camera looks at the work until the orb strikes it, then at the portal it opens.
  let aimedAt = mix3(work, portal.center, ease((time - strike + 0.1) / 1))
  if (flight && time > throwAt && time < strike) {
    // While the orb flies, the aimedAt leans toward it, most halfway.
    const since = time - throwAt
    const orb: Vec3 = [flight.from[0] + flight.velocity[0] * since, flight.from[1] + flight.velocity[1] * since - gravity / 2 * since ** 2, flight.from[2] + flight.velocity[2] * since]
    const along = add(eye, scale(normalize(sub(orb, eye)), length(sub(aimedAt, eye))))
    aimedAt = mix3(aimedAt, along, 0.4 * Math.sin(Math.PI * since / (strike - throwAt)))
  }
  const orbit: Shot = {
    position: eye,
    target: aimedAt,
    fov: fov + thrown.fov,
    roll,
  }
  let shot = orbit
  if (time > emergence) {
    const closing = closeUp ? resultShot(closeUp.landing, closeUp.view, timeline, time) : partyShot(portal, timeline, time)
    // Over the result, the camera only sets off once it has risen to the top of its flip, so it never flies into it.
    const blend = closeUp ? ease((time - emergence - 0.5) / clamp(closeUp.landing.settled - emergence + 0.5, 2.6, 4)) : ease((time - emergence - 0.15) / 2.2)
    let target = mix3(orbit.target, closing.target, blend)
    if (closeUp) {
      // It follows the result up out of the portal and down onto the floor.
      const {landing} = closeUp
      const flown = followResult(landing.track, time) ?? portal.center
      target = mix3(mix3(orbit.target, flown, ease((time - emergence) / 0.3)), landing.position, ease((time - landing.settled) / 1.2))
    }
    shot = {
      position: mix3(orbit.position, closing.position, blend),
      target,
      fov: mix(orbit.fov, closing.fov, blend),
      roll: mix(orbit.roll, closing.roll, blend),
    }
  }
  const look = normalize(sub(shot.target, shot.position))
  const right = normalize(cross(look, [0, 1, 0]))
  const up = cross(right, look)
  const distance = length(sub(shot.target, shot.position))
  let {position, target} = shot
  for (const [at, push, shake, decay] of blows(timeline)) {
    const since = time - at
    const hit = jolt(since, decay)
    if (hit === 0) {
      continue
    }
    position = add(position, scale(look, -push * hit))
    const tremble = radians(shake) * Math.exp(-since / (decay * 0.6))
    const sideways = Math.tan(tremble * (0.6 * Math.sin(2 * Math.PI * 17 * since + at) + 0.4 * Math.sin(2 * Math.PI * 29 * since + 2 * at))) * distance
    const upward = Math.tan(tremble * (0.6 * Math.sin(2 * Math.PI * 13 * since + 3 * at) + 0.4 * Math.sin(2 * Math.PI * 23 * since + at))) * distance
    target = add(target, add(scale(right, sideways), scale(up, upward)))
  }
  // A slight sway, as if held by hand
  const sway = (frequency: number, phase: number) => 0.6 * Math.sin(2 * Math.PI * frequency * time + phase) + 0.4 * Math.sin(2 * Math.PI * frequency * 2.3 * time + phase * 1.7)
  position = add(position, scale([sway(0.21, 0.3), sway(0.17, 1.9), sway(0.26, 4.1)], 0.012))
  target = add(target, scale([sway(0.19, 2.2), sway(0.23, 0.7), sway(0.15, 5.3)], 0.008))
  return {
    ...shot,
    position,
    target,
  }
}

/** Where a throw from the camera of `shot` leaves: where a carried orb floats, 0.55 m out and 15° below the middle of the view, see throw_prop. */
const holdPoint = ({position, roll, target}: Shot): Vec3 => {
  const look = normalize(sub(target, position))
  const right = normalize(cross(look, [0, 1, 0]))
  const up = cross(right, look)
  const tilted = add(scale(up, Math.cos(radians(roll))), scale(right, Math.sin(radians(roll))))
  const tilt = radians(15)
  return add(add(position, scale(look, Math.cos(tilt) * 0.55)), scale(tilted, -Math.sin(tilt) * 0.55))
}
/** Every frame’s keyframe of a film.ts recipe, with the tools to run at the frames due for them, by the time of their frame. */
const writeRecipe = async (file: string, {fps, shot, timeline, tools}: {
  fps: number
  shot: (time: number) => Shot
  timeline: Timeline
  tools: Map<number, Record<string, Record<string, unknown>>>
}) => {
  const frames = Math.round(timeline.end * fps)
  const keyframes: Array<Record<string, unknown>> = []
  let previousYaw: number | undefined
  for (let frame = 0; frame <= frames; frame++) {
    const time = frame / fps
    const {fov, position, roll, target} = shot(time)
    const [x, y, z] = sub(target, position)
    let yaw = Math.atan2(-x, -z) * 180 / Math.PI
    if (previousYaw !== undefined) {
      yaw += Math.round((previousYaw - yaw) / 360) * 360
    }
    previousYaw = yaw
    keyframes.push({
      time: Number(time.toFixed(6)),
      position: position.map(value => Number(value.toFixed(5))),
      yaw: Number(yaw.toFixed(4)),
      pitch: Number((Math.atan2(y, Math.hypot(x, z)) * 180 / Math.PI).toFixed(4)),
      roll: Number(roll.toFixed(4)),
      fov: Number(fov.toFixed(4)),
      ...tools.has(frame) ? {tools: tools.get(frame)} : {},
    })
  }
  await fs.writeFile(file, JSON.stringify(keyframes))
}
/** The room the slot’s wall belongs to, by the point just in front of it. */
const slotRoom = ({position, rotation}: PortraitSlot) => {
  const room = world.roomAt([position[0] + Math.sin(rotation) * 0.3, position[1], position[2] + Math.cos(rotation) * 0.3])
  return room?.id
}
/** how much room there is in front of the slot for the camera, up to 6 m, and along its wall to the nearer side, up to 3 m, as its portal measures it */
const slotSpace = (slot: PortraitSlot) => {
  const normal: Vec3 = [Math.sin(slot.rotation), 0, Math.cos(slot.rotation)]
  const tangent: Vec3 = [normal[2], 0, -normal[0]]
  const probe = add(slot.position, scale(normal, 0.3))
  return {
    depth: Math.min(6, world.wallDistance(slot.position, normal)),
    sides: Math.min(3, world.wallDistance(probe, scale(tangent, -1)), world.wallDistance(probe, tangent)),
  }
}
const isSlotOf = (slot: PortraitSlot, position: Vec3) => Math.hypot(...position.map((value, axis) => value - slot.position[axis])) < 1e-6
/** The work the fusion takes, by --portrait, --room and --slot: a default work where the seed hangs it, or an image hung in a slot of the room. */
const resolveWork = async ({portrait, room, slot: slotId}: {
  portrait?: string
  room?: string
  slot?: string
}, seed: number) => {
  const slots = world.portraitSlots()
  const works = hangDefaultWorks(slots, world.artworks, seed)
  const rooms: Array<string> = world.rooms.map(candidate => candidate.id)
  if (room !== undefined && !rooms.includes(room)) {
    throw new Error(`There is no room “${room}”. Rooms: ${rooms.join(', ')}`)
  }
  const catalog = portrait === undefined || world.artworks.some(artwork => artwork.id === portrait)
  if (catalog) {
    if (slotId !== undefined) {
      throw new Error('--slot is for an image; a default work hangs where the seed hangs it.')
    }
    const inRoom = room ?? 'banquet'
    const work = portrait === undefined ? works.find(candidate => slotRoom(slots.find(slot => isSlotOf(slot, candidate.position))!) === inRoom) : works.find(candidate => candidate.id === portrait)
    if (!work) {
      throw new Error(portrait === undefined ? `With seed ${seed}, no default work hangs in “${inRoom}”; name one with --portrait or try another --seed.` : `With seed ${seed}, “${portrait}” doesn’t hang anywhere, as the seed drew other works of its ratio; try another --seed.`)
    }
    const slot = slots.find(candidate => isSlotOf(candidate, work.position))!
    const workRoom = slotRoom(slot)!
    if (room !== undefined && workRoom !== room) {
      throw new Error(`With seed ${seed}, “${work.id}” hangs in “${workRoom}”, not in “${room}”.`)
    }
    return {
      label: work.id,
      room: workRoom,
      slot,
    }
  }
  const file = resolve(portrait)
  const isFile = await fs.stat(file).then(entry => entry.isFile(), () => false)
  if (!isFile && !URL.canParse(portrait)) {
    throw new Error(`--portrait must be a default work (${world.artworks.map(artwork => artwork.id).join(', ')}), an image file or an image URL, got “${portrait}”.`)
  }
  const inRoom = room ?? 'banquet'
  let slot: PortraitSlot | undefined
  if (slotId === undefined) {
    const taken = (candidate: PortraitSlot) => works.some(work => isSlotOf(candidate, work.position))
    // A free one first, then the one with the most room round it
    const space = (candidate: PortraitSlot) => {
      const {depth, sides} = slotSpace(candidate)
      return depth + sides
    }
    slot = slots.filter(candidate => slotRoom(candidate) === inRoom).toSorted((a, b) => Number(taken(a)) - Number(taken(b)) || space(b) - space(a) || a.id.localeCompare(b.id)).at(0)
    if (!slot) {
      throw new Error(`The room “${inRoom}” has no portrait slots.`)
    }
  } else {
    slot = slots.find(candidate => candidate.id === slotId)
    if (!slot) {
      throw new Error(`There is no portrait slot “${slotId}”.`)
    }
    if (room !== undefined && slotRoom(slot) !== room) {
      throw new Error(`The slot “${slotId}” is in “${slotRoom(slot)}”, not in “${room}”.`)
    }
  }
  const label = isFile ? parse(file).name : parse(URL.parse(portrait)!.pathname).name
  return {
    label: label || 'image',
    room: slotRoom(slot)!,
    slot,
    image: isFile ? {file} : {url: portrait} as {
      file?: string
      url?: string
    },
  }
}
/** The ingredient --ingredient names: a kind of orb, spawned for the throw, or a prop already in the world. */
const resolveIngredient = (ingredient: string) => {
  const orb = orbs.find(candidate => candidate.id === ingredient)
  if (orb) {
    return {
      label: orb.id,
      orb,
      prop: `${orb.propId}-thrown`,
    }
  }
  if (!ingredient.startsWith('prop-')) {
    throw new Error(`--ingredient must be a kind of orb (${orbs.map(candidate => candidate.id).join(', ')}) or the id of a prop, like prop-cube, got “${ingredient}”.`)
  }
  return {
    label: ingredient.replace(/^prop-/, ''),
    prop: ingredient,
  }
}
const positiveNumber = (value: string, name: string) => {
  const [number] = parseNumbers(value, name, [1])
  if (!(number > 0)) {
    throw new Error(`--${name} must be positive.`)
  }
  return number
}

/**
 * The result’s flight and where it came to rest, from the probe’s dumps: the work that no longer hangs and no fusion holds any more, or a new one, from the moment it flipped out; it lies still once it moves less than 5 mm in half a second.
 * `work` is the id of the work the orb was thrown into, whose place the result takes in the collection.
 */
export function findLanding(dumps: ReadonlyArray<{
  portraits: ReadonlyArray<PortraitDump>
  time: number
}>, work: string): Landing | undefined {
  const before = new Set(dumps[0]?.portraits.map(portrait => portrait.id))
  let id: string | undefined
  const track: Array<ResultSample> = []
  let size: Pick<PortraitDump, 'height' | 'width'> | undefined
  for (const {portraits, time} of dumps.slice(1)) {
    const result = id === undefined ? portraits.find(portrait => !portrait.hung && !portrait.fusing && !portrait.pending && (portrait.id === work || !before.has(portrait.id))) : portraits.find(portrait => portrait.id === id)
    if (!result) {
      continue
    }
    id = result.id
    size = result
    track.push({
      time,
      position: result.position,
      quaternion: result.quaternion,
    })
  }
  if (!track.length) {
    return
  }
  const last = track.at(-1)!
  const settled = track.find(({position, time}) => track.every(sample => sample.time < time || sample.time > time + 0.5 || length(sub(sample.position, position)) < 0.005))?.time ?? last.time
  return {
    position: last.position,
    quaternion: last.quaternion,
    settled,
    track,
    width: size!.width,
    height: size!.height,
  }
}

const dumpsIn = (calls: Awaited<ReturnType<typeof film>>['tools']) => calls.filter(call => call.name === 'dump_portraits').map(call => ({
  time: call.time,
  portraits: JSON.parse(call.result) as Array<PortraitDump>,
}))
const main = async (options: RenderFusionOptions) => {
  const text = (key: string) => {
    const value = options[key]
    return typeof value === 'string' ? value : undefined
  }
  const emphasis = options.emphasis as Emphasis
  if (!emphases.includes(emphasis)) {
    throw new Error(`--emphasis must be ${emphases.join(' or ')}, got “${options.emphasis}”.`)
  }
  const fps = positiveNumber(options.fps, 'fps')
  const holding = text('hold')
  const hold = holding === undefined ? (emphasis === 'result' ? 3.5 : 1) : parseNumbers(holding, 'hold', [1])[0]
  if (!(hold >= 0)) {
    throw new Error('--hold must be at least 0.')
  }
  resolveSettle(options.settle)
  const seed = parseSeed(options.seed)
  if (seed === undefined) {
    throw new Error(`--seed expects a whole number, got “${options.seed}”.`)
  }
  const ingredient = resolveIngredient(options.ingredient)
  const work = await resolveWork({
    portrait: text('portrait'),
    room: text('room'),
    slot: text('slot'),
  }, seed)
  const {slot} = work
  const portal = portalIn(slot, world)
  // The throw falls on a frame, so the probe and the film run it on the same one.
  const throwAt = Math.round(fps) / fps
  /** the party’s length after the result flipped out: the ingredient’s effect, at least 2.5 s and at most 9 s */
  const party = Math.min(9, Math.max(2.5, ingredient.orb?.effect?.afterglow ?? 0))
  const timeline: Timeline = {
    throwAt,
    strike: throwAt + 0.4,
    emergence: 0,
    end: 0,
  }
  let flight: Parameters<typeof shotAt>[1]['flight']
  const shot = (closing?: Parameters<typeof shotAt>[1]['closing']) => (time: number) => shotAt(time, {
    closing,
    flight,
    portal,
    timeline,
    work: slot.position,
  })
  // The throw leaves from in front of the camera as it is when it throws, whose path bends toward where the orb strikes, which depends on where it leaves from: a few rounds settle both. The throw’s own motion of the camera only starts after it.
  let from: Vec3 = [0, 0, 0]
  for (let round = 0; round < 8; round++) {
    timeline.emergence = timeline.strike + fusionTiming.minimum + fusionTiming.climax
    timeline.end = timeline.emergence + party + hold
    from = holdPoint(shot()(throwAt))
    const aim = aimThrow(from, slot.position, throwSpeed)
    if (!aim) {
      throw new Error(`A throw from ${from.map(value => value.toFixed(2)).join(', ')} at ${throwSpeed} m/s falls short of the work.`)
    }
    flight = {
      from,
      velocity: aim.velocity,
    }
    const strike = throwAt + aim.seconds
    const settled = Math.abs(strike - timeline.strike) < 1e-9
    timeline.strike = strike
    if (settled) {
      break
    }
  }
  timeline.emergence = timeline.strike + fusionTiming.minimum + fusionTiming.climax
  timeline.end = timeline.emergence + party + hold
  const start = shot()(0)
  const tools = new Map<number, Record<string, Record<string, unknown>>>
  await using served = work.image?.file === undefined ? undefined : serveFile(work.image.file)
  const imageUrl = served?.url ?? work.image?.url
  tools.set(0, {
    // Under the camera, out of view, until it is thrown
    ...ingredient.orb ? {
      spawn_orb: {
        orb: ingredient.orb.id,
        id: ingredient.prop,
        position: [start.position[0], world.floorHeight(start.position) + orbRadius + 0.02, start.position[2]],
      },
    } : {},
    ...imageUrl === undefined ? {} : {
      hang_work: {
        image: imageUrl,
        slot: slot.id,
      },
    },
    dump_portraits: {},
  })
  tools.set(Math.round(throwAt * fps), {
    throw_prop: {
      prop: ingredient.prop,
      target: slot.position,
      from,
    },
  })
  const outputFile = text('output-file')
  const output = outputFile === undefined ? join(fusionRoot, `${work.label}-${ingredient.label}-${timestamp()}.webm`) : resolve(outputFile)
  const side = text('width') ?? text('height') ?? String(videoSize)
  const shared = {
    ...Object.fromEntries(Object.entries(options).filter(([key]) => key in galleryOptions)),
    graphics: options.graphics,
    seed: options.seed,
    room: work.room,
    audio: text('audio') ?? 'true',
    fps: options.fps,
    settle: options.settle,
    'jxl-distance': options['jxl-distance'],
    'starting-frame': '1',
  }
  /** the id of the work the orb is thrown into, whose place the result takes in the collection, from a film’s tool calls */
  const workIdIn = (calls: Awaited<ReturnType<typeof film>>['tools']) => {
    const hung = calls.find(call => call.name === 'hang_work')
    return hung ? (JSON.parse(hung.result) as {id: string}).id : work.label
  }
  const workspace = await fs.mkdtemp(join(tmpdir(), 'render-fusion-'))
  try {
    let closing: Parameters<typeof shotAt>[1]['closing']
    if (emphasis === 'result') {
      // The probe films the same fusion small, without sound, dumping the works every other frame from just before the result flips out until long after it landed.
      const probeEnd = timeline.emergence + 4
      const probeTools = new Map(tools)
      for (let frame = Math.round((timeline.emergence - 0.3) * fps); frame <= Math.round(probeEnd * fps); frame += 2) {
        probeTools.set(frame, {dump_portraits: {}})
      }
      const recipe = join(workspace, 'probe.json')
      await writeRecipe(recipe, {
        fps,
        shot: shot(),
        timeline: {
          ...timeline,
          end: probeEnd,
        },
        tools: probeTools,
      })
      console.error(`Probing where the result lands, ${probeEnd.toFixed(1)} s at ${probeSize}×${probeSize}`)
      const probe = await film({
        ...shared,
        audio: 'false',
        width: String(probeSize),
        height: String(probeSize),
        recipe,
        crf: '50',
        'output-file': join(workspace, 'probe.webm'),
      } as Parameters<typeof film>[0])
      const landing = findLanding(dumpsIn(probe.tools), workIdIn(probe.tools))
      if (!landing) {
        throw new Error(`No result flipped out of the portal by ${probeEnd.toFixed(1)} s; the throw may have missed the work (${probe.tools.find(call => call.name === 'throw_prop')?.result}).`)
      }
      const [x, y, z] = landing.position
      console.error(`The result flips out at ${landing.track[0].time.toFixed(2)} s and lies still from ${landing.settled.toFixed(2)} s at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`)
      const room = world.roomById(work.room)!
      const view = resultView(landing, room.floorY + (room.height ?? 3))
      if (view.faceDown) {
        console.warn('Warning: the result lands face down, so the closing shot shows its back.')
      }
      closing = {
        landing,
        view,
      }
      timeline.end = Math.max(landing.settled, timeline.emergence + 2.4) + hold
      // The film dumps the works once more at its end, to tell how closely it followed the probe.
      tools.set(Math.round(timeline.end * fps) - 1, {dump_portraits: {}})
    }
    const recipe = join(workspace, 'film.json')
    await writeRecipe(recipe, {
      fps,
      shot: shot(closing),
      timeline,
      tools,
    })
    console.error(`Filming ${timeline.end.toFixed(1)} s: the orb strikes at ${timeline.strike.toFixed(2)} s and the result flips out at ${timeline.emergence.toFixed(2)} s`)
    const filmed = await film({
      ...shared,
      width: text('width') ?? side,
      height: text('height') ?? side,
      recipe,
      ...text('crf') === undefined ? {} : {crf: text('crf')},
      'output-file': output,
    })
    // How far from where the probe saw it the result came to rest in the film, which the camera planned for
    const rested = closing && findLanding(dumpsIn(filmed.tools), workIdIn(filmed.tools))
    return {
      ...filmed,
      drift: rested && length(sub(rested.position, closing!.landing.position)),
      timeline,
    }
  } finally {
    await fs.remove(workspace)
  }
}

export default main

if (import.meta.main) {
  const {values} = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      ...renderFusionOptions,
      help: {
        type: 'boolean',
        short: 'h',
      },
    },
  })
  if (values.help) {
    console.log(help)
  } else {
    const {audio, drift, format, fps, frameCount, height, output, width} = await main(values)
    const shorten = (file: string) => {
      const inRepository = relative(repositoryRoot, file)
      return (inRepository.startsWith('..') ? file : inRepository).replaceAll('\\', '/')
    }
    const written = shorten(output)
    let sound = ''
    if (audio !== undefined) {
      sound = audio === output ? ' with sound' : `, sound in ${shorten(audio)}`
    }
    const followed = drift === undefined ? '' : `; the result came to rest ${(drift * 100).toFixed(1)} cm from where the probe saw it`
    console.log(`Wrote ${format === 'png' ? `${frameCount} numbered PNGs for ${written}` : written} (${width}×${height}, ${frameCount} frames at ${fps} fps, ${(frameCount / fps).toFixed(2)} s${sound}${followed})`)
  }
}
