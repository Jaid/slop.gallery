import {afterAll, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {acceleratedRaycast, MeshBVH} from 'three-mesh-bvh'
import {DoubleSide, Euler, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import antechamber, {antechamberEastFlight, antechamberEastLanding, antechamberEastRoof, antechamberMoonfallDoor, antechamberNecks, antechamberPavilionCenter, antechamberPavilionCrownY, antechamberPavilions} from '../../src/lib/gallery/antechamber.ts'
import {centralCompassInlayGeometry, eastStairHandrailGeometry, neckBrassRibGeometry, neckVaultGeometry, pavilionCeilingSlabGeometry, pavilionDrumGeometry, pavilionFloorRingGeometry, pavilionLatticeGeometry} from '../../src/lib/gallery/antechamberArchitecture.ts'
import {colliderGeometry, createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {floorThickness} from '../../src/lib/gallery/floors.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import LobbyVaultGeometry from '../../src/lib/gallery/LobbyVaultGeometry.ts'
import lowerGallery from '../../src/lib/gallery/lowerGallery.ts'
import {ceilingBeam, ceilingMirrorY, ceilingSlab, moonfallHeight} from '../../src/lib/gallery/moonfall/config.ts'
import sienna from '../../src/lib/gallery/sienna.ts'
import staircase, {stairApproach, stairBlocks, stairFlights} from '../../src/lib/gallery/staircase.ts'
import {middaySun} from '../../src/lib/gallery/sun.ts'
import {weldedSurfaceSkin} from '../../src/lib/physics/weldedSurface.ts'
import {enabledRooms} from '../../src/worlds/gallery/activations.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import walls, {floorHeight, insideGallery, roomAt} from './fixtures/gallery.ts'

await RAPIER.init()
const material = new MeshBasicMaterial({side: DoubleSide})
const disposables: Array<{dispose: () => void}> = [material]
afterAll(() => {
  for (const item of disposables) {
    item.dispose()
  }
})
describe('Antechamber remake & Lobby sightline occlusion', () => {
  test('zero 3D raycasts from anywhere in the Lobby reach Moonfall’s doorway through the Antechamber', () => {
    const occluders: Array<Mesh> = []
    const addMesh = (part: PlaneGeometry | ReturnType<typeof neckVaultGeometry>, pos: readonly [number, number, number], rotX = 0, rotY = 0) => {
      part.boundsTree = new MeshBVH(part)
      const mesh = new Mesh(part, material)
      mesh.raycast = acceleratedRaycast
      mesh.position.set(pos[0], pos[1], pos[2])
      mesh.rotation.x = rotX
      mesh.rotation.y = rotY
      mesh.updateMatrixWorld(true)
      occluders.push(mesh)
    }
    for (const wall of walls) {
      if (wall.room !== 'lobby' && wall.room !== 'antechamber') {
        continue
      }
      const geometry = createArchitectureGeometry(wall)
      disposables.push(geometry)
      for (const part of [geometry.surface, ...geometry.trim, ...geometry.cornice]) {
        addMesh(part, wall.center, 0, wall.rotation)
      }
    }
    const vault = neckVaultGeometry()
    const pavSlab = pavilionCeilingSlabGeometry()
    const lobbyVault = new LobbyVaultGeometry
    disposables.push(vault, pavSlab, lobbyVault)
    for (const {center: [nx, nz]} of antechamberNecks) {
      addMesh(vault, [nx, antechamber.neck.springY, nz])
    }
    for (const {center: [px, pz], height} of antechamberPavilions) {
      addMesh(pavSlab, [px, height - 0.11, pz], -Math.PI / 2)
    }
    const lobbyRoom = slopGallery.room('lobby')
    addMesh(lobbyVault.clad, [lobbyRoom.center[0], 0, lobbyRoom.center[1]])
    // Target plane sitting right across the Moonfall doorway in antechamber-west_south.
    const portalGeo = new PlaneGeometry(antechamberMoonfallDoor.width, antechamberMoonfallDoor.height)
    portalGeo.boundsTree = new MeshBVH(portalGeo)
    disposables.push(portalGeo)
    const portalMesh = new Mesh(portalGeo, material)
    portalMesh.raycast = acceleratedRaycast
    portalMesh.position.set(antechamberMoonfallDoor.x, antechamberMoonfallDoor.height / 2, antechamberMoonfallDoor.z)
    portalMesh.updateMatrixWorld(true)
    const allMeshes = [...occluders, portalMesh]
    // Sample origins across the entire Lobby — standing, crouching, high in the vault and the exact issue camera pose.
    const origins: Array<Vector3> = [
      new Vector3(-7.033, 7.919, -3.262),
      new Vector3(-2.321, 1.62, 5.655),
    ]
    for (const x of [-7.7, -4, -1.2, 0, 1.2, 4, 7.7]) {
      for (const z of [-28, -12, 0, 5, 7.7]) {
        for (const y of [0.8, 1.62, 4.5, 9]) {
          origins.push(new Vector3(x, y, z))
        }
      }
    }
    // Aim at a grid of points across the entire Moonfall doorway opening.
    const targets: Array<Vector3> = []
    for (let ix = 0; ix <= 8; ix++) {
      const tx = antechamberMoonfallDoor.x - antechamberMoonfallDoor.width / 2 + antechamberMoonfallDoor.width * ix / 8
      for (let iy = 0; iy <= 6; iy++) {
        const ty = 0.05 + (antechamberMoonfallDoor.height - 0.1) * iy / 6
        targets.push(new Vector3(tx, ty, antechamberMoonfallDoor.z))
      }
    }
    let unblocked = 0
    for (const origin of origins) {
      for (const target of targets) {
        const direction = target.clone().sub(origin)
        const distance = direction.length()
        direction.divideScalar(distance)
        const raycaster = new Raycaster(origin, direction, 0.01, distance + 0.05)
        raycaster.firstHitOnly = true
        const hit = raycaster.intersectObjects(allMeshes, false).at(0)
        if (hit?.object === portalMesh) {
          unblocked++
        }
      }
    }
    expect(unblocked).toBe(0)
    // Consequently Moonfall is omitted from every Lobby activation.
    for (const fence of slopGallery.fencesIn('lobby')) {
      expect(enabledRooms([fence])).not.toContain('moonfall')
    }
  })
  test('flanking pavilions clear the Sienna, stay below the Lobby vault springing and admit midday sun through their oculus skylights', () => {
    const siennaEastX = sienna.center[0] + sienna.size[0] / 2
    const [westX] = antechamberPavilionCenter('west')
    const westMinX = westX - antechamber.pavilion.size[0] / 2
    expect(westMinX - siennaEastX).toBeGreaterThan(0.9)
    expect(antechamberPavilionCrownY).toBeLessThan(lobby.southZ) // and strictly under 5.8 m
    expect(antechamberPavilionCrownY).toBeLessThan(5.8)
    // Midday sun passes through the pavilion skylight lattice and drum onto the floor.
    const slab = pavilionCeilingSlabGeometry()
    const drum = pavilionDrumGeometry()
    const lattice = pavilionLatticeGeometry()
    disposables.push(slab, drum, lattice)
    const pHeight = antechamber.pavilion.height
    const springY = pHeight + 0.07
    const latticeY = springY + antechamber.pavilion.skylight.drumHeight - antechamber.pavilion.skylight.latticeDepth
    const slabMesh = new Mesh(slab, material)
    slabMesh.position.set(0, pHeight - 0.11, 0)
    slabMesh.rotation.x = -Math.PI / 2
    slabMesh.updateMatrixWorld(true)
    const drumMesh = new Mesh(drum, material)
    drumMesh.position.set(0, springY, 0)
    drumMesh.updateMatrixWorld(true)
    const latticeMesh = new Mesh(lattice, material)
    latticeMesh.position.set(0, latticeY, 0)
    latticeMesh.updateMatrixWorld(true)
    const sunDir = new Vector3(...middaySun)
    sunDir.normalize()
    let sunlit = 0
    for (let x = -2; x <= 2; x += 0.25) {
      for (let z = -2.5; z <= 2.5; z += 0.25) {
        const raycaster = new Raycaster(new Vector3(x, 0.05, z), sunDir)
        if (raycaster.intersectObjects([slabMesh, drumMesh, latticeMesh], false).length === 0) {
          sunlit++
        }
      }
    }
    expect(sunlit).toBeGreaterThan(10)
    // Custom architectural geometries are finite and non-empty.
    for (const part of [centralCompassInlayGeometry(), pavilionFloorRingGeometry(), neckBrassRibGeometry(), eastStairHandrailGeometry(-1), eastStairHandrailGeometry(1)]) {
      disposables.push(part)
      const positions = part.getAttribute('position')
      expect(positions.count).toBeGreaterThan(0)
      expect([...positions.array].every(Number.isFinite)).toBe(true)
    }
  })
  test('Moonfall’s ceiling sits flush beneath the ground-floor slabs, +189 cm higher, clear of its stairs and approach', () => {
    const moonfall = slopGallery.room('moonfall')
    const moonfallEastX = lowerGallery.moonfall.center[0] + lowerGallery.moonfall.size[0] / 2
    const slabTopWorldY = lowerGallery.floorY + ceilingSlab.center + ceilingSlab.thickness / 2
    expect(slabTopWorldY).toBeCloseTo(-floorThickness, 9)
    expect(moonfall.height).toBeCloseTo(moonfallHeight, 9)
    expect(moonfallHeight - 5.69).toBeCloseTo(1.89, 2)
    expect(ceilingMirrorY).toBeCloseTo(moonfallHeight - 0.01, 9)
    // Ceiling beams clear the walls’ cornice below (wall.height − 0.105).
    const wallCorniceTop = moonfallHeight - 0.3 - 0.105
    expect(ceilingBeam.bottomY).toBeGreaterThan(wallCorniceTop)
    // No descending stair block enters Moonfall’s footprint (x < moonfallEastX).
    for (const block of stairBlocks) {
      expect(block.position[0] - block.size[0] / 2).toBeGreaterThanOrEqual(moonfallEastX - 1e-9)
    }
    expect(stairFlights[0].start[0]).toBe(moonfallEastX)
    expect(staircase.startX).toBe(moonfallEastX)
    // The curved approach over Moonfall stays at ground level (y = 0, slab bottom −floorThickness).
    expect(stairApproach.y - floorThickness).toBeCloseTo(slabTopWorldY, 9)
  })
  for (const fps of [30, 60, 120]) {
    for (const sprint of [false, true]) {
      for (const returning of [false, true]) {
        test(`walks from the Antechamber center through the east arched neck, pavilion and ascending stairs to the top landing at ${fps} Hz, sprint ${sprint}, returning ${returning}`, () => {
          const world = new RAPIER.World({
            x: 0,
            y: -9.81,
            z: 0,
          })
          world.timestep = 1 / fps
          const anteWalls = walls.filter(wall => wall.room === 'antechamber').map(wall => ({
            wall,
            geometry: createArchitectureGeometry(wall),
          }))
          for (const {wall, geometry} of anteWalls) {
            const rotation = new Quaternion
            rotation.setFromAxisAngle(new Vector3(0, 1, 0), wall.rotation)
            for (const [vertices, indices] of geometry.collision) {
              world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setContactSkin(weldedSurfaceSkin).setTranslation(...wall.center).setRotation(rotation))
            }
          }
          // Floor colliders: central hall, necks, pavilions, east flight and top landing.
          world.createCollider(RAPIER.ColliderDesc.cuboid(antechamber.size[0] / 2, floorThickness / 2, antechamber.size[1] / 2).setTranslation(antechamber.center[0], -floorThickness / 2, antechamber.center[1]))
          for (const {center: [nx, nz], size: [nLen, nWidth]} of antechamberNecks) {
            world.createCollider(RAPIER.ColliderDesc.cuboid(nLen / 2, floorThickness / 2, nWidth / 2).setTranslation(nx, -floorThickness / 2, nz))
          }
          for (const {center: [px, pz], size: [pWidth, pDepth]} of antechamberPavilions) {
            world.createCollider(RAPIER.ColliderDesc.cuboid(pWidth / 2, floorThickness / 2, pDepth / 2).setTranslation(px, -floorThickness / 2, pz))
          }
          for (const block of antechamberEastFlight.blocks) {
            world.createCollider(RAPIER.ColliderDesc.cuboid(block.size[0] / 2, block.size[1] / 2, block.size[2] / 2).setTranslation(...block.position))
          }
          const [lx, lz] = antechamberEastLanding.center
          const [lLen, lWidth] = antechamberEastLanding.size
          world.createCollider(RAPIER.ColliderDesc.cuboid(lLen / 2, floorThickness / 2, lWidth / 2).setTranslation(lx, antechamberEastLanding.floorY - floorThickness / 2, lz))
          world.createCollider(RAPIER.ColliderDesc.cuboid(lLen / 2, 0.09, lWidth / 2).setTranslation(lx, antechamberEastLanding.floorY + antechamberEastLanding.height + 0.09, lz))
          const roofRotation = new Quaternion
          roofRotation.setFromEuler(new Euler(...antechamberEastRoof.rotation))
          world.createCollider(RAPIER.ColliderDesc.cuboid(antechamberEastRoof.size[0] / 2, antechamberEastRoof.size[1] / 2, antechamberEastRoof.size[2] / 2).setTranslation(...antechamberEastRoof.position).setRotation(roofRotation))
          const vault = neckVaultGeometry()
          const [vaultVerts, vaultIdx] = colliderGeometry(vault)
          for (const {center: [nx, nz]} of antechamberNecks) {
            world.createCollider(RAPIER.ColliderDesc.trimesh(vaultVerts, vaultIdx, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setContactSkin(weldedSurfaceSkin).setTranslation(nx, antechamber.neck.springY, nz))
          }
          vault.dispose()
          for (const side of [-1, 1] as const) {
            const rail = eastStairHandrailGeometry(side)
            const [verts, idx] = colliderGeometry(rail)
            world.createCollider(RAPIER.ColliderDesc.trimesh(verts, idx, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setContactSkin(weldedSurfaceSkin).setTranslation(antechamber.center[0], 0, antechamber.center[1]))
            rail.dispose()
          }
          const path: Array<[number, number]> = [
            [0, 12],
            [2.5, 10],
            [5, 10],
            [8.5, 10],
            [8.5, 11],
            [11.2, 11],
            [16.5, 11],
          ]
          if (returning) {
            path.reverse()
          }
          const startY = returning ? antechamberEastLanding.floorY : 0
          const endY = returning ? 0 : antechamberEastLanding.floorY
          // Navigation and room membership agree at both endpoints.
          expect(floorHeight([16.5, antechamberEastLanding.floorY + 1.6, 11])).toBeCloseTo(antechamberEastLanding.floorY, 6)
          expect(insideGallery([16.5, antechamberEastLanding.floorY + 1.6, 11])).toBe(true)
          expect(roomAt([16.5, antechamberEastLanding.floorY + 1.6, 11])).toBe('antechamber')
          const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(path[0][0], startY + 0.04, path[0][1]))
          const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
          const motor = new EgoMotor(RAPIER, world, body, collider)
          const facing = new Quaternion
          try {
            for (let i = 0; i < 30; i++) {
              motor.step(world.timestep, {}, facing)
              world.step()
            }
            let target = 1
            for (let i = 0; i < fps * 18 && target < path.length; i++) {
              const position = body.translation()
              const dx = path[target][0] - position.x
              const dz = path[target][1] - position.z
              if (Math.hypot(dx, dz) < (sprint ? 0.55 : Math.max(0.14, 3 / fps))) {
                target++
                continue
              }
              facing.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(-dx, -dz))
              motor.step(world.timestep, {
                forward: true,
                sprint,
              }, facing)
              world.step()
            }
            expect(target).toBe(path.length)
            for (let i = 0; i < 60; i++) {
              motor.step(world.timestep, {}, facing)
              world.step()
            }
            expect(body.translation().y).toBeCloseTo(endY + 0.02, 2)
            expect(motor.grounded).toBe(true)
          } finally {
            motor.dispose()
            world.free()
            for (const {geometry} of anteWalls) {
              geometry.dispose()
            }
          }
        })
      }
    }
  }
})
