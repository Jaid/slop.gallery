import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {DoubleSide, Matrix3, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {colliderGeometry, createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {climbApproach, climbArch} from '../../src/lib/gallery/climb.ts'
import forge, {forgeBays, forgePlate, forgeRoof, forgeVestibule} from '../../src/lib/gallery/forge.ts'
import {forgeArch, forgeRoundVestibule, forgeVestibuleFloor, vestibuleArches} from '../../src/lib/gallery/forgeVestibule.ts'
import {isRing} from '../../src/lib/gallery/fresco.ts'
import roomOrigins from '../../src/lib/gallery/layout.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import roundRevealGeometry from '../../src/lib/gallery/roundRevealGeometry.ts'
import {roundVestibuleFloorShape, vestibuleArchOpening} from '../../src/lib/gallery/roundVestibule.ts'
import salon from '../../src/lib/gallery/salon.ts'
import {vesper} from '../../src/lib/gallery/vesper.ts'
import {insideOpening, wallCoordinates, wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import {openings} from '../../src/worlds/gallery/relations.ts'
import walls, {floorHeight, insideGallery, roomAt, rooms, roomVisit} from './fixtures/gallery.ts'

await RAPIER.init()
const room = rooms.find(candidate => candidate.id === 'forge')!
const wallById = (id: string) => walls.find(wall => wall.id === id)!
describe('the Forge', () => {
  test('mirrors the Salon across the Lobby’s north extension, north of the Vesper, which mirrors the Banquet', () => {
    const salonRoom = rooms.find(candidate => candidate.id === 'salon')!
    const vesperRoom = rooms.find(candidate => candidate.id === 'vesper')!
    const banquet = rooms.find(candidate => candidate.id === 'banquet')!
    expect(room.floorY).toBe(0)
    expect(room.center).toEqual([-salonRoom.center[0], salonRoom.center[1]])
    expect(room.size).toEqual(salonRoom.size)
    expect(forge.size).toEqual(salon.size)
    expect(vesperRoom.center).toEqual([-banquet.center[0], banquet.center[1]])
    expect(vesperRoom.size).toEqual(banquet.size)
    expect(vesperRoom.size).toEqual(vesper.size)
    expect([roomOrigins.vesper[0], roomOrigins.vesper[2]]).toEqual([...vesperRoom.center])
    // Against the Lobby’s west extension, with the Vesper south of it
    expect(room.center[0] + room.size[0] / 2).toBe(-lobby.width / 2)
    expect(room.center[1] + room.size[1] / 2).toBe(vesperRoom.center[1] - vesperRoom.size[1] / 2)
    const [x, z] = room.center
    const [halfWidth, halfDepth] = [room.size[0] / 2 - 0.5, room.size[1] / 2 - 0.5]
    for (const [dx, dz] of [[0, 0], [-halfWidth, -halfDepth], [halfWidth, -halfDepth], [-halfWidth, halfDepth], [halfWidth, halfDepth]]) {
      expect(roomAt([x + dx, 1.7, z + dz])).toBe('forge')
      expect(floorHeight([x + dx, 1.7, z + dz])).toBe(0)
    }
    expect(roomAt([vesperRoom.center[0], 1.7, vesperRoom.center[1]])).toBe('vesper')
    // Behind its north wall lies its round vestibule, in the middle; beside that, nothing.
    const north = z - room.size[1] / 2
    expect(roomAt([x, 1.7, north - 0.5])).toBe('forge')
    expect(insideGallery([x - room.size[0] / 3, 1.7, north - 0.5])).toBe(false)
    expect(roomAt(roomVisit(room).position)).toBe('forge')
  })
  test('a solid shared wall separates the Vesper and the Forge', () => {
    const vesperNorth = wallById('vesper-north')
    const forgeSouth = wallById('forge-south')
    expect(vesperNorth.center).toEqual(forgeSouth.center)
    expect(Math.abs(Math.cos(vesperNorth.rotation - forgeSouth.rotation) + 1)).toBeLessThan(1e-12)
    for (const wall of [vesperNorth, forgeSouth]) {
      expect(wall.holes ?? []).toHaveLength(0)
      const geometry = createArchitectureGeometry(wall)
      const material = new MeshBasicMaterial({side: DoubleSide})
      const world = new RAPIER.World({
        x: 0,
        y: 0,
        z: 0,
      })
      try {
        const mesh = new Mesh(geometry.surface, material)
        for (const [vertices, indices] of geometry.collision) {
          world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices))
        }
        world.step()
        for (const y of [0.5, 1.7, 3.5]) {
          for (const side of [-1, 1]) {
            const origin = new Vector3(0, y, side)
            const direction = new Vector3(0, 0, -side)
            const ray = new Raycaster(origin, direction, 0, 2)
            expect(ray.intersectObject(mesh).length).toBeGreaterThan(0)
            expect(world.castRay(new RAPIER.Ray(origin, direction), 2, true)).not.toBeNull()
          }
        }
      } finally {
        world.free()
        geometry.dispose()
        material.dispose()
      }
    }
    expect(openings.some(({rooms: pair}) => pair.includes('vesper') && pair.includes('forge'))).toBe(false)
    expect(roomAt([-14, 1.7, -15.9])).toBe('vesper')
    expect(roomAt([-14, 1.7, -16.1])).toBe('forge')
    // The Vesper keeps its doors to the Lobby and the Sienna.
    const vesperEast = wallById('vesper-east')
    expect(vesperEast.holes).toHaveLength(1)
    expect(insideOpening(vesperEast.holes![0], wallCoordinates(vesperEast, [-8, 0, lobby.sideDoorZ]), 1.7)).toBe(true)
    const vesperSouth = wallById('vesper-south')
    expect(insideOpening(vesperSouth.holes![0], wallCoordinates(vesperSouth, [-14, 0, 8]), 1.7)).toBe(true)
    expect(roomAt([-14, 1.7, 7.9])).toBe('vesper')
  })
  test('the air and the sun reach the three ridges and the works plate and columns keep their places on the walls', () => {
    expect(room.air[0].max.y).toBe(forgeRoof.ridge)
    expect(room.room.sunlit).toBe(true)
    expect(room.room.hasVolumetricSun).toBe(true)
    expect(wallById('forge-south').reservations).toContainEqual({
      profile: 'rectangle',
      u: 0,
      width: forgePlate.width,
      bottom: forgePlate.y - forgePlate.height / 2,
      height: forgePlate.y + forgePlate.height / 2,
    })
    const west = wallById('forge-west')
    for (const {peak} of forgeBays) {
      const u = wallCoordinates(west, [forge.center[0] - forge.size[0] / 2, 0, forge.center[1] + peak])
      expect(west.reservations?.some(r => Math.abs(r.u - u) < 1e-6)).toBe(true)
    }
  })
})
describe('the Forge’s vestibule', () => {
  const {center: [x, z], radius, crown} = forgeVestibule
  const ring = wallById('forge-vestibule')
  const north = wallById('forge-north')
  const northZ = forge.center[1] - forge.size[1] / 2
  /** half the width of the arch into the room, and of the west one onto the approach, as wide as the approach */
  const [half, westHalf] = [forgeArch.width / 2, climbArch.width / 2]
  const archOf = (name: string) => ring.holes!.find(hole => hole.name === name)!
  test('is round, on the room’s axis, its wall touching the middle of the north wall back to back, where an arch opens through both', () => {
    expect(x).toBe(forge.center[0])
    expect(z + radius).toBe(northZ)
    expect(isRing(ring)).toBe(true)
    expect(isRing(north)).toBe(false)
    expect([ring.curveRadius, ring.height, ring.room, ring.sticky]).toEqual([radius, north.height, 'forge', false])
    // All round its center at its radius, facing it
    for (let u = -ring.width / 2; u <= ring.width / 2; u += 0.5) {
      const [px, , pz] = wallPosition(ring, u, 0, 0)
      const [fx, , fz] = wallPosition(ring, u, 0, 1)
      expect(Math.hypot(px - x, pz - z)).toBeCloseTo(radius, 9)
      expect(Math.hypot(fx - x, fz - z)).toBeCloseTo(radius - 1, 9)
    }
    // Where they touch, one faces north into the vestibule and the other south into the room, each with the arch between them in it.
    const inner = archOf('forge')
    const outer = north.holes!.find(hole => hole.name === 'vestibule')!
    expect(outer).toMatchObject(forgeArch)
    for (const [wall, hole, facing] of [[ring, inner, -1], [north, outer, 1]] as const) {
      const [px, , pz] = wallPosition(wall, hole.u, 0, 0)
      expect(px).toBeCloseTo(x, 9)
      expect(pz).toBeCloseTo(northZ, 9)
      expect(wallPosition(wall, hole.u, 0, 0.5)[2]).toBeCloseTo(northZ + facing * 0.5, 9)
    }
    // Each arch spans as much straight across between its jambs as what it opens onto: the arch into the room, and the approach, twice as wide. Besides them, only the window into the Bastion’s cistern pierces this ring.
    expect(ring.holes!.map(hole => hole.name)).toEqual([...vestibuleArches.map(arch => arch.name), 'cistern'])
    expect(vestibuleArches.map(arch => vestibuleArchOpening(forgeRoundVestibule, arch).width)).toEqual([forgeArch.width, climbApproach.width])
    for (const arch of vestibuleArches) {
      const hole = archOf(arch.name)
      const [left, right] = [-1, 1].map(side => wallPosition(ring, hole.u + side * hole.width / 2, 0, 0))
      expect(Math.hypot(left[0] - right[0], left[2] - right[2])).toBeCloseTo(vestibuleArchOpening(forgeRoundVestibule, arch).width, 9)
      expect([hole.height, hole.profile, hole.bottom]).toEqual([climbArch.height, climbArch.profile, undefined])
    }
    // The west one where the approach ends, the arch between the room and the vestibule within the room.
    const [wx, , wz] = wallPosition(ring, archOf('bastion').u, 0, 0)
    expect(wx).toBeCloseTo(climbApproach.route.end.point[0], 9)
    expect(wz).toBeCloseTo(climbApproach.route.end.point[1], 9)
    expect(openings.filter(({rooms: pair}) => pair.includes('forge'))).toEqual([
      {
        rooms: ['bastion', 'forge'],
        holes: [['forge-vestibule', 'bastion']],
      },
      {
        rooms: ['bastion', 'forge'],
        holes: [['forge-vestibule', 'cistern']],
      },
      {
        rooms: ['lobby', 'forge'],
        holes: [['lobby-extension_west', 'forge_window'], ['forge-east', 'lobby_window']],
      },
    ])
  })
  test('navigation holds its round floor and its thresholds out under its arches, and nothing else behind its wall', () => {
    for (const [dx, dz] of [[0, 0], [2.6, 0], [-2.6, 0], [0, -2.9], [0, 2.9], [2, -2], [-2, 2]]) {
      const position = [x + dx, 1.7, z + dz] as const
      expect(roomAt([...position])).toBe('forge')
      expect(floorHeight([...position])).toBe(0)
      expect(insideGallery([...position])).toBe(true)
    }
    // Under the west arch, outside the wall’s center line, out to where the approach ends, as wide as it
    for (const along of [radius - 0.01, radius]) {
      expect(forgeVestibuleFloor(x - along, z + westHalf - 0.01)).toBe(0)
      expect(forgeVestibuleFloor(x - along, z - westHalf + 0.01)).toBe(0)
      expect(forgeVestibuleFloor(x - along, z + westHalf + 0.05)).toBeUndefined()
    }
    expect(forgeVestibuleFloor(x - radius - 0.05, z)).toBeUndefined()
    expect(forgeVestibuleFloor(x + half - 0.01, northZ)).toBe(0)
    // Behind the wall, in the corners of its box, lies nothing.
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      expect(insideGallery([x + dx * (radius - 0.4), 1.7, z + dz * (radius - 0.4)])).toBe(false)
    }
    // Under its floor, the Bastion’s curve climbs west toward the Lodge.
    expect(roomAt([x, -4.4, z - 2.7])).toBe('bastion')
    expect(insideGallery([x, crown, z])).toBe(true)
    expect(insideGallery([x, crown + 0.21, z])).toBe(false)
  })
  test('its floor slab’s shape is what navigation holds: within the wall’s center line and out under each arch to the plane touching it', () => {
    // In the shape’s plane, y runs north.
    const outline = roundVestibuleFloorShape(forgeRoundVestibule).getPoints(256)
    const contains = (px: number, py: number) => {
      let inside = false
      for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
        const [a, b] = [outline[i], outline[j]]
        if (a.y > py !== b.y > py && px < (b.x - a.x) * (py - a.y) / (b.y - a.y) + a.x) {
          inside = !inside
        }
      }
      return inside
    }
    let compared = 0
    for (let dx = -radius - 0.3; dx <= radius + 0.3; dx += 0.07) {
      for (let dz = -radius - 0.3; dz <= radius + 0.3; dz += 0.07) {
        // Right on the wall’s center line, the shape’s chords cut the corners.
        if (Math.abs(Math.hypot(dx, dz) - radius) < 0.01) {
          continue
        }
        expect(`${dx.toFixed(2)}, ${dz.toFixed(2)}: ${contains(dx, -dz)}`).toBe(`${dx.toFixed(2)}, ${dz.toFixed(2)}: ${forgeVestibuleFloor(x + dx, z + dz) !== undefined}`)
        compared++
      }
    }
    expect(compared).toBeGreaterThan(5000)
  })
  test('the reveals line its arches from its wall’s center line out to the plane touching it there, round the jambs and the head, but not the sill', () => {
    const place = new Matrix4
    place.makeRotationY(ring.rotation).setPosition(...ring.center)
    const turn = new Matrix3
    turn.setFromMatrix4(place)
    for (const arch of vestibuleArches) {
      const {angle} = arch
      const opening = vestibuleArchOpening(forgeRoundVestibule, arch)
      const archHalf = opening.width / 2
      const hole = archOf(arch.name)
      const reveal = roundRevealGeometry(ring, hole, opening)
      try {
        const position = reveal.getAttribute('position')
        const normal = reveal.getAttribute('normal')
        const point = new Vector3
        const facing = new Vector3
        const out = [Math.cos(angle), Math.sin(angle)] as const
        let widest = 0
        let highest = 0
        for (let i = 0; i < position.count; i++) {
          point.fromBufferAttribute(position, i).applyMatrix4(place)
          facing.fromBufferAttribute(normal, i).applyMatrix3(turn)
          const [dx, dz] = [point.x - x, point.z - z]
          const along = dx * out[0] + dz * out[1]
          const across = dz * out[0] - dx * out[1]
          // Never in front of the wall’s center line or past the plane, nor wider or higher than what it opens onto
          expect(Math.hypot(dx, dz)).toBeGreaterThan(radius - 1e-6)
          expect(along).toBeLessThan(radius + 1e-6)
          expect(Math.abs(across)).toBeLessThan(archHalf + 1e-6)
          expect(point.y).toBeGreaterThanOrEqual(-1e-9)
          expect(point.y).toBeLessThan(climbArch.height + 1e-6)
          // Facing into the opening: straight across it below where the head springs, toward the middle of the head above, and never along it
          const sideways = facing.z * out[0] - facing.x * out[1]
          const springY = climbArch.height - archHalf
          expect(sideways * -across + facing.y * (Math.min(point.y, springY) - point.y)).toBeGreaterThan(0)
          expect(Math.abs(facing.x * out[0] + facing.z * out[1])).toBeLessThan(1e-6)
          if (Math.abs(along - radius) >= 1e-6) {
            continue
          }
          widest = Math.max(widest, Math.abs(across))
          highest = Math.max(highest, point.y)
        }
        // Out at the plane, it opens as wide and as high as what it opens onto.
        expect(widest).toBeCloseTo(archHalf, 6)
        expect(highest).toBeCloseTo(climbArch.height, 6)
        const [, indices] = colliderGeometry(reveal)
        expect(indices.length).toBeGreaterThan(0)
      } finally {
        reveal.dispose()
      }
    }
  })
})
