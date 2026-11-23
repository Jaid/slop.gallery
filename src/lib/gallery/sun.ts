import type {Vec3} from './types.ts'

import {degreesToRadians, vec3} from 'math'
import {Box3} from 'three/webgpu'

import lobbyVault from './lobbyVault.ts'

/** a room the sun may shine into, as far as its shadow map cares */
export type SunlitRoom = {
  /** the room’s air in world meters */
  readonly air: ReadonlyArray<Box3>
  /** whether the sun may reach into it anywhere */
  readonly sunlit: boolean
}
/** a room whose walls and ceiling may keep the sun out */
export type SunTightRoom = {
  /** the room’s air in world meters */
  readonly air: ReadonlyArray<Box3>
  /** the world height of the room’s floor */
  readonly floorY: number
  /** `main` limits the guarantee to the first box (the hall, not its approaches). */
  readonly sunTight: 'main' | boolean
}

/** How far the light’s shadow camera stands from the origin along its direction, well above the vault’s crown. */
const sunDistance = 80
const margin = 1
const up: Vec3 = [0, 1, 0]
/** How far a sun-tight space stays inside the room’s air at its sides and top, in meters: the air reaches into the walls, up to their centerlines, and their trim and the ceiling reach further in. */
const sunTightClearance = 0.35

/** texels along each axis of the sun’s shadow map in heavy graphics */
export const sunShadowMapSize = 4096

/** Every point the sun’s shadow map has to cover: the corners of the air of every room within the sun’s reach, from below its floor to over its ceiling or vault. */
export function sunlitPoints(rooms: Iterable<SunlitRoom>): Array<Vec3> {
  const points: Array<Vec3> = []
  for (const room of rooms) {
    if (!room.sunlit) {
      continue
    }
    for (const {min, max} of room.air) {
      for (const x of [min.x - 0.5, max.x + 0.5]) {
        for (const z of [min.z - 0.5, max.z + 0.5]) {
          for (const y of [min.y - 1, max.y + 0.5]) {
            points.push([x, y, z])
          }
        }
      }
    }
  }
  return points
}

/**
 * The spaces the sun reaches no point of: the air of every sun-tight room from its floor up, clear of its walls, their trim and its ceiling.
 * Whatever lies wholly inside one can’t change what the sun’s shadow map shows, since along every ray from there toward the sun, the room’s shell stands in the way first.
 * They start at the floor: where the air reaches down into a pit, like Moonfall’s crater, it takes in the ground round the pit too, which isn’t modeled, so rays from there pass under the walls into the open.
 */
export function sunTightSpaces(rooms: Iterable<SunTightRoom>): Array<Box3> {
  const spaces: Array<Box3> = []
  for (const room of rooms) {
    if (!room.sunTight) {
      continue
    }
    for (const {min, max} of room.sunTight === 'main' ? room.air.slice(0, 1) : room.air) {
      const space = new Box3(min.clone(), max.clone())
      space.min.x += sunTightClearance
      space.min.z += sunTightClearance
      space.min.y = Math.max(space.min.y, room.floorY)
      space.max.x -= sunTightClearance
      space.max.z -= sunTightClearance
      space.max.y -= sunTightClearance
      if (!space.isEmpty()) {
        spaces.push(space)
      }
    }
  }
  return spaces
}

/**
 * Where a directional light shining from `toward` (any length) stands, and the shadow frustum that spans every one of the points from there.
 * It stands 80 m from the origin, or with `nearest` right beyond the points: the volumetric light fades with the depth into the frustum from the light, which then starts over the highest of them.
 */
export function sunGeometry(toward: Vec3, points: ReadonlyArray<Vec3>, {nearest = false}: {nearest?: boolean} = {}) {
  const direction = vec3.normalize(vec3.create(), toward)
  const distance = nearest ? Math.max(...points.map(point => vec3.dot(point, direction))) + margin + 0.5 : sunDistance
  // The basis of a camera at the light, looking at the origin, as Object3D.lookAt builds it.
  const right = vec3.cross(vec3.create(), up, direction)
  vec3.normalize(right, right)
  const top = vec3.cross(vec3.create(), direction, right)
  const projected = points.map(point => [vec3.dot(point, right), vec3.dot(point, top), distance - vec3.dot(point, direction)] as const)
  const bound = (axis: 0 | 1 | 2, pick: typeof Math.max) => pick(...projected.map(point => point[axis]))
  return {
    direction,
    position: vec3.scale(vec3.create(), direction, distance),
    shadow: {
      left: bound(0, Math.min) - margin,
      right: bound(0, Math.max) + margin,
      bottom: bound(1, Math.min) - margin,
      top: bound(1, Math.max) + margin,
      near: Math.max(0.5, bound(2, Math.min) - margin),
      far: bound(2, Math.max) + margin,
      mapSize: sunShadowMapSize,
      normalBias: 0.035,
    },
  }
}

/** Direction toward the sun from azimuth (clockwise from north, −z) and elevation, in degrees. */
export function sunDirectionFromAngles(azimuth: number, elevation: number): Vec3 {
  const a = degreesToRadians(azimuth)
  const e = degreesToRadians(elevation)
  return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)]
}

/** The direction toward the gallery’s midday sun, 193.7° clockwise from north and 51° above the horizon; only the Lobby’s glazing lets it in. */
export const middaySun = sunDirectionFromAngles(193.7, 51)

/** How far in front of the shadow camera of a sun shining from `direction` the crown of the Lobby’s vault stands, which has to stay in front of it to cast a shadow. */
export function sunClearance(direction: Vec3) {
  return sunDistance - vec3.dot([0, lobbyVault.crownY, 0], vec3.normalize(vec3.create(), direction))
}
