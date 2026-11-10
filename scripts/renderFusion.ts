import type {FusionEffect} from '#src/lib/gallery/fusion/effects/index.ts'
import type {PortraitSlot, Quat, Vec3} from '#src/lib/gallery/types.ts'
import type {PortraitDump} from '#src/lib/webmcp/dumpPortraits.ts'
import type World from '#src/worlds/base/World.ts'
import type {WorldId} from '#src/worlds/index.ts'
import type {CameraKey, CameraPath, Shot, Timeline} from './lib/fusionCamera.ts'
import type {Closing, Emphasis, Landing, PartyClosing, PartyFraming, PartyView, ResultClosing, ResultSample} from './lib/fusionEmphasis.ts'

import {tmpdir} from 'node:os'
import {join, parse, relative, resolve} from 'node:path'
import {parseArgs} from 'node:util'

import fs from 'fs-extra'
import {av1Crf, av1Preset} from 'knot-materials/scripts/lib/encodeAnimation.ts'
import {clamp} from 'math'

import {inspectionFov} from '#src/lib/camera/OrbitInspection.ts'
import {parseSeed} from '#src/lib/environmentSeed.ts'
import {portraitFrame} from '#src/lib/frames/index.ts'
import {hangDefaultWorks} from '#src/lib/gallery/defaultPortraits.ts'
import {offsetPosition} from '#src/lib/gallery/fusion/effects/base/portalOffset.ts'
import {portalIn, satelliteSize} from '#src/lib/gallery/fusion/portalFrame.ts'
import {fusionTiming} from '#src/lib/gallery/fusion/timing.ts'
import {orbRadius, orbs} from '#src/lib/gallery/orbs/index.ts'
import {aimThrow, flightPoint} from '#src/lib/physics/aimThrow.ts'
import {throwSpeed} from '#src/lib/physics/GrabbableBody.ts'
import {readWorld} from '#src/worlds/index.ts'

import film from './film.ts'
import {add, dot, ease, handheld, holdPoint, keyedShot, length, mix, mix3, normalize, parseCameraPath, radians, scale, shotAngles, sub, throughKeys} from './lib/fusionCamera.ts'
import {emphases, emphasized, outermost, partyFraming, partyPush, partySwing, partyView, seenWithin, shotReach} from './lib/fusionEmphasis.ts'
import {galleryHelp, galleryOptions, parseNumbers, repositoryRoot, resolveSettle, serveFile, timestamp} from './lib/headlessGallery.ts'

type PortalFrame = ReturnType<typeof portalIn>
/** a key of the camera’s path round the portal: degrees round from straight out of the wall toward its tangent, meters out from the portal’s middle and above its floor, the field of view in degrees and the roll in degrees */
type OrbitKey = [time: number, angle: number, radius: number, height: number, fov: number, roll: number]

