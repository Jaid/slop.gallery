import type {GalleryRoomId as RoomId} from '#src/worlds/gallery/index.ts'
import type {Wall} from '../../placement/wallGeometry.ts'
import type {FloorChunk, FloorPolygon} from '../floorPolygons.ts'
import type {Vec3} from '../types.ts'

import {clipPolygon, floorChunks} from '../floorPolygons.ts'
import passageOrientation from '../passages/orientation.ts'

export type StairBlock = {
  /** the axis a block of a flight along x or z runs along; a block of a flight askew of both runs along its own x and turns by its `yaw` */
  axis?: 0 | 2
  direction: number
  position: Vec3
  size: Vec3
  top: number
  tread: boolean
  /** the turn around y of a block of a flight askew of both axes */
  yaw?: number
}
export type StairBeam = {
  position: Vec3
  rotation: Vec3
  size: Vec3
}
export const stairThickness = 0.6
export const stairHeadroom = 3.6
const tolerance = 1e-6

/** A straight flight of stairs down from its `start` to its `end`, along x or z or askew of both, as level blocks: its treads and the landings at either end. */
export default class StairFlight {
  /** the axis the flight runs along, for a flight along x or z; a flight askew of both has none */
  readonly axis: 0 | 2 | undefined
  readonly blocks: Array<StairBlock>
  readonly crossAxis: 0 | 2 | undefined
  /** which way along its axis the flight descends, 1 for a flight askew of both */
  readonly direction: number
  /** how much the grade falls per meter along the flight, from its top to its bottom, negative */
  readonly grade: number
  /** the unit direction along x and z from the flight’s top to its bottom */
  readonly heading: readonly [number, number]
  readonly length: number
  readonly rise: number
  readonly run: number
  /** how much the grade falls per meter along the flight’s axis, or along the flight itself when it runs askew of both axes */
  readonly slope: number
  /** the turn around y that turns +x into the heading */
  readonly yaw: number
  /** the unit direction across the flight: along its positive cross axis, or to the right of its heading when it runs askew of both axes */
  private readonly across: readonly [number, number]

  /** `headroom` is the height of its walls over the grade from its start to its end. */
  constructor(readonly id: string, readonly start: Vec3, readonly end: Vec3, readonly width: number, readonly count: number, readonly entryLanding = 0, readonly exitLanding = 0, readonly room: RoomId = 'moonfall', readonly headroom = stairHeadroom) {
    const dx = end[0] - start[0]
    const dz = end[2] - start[2]
    this.length = Math.hypot(dx, dz)
    this.axis = dz === 0 ? 0 : (dx === 0 ? 2 : undefined)
    this.crossAxis = this.axis === undefined ? undefined : (this.axis === 0 ? 2 : 0)
    this.direction = this.axis === undefined ? 1 : Math.sign(end[this.axis] - start[this.axis])
    this.heading = [dx / this.length, dz / this.length]
    this.yaw = Math.atan2(-dz, dx)
    this.across = this.axis === undefined ? [-this.heading[1], this.heading[0]] : (this.axis === 0 ? [0, 1] : [1, 0])
    this.rise = (start[1] - end[1]) / count
    this.run = (this.length - entryLanding - exitLanding) / count
    this.grade = (end[1] - start[1]) / this.length
    this.slope = this.grade * this.direction
    if (![...start, ...end, width, count, entryLanding, exitLanding, headroom].every(Number.isFinite) || !(this.length > 0) || width <= 0 || headroom <= 0 || !Number.isSafeInteger(count) || count <= 0 || this.rise <= 0 || this.run <= 0 || entryLanding < 0 || exitLanding < 0) {
      throw new RangeError('A stair flight needs a descending run, positive dimensions and a whole number of steps.')
    }
    this.blocks = []
    if (entryLanding) {
      this.blocks.push(this.block(entryLanding / 2, entryLanding, start[1], false))
    }
    for (let i = 1; i <= count; i++) {
      this.blocks.push(this.block(entryLanding + (i - 0.5) * this.run, this.run, start[1] - i * this.rise, true))
    }
    if (exitLanding) {
      this.blocks.push(this.block(this.length - exitLanding / 2, exitLanding, end[1], false))
    }
  }

  /** A beam along the flight, `height` over its grade and `across` meters right of its center line, like a handrail or a roof. */
  beam(height: number, thickness: number, width: number, across = 0): StairBeam {
    const [hx, hz] = this.heading
    const position: Vec3 = [(this.start[0] + this.end[0]) / 2 - hz * across, (this.start[1] + this.end[1]) / 2 + height, (this.start[2] + this.end[2]) / 2 + hx * across]
    const slant = Math.hypot(this.length, this.start[1] - this.end[1])
    if (this.axis === undefined) {
      return {
        position,
        rotation: [0, this.yaw, Math.atan(this.grade)],
        size: [slant, thickness, width],
      }
    }
    const size: Vec3 = [width, thickness, width]
    size[this.axis] = slant
    return {
      position,
      rotation: this.axis === 0 ? [0, 0, Math.atan(this.slope)] : [-Math.atan(this.slope), 0, 0],
      size,
    }
  }

  /**
   * Boxes around the flight’s air, see {@link floorChunks}: one around a flight along x or z, and around one askew of both one for each of the strips across x it is cut into, none reaching more than `slack` meters past its sides.
   * Each reaches from a rise under the grade at its low end up to the headroom over the grade at its high end.
   */
  chunks(slack: number): Array<FloorChunk> {
    const [hx, hz] = this.heading
    return floorChunks([this.outline()], 0, 1, slack).map(({min, max}) => {
      const alongs = [[min[0], min[2]], [max[0], min[2]], [max[0], max[2]], [min[0], max[2]]].map(([x, z]) => (x - this.start[0]) * hx + (z - this.start[2]) * hz)
      const near = Math.max(0, Math.min(...alongs))
      const far = Math.min(this.length, Math.max(...alongs))
      return {
        min: [min[0], this.start[1] + this.grade * far - this.rise, min[2]],
        max: [max[0], this.start[1] + this.grade * near + this.headroom, max[2]],
      }
    })
  }

