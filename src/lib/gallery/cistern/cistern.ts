import type {Wall} from '../../placement/wallGeometry.ts'
import type {Vec3} from '../types.ts'

import {defaultEgoOptions} from 'ego-player/motor'

import {orbRadius} from '#src/orbs/index.ts'

import {cannonLaunch, flight} from '../alchemy/alchemyMachine.ts'
import {wallFace} from '../architectureDimensions.ts'
import {climbCrossfall, climbCulvert, climbRun} from '../climb.ts'
import {cisternWindow, cisternWindowHole} from './window.ts'

type Point = readonly [x: number, z: number]

const [windowX, wallZ] = cisternWindow.center
/** the face of the cistern’s flat wall, where the channel begins behind the window and leaves through the culvert */
const faceZ = cisternWindow.channelZ
/** the radius of the channel’s round bottom */
const bore = 0.21
/** how high the channel’s sides stand upright over the middle of its round bottom, low for the orbs drifting along it */
const sides = 0.05
/** how far the channel runs straight north from the face of the flat wall before it turns, and straight back south to it after its turn: as far as leaves the floor beyond its turn a strip to fall toward it, inside the round wall */
const leg = 1.2
/** the radius of its turn, from the leg behind the window on the vestibule’s axis round to the leg on the run’s axis, where the culvert lies */
const turnRadius = (windowX - climbCulvert.x) / 2
/** the middle of its turn, where its legs end */
const turnCenter: Point = [windowX - turnRadius, faceZ - leg]
const turnLength = turnRadius * Math.PI
/** how far along it it meets the face of the flat wall again, on its way out through the culvert */
const loop = leg * 2 + turnLength
/** how far its lip stands out of the approach’s north wall */
const lip = 0.06
/** how long it runs straight south through the flat wall and the approach’s wall back to back with it, out over the approach’s floor */
const outletRun = wallFace * 2 + lip
const length = loop + outletRun
/** how high the floor stands by the channel at the window: a step under the window’s sill */
const floorAtWindow = cisternWindow.sill - cisternWindow.step
/** where the channel’s bottom lies at its start, as deep under the floor there as keeps an orb rolling along it a hand under the floor */
const startBottom = floorAtWindow - orbRadius * 2 - 0.08
/** where it lies at its lip, a few centimeters over the culvert’s sill */
const lipBottom = climbCulvert.bottom + 0.04
/** how steeply the channel falls, evenly all along */
const channelFall = (startBottom - lipBottom) / length
/** How high the channel’s bottom lies `along` meters along it in plan. */
const bottom = (along: number) => startBottom - channelFall * along
/** How high its sides stand `along` meters along it, where the floor beside them lies no higher. */
const rim = (along: number) => bottom(along) + bore + sides
/** how far along it its head rises out of it, from where its bottom runs evenly up to where it lies flush with the floor at the window, for a player to walk out of it onto the window’s sill */
const head: readonly [from: number, to: number] = [0.3, 0.5]
/** How low its bottom lies `along` meters along it, rising up its head to the floor. */
const bed = (along: number) => Math.max(bottom(along), floorAtWindow - (floorAtWindow - bottom(head[1])) * Math.max(along - head[0], 0) / (head[1] - head[0]))
/** Where the channel’s middle lies in plan `along` meters along it, and which way it runs there. */
function plan(along: number): {
  direction: Point
  point: Point
} {
  const [cx, cz] = turnCenter
  if (along <= leg) {
    return {
      point: [windowX, faceZ - along],
      direction: [0, -1],
    }
  }
  if (along <= leg + turnLength) {
    const angle = (along - leg) / turnRadius
    return {
      point: [cx + turnRadius * Math.cos(angle), cz - turnRadius * Math.sin(angle)],
      direction: [-Math.sin(angle), -Math.cos(angle)],
    }
  }
  return {
    point: [cx - turnRadius, cz + along - leg - turnLength],
    direction: [0, 1],
  }
}

/**
 * The channel round the cistern’s floor: a groove of stone with a round bottom and low upright sides, sunk into the floor, from behind the window, where it rises flush with the floor, straight north, round a half turn counter-clockwise, straight back south to the flat wall and on out through the culvert in the approach’s north wall, on the run’s axis, its lip over the approach’s floor.
 * The cannon’s shot dives into its first leg past its head and rides it round, as fast as it comes: straight first, its turn holds the orb in the groove.
 * It falls evenly all along. Its water pours into it from the inflow’s spout near the end of its first leg, runs along it and spills off its lip onto the drain in front of the culvert. Whatever drops into it rolls out with the water, steeply enough that an orb set down in it never comes to rest.
 * All values are in meters, in the world’s frame.
 */
