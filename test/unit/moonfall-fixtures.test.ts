import {expect, test} from 'bun:test'

import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {createArchitectureGeometry, wallOpeningTrim} from '../../src/lib/gallery/architecture.ts'
import {defaultBaseboardHeight} from '../../src/lib/gallery/architectureDimensions.ts'
import lowerGallery from '../../src/lib/gallery/lowerGallery.ts'
import moonfallWallLeds, {wallLedHousing} from '../../src/lib/gallery/moonfall/fixtures.ts'
import moonfallWalls from '../../src/rooms/moonfall/walls.ts'
import walls from './fixtures/gallery.ts'

const room = lowerGallery.moonfall
test('every Moonfall LED is backed by solid wall across its entire housing', () => {
  const material = new MeshBasicMaterial
  try {
    for (const {position: [x, y, z], inward: [inwardX, inwardZ], wall: wallName} of moonfallWallLeds) {
      const wall = walls.find(candidate => candidate.id === `moonfall-${wallName}`)!
      const geometry = createArchitectureGeometry(wall)
      const mesh = new Mesh(geometry.surface, material)
      mesh.position.set(...wall.center)
      mesh.rotation.y = wall.rotation
      mesh.updateMatrixWorld(true)
      try {
        const reach = wallLedHousing.width / 2 - 0.001
        const rise = wallLedHousing.height / 2 - 0.001
        for (const along of [-reach, 0, reach]) {
          for (const up of [-rise, 0, rise]) {
            const origin = new Vector3(room.center[0] + x - inwardZ * along + inwardX * 0.005, lowerGallery.floorY + y + up, room.center[1] + z + inwardX * along + inwardZ * 0.005)
            const backingRay = new Raycaster(origin, new Vector3(-inwardX, 0, -inwardZ), 0, 0.3)
            const hit = backingRay.intersectObject(mesh)[0]
            expect(hit).toBeDefined()
            expect(hit.distance).toBeCloseTo(wallLedHousing.depth / 2 + 0.005, 5)
          }
        }
      } finally {
        geometry.dispose()
      }
    }
  } finally {
    material.dispose()
  }
})
test('the LEDs flanking each Moonfall opening keep the same distance from its casing’s side as from the casing’s top and the baseboard', () => {
  for (const [wallName, holeName] of [['east', 'stairway'], ['north', 'exhibition']] as const) {
    const wall = moonfallWalls[wallName]
    const hole = wall.holes![holeName]
    const flanking = moonfallWallLeds.filter(led => led.wall === wallName)
    expect(flanking).toHaveLength(2)
    for (const {position: [x, y, z]} of flanking) {
      const u = (x - wall.center[0]) * Math.cos(wall.rotation) - (z - wall.center[2]) * Math.sin(wall.rotation)
      const side = Math.abs(u - hole.u) - wallLedHousing.width / 2 - hole.width / 2 - wallOpeningTrim
      const top = hole.height + wallOpeningTrim - (y + wallLedHousing.height / 2)
      const bottom = y - wallLedHousing.height / 2 - defaultBaseboardHeight
      expect(side).toBeGreaterThan(0)
      expect(top).toBeCloseTo(side, 9)
      expect(bottom).toBeCloseTo(side, 9)
    }
  }
})
