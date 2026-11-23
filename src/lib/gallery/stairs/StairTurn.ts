import type {Wall} from '../../placement/wallGeometry.ts'
import type {Vec3} from '../types.ts'

import CurvedBoxGeometry from '../CurvedBoxGeometry.ts'
import {stairHeadroom, stairThickness} from './StairFlight.ts'

/** A level U-turn with tangent circular walls, widening smoothly between parallel stair flights. */
export default class StairTurn {
  readonly innerCenterZ: number
  readonly innerRadius: number
  readonly outerCenterZ: number
  readonly outerRadius: number
  readonly position: Vec3

  /** `direction` is 1 when the turn swings south from its entry to its exit, or −1 when it swings north. */
  constructor(readonly center: readonly [number, number], readonly top: number, readonly radius: number, readonly width: number, readonly exitWidth = width, readonly direction: -1 | 1 = 1) {
    if (![...center, top, radius, width, exitWidth].every(Number.isFinite) || Math.min(width, exitWidth) <= 0 || radius <= (width + exitWidth) / 4) {
      throw new RangeError('A stair turn needs a finite center and elevation, positive width and room for its inner wall.')
    }
    this.innerRadius = radius - (width + exitWidth) / 4
    this.outerRadius = radius + (width + exitWidth) / 4
    this.innerCenterZ = center[1] + direction * (width - exitWidth) / 4
    this.outerCenterZ = center[1] - direction * (width - exitWidth) / 4
    this.position = [center[0] + radius, top, center[1]]
  }

  contains(x: number, z: number) {
    return x >= this.center[0] - 1e-9 && Math.hypot(x - this.center[0], z - this.innerCenterZ) >= this.innerRadius - 1e-9 && Math.hypot(x - this.center[0], z - this.outerCenterZ) <= this.outerRadius + 1e-9
  }

  floorGeometry() {
    return this.slabGeometry(stairThickness, this.top - stairThickness / 2)
  }

  point(angle: number, radius = this.radius): [number, number] {
    return [this.center[0] + Math.sin(angle) * radius, this.centerAt(radius) - this.direction * Math.cos(angle) * radius]
  }

  roofGeometry() {
    return this.slabGeometry(0.18, this.top + stairHeadroom)
  }

  walls(): Array<Wall> {
    return [false, true].map(inner => {
      const radius = inner ? this.innerRadius : this.outerRadius
      return {
        id: `moonfall-stairs_turn_${inner ? 'inner' : 'outer'}`,
        room: 'moonfall',
        center: [this.center[0] + radius, this.top, inner ? this.innerCenterZ : this.outerCenterZ],
        rotation: inner ? Math.PI / 2 : -Math.PI / 2,
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

  private centerAt(radius: number) {
    return this.innerCenterZ + (radius - this.innerRadius) / (this.outerRadius - this.innerRadius) * (this.outerCenterZ - this.innerCenterZ)
  }

  private geometry(radius: number, width: number, height: number, y: number, centerZ: number) {
    const halfRingSlab = new CurvedBoxGeometry(Math.PI * radius, height, width, radius)
    return halfRingSlab
      .rotateY(-Math.PI / 2)
      .translate(this.center[0] + radius, y, centerZ)
  }

  private slabGeometry(height: number, y: number) {
    const geometry = this.geometry(this.radius, this.outerRadius - this.innerRadius, height, y, this.center[1])
    const positions = geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i++) {
      const radius = Math.hypot(positions.getX(i) - this.center[0], positions.getZ(i) - this.center[1])
      positions.setZ(i, positions.getZ(i) + this.centerAt(radius) - this.center[1])
    }
    // Each radial layer is translated, not scaled: its circular side normals,
    // horizontal faces and flat end caps keep their original directions.
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return geometry
  }
}
