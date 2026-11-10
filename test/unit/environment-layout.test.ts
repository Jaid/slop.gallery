import {expect, test} from 'bun:test'

import {Box3, Euler, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {corridorLanding, corridorPassage} from '../../src/lib/gallery/corridor.ts'
import {fountainBench, fountainBenches} from '../../src/lib/gallery/fountainBenches.ts'
import {lobbyFountainReach, lobbyFountainSpot} from '../../src/lib/gallery/lobbyFountain.ts'
import lodge, {lodgeWindowRibCutouts} from '../../src/lib/gallery/lodge.ts'
import TimberGeometry from '../../src/lib/gallery/passages/TimberGeometry.ts'
import SlattedBenchGeometry from '../../src/lib/gallery/SlattedBenchGeometry.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import walls from './fixtures/gallery.ts'

test('four matching slatted benches surround the fountain under the middle chandelier and leave the spawn clear', () => {
  expect(lobbyFountainSpot).toEqual([0, 0, -12])
  expect(fountainBenches.map(pose => pose.rotation[1])).toEqual([0, Math.PI / 2, Math.PI, Math.PI * 3 / 2])
  const geometry = new SlattedBenchGeometry
  try {
    const seat = geometry.wood.boundingBox!
    expect(seat.max.y).toBeCloseTo(0.5)
    expect(seat.max.x - seat.min.x).toBeGreaterThan(2.7)
    expect(seat.max.z - seat.min.z).toBeCloseTo(0.8)
    expect(geometry.metal.boundingBox!.min.y).toBeCloseTo(0)
    for (const part of [geometry.wood, geometry.metal]) {
      for (const attribute of Object.values(part.attributes)) {
        expect([...attribute.array].every(Number.isFinite)).toBe(true)
      }
    }
    for (const {position, rotation} of fountainBenches) {
      expect(Math.hypot(position[0] - lobbyFountainSpot[0], position[2] - lobbyFountainSpot[2])).toBeCloseTo(fountainBench.radius)
      const transform = new Matrix4
      transform.makeRotationFromEuler(new Euler(...rotation)).setPosition(...position)
      const bounds = new Box3
      bounds.copy(seat).applyMatrix4(transform)
      expect(bounds.distanceToPoint(new Vector3(...slopGallery.spawn.position))).toBeGreaterThan(0.5)
      const center = new Vector3(lobbyFountainSpot[0], 0.48, lobbyFountainSpot[2])
      expect(bounds.distanceToPoint(center) - lobbyFountainReach).toBeGreaterThan(1.4)
    }
    // Six continuous lengthwise battens, with genuine openings between them.
    expect(fountainBench.slats).toBe(6)
    const material = new MeshBasicMaterial
    try {
      const mesh = new Mesh(geometry.wood, material)
      const {depth, slats, slatGap} = fountainBench
      const pitch = (depth + slatGap) / slats
      for (let slat = 0; slat < slats; slat++) {
        const z = (slat + 0.5) * pitch - (depth + slatGap) / 2
        for (const x of [-1.3, -0.8, 0, 0.8, 1.3]) {
          const ray = new Raycaster(new Vector3(x, 1, z), new Vector3(0, -1, 0))
          expect(ray.intersectObject(mesh)[0].point.y).toBeCloseTo(fountainBench.height)
          if (!(slat < slats - 1)) {
            continue
          }
          ray.ray.origin.z += pitch / 2
          expect(ray.intersectObject(mesh)).toHaveLength(0)
        }
        const leftEndRay = new Raycaster(new Vector3(-1, 1, z), new Vector3(0, -1, 0))
        const left = leftEndRay.intersectObject(mesh)[0]
        const rightEndRay = new Raycaster(new Vector3(1, 1, z), new Vector3(0, -1, 0))
        const right = rightEndRay.intersectObject(mesh)[0]
        expect(left.uv!.x).toBeCloseTo(right.uv!.x)
        expect(Math.abs(left.uv!.y - right.uv!.y)).toBeGreaterThan(0.6)
      }
    } finally {
      material.dispose()
    }
  } finally {
    geometry.dispose()
  }
})
test('timber entrances have a single exposed face across the ribs, lining and structural wall ends', () => {
  const material = new MeshBasicMaterial
  // Each leaves its room straight out of a wall: the landing west out of the Sienna’s vestibule, the passage north out of the Lodge’s bay.
  const entrances = [
    {
      timber: TimberGeometry.passage(corridorLanding),
      start: [corridorLanding.path[0][0], corridorLanding.floorY, corridorLanding.path[0][1]],
      width: corridorLanding.width,
      into: new Vector3(1, 0, 0),
      wallIds: ['sienna-vestibule_west', ...corridorLanding.walls.map(wall => wall.id)],
    },
    {
      timber: TimberGeometry.passage(corridorPassage, lodgeWindowRibCutouts),
      start: [corridorPassage.path[0][0], corridorPassage.floorY, corridorPassage.path[0][1]],
      width: corridorPassage.width,
      into: new Vector3(0, 0, 1),
      wallIds: ['lodge-north', ...corridorPassage.walls.map(wall => wall.id)],
    },
  ]
  try {
    for (const {timber, start, width, into, wallIds} of entrances) {
      const across = new Vector3(into.z, 0, into.x)
      const doorway = new Vector3(start[0], start[1], start[2])
      const architecture = walls.filter(wall => wallIds.includes(wall.id)).map(wall => ({
        wall,
        geometry: createArchitectureGeometry(wall),
      }))
      try {
        const meshes = [timber.ribs, timber.shell].map(part => new Mesh(part, material))
        for (const {wall, geometry} of architecture) {
          for (const part of [geometry.surface, ...geometry.trim]) {
            const mesh = new Mesh(part, material)
            mesh.position.set(...wall.center)
            mesh.rotation.y = wall.rotation
            mesh.updateMatrixWorld()
            meshes.push(mesh)
          }
        }
        for (const side of [-1, 1]) {
          for (const cross of [1.06, 1.12, 1.19, 1.2, 1.215, 1.22, 1.24, 1.28, 1.31]) {
            for (const height of [0.1, 0.41, 0.83, 1.37, 1.9, 2.2, 2.9, 3.35]) {
              const origin = doorway.clone().setY(start[1] + height).addScaledVector(into, 0.8).addScaledVector(across, side * (width / 2 - 1.3 + cross))
              const exposedFaceRay = new Raycaster(origin, into.clone().negate(), 0, 2)
              const hits = exposedFaceRay.intersectObjects(meshes)
              expect(hits.length).toBeGreaterThan(0)
              const front = hits.filter(hit => Math.abs(hit.distance - hits[0].distance) < 0.0001)
              const frontMeshes = new Set(front.map(hit => hit.object))
              expect(frontMeshes.size).toBe(1)
            }
          }
        }
        // The timber is a real projecting reveal, not a depth-biased material or an open ceiling seam.
        const origin = doorway.clone().setY(start[1] + 1.6).addScaledVector(into, 0.015)
        const ceilingRay = new Raycaster(origin, new Vector3(0, 1, 0), 0, 3)
        const ceiling = ceilingRay.intersectObjects(meshes)[0]
        expect(ceiling.distance).toBeGreaterThan(1.5)
        expect(ceiling.distance).toBeLessThan(2.1)
      } finally {
        for (const {geometry} of architecture) {
          geometry.dispose()
        }
      }
    }
  } finally {
    material.dispose()
    for (const {timber} of entrances) {
      timber.dispose()
    }
  }
})
test('corridor timber ribs never share their visible face with a wall baseboard', () => {
  // the long hall’s west wall
  const wall = walls.find(value => value.id === 'corridor-wall_8')!
  const architecture = createArchitectureGeometry(wall)
  const timber = TimberGeometry.passage(corridorPassage, lodgeWindowRibCutouts)
  const material = new MeshBasicMaterial
  try {
    expect(wall.trimStyle).toBe('none')
    expect(architecture.trim).toHaveLength(0)
    const surface = new Mesh(architecture.surface, material)
    surface.position.set(...wall.center)
    surface.rotation.y = wall.rotation
    surface.updateMatrixWorld()
    const meshes = [surface, new Mesh(timber.ribs, material), new Mesh(timber.shell, material)]
    const ray = new Raycaster(new Vector3(lodge.approachX, lodge.floorY + 0.3, -20), new Vector3(-1, 0, 0))
    const hits = ray.intersectObjects(meshes)
    expect(hits[0].point.x).toBeLessThan(lodge.approachX - corridorPassage.width / 2 + 0.3)
    expect(hits[1].distance - hits[0].distance).toBeGreaterThan(0.01)
    expect(walls.filter(value => value.room === 'corridor').every(value => value.trimStyle === 'none')).toBe(true)
    expect(walls.filter(value => value.room === 'bastion').every(value => value.trimStyle === 'plain')).toBe(true)
  } finally {
    material.dispose()
    architecture.dispose()
    timber.dispose()
  }
})
