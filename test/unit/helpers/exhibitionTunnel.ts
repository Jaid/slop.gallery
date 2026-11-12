import type {Vec3} from '../../../src/lib/gallery/types.ts'
import type {Wall} from '../../../src/lib/placement/wallGeometry.ts'
import type {BufferGeometry} from 'three/webgpu'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {ExtrudeGeometry, Matrix4, Mesh, Quaternion, Shape, Vector2, Vector3} from 'three/webgpu'

import {colliderGeometry, createArchitectureGeometry} from '../../../src/lib/gallery/architecture.ts'
import {frameToWorld, tunnelFrame, tunnelSlabs, tunnelSlope} from '../../../src/lib/gallery/exhibitionTunnel.ts'
import SlopedBoxGeometry from '../../../src/lib/gallery/SlopedBoxGeometry.ts'

type Point = readonly [number, number]

/** from the frame of the tunnel’s diagonal into the museum’s meters */
export const frameMatrix = new Matrix4
frameMatrix.makeRotationY(tunnelFrame.yaw).setPosition(tunnelFrame.origin[0], 0, tunnelFrame.origin[1])
/** The point in the diagonal’s frame in the museum’s meters, at its height. */
export const fromFrame = ([x, y, z]: Vec3): Vec3 => {
  const [worldX, worldZ] = frameToWorld([x, z])
  return [worldX, y, worldZ]
}
/** The horizontal direction in the diagonal’s frame in the museum’s meters. */
export const directionFromFrame = ([x, y, z]: Vec3) => {
  const direction = new Vector3(x, y, z)
  return direction.transformDirection(frameMatrix)
}

/** A slab over the convex polygon in the museum’s meters, built like FloorSlab builds it. */
export function levelSlab(polygon: ReadonlyArray<Point>, bottom: number, top: number) {
  const geometry = new ExtrudeGeometry(new Shape(polygon.map(([x, z]) => new Vector2(x, -z))), {
    depth: top - bottom,
    bevelEnabled: false,
  })
  return geometry.rotateX(-Math.PI / 2).translate(0, bottom, 0)
}
/** A sloped box in the diagonal’s frame, at its middle `position`, placed in the museum’s meters. */
export function frameBox(position: Vec3, size: Vec3, slope = tunnelSlope) {
  const geometry = new SlopedBoxGeometry(...size, slope)
  geometry.translate(...position)
  return geometry.applyMatrix4(frameMatrix)
}
/** the slabs under the tunnel’s floor and over its ceiling, in the museum’s meters */
export function tunnelSlabGeometries(): Array<BufferGeometry> {
  return [
    ...tunnelSlabs.level.map(({polygon, bottom, top}) => levelSlab(polygon, bottom, top)),
    ...tunnelSlabs.sloped.map(({position, size}) => frameBox(position, size)),
  ]
}

/** The walls’ collision in the world. */
export function addWalls(world: RAPIER.World, walls: ReadonlyArray<Wall>) {
  for (const wall of walls) {
    const geometry = createArchitectureGeometry(wall)
    const rotation = new Quaternion
    rotation.setFromAxisAngle(new Vector3(0, 1, 0), wall.rotation)
    for (const collision of geometry.collision) {
      world.createCollider(RAPIER.ColliderDesc.trimesh(...collision).setTranslation(...wall.center).setRotation(rotation))
    }
    geometry.dispose()
  }
}
/** The geometries’ collision in the world, as they are; they stay the caller’s. */
export function addGeometries(world: RAPIER.World, geometries: ReadonlyArray<BufferGeometry>) {
  for (const geometry of geometries) {
    world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(geometry)))
  }
}
/** the visible meshes of the walls, as placed in the world */
export function wallMeshes(list: ReadonlyArray<Wall>, material: ConstructorParameters<typeof Mesh>[1]) {
  const geometries = list.map(wall => createArchitectureGeometry(wall))
  const meshes = list.flatMap((wall, i) => [geometries[i].surface, ...geometries[i].trim].map(part => {
    const mesh = new Mesh(part, material)
    mesh.position.set(...wall.center)
    mesh.rotation.y = wall.rotation
    mesh.updateMatrixWorld(true)
    return mesh
  }))
  return {
    meshes,
    dispose: () => {
      for (const geometry of geometries) {
        geometry.dispose()
      }
    },
  }
}

/**
 * Walks a player’s capsule from `start` through the targets in turn, facing each, checking `each` at every step, and resolves with the body’s last position.
 * Throws if a target is out of reach for 12 s.
 */
export function walk(world: RAPIER.World, start: Vec3, targets: ReadonlyArray<Point>, {sprint = false, each}: {
  each?: (position: Vec3) => void
  sprint?: boolean
} = {}): Vec3 & {grounded: boolean} {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...start))
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
  const motor = new EgoMotor(RAPIER, world, body, collider)
  const facing = new Quaternion
  try {
    for (const target of targets) {
      const distance = () => Math.hypot(body.translation().x - target[0], body.translation().z - target[1])
      for (let i = 0; i < 12 / world.timestep && distance() > 0.15; i++) {
        const {x, z} = body.translation()
        facing.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(x - target[0], z - target[1]))
        motor.step(world.timestep, {
          forward: true,
          sprint,
        }, facing)
        world.step()
        const now = body.translation()
        each?.([now.x, now.y, now.z])
      }
      if (distance() > 0.15) {
        const {x, y, z} = body.translation()
        throw new Error(`The player got stuck at ${[x, y, z].map(value => value.toFixed(2)).join(', ')} on the way to ${target.join(', ')}.`)
      }
    }
    const {x, y, z} = body.translation()
    return Object.assign([x, y, z] as Vec3, {grounded: motor.grounded})
  } finally {
    motor.dispose()
  }
}
