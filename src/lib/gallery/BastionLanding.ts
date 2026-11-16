import type {FloorPolygon} from './floorPolygons.ts'

import {ExtrudeGeometry, Shape, Vector2} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'
import {climbMouth} from './climb.ts'
import {cutFloorOpening} from './floorPolygons.ts'
import FloorHollow from './passages/FloorHollow.ts'

/** A low stone threshold at the east exit of the golf landing. Its west face returns rolling orbs to the hatch instead of letting a missed shot escape onto the level hallway. The player can step over it; the hallway side is ramped. */
export const bastionGolfSill = {
  // Between the lanterns, not under one: the threshold must keep its headroom.
  x: climbMouth.path[1][0] + climbMouth.width / 2 + 0.8,
  z: climbMouth.path[0][1],
  y: climbMouth.floorY,
  height: 0.24,
  depth: 0.8,
  bevel: 0.04,
  plateau: 0.35,
  width: climbMouth.width,
}

/** The visible stone and its collider share this solid, with no hidden bumper. */
export function golfSillGeometry() {
  const {x, y, z, height, depth, bevel, plateau, width} = bastionGolfSill
  const shape = new Shape([[0, -0.24], [depth, -0.24], [depth, 0], [plateau, height], [bevel, height], [0, height - bevel]].map(([u, v]) => new Vector2(u, v)))
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    depth: width,
  })
  return geometry.translate(x, y, z - width / 2)
}

export function golfSillFloor(x: number, z: number) {
  const sill = bastionGolfSill
  const along = x - sill.x
  if (along < 0 || along > sill.depth || Math.abs(z - sill.z) > sill.width / 2) {
    return
  }
  const height = Math.min(sill.height, sill.height - sill.bevel + along, sill.height * (sill.depth - along) / (sill.depth - sill.plateau))
  return sill.y + height
}

/** The golf landing’s sunken flags and return threshold are one rendered surface and one welded collider. */
export default class BastionLanding extends FloorHollow {
  override cut(polygon: FloorPolygon) {
    const {x, z, depth, width} = bastionGolfSill
    return super.cut(polygon).flatMap(floor => cutFloorOpening(floor, {
      center: [x + depth / 2, z],
      size: [depth, width],
    }))
  }

  override floorAt(x: number, z: number) {
    return golfSillFloor(x, z) ?? super.floorAt(x, z)
  }

  override geometry() {
    return mergeParts([super.geometry(), golfSillGeometry()])
  }
}