export const cisternChannel = {
  bore,
  sides,
  length,
  lip,
  /** how long each of its straight legs is, before and after its turn */
  leg,
  turn: {
    center: turnCenter,
    radius: turnRadius,
    /** how far along it its turn starts and ends */
    from: leg,
    to: leg + turnLength,
  },
  loop,
  /** how far along it its middle crosses the center line of the flat wall, on its way out through the culvert */
  crossing: loop + wallFace,
  /** how steeply it falls, per meter along it */
  fall: channelFall,
  /** where its bottom would lie if it fell evenly all the way from the face of the flat wall */
  bottom,
  /** where its bottom lies, rising out of it at its head */
  bed,
  head,
  rim,
  /** Where its middle lies `along` meters along it in plan, as high as its sides would be if they rose to a full circle round its bottom, and which way it runs there, in 3D. */
  at(along: number) {
    const {direction: [dx, dz], point: [x, z]} = plan(along)
    const norm = Math.hypot(1, channelFall)
    return {
      point: [x, bottom(along) + bore, z] as Vec3,
      direction: [dx / norm, -channelFall / norm, dz / norm] as Vec3,
    }
  },
} as const

/** where the shot’s orb comes down into the channel, as Rapier steps it: how far along it its middle lies as it sinks to an orb’s radius over the floor at the window, into the groove */
export const cisternShotLanding = (() => {
  const y = floorAtWindow + orbRadius
  let previous = cannonLaunch.position
  for (const point of flight(cannonLaunch.position, cannonLaunch.velocity)) {
    if (point[1] <= y) {
      const share = (previous[1] - y) / (previous[1] - point[1])
      return faceZ - (previous[2] + (point[2] - previous[2]) * share)
    }
    previous = point
  }
  throw new Error('An orb flies on forever.')
})()
/** the radius of the cistern’s round wall, along its center line: the approach’s west wall runs on north into it */
const radius = turnCenter[0] - (climbCulvert.x - climbRun.width / 2)
/** where the half dome springs from the round wall, and how high it rises from there to its crown, which leans on the flat wall */
const [spring, rise] = [2.8, 2.6]
/** how steeply the floor falls toward the channel from both sides, like the climb’s paving toward its middle */
const apronFall = climbCrossfall
/** how steeply the floor falls downstream beside the channel: from the window’s sill down to the channel’s sides where it leaves through the culvert, steeper than the channel, so the floor never lies under its sides */
const apronSlope = (floorAtWindow - rim(loop)) / loop
/** How high the floor stands beside the channel’s sides, `along` meters down it. */
const apronEdge = (along: number) => floorAtWindow - apronSlope * Math.min(along, loop)
/** how far the floor reaches from the line between the ends of the channel’s legs to its sides, inside its turn and outside of it */
const [innerEdge, outerEdge] = [turnRadius - bore, turnRadius + bore]
if (rim(0) > apronEdge(0) || cisternShotLanding < head[1] || cisternShotLanding > leg) {
  throw new RangeError('The cistern’s channel needs to sink into its floor, and the shot to come down into its first leg, past its head.')
}

/**
 * The Bastion’s cistern behind the Forge’s vestibule, a half-round chamber of castle stone under a ribbed half dome, which the alchemy machine shoots orbs into through the window in the vestibule’s north wall: its flat wall, which the vestibule’s round wall touches back to back, runs on behind the approach, and its round wall springs from the approach’s west wall.
 * The channel winds round its floor, which falls toward it from all sides, so whatever lands in the cistern rolls into the channel and drifts out through the culvert. A player gets in only by ducking through the window, to fetch what was thrown in; the culvert lies low.
 * All values are in meters, in the world’s frame.
 */
export const cistern = {
  /** the middle of its flat wall, on its center line, which the round wall’s center line turns round */
  center: [turnCenter[0], wallZ] as Point,
  radius,
  spring,
  rise,
  crown: spring + rise,
  /** the floor’s fall toward the channel, across it */
  apronFall,
  /** the floor’s fall downstream beside the channel */
  apronSlope,
  innerEdge,
  outerEdge,
  apronEdge,
  /** how high its floor lies at its lowest, by the channel where it leaves, and at its highest, in the middle of the channel’s turn */
  floorRange: [apronEdge(loop), floorAtWindow + apronFall * innerEdge] as const,
}