  /** Whether the position is on the flight, from a meter under its blocks up to its headroom. */
  contains([x, y, z]: Vec3) {
    const floor = this.floorAt(x, z)
    return floor !== undefined && y >= floor - 1 && y <= floor + this.headroom
  }

  /** The top of the block under the point, or undefined off the flight. */
  floorAt(x: number, z: number) {
    const [hx, hz] = this.heading
    const along = (x - this.start[0]) * hx + (z - this.start[2]) * hz
    const across = (z - this.start[2]) * hx - (x - this.start[0]) * hz
    if (Math.abs(across) > this.width / 2 + tolerance) {
      return
    }
    return this.blocks.find(block => Math.abs(along - this.along(block)) <= this.extent(block) / 2 + tolerance)?.top
  }

  /** The block one tread deep in front of its first riser, flush with its top, where the edge of the floor it starts from is laid as a tread. Not one of its {@link blocks}: the floor carries it. */
  headBlock(): StairBlock {
    return this.block(this.entryLanding - this.run / 2, this.run, this.start[1], true)
  }

  /** The footprint of its {@link headBlock}, round it from the corner at its back left. */
  headOutline(): FloorPolygon {
    const [hx, hz] = this.heading
    const half = this.width / 2
    const corner = (along: number, side: number): readonly [number, number] => [this.start[0] + hx * along - hz * side * half, this.start[2] + hz * along + hx * side * half]
    const front = this.entryLanding
    const back = front - this.run
    return [corner(back, -1), corner(front, -1), corner(front, 1), corner(back, 1)]
  }

  /** The flight’s footprint, round it from the corner at its top left. */
  outline(): FloorPolygon {
    const [hx, hz] = this.heading
    const half = this.width / 2
    const corner = ([x, , z]: Vec3, side: number): readonly [number, number] => [x - hz * side * half, z + hx * side * half]
    return [corner(this.start, -1), corner(this.end, -1), corner(this.end, 1), corner(this.start, 1)]
  }

  /** The convex floor polygon without the footprint of its {@link headBlock}, in convex pieces: behind it, in front of it and beside it on either side. */
  outsideHead(polygon: FloorPolygon): Array<FloorPolygon> {
    const [hx, hz] = this.heading
    const [ax, az] = this.across
    const front = hx * this.start[0] + hz * this.start[2] + this.entryLanding
    const back = front - this.run
    const middle = ax * this.start[0] + az * this.start[2]
    const alongside = clipPolygon(clipPolygon(polygon, [-hx, -hz], -back), [hx, hz], front)
    return [
      clipPolygon(polygon, [hx, hz], back),
      clipPolygon(polygon, [-hx, -hz], -front),
      clipPolygon(alongside, [ax, az], middle - this.width / 2),
      clipPolygon(alongside, [-ax, -az], -(middle + this.width / 2)),
    ].filter(piece => piece.length)
  }

  /**
   * The wall along one side of the flight, `depth` meters under its grade all along.
   * By default, it reaches under every tread’s underside: a straight grade differs from discrete treads, especially beside a landing, and a shallower wall would leave triangular daylight gaps under them.
   */
  wall(side: number, depth = Math.max(...this.blocks.map(block => this.start[1] + (this.along(block) - this.extent(block) / 2) * this.grade - block.top + stairThickness))): Wall {
    const [ax, az] = this.across
    const center: Vec3 = [(this.start[0] + this.end[0]) / 2 + ax * side * this.width / 2, (this.start[1] + this.end[1]) / 2 - depth, (this.start[2] + this.end[2]) / 2 + az * side * this.width / 2]
    // It faces back across the flight, against the side it stands on.
    const face = this.axis === undefined ? {
      name: side < 0 ? 'left' : 'right',
      rotation: Math.atan2(-side * ax, -side * az),
    } : passageOrientation(this.axis, side)
    return {
      id: `${this.room}-stairs_${this.id.replaceAll('-', '_')}_${face.name}`,
      room: this.room,
      center,
      rotation: face.rotation,
      width: this.length,
      height: this.headroom + depth - 0.3,
      // The grade’s fall along the wall’s own x.
      slope: this.grade * (this.heading[0] * Math.cos(face.rotation) - this.heading[1] * Math.sin(face.rotation)),
      sticky: false,
    }
  }

  /** how far along the flight the block’s middle lies */
  private along(block: StairBlock) {
    return (block.position[0] - this.start[0]) * this.heading[0] + (block.position[2] - this.start[2]) * this.heading[1]
  }

  private block(distance: number, length: number, top: number, tread: boolean): StairBlock {
    const position: Vec3 = [this.start[0] + this.heading[0] * distance, top - stairThickness / 2, this.start[2] + this.heading[1] * distance]
    if (this.axis === undefined) {
      return {
        position,
        size: [length, stairThickness, this.width],
        direction: 1,
        top,
        tread,
        yaw: this.yaw,
      }
    }
    const size: Vec3 = [this.width, stairThickness, this.width]
    size[this.axis] = length
    return {
      axis: this.axis,
      position,
      size,
      direction: this.direction,
      top,
      tread,
    }
  }

  /** how long the block is along the flight */
  private extent(block: StairBlock) {
    return block.axis === undefined ? block.size[0] : block.size[block.axis]
  }
}
