import type {Vec3} from '../types.ts'

import {BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2, Vector3} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import {openingReveal} from '../BarredOpeningGeometry.ts'
import {climbCulvert, climbDrain} from '../climb.ts'
import {cistern, cisternChannel, cisternFloorHeight, cisternInflow, cisternWalls} from './cistern.ts'
import {cisternWindow} from './window.ts'

type Section = ReadonlyArray<readonly [lateral: number, y: number]>

/** how many stations the channel’s collider is cut into along it: coarsely, as a welded collider cut into triangles a few centimeters long holds an orb at rest in it until it falls asleep */
const collisionStations = 190
/** how many pieces the channel’s round bottom is cut into, for the eye and for its collider, which an odd count leaves a level facet along its bottom, for an orb to roll along */
const bottomSegments = [12, 15] as const
/** how deep the water runs in the channel, over its bottom */
export const channelWaterDepth = 0.06
/** how far up the channel from where the inflow’s water lands it runs on, thinning out to nothing against the fall */
const backwater = 0.3
/** how many rows the water takes where it thins out up the channel */
const backwaterRows = 6
/** how many pieces the cistern’s floor is cut into along each of the channel’s legs and round its turn, and how many rings it is cut into inside and outside the channel: it falls evenly out from the channel along every spoke, so a few rings follow it */
const [legSegments, turnSegments, innerRings, outerRings] = [8, 48, 3, 2] as const
/** how long the water takes from the channel’s lip down into the drain, a little past the floor, through the grate */
const outfallBelow = 0.04
/** how fast the inflow’s water leaves its spout, downward, and how wide its stream is there */
const [spoutSpeed, spoutStream] = [1.1, 0.042] as const
const gravity = 9.81
const {bore, head, leg, length, loop, turn} = cisternChannel
const turnLength = turn.to - turn.from
const lipAlong = length
/** How far along the channel, from `from` to its lip: evenly over its stretch in the cistern, out of `count` stations along all of it, and five through the culvert. */
const alongs = (count: number, from = 0) => {
  const inside = Math.round(count * (loop - from) / length)
  return [
    ...Array.from({length: inside}, (_, index) => from + (loop - from) * index / inside),
    ...Array.from({length: 5}, (_, index) => loop + (length - loop) * index / 4),
  ]
}
/**
 * The stations the channel’s stone and water are drawn at, from `from` on: where the floor’s spokes meet it, so its sides meet the floor’s edge at the same points, where its head starts and ends rising and five through the culvert. Between them its bottom and its sides run straight, but round the turn.
 */
const visibleAlongs = (from = 0) => [
  ...Array.from({length: legSegments}, (_, index) => leg * index / legSegments),
  ...Array.from({length: turnSegments}, (_, index) => turn.from + turnLength * index / turnSegments),
  ...Array.from({length: legSegments}, (_, index) => turn.to + leg * index / legSegments),
  ...Array.from({length: 5}, (_, index) => loop + (length - loop) * index / 4),
  ...head,
  from,
].filter((along, index, all) => along >= from - 1e-9 && all.findIndex(other => Math.abs(other - along) < 1e-9) === index).toSorted((a, b) => a - b)
/** Where a point of the channel’s section lies `along` meters down it, `lateral` meters to the right of its middle, at the height `y`. */
function place(along: number, lateral: number, y: number): Vec3 {
  const {point: [x, , z], direction: [dx, , dz]} = cisternChannel.at(along)
  const norm = Math.hypot(dx, dz)
  return [x - dz / norm * lateral, y, z + dx / norm * lateral]
}
/** The channel’s round bottom from its left side to its right, with its upright sides up to `top`; up its head, only what of it lies under `top`. */
function groove(along: number, top: number, segments: number): Section {
  const middle = cisternChannel.bed(along) + bore
  return [
    [-bore, top],
    ...Array.from({length: segments + 1}, (_, index): readonly [number, number] => {
      const angle = Math.PI * index / segments
      return [-bore * Math.cos(angle), Math.min(middle - bore * Math.sin(angle), top)]
    }),
    [bore, top],
  ]
}
/** how high the channel’s sides stand `along` meters down it: up to the floor beside it, through the walls up to its rim */
const sideTop = (along: number) => (along <= loop ? cistern.apronEdge(along) : cisternChannel.rim(along))
/** Which way is right of the channel `along` meters down it, scaled by `side`. */
const rightOf = (along: number, side = 1) => {
  const [x, , z] = place(along, side, 0)
  const [mx, , mz] = place(along, 0, 0)
  return [x - mx, 0, z - mz] as Vec3
}
/** The stone that lines the window through the cistern’s flat wall and the vestibule’s round wall back to back with it, out to where the round wall’s center line curves furthest away from the flat wall’s, at its jambs. */
export function cisternWindowGeometry() {
  const wall = cisternWalls.find(value => value.id === 'bastion-cistern_flat')!
  return openingReveal(wall, wall.holes!.find(value => value.name === 'vestibule')!, cisternWindow.gap)
}
/**
 * A strip swept through the sections at the stations along the channel, facing the side `toward` points to from the section’s first point, at the first station where it lies apart from the next point.
 * Smooth along the channel and across the section.
 */