/** how many ribs run up the half dome, evenly round it between its ends */
export const cisternDomeRibs = 7
/**
 * The lantern hanging from the half dome over the floor inside the channel’s turn, between two of the dome’s ribs, which lights the cistern and shines out through the window into the vestibule: the middle of its body, and where its rod meets the dome, straight above it, with the dome’s face there, facing down.
 * In the world’s frame.
 */
export const cisternLantern = (() => {
  const azimuth = Math.PI * (3.5 / (cisternDomeRibs + 1))
  const out = 3
  const [x, z] = [cistern.center[0] + Math.cos(azimuth) * out, cistern.center[1] - Math.sin(azimuth) * out]
  const inside = radius - wallFace
  const height = Math.sqrt(1 - (out / inside) ** 2)
  const anchorY = spring + rise * height
  // the ellipsoid’s gradient there, out and up, turned to face down into the cistern
  const [outward, upward] = [out / inside ** 2, rise * height / rise ** 2]
  const norm = Math.hypot(outward, upward)
  const light: Vec3 = [x, anchorY - 1.1, z]
  return {
    light,
    anchor: [x, anchorY, z] as Vec3,
    normal: [-outward / norm * Math.cos(azimuth), -upward / norm, outward / norm * Math.sin(azimuth)] as Vec3,
    drop: 1.1,
  }
})()

/** how far down the channel the inflow’s water pours into it, near the end of its first leg */
const inflowAlong = leg - 0.05
/** how high the inflow’s pipe leaves the foot of the half dome, and how high it turns down over the channel */
const [inflowLeaves, inflowTurns] = [3.35, 2.95]
/** how high its spout’s mouth hangs, clear over the head of a player standing beside the channel under it */
const inflowMouth = apronEdge(inflowAlong) + defaultEgoOptions.height + 0.12
/**
 * The pipe that feeds the cistern’s channel: out of the foot of the half dome near the east end of the round wall, halfway to its first rib, sloping down over the floor toward the channel and turning down over it near the end of its first leg, into a short spout the water pours out of into the channel.
 * Its corners in the world’s frame: where it leaves the half dome’s inside, with the dome’s normal there, facing into the cistern, where it turns down, and its mouth; and how far down the channel its water lands, and how high the water’s surface lies there.
 */
export const cisternInflow = (() => {
  const azimuth = Math.PI / (cisternDomeRibs + 1) / 2
  const inside = radius - wallFace
  const elevation = Math.asin((inflowLeaves - spring) / rise)
  const [cos, sin] = [Math.cos(elevation), Math.sin(elevation)]
  const [outward, upward] = [cos / inside, sin / rise]
  const norm = Math.hypot(outward, upward)
  const [x, , z] = cisternChannel.at(inflowAlong).point
  return {
    leaves: [cistern.center[0] + inside * cos * Math.cos(azimuth), inflowLeaves, cistern.center[1] - inside * cos * Math.sin(azimuth)] as Vec3,
    normal: [-outward / norm * Math.cos(azimuth), -upward / norm, outward / norm * Math.sin(azimuth)] as Vec3,
    turns: [x, inflowTurns, z] as Vec3,
    mouth: [x, inflowMouth, z] as Vec3,
    along: inflowAlong,
  }
})()
if (inflowAlong > leg || inflowMouth > inflowTurns - 0.2) {
  throw new RangeError('The cistern’s inflow has to pour into the channel’s first leg, out of a spout under its turn.')
}

/** Where the half dome’s inside lies straight over the point in plan, inside the cistern. */
export function cisternDomeHeight(x: number, z: number) {
  const out = Math.hypot(x - cistern.center[0], z - cistern.center[1]) / (radius - wallFace)
  return spring + rise * Math.sqrt(Math.max(0, 1 - out ** 2))
}

/**
 * How high the cistern’s floor lies under the point in plan: falling toward the channel from its round wall and from the line between the ends of the channel’s legs, which stands highest, and downstream along it.
 * Over the channel, as high as the floor beside it.
 */
export function cisternFloorHeight(x: number, z: number) {
  const {along, out} = polar(x, z)
  const edge = apronEdge(along)
  if (out <= innerEdge) {
    const middle = apronEdge(0)
    return middle + (edge - middle) * out / innerEdge + apronFall * (innerEdge - out)
  }
  return edge + apronFall * Math.max(0, out - outerEdge)
}

