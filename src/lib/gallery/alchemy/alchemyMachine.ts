import type {Vec3} from '../types.ts'

import {wallFace} from '../architectureDimensions.ts'
import {cisternWindow} from '../cistern/window.ts'
import forge from '../forge.ts'
import {ironTable, ironTableStandOff} from '../ironTable.ts'

const southZ = forge.center[1] + forge.size[1] / 2
/** where the face of the Forge’s south wall stands, which the alchemy machine stands against */
export const southWallFace = southZ - wallFace
const northZ = forge.center[1] - forge.size[1] / 2
/** how often the physics steps, in steps a second, and in how many substeps it integrates each, one for each of its solver’s iterations, as `<Physics>` of @react-three/rapier sets both by default; the cannon’s aim follows them substep by substep */
export const physicsSteps = {
  rate: 60,
  substeps: 4,
} as const
const gravity = -9.81
/** the workbench in its own frame, which lines up with the world’s: running east to west along the wall, its back toward it */
const bench = ironTable({
  length: 3.2,
  depth: 1.15,
  height: 1.3,
  // As thick as leaves an orb resting on the body’s lid down in the throat, which the sink’s bowl starts under
  top: 0.045,
  // Deep enough to keep the front feet off the floor’s brass inlay
  overhang: 0.12,
  back: 0.12,
  apron: [0.12, 0.014],
  leg: 0.07,
  // Low enough for the machine’s pipe to pass over the stretcher across the east end on its way to the riser
  stretcher: [0.12, 0.04],
  pairs: 2,
})
/**
 * The workbench against the middle of the Forge’s south wall, which the alchemy machine is built into: an iron table under a thick slab of soapstone, see {@link ironTable}, the round hole of the machine’s sink cut into its east end, left of its middle as seen from the room.
 * All values are in meters; its middle and its top’s height are in the world’s frame, everything else measured on the bench.
 */
export const workbench = {
  ...bench,
  /** the middle of its slab in plan, on the room’s axis, as close to the wall as its legs stand clear of the baseboard, its slab reaching back out over it */
  center: [forge.center[0], southZ - ironTableStandOff(bench)] as const,
}
const [benchX, benchZ] = workbench.center
/** how far the sink’s bowl turns round from upright at its rim down to the throat, in radians: it meets the throat at a fall of 25° */
const bowlSweep = Math.PI * 65 / 180

/**
 * The sink of the alchemy machine, which orbs are thrown or dropped into: a hammered brass bowl filling a round hole in the workbench’s top, flush with it, its walls running straight down through the top and curving in to a throat, which drops an orb into the machine’s body under the bench.
 * Its middle is in the world’s frame, the rest in meters.
 */
export const alchemySink = (() => {
  const radius = 0.4
  const throat = 0.17
  // The bowl is a quarter circle’s arc turning from upright at the rim by `bowlSweep`, down to the throat.
  const curve = (radius - throat) / (1 - Math.cos(bowlSweep))
  const rim = workbench.height - workbench.top
  return {
    /** the middle of its rim, flush with the bench’s top, far enough from the east end for the cube under it to clear the legs */
    center: [benchX + workbench.length / 2 - 0.2 - radius, workbench.height, benchZ] as Vec3,
    radius,
    /** the radius of the throat inside, wide enough for an orb to drop through with a little room to spare */
    throat,
    /** the radius of the bowl’s curve, which turns from the hole’s upright side under the top in toward the throat */
    curve,
    sweep: bowlSweep,
    /** how high the throat’s upper edge lies, where the bowl ends */
    throatY: rim - curve * Math.sin(bowlSweep),
    /** how thick its brass is */
    thickness: 0.012,
  }
})()

/**
 * The body of the alchemy machine under its sink, standing on the floor between the bench’s legs: an iron cube the sink’s throat runs down into, with a round window in its front glowing while it works on an orb.
 * Its pipe leaves it through the middle of its east side. In meters, its middle in plan in the world’s frame.
 */
export const machineBody = {
  center: [alchemySink.center[0], benchZ] as const,
  /** a cube, low enough for an orb dropping down the throat to come to rest on its lid under the bowl */
  size: [0.72, 0.72, 0.72] as const,
}

/** whether an orb with its middle at the position has dropped into the throat of the sink, out of reach of the bowl, so the machine takes it in: its middle under the bowl and over the throat */
export function inSinkThroat([x, y, z]: Vec3) {
  const [sinkX, , sinkZ] = alchemySink.center
  return y < alchemySink.throatY - 0.02 && y > machineBody.size[1] - 0.05 && Math.hypot(x - sinkX, z - sinkZ) < alchemySink.throat
}

/** how high the pipe runs west along the wall to the cannon */
const pipeRun = 2.1
/** how far the riser stands east of the bench’s east end, clear of it */
const riserX = benchX + workbench.length / 2 + 0.07 + 0.18
/** where the pipe’s run along the wall turns into the cannon, over the bench’s middle */
const turn: Vec3 = [benchX, pipeRun, benchZ]
/** how far up the barrel from where the pipe turns into it the cannon’s breech starts */
const feed = 0.32
/** how long the barrel is, from its breech to its muzzle */
const barrel = 0.95
/** how far down the barrel from its muzzle an orb starts, already flying */
const launchDepth = 0.3

/**
 * Where the cannon sends every orb: through the arch into the vestibule, as high over its middle as leaves the orb clear of its crown, so the barrel stands raised over a visitor’s head, and on through the window in the vestibule’s north wall, a hand over its sill, into the Bastion’s cistern.
 * All values are in the world’s frame.
 */