function strip(along: ReadonlyArray<number>, section: (along: number) => Section, toward: Vec3) {
  const rows = along.map(value => section(value).map(([lateral, y]) => place(value, lateral, y)))
  const columns = rows[0].length
  const positions = rows.flat(2)
  // at the first station where the section’s first two points lie apart, as up the channel’s head they meet
  const normal = new Vector3
  for (const [index, row] of rows.slice(0, -1).entries()) {
    const [a, b, c] = [row[0], row[1], rows[index + 1][0]].map(point => new Vector3(...point))
    normal.copy(b.sub(a).cross(c.sub(a)))
    if (normal.lengthSq() > 1e-12) {
      break
    }
  }
  const flip = normal.dot(new Vector3(...toward)) > 0
  const indices: Array<number> = []
  for (let row = 0; row < rows.length - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const first = row * columns + column
      const [right, below, diagonal] = [first + 1, first + columns, first + columns + 1]
      indices.push(...flip ? [first, right, below, right, diagonal, below] : [first, below, right, right, below, diagonal])
    }
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
/** A flat cap across the channel `along` meters down it, filling the outline, facing along the channel or back up it. */
function cap(along: number, outline: Section, forward: boolean) {
  const corners = outline.map(([lateral, y]) => place(along, lateral, y))
  const triangles = ShapeUtils.triangulateShape(outline.map(([lateral, y]) => new Vector2(lateral, y)), [])
  const {direction} = cisternChannel.at(along)
  const facing = new Vector3(...direction)
  facing.multiplyScalar(forward ? 1 : -1)
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(corners.flat(), 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(corners.flatMap(() => facing.toArray()), 3))
  const [first, u, v] = [new Vector3, new Vector3, new Vector3]
  geometry.setIndex(triangles.flatMap(([a, b, c]) => {
    first.fromArray(corners[a])
    u.fromArray(corners[b]).sub(first)
    v.fromArray(corners[c]).sub(first)
    return u.cross(v).dot(facing) > 0 ? [a, b, c] : [a, c, b]
  }))
  return geometry
}
/**
 * Where the floor’s pieces lie round the channel, each on a line square to the line between the ends of its legs, from the start of the channel to its end: the point on that line, and which way the line runs from it, out of the cistern.
 * Beside the legs, the points lie along that line and the lines run east and west; round the turn, the points all lie at the turn’s center and the lines fan out from it.
 */
const floorSpokes = (() => {
  const [x, z] = turn.center
  const face = z + leg
  return [
    ...Array.from({length: legSegments}, (_, index) => ({
      base: [x, face - leg * index / legSegments] as const,
      out: [1, 0] as const,
    })),
    ...Array.from({length: turnSegments}, (_, index) => {
      const angle = Math.PI * index / turnSegments
      return {
        base: [x, z] as const,
        out: [Math.cos(angle), -Math.sin(angle)] as const,
      }
    }),
    ...Array.from({length: legSegments + 1}, (_, index) => ({
      base: [x, z + leg * index / legSegments] as const,
      out: [-1, 0] as const,
    })),
  ]
})()
/** How far out along each of the floor’s spokes the round wall’s center line lies. */
const wallReach = floorSpokes.map(({base: [x, z], out: [dx, dz]}) => {
  const [cx, cz] = cistern.center
  const [ox, oz] = [x - cx, z - cz]
  const along = ox * dx + oz * dz
  return -along + Math.sqrt(along ** 2 - (ox ** 2 + oz ** 2 - cistern.radius ** 2))
})
/** The floor between the rings, each `reach(spoke)` meters out along every spoke, facing up. */
function floorBand(rings: ReadonlyArray<(spoke: number) => number>) {
  const positions = rings.flatMap(reach => floorSpokes.flatMap(({base: [x, z], out: [dx, dz]}, spoke) => {
    const [px, pz] = [x + dx * reach(spoke), z + dz * reach(spoke)]
    return [px, cisternFloorHeight(px, pz), pz]
  }))
  const indices: Array<number> = []
  const columns = floorSpokes.length
  for (let row = 0; row < rings.length - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const first = row * columns + column
      const [next, outer, diagonal] = [first + 1, first + columns, first + columns + 1]
      // Rings grow outward, counter-clockwise seen from above; where they start at a single point round the turn, the triangles there fold away to nothing.
      indices.push(first, outer, next, next, outer, diagonal)
    }
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
/** The floor’s edge along the face of the flat wall from `from` to `to` along x, down to the wall’s foot, facing out of the cistern, where the window and the culvert open over and under the floor. */
function floorSkirt(from: number, to: number) {
  const z = turn.center[1] + leg
  const steps = Math.ceil((to - from) / 0.1)
  const positions = Array.from({length: steps + 1}, (_, step) => {
    const x = from + (to - from) * step / steps
    return [x, 0, z, x, cisternFloorHeight(x, z), z]
  }).flat()
  const indices = Array.from({length: steps}, (_, step) => {
    const [bottom, top, nextBottom, nextTop] = [step * 2, step * 2 + 1, step * 2 + 2, step * 2 + 3]
    return [bottom, nextBottom, top, top, nextBottom, nextTop]
  }).flat()
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * The cistern’s floor, sunk into which its channel winds, and the water in the channel, pouring into it out of the inflow’s spout and falling off its lip, all in the world’s frame, see {@link cistern} and {@link cisternChannel}.
 * The floor collides as it shows, the channel’s groove through `channelCollision`, cut more coarsely.
 */
export default class CisternGeometry {
  /** the channel’s groove and, through the walls, the stone it runs out in, and its lip */
  readonly channel: BufferGeometry
  readonly channelCollision: BufferGeometry
  /** the water pouring out of the inflow’s spout into the channel and falling off the channel’s lip into the drain, its UV v the water’s age in seconds, with the attributes the fountain’s falling water reads */
  readonly falling: BufferGeometry
  readonly floor: BufferGeometry
  /** the water running along the channel from where the inflow pours it in, its UV v how far along it */
  readonly water: BufferGeometry

  constructor() {
    // Its groove faces in, which its left side does toward its right.
    const channelStrips = (stations: ReadonlyArray<number>, segments: number) => {
      const insideAlongs = stations.filter(along => along <= loop + 1e-9)
      const runAlongs = stations.filter(along => along >= loop - 1e-9)
      return [
        strip(insideAlongs, along => groove(along, sideTop(along), segments), rightOf(0)),
        strip(runAlongs, along => groove(along, sideTop(along), segments), rightOf(loop)),
      ]
    }
    // Through the walls, the stone fills the culvert across, up to the channel’s rim, down to its sill.
    const half = climbCulvert.width / 2 - 0.005
    const runAlongs = visibleAlongs().filter(along => along >= loop - 1e-9)
    const masonry = (side: number) => [
      strip(runAlongs, along => (side > 0 ? [[bore, sideTop(along)], [half, sideTop(along)]] : [[-half, sideTop(along)], [-bore, sideTop(along)]]), [0, 1, 0]),
      strip(runAlongs, along => (side > 0 ? [[half, sideTop(along)], [half, climbCulvert.bottom]] : [[-half, climbCulvert.bottom], [-half, sideTop(along)]]), rightOf(loop, side)),
    ]
    /** The stone across the culvert `along` meters down the channel, round its groove. */
    const culvertOutline = (along: number): Section => [
      [-half, climbCulvert.bottom],
      [half, climbCulvert.bottom],
      [half, sideTop(along)],
      ...groove(along, sideTop(along), bottomSegments[0]).toReversed(),
      [-half, sideTop(along)],
    ]
    this.channel = mergeParts([
      ...channelStrips(visibleAlongs(), bottomSegments[0]),
      ...masonry(1),
      ...masonry(-1),
      // where it enters the culvert, under the floor’s edge, and its lip
      cap(loop, culvertOutline(loop), false),
      cap(lipAlong, culvertOutline(lipAlong), true),
    ])
    this.channelCollision = mergeParts(channelStrips(alongs(collisionStations), bottomSegments[1]))
    this.water = this.flowingWater()
    this.falling = mergeParts([this.fallingWater(), this.pouringWater()])
    const [cx] = turn.center
    this.floor = mergeParts([
      floorBand(Array.from({length: innerRings + 1}, (_, ring) => () => cistern.innerEdge * ring / innerRings)),
      floorBand(Array.from({length: outerRings + 1}, (_, ring) => (spoke: number) => cistern.outerEdge + (wallReach[spoke] - cistern.outerEdge) * ring / outerRings)),
      floorSkirt(cx - cistern.radius, cx - cistern.outerEdge),
      floorSkirt(cx - cistern.innerEdge, cx + cistern.innerEdge),
      floorSkirt(cx + cistern.outerEdge, cx + cistern.radius),
    ])
  }

  dispose() {
    for (const geometry of [this.channel, this.channelCollision, this.falling, this.floor, this.water]) {
      geometry.dispose()
    }
  }

  /** The water falling off the channel’s lip as a sheet as wide as its surface there, thrown out just far enough to land in the middle of the drain, and on down through its grate. */
  private fallingWater() {
    const across = Math.sqrt(bore ** 2 - (bore - channelWaterDepth) ** 2)
    const [x, , z] = place(lipAlong, 0, 0)
    const start = cisternChannel.bottom(lipAlong) + channelWaterDepth
    const landing = Math.sqrt(2 * start / gravity)
    const end = Math.sqrt(2 * (start + outfallBelow) / gravity)
    const speed = (climbDrain.center[1] - z) / landing
    const [rows, columns] = [14, 6]
    const positions: Array<number> = []
    const uvs: Array<number> = []
    const falls: Array<number> = []
    const airs: Array<number> = []
    const lobes: Array<number> = []
    const arounds: Array<number> = []
    for (let row = 0; row <= rows; row++) {
      const age = end * row / rows
      const fall = age / end
      // a little wider as it falls, the water spreading
      const width = across * (1 + fall * 0.25)
      for (let column = 0; column <= columns; column++) {
        const lateral = -width + width * 2 * column / columns
        positions.push(x + lateral, start - gravity * age ** 2 / 2, z + speed * age)
        uvs.push(column / columns, age)
        falls.push(fall)
        airs.push(0.15 + fall * 0.45)
        lobes.push(0.5)
        arounds.push(lateral * 3, 0)
      }
    }
    const indices: Array<number> = []
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const first = row * (columns + 1) + column
        const [right, below, diagonal] = [first + 1, first + columns + 1, first + columns + 2]
        indices.push(first, right, below, right, diagonal, below)
      }
    }
    const geometry = new BufferGeometry
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    geometry.setAttribute('waterFall', new Float32BufferAttribute(falls, 1))
    geometry.setAttribute('waterAir', new Float32BufferAttribute(airs, 1))
    geometry.setAttribute('waterLobe', new Float32BufferAttribute(lobes, 1))
    geometry.setAttribute('waterAround', new Float32BufferAttribute(arounds, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }

  /** The water’s surface in the channel, `channelWaterDepth` over its bottom, from where the inflow pours it in to its lip, and a little way up the channel from there, where it thins out; its UV runs across it and along the channel in meters. */
  private flowingWater() {
    const from = cisternInflow.along - backwater
    const along = [...visibleAlongs(from), ...Array.from({length: backwaterRows - 1}, (_, index) => from + backwater * (index + 1) / backwaterRows)].filter((value, index, all) => all.findIndex(other => Math.abs(other - value) < 1e-9) === index).toSorted((a, b) => a - b)
    const columns = 4
    const positions: Array<number> = []
    const uvs: Array<number> = []
    for (const value of along) {
      const share = Math.min(Math.max((value - from) / backwater, 0), 1)
      const depth = channelWaterDepth * share * share * (3 - share * 2)
      const across = Math.sqrt(bore ** 2 - (bore - depth) ** 2)
      const y = cisternChannel.bottom(value) + depth
      for (let column = 0; column <= columns; column++) {
        const lateral = -across + across * 2 * column / columns
        positions.push(...place(value, lateral, y))
        uvs.push(column / columns, value)
      }
    }
    const indices: Array<number> = []
    for (let row = 0; row < along.length - 1; row++) {
      for (let column = 0; column < columns; column++) {
        const first = row * (columns + 1) + column
        const [right, below, diagonal] = [first + 1, first + columns + 1, first + columns + 2]
        // left to right across the flow and on down it, facing up
        indices.push(first, right, below, right, diagonal, below)
      }
    }
    const geometry = new BufferGeometry
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }

  /** The water pouring out of the inflow’s spout as a round stream, necking as it speeds up and fraying as it falls, down into the channel and a little under its surface, its UV u round it and v the water’s age in seconds. */
  private pouringWater() {
    const [x, mouth, z] = cisternInflow.mouth
    // from just inside the spout
    const top = mouth + 0.02
    const surface = cisternChannel.bottom(cisternInflow.along) + channelWaterDepth
    const end = (Math.sqrt(spoutSpeed ** 2 + 2 * gravity * (top - surface + outfallBelow)) - spoutSpeed) / gravity
    const [rows, sides] = [16, 10]
    const positions: Array<number> = []
    const uvs: Array<number> = []
    const falls: Array<number> = []
    const airs: Array<number> = []
    const lobes: Array<number> = []
    const arounds: Array<number> = []
    for (let row = 0; row <= rows; row++) {
      const age = end * row / rows
      const fall = age / end
      // narrower as it speeds up, which keeps as much water passing, then a little wider again as it takes in air and frays
      const radius = spoutStream * Math.sqrt(spoutSpeed / (spoutSpeed + gravity * age)) * (1 + fall ** 2)
      const y = top - spoutSpeed * age - gravity * age ** 2 / 2
      for (let side = 0; side <= sides; side++) {
        const angle = Math.PI * 2 * side / sides
        positions.push(x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius)
        uvs.push(side / sides, age)
        falls.push(fall)
        airs.push(0.12 + fall ** 2 * 0.6)
        lobes.push(0.5)
        arounds.push(Math.cos(angle) * 0.5, Math.sin(angle) * 0.5)
      }
    }
    const indices: Array<number> = []
    for (let row = 0; row < rows; row++) {
      for (let side = 0; side < sides; side++) {
        const first = row * (sides + 1) + side
        const [next, below, diagonal] = [first + 1, first + sides + 1, first + sides + 2]
        // round it, and on down, facing out
        indices.push(first, next, below, next, diagonal, below)
      }
    }
    const geometry = new BufferGeometry
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    geometry.setAttribute('waterFall', new Float32BufferAttribute(falls, 1))
    geometry.setAttribute('waterAir', new Float32BufferAttribute(airs, 1))
    geometry.setAttribute('waterLobe', new Float32BufferAttribute(lobes, 1))
    geometry.setAttribute('waterAround', new Float32BufferAttribute(arounds, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }
}