/** Whether the point in plan lies within the cistern, inside its walls’ center lines. */
export function insideCisternPlan(x: number, z: number) {
  return z <= wallZ && Math.hypot(x - cistern.center[0], z - cistern.center[1]) <= radius
}

/** The cistern’s floor under the point in plan, or undefined outside of it. */
export function cisternFloor(x: number, z: number) {
  return insideCisternPlan(x, z) ? cisternFloorHeight(x, z) : undefined
}

/** Whether the position lies in the cistern, from a meter under its floor up to its crown. */
export function insideCistern([x, y, z]: Vec3) {
  const floor = cisternFloor(x, z)
  return floor !== undefined && y >= floor - 1 && y <= cistern.crown
}

/** How far along the channel the point in plan lies abreast of it, and how far from the line between the ends of its legs, which its middle runs round at the turn’s radius: beside its legs, square to them, and round its turn, from the turn’s center. */
function polar(x: number, z: number) {
  const [cx, cz] = turnCenter
  if (z >= cz) {
    const into = Math.min(Math.max(faceZ - z, 0), leg)
    return {
      along: x >= cx ? into : loop - into,
      out: Math.abs(x - cx),
    }
  }
  return {
    along: leg + Math.atan2(cz - z, x - cx) * turnRadius,
    out: Math.hypot(x - cx, z - cz),
  }
}
/** how many boxes the cistern’s air is cut into, in strips from west to east */
const airStrips = 8
/** Boxes round the cistern’s air, strips from west to east, each from its lowest floor to its crown and from the flat wall’s center line to the round wall’s, where the strip reaches furthest north. */
export function cisternChunks() {
  const [x, z] = cistern.center
  return Array.from({length: airStrips}, (_, strip) => {
    const [west, east] = [strip, strip + 1].map(edge => x - radius + radius * 2 * edge / airStrips)
    const nearest = west < x && east > x ? 0 : Math.min(Math.abs(west - x), Math.abs(east - x))
    return {
      min: [west, cistern.floorRange[0], z - Math.sqrt(radius ** 2 - nearest ** 2)] as Vec3,
      max: [east, cistern.crown, z] as Vec3,
    }
  })
}

/** how often the baseboard’s contact with the floor is sampled along a wall, at most this far apart */
const contactStep = 0.25
/** Where the floor meets the wall along its face, in the wall’s own coordinates, for its baseboard to follow. */
function floorContact(wall: Omit<Wall, 'id'>, at: (u: number) => Point) {
  const steps = Math.ceil(wall.width / contactStep)
  return Array.from({length: steps + 1}, (_, step) => {
    const u = -wall.width / 2 + wall.width * step / steps
    return [u, cisternFloorHeight(...at(u)) - wall.center[1]] as const
  })
}
const flatWall: Omit<Wall, 'id'> = {
  room: 'bastion',
  center: [cistern.center[0], 0, wallZ],
  // Facing north, into the cistern
  rotation: Math.PI,
  width: radius * 2,
  height: cistern.crown,
  sticky: false,
  trimStyle: 'plain',
  cornice: false,
}
const roundWall: Omit<Wall, 'id'> = {
  room: 'bastion',
  center: [cistern.center[0], 0, wallZ - radius],
  // Facing south, toward the middle of the flat wall, which it turns round
  rotation: 0,
  width: Math.PI * radius,
  curveRadius: radius,
  height: spring,
  sticky: false,
  trimStyle: 'plain',
  cornice: false,
}
/**
 * The cistern’s walls: the flat one, with the window onto the vestibule and the culvert onto the approach in it, and the round one under the half dome.
 * They stand on the cistern’s floor, and their baseboards follow it.
 */
export const cisternWalls: ReadonlyArray<Wall> = [
  {
    ...flatWall,
    id: 'bastion-cistern_flat',
    baseboardProfile: floorContact(flatWall, u => [cistern.center[0] - u, faceZ]),
    holes: [
      {
        ...cisternWindowHole(flatWall, [0, 0, 0]),
        name: 'vestibule',
      },
      {
        name: 'approach',
        u: cistern.center[0] - climbCulvert.x,
        width: climbCulvert.width,
        bottom: climbCulvert.bottom,
        height: climbCulvert.height,
        profile: 'rectangle',
        casing: false,
      },
    ],
  },
  {
    ...roundWall,
    id: 'bastion-cistern_round',
    baseboardProfile: floorContact(roundWall, u => {
      const angle = u / radius
      const face = radius - wallFace
      return [cistern.center[0] + Math.sin(angle) * face, wallZ - Math.cos(angle) * face]
    }),
  },
]