/** every world’s module, loaded only for the world whose room --room names */
const worldModules: Record<WorldId, () => Promise<{default: World}>> = {
  gallery: () => import('#src/worlds/gallery/index.ts'),
  knottingham: () => import('#src/worlds/knottingham/index.ts'),
  sandbox: () => import('#src/worlds/sandbox/index.ts'),
}
const videoSize = 2160
/** how long a film lasts unless its camera path, --emphasis party or --end says otherwise, in seconds */
const filmLength = 20
/** how long a film of --emphasis party goes on once the ingredient’s effect is over and the portal has closed, in seconds */
const partyOutro = 1
/** rows the probe renders, which only has to get the physics right */
const probeSize = 360
const help = `Usage: bun scripts/renderFusion.ts [options]

Films a fusion: an ingredient, like an orb, is thrown into a work hung in a room of a world, whose portal opens, swallows both and flips out the result, while the camera follows the ingredient a little as it flies, is knocked back by its strike, rushes in on the singularity, is knocked back again by its burst, cranes and sweeps round the portal as it brews, pushes in through the climax and steps aside for the result, where it holds, unless --emphasis ends the film otherwise. By default ${videoSize}×${videoSize} at 60 fps into an AV1 video with the game’s sound.
Starts a private Vite dev server (or serves --target) and a private headless browser; never touches the visible browser. The engine clock is virtual, see scripts/film.ts, which renders the film.
With --emphasis result, a probe renders the fusion small first to learn where the result lands, which the camera of the film then plans for.

Options:
  --ingredient <orb|prop> what is thrown: a kind of orb, which enters the world just for the throw, or the id of a prop already in the world, like prop-cube. Default: spook
                          ${orbs.map(orb => orb.id).join(', ')}
  --portrait <id|file|url>
                          the work it is thrown into: a default work by its id, which hangs where the seed hangs it, or an image file or URL, which hangs in a portrait slot of --room as an imported work. Default: the first work hung in --room
  --room <id>             the room of the work, which the page opens in, and with it its world, like the Sandbox for its Cell, which loads much faster than the gallery; for a default work, where it hangs. Default: banquet
  --slot <id>             the portrait slot an image hangs in, in place of what hangs there. Default: a free slot of --room with the most room in front and to its sides
  --emphasis <kind>       how the film ends, taking over from the camera’s path, its own or that of --camera, as the result flips out: neutral leaves the path as it is; party keeps everything the ingredient’s effect reaches, like the Halloween Orb’s bats or the Horror Orb’s blood, in view from just far enough, drifting round it a little, and ends the film a second after the effect is over; result follows the result down and cranes up over it lying on the floor until the last frame looks straight at its image, upright, which fills the view to the sight edge of its frame, as when viewing a hung portrait with V. Default: neutral
  --camera <file>         a camera path as JSON, like the camera editor exports it, in place of the camera’s own: keys of time, position, target, field of view and roll that the camera passes through smoothly, the end of the film and whether the camera is held by hand, shaken by the fusion’s blows and swaying a little. --emphasis ends it as it ends the camera’s own; the throw still leaves from in front of the camera.
  --plan-file <file>      writes what the film would show as JSON instead of filming it: the work, its portal, the fusion’s moments, the throw, how --emphasis ends it, with result the result’s landing, which the probe still renders for, the camera in every frame and keys through its path before it is held by hand and --emphasis ends it, or those of --camera
  --end <seconds>         how long the film lasts. Default: with --emphasis party, until ${partyOutro} s after the ingredient’s effect is over and the portal has closed; otherwise the end of the path of --camera, otherwise ${filmLength}
  --fps <number>          frames per second. Default: 60
  --settle <frames>       wall-clock frames to render before recording. Default: 2
  --output-file <file>    the extension picks the format: .webm or .mkv for AV1 video, .jxl for an animated JPEG XL, .png for one PNG per frame. Default: out/fusion/<portrait>-<ingredient>-<timestamp>.webm
  --crf <number>          AV1 quality for .webm and .mkv, lower is better. Default: ${av1Crf}
  --keyframe-interval <n> at most how many frames .webm and .mkv run from one keyframe to the next, like 6 for a film to scrub through, see scripts/film.ts. Default: the encoder’s own, about 5 s
  --fast-decode <0–2>     how much of the AV1 compression to trade for a faster decoder, see scripts/film.ts. Default: 0
  --preset <number>       SVT-AV1 preset, lower compresses better and encodes slower. Default: ${av1Preset}
  --jxl-distance <number> cjxl Butteraugli distance for .jxl, 0 is lossless. Default: 1
${galleryHelp(videoSize, {ratio: 1})}
  -h, --help              show this help

--graphics defaults to cinematic and --audio to true here.
Set BROWSER to a Chromium executable with WebGPU support. ffmpeg (and cjxl for .jxl) must be on PATH.`
const fusionRoot = join(repositoryRoot, 'out', 'fusion')
const renderFusionOptions = {
  ...galleryOptions,
  camera: {type: 'string'},
  crf: {type: 'string'},
  end: {type: 'string'},
  emphasis: {
    type: 'string',
    default: 'neutral',
  },
  fps: {
    type: 'string',
    default: '60',
  },
  graphics: {
    type: 'string',
    default: 'cinematic',
  },
  'fast-decode': {type: 'string'},
  ingredient: {
    type: 'string',
    default: 'spook',
  },
  'jxl-distance': {
    type: 'string',
    default: '1',
  },
  'keyframe-interval': {type: 'string'},
  'output-file': {type: 'string'},
  'plan-file': {type: 'string'},
  portrait: {type: 'string'},
  preset: {type: 'string'},
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

/** The vector turned by the quaternion [x, y, z, w]. */
const rotate = ([x, y, z]: Vec3, [qx, qy, qz, qw]: Quat): Vec3 => {
  const tx = 2 * (qy * z - qz * y)
  const ty = 2 * (qz * x - qx * z)
  const tz = 2 * (qx * y - qy * x)
  return [x + qw * tx + qy * tz - qz * ty, y + qw * ty + qz * tx - qx * tz, z + qw * tz + qx * ty - qy * tx]
}
/** The horizontal direction `degrees` round from `from` toward `toward`, both horizontal and at right angles. */
const turned = (from: Vec3, toward: Vec3, degrees: number): Vec3 => add(scale(from, Math.cos(radians(degrees))), scale(toward, Math.sin(radians(degrees))))
/** how far a recoil has kicked in `since` seconds after its blow, from 0 to 1 within a third of a second, starting from rest so it never jumps between frames */
const kick = (since: number) => (since < 0 ? 0 : 1 - Math.exp(-((since / 0.16) ** 2)))
/** how far the camera dollies after the orb by the time it strikes, in meters */
const followReach = 0.6
/** how far the strike knocks the camera back beyond its path, in meters, until the singularity’s pull draws it in again */
const recoilReach = 1.8

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

/** how much of the view’s width the satellites’ orbit takes at most, each of them whole */
const orbitFill = 0.9

/** How far from the portal’s middle the camera has to stand at the field of view `fov` to see the satellites whole wherever their orbit takes them, which reaches out along the wall furthest. */
export function orbitDistance(portal: Pick<PortalFrame, 'orbit'>, fov: number) {
  return (portal.orbit.along + satelliteSize / 2) / Math.tan(radians(fov / 2)) / orbitFill
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

/** The point `radius` meters out from the portal’s middle, `angle` degrees round from straight out toward its tangent, `height` above its floor, but no closer to a wall of the world than half a meter. */
const aroundPortal = (world: World, portal: PortalFrame, angle: number, radius: number, height: number): Vec3 => {
  const direction = turned(portal.normal, portal.tangent, angle)
  const at: Vec3 = [portal.center[0], portal.floor + height, portal.center[2]]
  const room = world.wallDistance(at, direction) - 0.5
  return add(at, scale(direction, Math.max(0.5, Math.min(radius, room))))
}
/** how much of the view the result lying on the floor takes, across its longer side as seen from its middle, while the camera looks down on it as it falls; its near edge, closer to the camera, takes more */
const resultFill = 0.66
/** how far a frame reaches out round its work on every side, in meters, about */
const frameReach = 0.15
/** the field of view the camera of --emphasis result looks down at the result with as it falls */
const resultFov = 46
/**
 * Where the camera of --emphasis result looks down on the result lying still: from the side of its bottom edge, so its image stands upright in the view, as close as it can with all of it in view, looking down steeply, or from in front a little above, should it stand or lean.
 * Of the directions round it, the one nearest that side with room for the camera before the next wall of the world.
 */
export function resultView({height, position, quaternion, width}: Pick<Landing, 'height' | 'position' | 'quaternion' | 'width'>, ceiling: number, world: World) {
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

/** how much room the camera keeps from the ceiling, the floor and the walls, in meters */
const roomMargin = 0.3

/**
 * How --emphasis result ends the film: following the result down and craning up over it, see {@link resultShot}, from where {@link resultView} looks down on it, until it looks straight at the middle of its image, which fills the view at the field of view of viewing a hung portrait with V, the larger of its sides for the film’s `aspect`, as far as its frame’s sight edge leaves it in sight, so none of the frame shows along those sides; should the ceiling stand in the way, from closer by and wider.
 */
export function resultClosing(landing: Landing, {aspect, ceiling, world}: {
  aspect: number
  ceiling: number
  world: World
}): ResultClosing {
  const view = resultView(landing, ceiling, world)
  const front = rotate([0, 0, 1], landing.quaternion)
  const frame = portraitFrame(landing.frame)
  // Its image lies recessed in its frame, by the frame.
  const center = add(landing.position, scale(front, frame.imageDepth))
  // Lying face down, it can only show its back, from above.
  const normal = view.faceDown ? scale(front, -1) : front
  const top = rotate([0, 1, 0], landing.quaternion)
  const vantage: Vec3 = [landing.position[0] + view.direction[0] * view.back, view.eye, landing.position[2] + view.direction[2] * view.back]
  const toward = normalize(sub(vantage, center))
  const across = sub(toward, scale(normal, dot(toward, normal)))
  // how far out from the image’s middle the ceiling and the walls let the camera stand
  const flat = Math.hypot(normal[0], normal[2])
  const below = normal[1] > 1e-3 ? (ceiling - roomMargin - center[1]) / normal[1] : Number.POSITIVE_INFINITY
  const before = flat > 0.2 ? (world.wallDistance(center, [normal[0] / flat, 0, normal[2] / flat]) - roomMargin) / flat : Number.POSITIVE_INFINITY
  const viewing = frame.viewingDistance(landing.width, landing.height, aspect, inspectionFov)
  const distance = Math.min(viewing, below, before)
  return {
    kind: 'result',
    landing,
    center,
    normal,
    top: normalize(sub(top, scale(normal, dot(top, normal)))),
    approach: normalize(length(across) > 1e-6 ? across : top),
    elevation: Math.asin(clamp(dot(toward, normal), -1, 1)) * 180 / Math.PI,
    distance: length(sub(vantage, center)),
    fov: resultFov,
    aligned: {
      distance,
      fov: distance < viewing ? 2 * Math.atan(frame.viewedFill(landing.width, landing.height, aspect, distance) / distance) * 180 / Math.PI : inspectionFov,
    },
  }
}

/** the fields of view --emphasis party looks at the party with, each wider one only tried should the room be too small for the one before */
const partyFovs = [55, 65, 75, 90]
/** how far round the closing shot of --emphasis party drifts over the closing, in degrees */
const partyDrift = 12
/** how --emphasis party may look at the party: how far down, in degrees, up where negative, how far round from straight out of the wall toward its tangent, in degrees, and the height over the floor it best looks from, about a standing person’s eyes, in meters */
const partyLook = {
  elevations: Array.from({length: 16}, (_, index) => index * 5 - 15),
  angles: Array.from({length: 13}, (_, index) => index * 5 - 30),
  eyes: 1.7,
}
/** how often --emphasis party works out what it has to keep in view anew, in seconds */
const partyStep = 0.25
/** how far into the effect’s show --emphasis party has settled, as a share of it, which it pushes in on, so it focuses on the party instead of chasing the last of it */
const partySettles = 0.6
/** how far out toward the edges of the view what is still to come may show while --emphasis party pushes in, as a share of the way from the middle */
const partyMargin = 0.97

/** what the camera’s path round the portal goes by */
export type PathContext = {
  /** where the orb leaves from and how fast, which the camera’s look follows a little while it flies */
  flight?: {
    from: Vec3
    velocity: Vec3
  }
  portal: PortalFrame
  timeline: Timeline
  work: Vec3
  /** whose walls keep the camera in */
  world: World
}

/**
 * What --emphasis party has to keep in view from moment to moment, cut down to the outermost of it: everything the ingredient’s `effect` still reaches and the portal’s rim while it glows, or without an effect, where the fusion took place, the satellites’ orbit; and what of it is left once the effect has settled.
 */
export function partyViews(portal: PortalFrame, effect: FusionEffect | undefined, {emergence, end}: Pick<Timeline, 'emergence' | 'end'>) {
  const ring = (along: number, up: number, out: number) => Array.from({length: 16}, (_, index): [number, number, number] => {
    const angle = index / 16 * Math.PI * 2
    return [Math.cos(angle) * along, Math.sin(angle) * up, Math.sin(angle) * out]
  })
  const {orbit, radius} = portal
  const floor = portal.floor - portal.center[1]
  const reach = (since: number) => outermost((effect ? [...since < fusionTiming.afterglow ? ring(radius, radius, 0) : [], ...effect.extent(floor, since)] : ring(orbit.along, -orbit.tilt, orbit.across)).map(offset => offsetPosition(portal, offset)))
  const views: Array<PartyView> = []
  for (let time = emergence; time < end + partyStep; time += partyStep) {
    views.push({
      time,
      points: reach(time - emergence),
    })
  }
  const settled = reach(Math.min((effect?.afterglow ?? 0) * partySettles, end - emergence))
  return {
    views,
    settled: settled.length ? settled : views[0].points,
  }
}
/**
 * How --emphasis party ends the film: a wide shot of everything the party reaches and a close one of it once it has settled, both from straight out of the wall, unless from further round they come much closer, at the narrowest field of view the room has space for, each looking down from about a standing person’s eyes, unless from higher or lower it comes much closer; and the one calm push in from the wide to the close shot, as long as it can be without losing sight of anything still to come.
 * The camera keeps clear of the walls, the floor and the ceiling of the world all through its drift.
 */
export function partyClosing({settled, views}: ReturnType<typeof partyViews>, timeline: Pick<Timeline, 'emergence' | 'end'>, {aspect, ceiling, portal, world}: {
  aspect: number
  ceiling: number
  portal: PortalFrame
  world: World
}): PartyClosing {
  const {emergence, end} = timeline
  const lasts = end - emergence
  const fits = (shot: Shot) => {
    const {position, target} = shot
    const away: Vec3 = [position[0] - target[0], 0, position[2] - target[2]]
    const along = length(away)
    return position[1] > portal.floor + roomMargin && position[1] < ceiling - roomMargin && (along < 1e-6 || world.wallDistance(target, scale(away, 1 / along)) > along + roomMargin)
  }
  const swings = [emergence, (emergence + end) / 2, end].map(time => partySwing({drift: partyDrift}, time, timeline))
  /** the elevation that frames the points best from the look, by how close and how high it has the camera stand, as long as it stays in the room all through its drift */
  const framed = (look: Pick<PartyClosing, 'aspect' | 'fov' | 'from'>, points: Array<Vec3>) => {
    let chosen: {
      framing: PartyFraming
      score: number
    } | undefined
    for (const elevation of partyLook.elevations) {
      const framing = {
        elevation,
        points,
      }
      const shots = swings.map(swing => partyFraming(look, framing, swing))
      if (!shots.every(fits)) {
        continue
      }
      const score = shotReach(shots[1]) * (1 + 0.3 * (shots[1].position[1] - portal.floor - partyLook.eyes) ** 2)
      if (!chosen || score < chosen.score) {
        chosen = {
          framing,
          score,
        }
      }
    }
    return chosen
  }
  let best: {
    closing: PartyClosing
    score: number
  } | undefined
  for (const fov of partyFovs) {
    for (const angle of partyLook.angles) {
      const look = {
        aspect,
        fov,
        from: turned(portal.normal, portal.tangent, angle),
      }
      const wide = framed(look, views[0].points)
      const close = framed(look, settled)
      if (!wide || !close) {
        continue
      }
      // The close shot is what the film ends on, so it counts twice.
      const score = (wide.score + 2 * close.score) / 3 * (1 + 0.5 * (angle / 45) ** 2)
      if (!best || score < best.score) {
        best = {
          score,
          closing: {
            kind: 'party',
            ...look,
            lasts,
            drift: partyDrift,
            wide: wide.framing,
            close: close.framing,
            views,
          },
        }
      }
    }
    if (best) {
      break
    }
  }
  if (!best) {
    console.warn('Warning: the room is too small to keep all of the party in view; the camera stands outside it.')
    const wide = {
      elevation: 0,
      points: views[0].points,
    }
    return {
      kind: 'party',
      aspect,
      fov: partyFovs.at(-1)!,
      from: portal.normal,
      lasts,
      drift: partyDrift,
      wide,
      close: wide,
      views,
    }
  }
  const {closing} = best
  // The push in: of every start and end on a grid, the longest that keeps everything still to come in view and the camera in the room, the earliest of those.
  const frames = Array.from({length: Math.floor((end - emergence) * 30) + 1}, (_, index) => emergence + index / 30)
  const swing = frames.map(time => partySwing(closing, time, timeline))
  const wideShots = swing.map(degrees => partyFraming(closing, closing.wide, degrees))
  const closeShots = swing.map(degrees => partyFraming(closing, closing.close, degrees))
  const coming = frames.map(time => partyView(closing, time).points)
  const holds = (move: NonNullable<PartyClosing['move']>) => frames.every((time, index) => {
    const push = partyPush({move}, time)
    const shot: Shot = {
      position: mix3(wideShots[index].position, closeShots[index].position, push),
      target: mix3(wideShots[index].target, closeShots[index].target, push),
      fov: closing.fov,
      roll: 0,
    }
    return fits(shot) && coming[index].every(point => seenWithin(shot, point, aspect, partyMargin))
  })
  const marks = Array.from({length: Math.floor((end - emergence) / partyStep) + 1}, (_, index) => Math.min(end, emergence + index * partyStep))
  const moves = marks.flatMap(start => [...marks.filter(stop => stop > start), end].map(stop => ({
    from: start,
    to: stop,
  }))).filter(({from, to}) => to > from).toSorted((a, b) => b.to - b.from - (a.to - a.from) || a.from - b.from)
  const move = moves.find(holds)
  return move ? {
    ...closing,
    move,
  } : closing
}

/** How long the party of a fusion lasts once its result flipped out, in seconds: until the ingredient’s `effect` is over, at least until the portal has closed. */
export const partyLength = (effect?: FusionEffect) => Math.max(fusionTiming.afterglow, effect?.afterglow ?? 0)

/** Where the camera is and what it looks at `time` seconds into the film, before it is held by hand and the emphasis ends the film: its path round the portal, which holds where it stepped aside for the result, looking at the portal. */
export function pathAt(time: number, {flight, portal, timeline, work, world}: PathContext): Shot {
  const {emergence, strike, throwAt} = timeline
  const [angle, keyed, height, fov, roll] = throughKeys(orbitKeys(timeline), time)
  // From the burst until the climax, the camera stands back far enough to keep the satellites in view.
  const framing = ease((time - strike - 1.5) / 0.7) * (1 - ease((time - emergence + 1.5) / 1.2))
  const radius = mix(keyed, Math.max(keyed, orbitDistance(portal, fov)), framing)
  const thrown = throwMotion(time, timeline)
  const eye = aroundPortal(world, portal, angle, radius + thrown.radius, height + thrown.height)
  // The camera looks at the work until the orb strikes it, then at the portal it opens.
  let aimedAt = mix3(work, portal.center, ease((time - strike + 0.1) / 1))
  if (flight && time > throwAt && time < strike) {
    // While the orb flies, the camera’s look leans toward it, most halfway.
    const since = time - throwAt
    const orb = flightPoint(flight.from, flight.velocity, since)
    const along = add(eye, scale(normalize(sub(orb, eye)), length(sub(aimedAt, eye))))
    aimedAt = mix3(aimedAt, along, 0.4 * Math.sin(Math.PI * since / (strike - throwAt)))
  }
  return {
    position: eye,
    target: aimedAt,
    fov: fov + thrown.fov,
    roll,
  }
}

/** Where the camera is and what it looks at `time` seconds into the film: its path round the portal, see {@link pathAt}, with the blows of the fusion and a slight sway as if held by hand. */
export const shotAt = (time: number, context: PathContext) => handheld(pathAt(time, context), time, context.timeline)

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
    const framed = shot(time)
    const {fov, position} = framed
    const angles = shotAngles(framed)
    let {yaw} = angles
    if (previousYaw !== undefined) {
      yaw += Math.round((previousYaw - yaw) / 360) * 360
    }
    previousYaw = yaw
    keyframes.push({
      time: Number(time.toFixed(6)),
      position: position.map(value => Number(value.toFixed(5))),
      yaw: Number(yaw.toFixed(4)),
      pitch: Number(angles.pitch.toFixed(4)),
      roll: Number(angles.roll.toFixed(4)),
      fov: Number(fov.toFixed(4)),
      ...tools.has(frame) ? {tools: tools.get(frame)} : {},
    })
  }
  await fs.writeFile(file, JSON.stringify(keyframes))
}
/** The room the slot’s wall belongs to, by the point just in front of it. */
const slotRoom = (world: World, {position, rotation}: PortraitSlot) => {
  const room = world.roomAt([position[0] + Math.sin(rotation) * 0.3, position[1], position[2] + Math.cos(rotation) * 0.3])
  return room?.id
}
/** how much room there is in front of the slot for the camera, up to 6 m, and along its wall to the nearer side, up to 3 m, as its portal measures it */
const slotSpace = (world: World, slot: PortraitSlot) => {
  const normal: Vec3 = [Math.sin(slot.rotation), 0, Math.cos(slot.rotation)]
  const tangent: Vec3 = [normal[2], 0, -normal[0]]
  const probe = add(slot.position, scale(normal, 0.3))
  return {
    depth: Math.min(6, world.wallDistance(slot.position, normal)),
    sides: Math.min(3, world.wallDistance(probe, scale(tangent, -1)), world.wallDistance(probe, tangent)),
  }
}
const isSlotOf = (slot: PortraitSlot, position: Vec3) => Math.hypot(...position.map((value, axis) => value - slot.position[axis])) < 1e-6
/** The work the fusion takes in the world, by --portrait, --room and --slot: a default work where the seed hangs it, or an image hung in a slot of the room. */
const resolveWork = async (world: World, {portrait, room, slot: slotId}: {
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
    const work = portrait === undefined ? works.find(candidate => slotRoom(world, slots.find(slot => isSlotOf(slot, candidate.position))!) === inRoom) : works.find(candidate => candidate.id === portrait)
    if (!work) {
      throw new Error(portrait === undefined ? `With seed ${seed}, no default work hangs in “${inRoom}”; name one with --portrait or try another --seed.` : `With seed ${seed}, “${portrait}” doesn’t hang anywhere, as the seed drew other works of its ratio; try another --seed.`)
    }
    const slot = slots.find(candidate => isSlotOf(candidate, work.position))!
    const workRoom = slotRoom(world, slot)!
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
      const {depth, sides} = slotSpace(world, candidate)
      return depth + sides
    }
    slot = slots.filter(candidate => slotRoom(world, candidate) === inRoom).toSorted((a, b) => Number(taken(a)) - Number(taken(b)) || space(b) - space(a) || a.id.localeCompare(b.id)).at(0)
    if (!slot) {
      throw new Error(`The room “${inRoom}” has no portrait slots.`)
    }
  } else {
    slot = slots.find(candidate => candidate.id === slotId)
    if (!slot) {
      throw new Error(`There is no portrait slot “${slotId}”.`)
    }
    if (room !== undefined && slotRoom(world, slot) !== room) {
      throw new Error(`The slot “${slotId}” is in “${slotRoom(world, slot)}”, not in “${room}”.`)
    }
  }
  const label = isFile ? parse(file).name : parse(URL.parse(portrait)!.pathname).name
  return {
    label: label || 'image',
    room: slotRoom(world, slot)!,
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

/** what a film would show, as --plan-file writes it */
export type FusionPlan = {
  /** how --emphasis ends the film, unless neutral */
  closing?: Closing
  /** the throw: where it leaves from, how fast and how long it flies until it strikes */
  flight: {
    from: Vec3
    seconds: number
    velocity: Vec3
  }
  fps: number
  /** every frame’s shot */
  frames: Array<Shot>
  ingredient: {
    orb?: string
    prop: string
  }
  /** keys through the camera’s path round the portal before it is held by hand and the emphasis ends the film, or those of --camera */
  keys: Array<CameraKey>
  portal: PortalFrame
  room: string
  slot: PortraitSlot
  /** where the orb enters the world until it is thrown */
  spawn?: Vec3
  throwSpeed: number
  timeline: Timeline
  /** the id the image of --portrait hangs under */
  work?: string
  world: WorldId
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
  let size: Pick<PortraitDump, 'frame' | 'height' | 'width'> | undefined
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
    ...size!.frame === undefined ? {} : {frame: size!.frame},
  }
}
/** the moments a plan has keys of the camera’s path at: where orbitKeys has them, round the throw and the strike, where the burst knocks the camera back and where it holds after stepping aside for the result */
const planKeyTimes = ({emergence, end, strike, throwAt}: Timeline) => [0, throwAt, (throwAt + strike) / 2, strike, strike + 0.3, strike + 0.75, strike + 1.45, strike + 2.1, strike + 2.6, strike + 4.6, strike + 6.5, strike + 8.5, emergence - 1.5, emergence, emergence + 0.8, emergence + 1.6, emergence + 2.6, (emergence + 2.6 + end) / 2, end].filter((time, index, times) => time <= end && time > (times[index - 1] ?? -1))
const roundShot = ({fov, position, roll, target}: Shot): Shot => ({
  position: position.map(value => Number(value.toFixed(5))) as Vec3,
  target: target.map(value => Number(value.toFixed(5))) as Vec3,
  fov: Number(fov.toFixed(4)),
  roll: Number(roll.toFixed(4)),
})
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
  const ending = text('end')
  resolveSettle(options.settle)
  const seed = parseSeed(options.seed)
  if (seed === undefined) {
    throw new Error(`--seed expects a whole number, got “${options.seed}”.`)
  }
  const ingredient = resolveIngredient(options.ingredient)
  /** what the fusion’s portal shows as the result flips out, which --emphasis party keeps in view */
  const effect = ingredient.orb?.effect
  // The room opens its world, like the Sandbox for its Cell, the gallery for any other.
  const worldId = readWorld(`?${new URLSearchParams({room: text('room') ?? ''})}`)
  const {default: world} = await worldModules[worldId]()
  const work = await resolveWork(world, {
    portrait: text('portrait'),
    room: text('room'),
    slot: text('slot'),
  }, seed)
  const {slot} = work
  const portal = portalIn(slot, world)
  // The throw falls on a frame, so the probe and the film run it on the same one.
  const throwAt = Math.round(fps) / fps
  const cameraFile = text('camera')
  const camera: CameraPath | undefined = cameraFile === undefined ? undefined : parseCameraPath(await fs.readJson(resolve(cameraFile)))
  const timeline: Timeline = {
    throwAt,
    strike: throwAt + 0.4,
    emergence: 0,
    end: ending === undefined ? camera?.end ?? filmLength : positiveNumber(ending, 'end'),
  }
  let flight: PathContext['flight']
  const context = (): PathContext => ({
    flight,
    portal,
    timeline,
    work: slot.position,
    world,
  })
  const held = camera?.handheld ?? true
  const hold = (framed: Shot, time: number) => (held ? handheld(framed, time, timeline) : framed)
  /** the camera’s path, its own or that of --camera, before it is held by hand and the emphasis ends the film */
  const base = (time: number) => (camera ? keyedShot(camera.keys, time) : pathAt(time, context()))
  const shot = (closing?: Closing) => (time: number): Shot => emphasized(hold(base(time), time), closing, time, timeline, closed => hold(closed, time))
  // The throw leaves from in front of the camera as it is when it throws, whose path bends toward where the orb strikes, which depends on where it leaves from: a few rounds settle both. The throw’s own motion of the camera only starts after it.
  let from: Vec3 = [0, 0, 0]
  for (let round = 0; round < 8; round++) {
    timeline.emergence = timeline.strike + fusionTiming.minimum + fusionTiming.climax
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
  if (emphasis === 'party' && ending === undefined) {
    // on the first frame a second after the party is over
    timeline.end = Math.ceil((timeline.emergence + partyLength(effect) + partyOutro) * fps - 1e-6) / fps
  }
  if (emphasis !== 'neutral' && timeline.end < timeline.emergence + 2) {
    throw new Error(`--emphasis ${emphasis} ends the film from when the result flips out at ${timeline.emergence.toFixed(2)} s, but it ends at ${timeline.end.toFixed(2)} s; make it end at least 2 s later.`)
  }
  const start = shot()(0)
  const tools = new Map<number, Record<string, Record<string, unknown>>>
  /** the id an image hangs under */
  const workId = `film-${work.label.replaceAll(/[^\w-]/g, '-').slice(0, 80)}`
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
        // The same in the probe and in the film, as the result of an ingredient that brings no frame rolls its own by the id of the work.
        id: workId,
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
  const planFile = text('plan-file')
  const outputFile = text('output-file')
  const output = outputFile === undefined ? join(fusionRoot, `${work.label}-${ingredient.label}-${timestamp()}.webm`) : resolve(outputFile)
  const side = text('width') ?? text('height') ?? String(videoSize)
  const [width, height] = [text('width') ?? side, text('height') ?? side]
  const room = world.roomById(work.room)!
  const framing = {
    aspect: Number(width) / Number(height),
    ceiling: room.floorY + (room.height ?? 3),
    portal,
    world,
  }
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
    let closing: Closing | undefined = emphasis === 'party' ? partyClosing(partyViews(portal, effect, timeline), timeline, framing) : undefined
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
      const result = resultClosing(landing, framing)
      if (dot(result.normal, rotate([0, 0, 1], landing.quaternion)) < 0) {
        console.warn('Warning: the result lands face down, so the closing shot shows its back.')
      }
      if (landing.settled > timeline.end - 1) {
        console.warn(`Warning: the result only lies still ${(timeline.end - landing.settled).toFixed(2)} s before the film ends, too late to crane up over it calmly.`)
      }
      closing = result
      // The film dumps the works once more at its end, to tell how closely it followed the probe.
      tools.set(Math.round(timeline.end * fps) - 1, {dump_portraits: {}})
    }
    if (planFile !== undefined) {
      const framed = shot(closing)
      const plan: FusionPlan = {
        fps,
        world: worldId,
        room: work.room,
        slot,
        ingredient: {
          prop: ingredient.prop,
          ...ingredient.orb ? {orb: ingredient.orb.id} : {},
        },
        portal,
        timeline,
        ...imageUrl === undefined ? {} : {work: workId},
        throwSpeed,
        flight: {
          ...flight!,
          seconds: timeline.strike - throwAt,
        },
        spawn: (tools.get(0)?.spawn_orb as {position: Vec3} | undefined)?.position,
        ...closing ? {closing} : {},
        keys: camera?.keys ?? planKeyTimes(timeline).map(time => ({
          time,
          ...roundShot(pathAt(time, context())),
        })),
        frames: Array.from({length: Math.round(timeline.end * fps) + 1}, (_, frame) => roundShot(framed(frame / fps))),
      }
      await fs.outputJson(resolve(planFile), plan)
      return {
        plan: resolve(planFile),
        timeline,
      }
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
      width,
      height,
      recipe,
      ...Object.fromEntries(['crf', 'fast-decode', 'keyframe-interval', 'preset'].flatMap(key => (text(key) === undefined ? [] : [[key, text(key)]]))),
      'output-file': output,
    })
    // How far from where the probe saw it the result came to rest in the film, which the camera planned for
    const rested = closing?.kind === 'result' ? findLanding(dumpsIn(filmed.tools), workIdIn(filmed.tools)) : undefined
    return {
      ...filmed,
      drift: rested && closing?.kind === 'result' ? length(sub(rested.position, closing.landing.position)) : undefined,
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
    const result = await main(values)
    const shorten = (file: string) => {
      const inRepository = relative(repositoryRoot, file)
      return (inRepository.startsWith('..') ? file : inRepository).replaceAll('\\', '/')
    }
    if (result.plan !== undefined) {
      const {plan, timeline} = result
      console.log(`Wrote the plan of ${timeline.end.toFixed(2)} s to ${shorten(plan)}: the orb strikes at ${timeline.strike.toFixed(2)} s and the result flips out at ${timeline.emergence.toFixed(2)} s`)
      process.exit()
    }
    const {audio, drift, format, fps, frameCount, height, output, width} = result
    const written = shorten(output)
    let sound = ''
    if (audio !== undefined) {
      sound = audio === output ? ' with sound' : `, sound in ${shorten(audio)}`
    }
    const followed = drift === undefined ? '' : `; the result came to rest ${(drift * 100).toFixed(1)} cm from where the probe saw it`
    console.log(`Wrote ${format === 'png' ? `${frameCount} numbered PNGs for ${written}` : written} (${width}×${height}, ${frameCount} frames at ${fps} fps, ${(frameCount / fps).toFixed(2)} s${sound}${followed})`)
  }
}
