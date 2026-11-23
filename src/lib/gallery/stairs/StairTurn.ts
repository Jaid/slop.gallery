import type {Wall} from '../../placement/wallGeometry.ts'
import type {Vec3} from '../types.ts'

import CurvedBoxGeometry from '../CurvedBoxGeometry.ts'
import {stairHeadroom, stairThickness} from './StairFlight.ts'

type Point = readonly [number, number]

/**
 * A level U-turn with tangent circular walls, widening smoothly between parallel stair flights.
 * It is laid out in a frame of its own around its center, between the ends of both flights: `along` toward its apex, where its walls turn round, and `across` from its first flight, `width` wide, toward its second, `exitWidth` wide, a quarter turn clockwise from `along` seen from above with north up. Its `heading` points it in the museum: east, the default, puts the first flight north of the second, and south puts it east of it.
 */
export default class StairTurn {
  /** the unit direction in the museum from the first flight across to the second */
  readonly across: Point
  /** the unit direction in the museum from the turn’s center toward its apex */
  readonly heading: Point
  /** the middle of the inner wall’s circle in the museum’s x and z */
  readonly innerCenter: Point
  readonly innerRadius: number
  /** how far the inner wall’s circle’s middle lies across from the turn’s center, toward the second flight */
  readonly innerShift: number
  /** the middle of the outer wall’s circle in the museum’s x and z */
  readonly outerCenter: Point
  readonly outerRadius: number
  /** how far the outer wall’s circle’s middle lies across from the turn’s center, toward the second flight */
  readonly outerShift: number
  /** the middle of the landing at its apex, on the centerline between the walls */
  readonly position: Vec3
  /** the turn around y that turns +x into the {@link heading} */
  readonly yaw: number

  constructor(readonly center: Point, readonly top: number, readonly radius: number, readonly width: number, readonly exitWidth = width, heading: Point = [1, 0]) {
    const length = Math.hypot(...heading)
    if (![...center, top, radius, width, exitWidth, ...heading].every(Number.isFinite) || Math.min(width, exitWidth) <= 0 || radius <= (width + exitWidth) / 4 || !(length > 0)) {
      throw new RangeError('A stair turn needs a finite center, elevation and heading, positive width and room for its inner wall.')
    }
    this.heading = [heading[0] / length, heading[1] / length]
    this.across = [-this.heading[1], this.heading[0]]
    this.yaw = Math.atan2(-this.heading[1], this.heading[0])
    this.innerRadius = radius - (width + exitWidth) / 4
    this.outerRadius = radius + (width + exitWidth) / 4
    this.innerShift = (width - exitWidth) / 4
    this.outerShift = -this.innerShift
    this.innerCenter = this.place(0, this.innerShift)
    this.outerCenter = this.place(0, this.outerShift)
    const [x, z] = this.place(radius, 0)
    this.position = [x, top, z]
  }

  contains(x: number, z: number) {
    const [along, across] = this.local(x, z)
    return along >= -1e-9 && Math.hypot(along, across - this.innerShift) >= this.innerRadius - 1e-9 && Math.hypot(along, across - this.outerShift) <= this.outerRadius + 1e-9
  }

  floorGeometry() {
    return this.slabGeometry(stairThickness, this.top - stairThickness / 2)
  }

  /** How far the point in the museum’s x and z lies toward the apex and across toward the second flight from the turn’s center, see {@link place}. */
  local(x: number, z: number): [along: number, across: number] {
    const dx = x - this.center[0]
    const dz = z - this.center[1]
    return [dx * this.heading[0] + dz * this.heading[1], dx * this.across[0] + dz * this.across[1]]
  }

  /** The point in the museum’s x and z that lies `along` toward the apex and `across` toward the second flight from the turn’s center. */
  place(along: number, across: number): [number, number] {
    return [this.center[0] + this.heading[0] * along + this.across[0] * across, this.center[1] + this.heading[1] * along + this.across[1] * across]
  }

  /** The point `angle` round the turn from the first flight’s end, `radius` out from the middle between the walls’ circles there. */
  point(angle: number, radius = this.radius): [number, number] {
    return this.place(Math.sin(angle) * radius, this.shiftAt(radius) - Math.cos(angle) * radius)
  }

  roofGeometry() {
    return this.slabGeometry(0.18, this.top + stairHeadroom)
  }

  walls(): Array<Wall> {
    return [false, true].map(inner => {
      const radius = inner ? this.innerRadius : this.outerRadius
      const [x, z] = this.place(radius, inner ? this.innerShift : this.outerShift)
      return {
        id: `moonfall-stairs_turn_${inner ? 'inner' : 'outer'}`,
        room: 'moonfall',
        center: [x, this.top, z],
        rotation: (inner ? Math.PI / 2 : -Math.PI / 2) + this.yaw,
        curveRadius: inner ? -radius : radius,
        width: Math.PI * radius,
        height: stairHeadroom - 0.3,
        // Start at the landing surface: buried end caps otherwise coincide with
        // its exposed riser. Keep the visible molding and cornice heights unchanged.
        baseboardHeight: 0.14,
        sticky: false,
      }
    })
  }

  /** how far the middle of the circle of the radius lies across from the turn’s center, between the inner wall’s and the outer wall’s */
  private shiftAt(radius: number) {
    return this.innerShift + (radius - this.innerRadius) / (this.outerRadius - this.innerRadius) * (this.outerShift - this.innerShift)
  }

  /** The ring slab `height` thick round its middle `y` high, laid out in the turn’s own frame, then turned to its heading and moved to its center. */
  private slabGeometry(height: number, y: number) {
    const geometry = new CurvedBoxGeometry(Math.PI * this.radius, height, this.outerRadius - this.innerRadius, this.radius)
    geometry.rotateY(-Math.PI / 2).translate(this.radius, y, 0)
    const positions = geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i++) {
      const radius = Math.hypot(positions.getX(i), positions.getZ(i))
      positions.setZ(i, positions.getZ(i) + this.shiftAt(radius))
    }
    // Each radial layer is translated, not scaled: its circular side normals,
    // horizontal faces and flat end caps keep their original directions.
    geometry.rotateY(this.yaw).translate(this.center[0], 0, this.center[1])
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return geometry
  }
}