export const cannonTarget = {
  arch: [cisternWindow.center[0], 2.75, northZ] as Vec3,
  window: cisternWindow.aim,
}

/** How the cannon lies when its barrel points north along the room’s axis, raised by `elevation` radians: its axis, breech and muzzle, and where an orb starts down the barrel. */
function cannonPose(elevation: number) {
  const axis: Vec3 = [0, Math.sin(elevation), -Math.cos(elevation)]
  const along = (length: number) => turn.map((value, index) => value + axis[index] * length) as Vec3
  return {
    axis,
    breech: along(feed),
    muzzle: along(feed + barrel),
    start: along(feed + barrel - launchDepth),
  }
}
/** how high an orb flying from `start` at `velocity` crosses the plane `z`, as Rapier steps it */
function heightAt(start: Vec3, velocity: Vec3, z: number) {
  let previous = start
  for (const point of flight(start, velocity)) {
    if (point[2] <= z) {
      const share = (previous[2] - z) / (previous[2] - point[2])
      return previous[1] + (point[1] - previous[1]) * share
    }
    previous = point
  }
  throw new Error('An orb flies on forever.')
}
/** the speed that carries an orb from the cannon raised by `elevation` through the arch at its target height, by bisection */
function speedThroughArch(elevation: number) {
  const {axis, start} = cannonPose(elevation)
  let [low, high] = [3, 60]
  for (let iteration = 0; iteration < 60; iteration++) {
    const middle = (low + high) / 2
    if (heightAt(start, axis.map(value => value * middle) as Vec3, cannonTarget.arch[2]) < cannonTarget.arch[1]) {
      low = middle
    } else {
      high = middle
    }
  }
  return (low + high) / 2
}
/** The cannon’s elevation, by bisection: of the shots through the arch at its target height, the one that comes down through the window at its target height, as the steeper the barrel, the slower and the more steeply falling the shot. */
const elevation = (() => {
  let [low, high] = [0, Math.PI / 3]
  for (let iteration = 0; iteration < 60; iteration++) {
    const middle = (low + high) / 2
    const {axis, start} = cannonPose(middle)
    const speed = speedThroughArch(middle)
    if (heightAt(start, axis.map(value => value * speed) as Vec3, cannonTarget.window[2]) > cannonTarget.window[1]) {
      low = middle
    } else {
      high = middle
    }
  }
  return (low + high) / 2
})()
const {axis, breech, muzzle, start: launchPosition} = cannonPose(elevation)

/**
 * The brass pipe the alchemy machine blasts an orb through, from its body up to the cannon: out of the middle of the body’s east side, east under the bench past its east end, up the south wall on brackets and west along it again to over the bench’s middle, where it turns north and up into the cannon’s breech.
 * Its corners are in the world’s frame, every one but the first and the last rounded by `bend`; its radii are meters.
 */
export const alchemyPipe = {
  corners: [
    [machineBody.center[0], machineBody.size[1] / 2, benchZ],
    [riserX, machineBody.size[1] / 2, benchZ],
    [riserX, pipeRun, benchZ],
    turn,
    breech,
  ] as ReadonlyArray<Vec3>,
  bend: 0.25,
  radius: 0.18,
  /** the radius of its bore, wide enough for an orb */
  bore: 0.165,
}

/**
 * The alchemy machine’s cannon, which shoots every orb the machine is done with across the Forge, through the arch into the vestibule and through the window there into the Bastion’s cistern: a bronze barrel on an iron bracket out of the south wall, fed by the pipe at its breech.
 * Its points are in the world’s frame, its lengths in meters.
 */
export const alchemyCannon = {
  axis,
  elevation,
  breech,
  muzzle,
  length: barrel,
  /** the radius of its bore, wide enough for an orb */
  bore: 0.17,
  /** how far down the barrel from its muzzle an orb starts, already flying */
  depth: launchDepth,
}

/**
 * Where an orb flying from `position` at `velocity` is after every step of the physics, as Rapier integrates it: in each of a step’s substeps, gravity onto the velocity first, then the velocity onto the position.
 * That drops it lower than a parabola, by half of gravity times the time flown and a substep’s length: a few centimeters over a shot across the Forge.
 */
export function *flight(position: Vec3, velocity: Vec3): Generator<Vec3> {
  const substep = 1 / physicsSteps.rate / physicsSteps.substeps
  let [x, y, z] = position
  const [vx, , vz] = velocity
  let vy = velocity[1]
  for (;;) {
    for (let index = 0; index < physicsSteps.substeps; index++) {
      vy += gravity * substep
      x += vx * substep
      y += vy * substep
      z += vz * substep
    }
    yield [x, y, z]
  }
}

/**
 * How an orb leaves the cannon: its middle `depth` meters down the barrel from the muzzle, flying along the barrel at the speed that carries it, step by step, through the arch and through the window.
 */
export const cannonLaunch = (() => {
  const speed = speedThroughArch(elevation)
  return {
    position: launchPosition,
    speed,
    velocity: axis.map(value => value * speed) as Vec3,
  }
})()

/** The orb’s free flight from the cannon through the window, after every step of the physics, up to the last step short of the face of the cistern’s wall behind it. */
export const cannonFlight = (() => {
  const points: Array<Vec3> = []
  for (const point of flight(cannonLaunch.position, cannonLaunch.velocity)) {
    if (point[2] <= cisternWindow.channelZ) {
      return {points}
    }
    points.push(point)
  }
  throw new Error('An orb flies on forever.')
})()

/** where the orb holder stands on the bench’s top, in the world’s frame: in the west half, right of the cannon as seen from the room */
export const holderSpot: Vec3 = [benchX - workbench.length / 4 - 0.1, workbench.height, benchZ]
