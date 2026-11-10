import type {Wall, WallOpening} from '../../src/lib/placement/wallGeometry.ts'

import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {computeMeshVolume} from 'three-bvh-csg'
import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {architectureGeometry, colliderGeometry, createArchitectureGeometry, wallFace, wallOpeningTrim} from '../../src/lib/gallery/architecture.ts'
import {baseboardCapHeight, defaultBaseboardHeight} from '../../src/lib/gallery/architectureDimensions.ts'
import {bastionCurve} from '../../src/lib/gallery/bastion.ts'
import lowerGallery, {oculusPlatform, oculusRamps} from '../../src/lib/gallery/lowerGallery.ts'
import {wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import {bastionBaseboard} from '../../src/rooms/bastion/walls.ts'
import walls from './fixtures/gallery.ts'

await RAPIER.init()
const lowerBandHeight = defaultBaseboardHeight - baseboardCapHeight
/** a half circle in the 128 chords the openings’ cutters and casings take */
const halfDisc = (radius: number) => 64 * radius ** 2 * Math.sin(Math.PI / 128)
/** The area of the casing round a hole with a sill, on the wall’s face. */
function casingArea({width, height, bottom = 0, profile}: WallOpening) {
  const trim = wallOpeningTrim
  if (profile === 'rectangle') {
    return (width + 2 * trim) * (height - bottom + 2 * trim) - width * (height - bottom)
  }
  const spring = height - width / 2
  return (width + 2 * trim) * (spring - bottom + trim) + halfDisc(width / 2 + trim) - width * (spring - bottom) - halfDisc(width / 2)
}
/** Probes a plain wall’s baseboard from the room at `u`: the lower band up to its cap, the cap standing proud of it up to the top, and nothing above. */
function expectBaseboard(wall: Wall, u: number, height: number, cap: number) {
  const geometry = createArchitectureGeometry(wall)
  const material = new MeshBasicMaterial
  try {
    const trim = new Mesh(geometry.trim[0], material)
    for (const [y, front] of [[height - cap - 0.01, 0.2], [height - cap + 0.01, 0.25], [height - 0.01, 0.25], [height + 0.01, null]] as const) {
      const ray = new Raycaster(new Vector3(u, y, 1), new Vector3(0, 0, -1))
      const hit = ray.intersectObject(trim)[0]
      if (front === null) {
        expect(hit).toBeUndefined()
      } else {
        expect(hit.point.z).toBeCloseTo(front, 5)
      }
    }
  } finally {
    geometry.dispose()
    material.dispose()
  }
}
describe('floor-following wall baseboards', () => {
  test('the Lobby’s baseboard is the default one, a lower band under a cap standing proud of it', () => {
    const wall = walls.find(value => value.id === 'lobby-south')!
    expect(wall.baseboardHeight ?? defaultBaseboardHeight).toBe(defaultBaseboardHeight)
    expect(wall.baseboardCapHeight ?? baseboardCapHeight).toBe(baseboardCapHeight)
    expectBaseboard(wall, 4, defaultBaseboardHeight, baseboardCapHeight)
  })
  test('the Bastion’s walls all take its own taller baseboard and cap', () => {
    const bastionWalls = walls.filter(wall => wall.room === 'bastion')
    expect(bastionWalls.length).toBeGreaterThan(0)
    for (const wall of bastionWalls) {
      expect(wall.baseboardHeight).toBe(bastionBaseboard.baseboardHeight)
      expect(wall.baseboardCapHeight).toBe(bastionBaseboard.baseboardCapHeight)
    }
    expect(bastionBaseboard.baseboardHeight).toBeGreaterThan(defaultBaseboardHeight)
    expect(bastionBaseboard.baseboardCapHeight).toBeGreaterThan(baseboardCapHeight)
    const wall = bastionWalls.find(candidate => !candidate.baseboardProfile && !candidate.holes?.length)!
    expectBaseboard(wall, 0, bastionBaseboard.baseboardHeight, bastionBaseboard.baseboardCapHeight)
  })
  for (const side of ['west', 'east'] as const) {
    test(`${side}: constant-height trim follows the floor, ramp and raised base without buried horizontal stubs`, () => {
      const wall = walls.find(value => value.id === `oculus-${side}`)!
      const ramp = oculusRamps.find(value => value.side === side)!
      const geometry = createArchitectureGeometry(wall)
      const material = new MeshBasicMaterial
      const meshes = geometry.trim.map(part => new Mesh(part, material))
      const world = new RAPIER.World({
        x: 0,
        y: 0,
        z: 0,
      })
      try {
        for (const part of geometry.trim) {
          world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(part)))
        }
        world.step()
        for (const z of [-34.7, -30.01, -30, -29.99, -28, -24, -22.3, -21.01, -21, -20.99, -18.81, -18.79, -18.2, -15.2]) {
          const u = (z - wall.center[2]) * (side === 'east' ? 1 : -1)
          const floor = (z <= ramp.startZ + ramp.width ? ramp.floorY - lowerGallery.oculus.floorY : 0) + Math.max(0, Math.min(ramp.rise, (ramp.startZ - z) / ramp.run * ramp.rise))
          for (const offset of [-0.02, 0.02, 0.19, 0.209, 0.211, 0.24, 0.249, 0.251, 0.46]) {
            const origin = new Vector3(u, floor + offset, 1)
            const direction = new Vector3(0, 0, -1)
            const faceRay = new Raycaster(origin, direction, 0, 1)
            const hits = faceRay.intersectObjects(meshes)
            const collision = world.castRay(new RAPIER.Ray(origin, direction), 1, true)
            const visible = offset > 0 && offset < defaultBaseboardHeight
            expect(hits.length > 0).toBe(visible)
            expect(collision !== null).toBe(visible)
            if (!visible) {
              continue
            }
            const front = offset < lowerBandHeight ? 0.2 : 0.25
            expect(hits[0].point.z).toBeCloseTo(front, 5)
            expect(collision!.timeOfImpact).toBeCloseTo(1 - front, 5)
          }
          const topRay = new Raycaster(new Vector3(u, floor + 0.6, 0.23), new Vector3(0, -1, 0), 0, 1)
          expect(topRay.intersectObjects(meshes)[0].point.y).toBeCloseTo(floor + defaultBaseboardHeight, 5)
        }
        const volume = geometry.trim.reduce((sum, part) => sum + computeMeshVolume(part), 0)
        // Besides the baseboard, the trim only cases the door at the balcony’s level, down to the sill buried in the balcony, and the arched doorway at the bridge’s end, into the Bastion’s mouth on the east and into its western climb on the west.
        expect(wall.holes!.map(hole => hole.name)).toEqual(['staff_door', 'bastion'])
        const casing = wall.holes!.reduce((sum, hole) => sum + casingArea(hole), 0) * (0.25 - wallFace)
        expect(volume).toBeCloseTo(wall.width * (lowerBandHeight * (0.2 - wallFace) + baseboardCapHeight * (0.25 - wallFace)) + casing, 4)
      } finally {
        world.free()
        geometry.dispose()
        material.dispose()
      }
    })
  }
  test('the apse’s round walls stand on the platform, their baseboards along its top', () => {
    const height = oculusPlatform.position[1] + oculusPlatform.size[1] / 2 - lowerGallery.oculus.floorY
    for (const id of ['oculus-northwest', 'oculus-north', 'oculus-northeast']) {
      const wall = walls.find(value => value.id === id)!
      expect(wall.center[1] - lowerGallery.oculus.floorY).toBeCloseTo(height, 9)
      expect(wall.curveRadius).toBeGreaterThan(0)
      expect(wall.baseboardProfile).toBeUndefined()
      const geometry = createArchitectureGeometry(wall)
      const material = new MeshBasicMaterial
      try {
        expect(geometry.trim[0].boundingBox!.min.y).toBeCloseTo(0, 6)
        // Near the wall’s end, clear of the barred openings, 23 cm out of its center line where it bends round its curve
        const u = 0.3 - wall.width / 2
        const radius = wall.curveRadius!
        const trimTopRay = new Raycaster(new Vector3((radius - 0.23) * Math.sin(u / radius), 1, radius - (radius - 0.23) * Math.cos(u / radius)), new Vector3(0, -1, 0))
        expect(trimTopRay.intersectObject(new Mesh(geometry.trim[0], material))[0].point.y).toBeCloseTo(defaultBaseboardHeight)
        // Up to the ceiling, like the side walls
        expect(wall.center[1] + geometry.surface.boundingBox!.max.y).toBeCloseTo(lowerGallery.oculus.ceiling.topY - lowerGallery.oculus.ceiling.thickness)
      } finally {
        geometry.dispose()
        material.dispose()
      }
    }
  })
  test('the Bastion’s walls stand level along its ramps, round the apse’s east shoulder, along the straight walls outside the curve and round the S bend too, their baseboards following the eased floor', () => {
    const ramped = walls.filter(wall => wall.id.startsWith('bastion-curve_') && wall.baseboardProfile)
    // the runs and turns down from the east doorway and up toward the Lodge, the straight east wall and the chamfer outside them
    expect(ramped.map(wall => wall.id)).toEqual([0, 1, 4, 14, 15].map(index => `bastion-curve_wall_${index}`))
    // The western climb’s hairpin climbs on all six of its walls and its run north falls toward it on both of its, see climb.test.ts, and the cistern’s floor falls toward its channel along both of its, see forge-alchemy.test.ts.
    expect(walls.filter(wall => wall.baseboardProfile && !ramped.includes(wall) && !/^bastion-(?:cistern|climb_hairpin|climb_run|link|lodge-spur)_/.test(wall.id)).map(wall => wall.id).toSorted()).toEqual(['oculus-east', 'oculus-west'])
    expect(ramped.filter(wall => wall.curveRadius)).toHaveLength(1)
    const material = new MeshBasicMaterial
    for (const wall of ramped) {
      const geometry = createArchitectureGeometry(wall)
      try {
        const trim = new Mesh(geometry.trim[0], material)
        // 23 cm out of its center line, over the baseboard’s cap, at its ends and in steps in between
        for (let step = 0; step <= 16; step++) {
          const u = (wall.width / 2 - 0.02) * (step / 8 - 1)
          const [x, , z] = wallPosition(wall, u, 0, 0)
          const floor = bastionCurve.floorAt(x, z)! - wall.center[1]
          const [localX, localZ] = wall.curveRadius ? [(wall.curveRadius - 0.23) * Math.sin(u / wall.curveRadius), wall.curveRadius - (wall.curveRadius - 0.23) * Math.cos(u / wall.curveRadius)] : [u, 0.23]
          const down = new Raycaster(new Vector3(localX, floor + 1, localZ), new Vector3(0, -1, 0), 0, 2)
          expect(down.intersectObject(trim)[0].point.y).toBeCloseTo(floor + bastionBaseboard.baseboardHeight, 3)
        }
      } finally {
        geometry.dispose()
      }
    }
    material.dispose()
  })
  test('geometry caching distinguishes baseboard cap profiles', () => {
    const wall = walls.find(value => value.id === 'bastion-curve_wall_0')!
    const original = architectureGeometry(wall)
    expect(architectureGeometry({
      ...wall,
      baseboardCapHeight,
    })).not.toBe(original)
  })
  test('geometry caching distinguishes mirrored and flat floor profiles', () => {
    const west = walls.find(value => value.id === 'oculus-west')!
    const east = walls.find(value => value.id === 'oculus-east')!
    const left = architectureGeometry(west)
    const right = architectureGeometry(east)
    expect(left).not.toBe(right)
    expect(architectureGeometry({...west})).toBe(left)
    expect(architectureGeometry({
      ...west,
      baseboardProfile: undefined,
    })).not.toBe(left)
  })
})
