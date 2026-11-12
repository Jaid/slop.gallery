import type {ReactNode} from 'react'

import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Children, isValidElement} from 'react'
import {BoxGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {createArchitectureGeometry, wallFace} from '../../src/lib/gallery/architecture.ts'
import {frameToWorld, tunnelFloorAt, tunnelFrame} from '../../src/lib/gallery/exhibitionTunnel.ts'
import {floorThickness, roomFloorPlan} from '../../src/lib/gallery/floors.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import lowerGallery, {oculusCeiling, oculusPlatform} from '../../src/lib/gallery/lowerGallery.ts'
import oculusApse, {apseBoundaryZ} from '../../src/lib/gallery/oculusApse.ts'
import StairFlight from '../../src/lib/gallery/stairs/StairFlight.ts'
import renderOculusRoom from '../../src/rooms/oculus/components/OculusRoom/index.tsx'
import walls, {floorHeight, insideGallery, roomAt, rooms} from './fixtures/gallery.ts'

await RAPIER.init()
const {oculus, tunnel} = lowerGallery
const {floorY} = oculus
const upper = rooms.find(room => room.id === 'lobby')!
describe('oculus and connecting tunnel', () => {
  test('the side walls stand 9 m either side of the glass and the entrance, which are centered between them', () => {
    expect(walls.find(value => value.id === 'oculus-west')!.center[0]).toBe(-9)
    expect(walls.find(value => value.id === 'oculus-east')!.center[0]).toBe(9)
    expect(insideGallery([-8.9, -6.4, -24])).toBe(true)
    expect(insideGallery([8.9, -6.4, -24])).toBe(true)
    expect(insideGallery([9.01, -6.4, -24])).toBe(false)
    expect(lobby.opening.center).toEqual([0, -24])
    // The tunnel to the Exhibition leaves the middle of the south wall, under the glass.
    expect(tunnel.north[0]).toBe(0)
    expect(oculusCeiling.reduce((sum, slab) => sum + slab.size[0] * slab.size[1], 0)).toBe(18 * 20 - 8 * 8)
  })
  test('lower walls meet the ceiling underside without coplanar faces in the upper floor', () => {
    const ceilingBottom = oculus.ceiling.topY - oculus.ceiling.thickness
    expect(oculus.ceiling.topY).toBe(-floorThickness)
    const material = new MeshBasicMaterial
    try {
      for (const side of ['northwest', 'north', 'northeast', 'east', 'south', 'west']) {
        const wall = walls.find(value => value.id === `oculus-${side}`)!
        const geometry = createArchitectureGeometry(wall)
        try {
          const mesh = new Mesh(geometry.surface, material)
          mesh.position.set(...wall.center)
          mesh.rotation.y = wall.rotation
          mesh.updateMatrixWorld(true)
          expect(wall.center[1] + geometry.surface.boundingBox!.max.y).toBeCloseTo(ceilingBottom, 5)
          for (const part of [geometry.surface, ...geometry.trim]) {
            expect(wall.center[1] + part.boundingBox!.max.y).toBeLessThan(-floorThickness)
          }
          const origin = mesh.localToWorld(new Vector3(0, 0, wallFace / 2))
          origin.y = 1
          const ray = new Raycaster(origin, new Vector3(0, -1, 0), 0, 1 + floorThickness)
          expect(ray.intersectObject(mesh)).toHaveLength(0)
          ray.far = 2
          expect(ray.intersectObject(mesh)[0].point.y).toBeCloseTo(ceilingBottom, 5)
        } finally {
          geometry.dispose()
        }
      }
    } finally {
      material.dispose()
    }
  })
  test('the platform fills the north end and the apse behind it with a matching walkable top', () => {
    const {position, size} = oculusPlatform
    expect(size).toEqual([18, 5, 4])
    expect(position).toEqual([0, -8.5, -33])
    expect(position[1] - size[1] / 2).toBe(floorY)
    expect(position[2] - size[2] / 2).toBe(-35)
    expect(position[2] + size[2] / 2).toBe(-31)
    expect(floorHeight([0, -4.4, -32])).toBe(-6)
    expect(floorHeight([0, 1.6, -32])).toBe(0)
    expect(floorHeight([0, -7.4, -30.9])).toBe(floorY)
    // In the apse, up to its round wall
    for (const [x, z] of [[0, -39.8], [-6, -38.9], [7, -38.4], [8.8, -35.3]] as const) {
      expect(floorHeight([x, -4.4, z])).toBe(-6)
      expect(insideGallery([x, -4.4, z])).toBe(true)
      expect(roomAt([x, -4.4, z])).toBe('oculus')
    }
    const geometry = new BoxGeometry(...size)
    const material = new MeshBasicMaterial
    const mesh = new Mesh(geometry, material)
    mesh.position.set(...position)
    mesh.updateMatrixWorld(true)
    const world = new RAPIER.World({
      x: 0,
      y: -9.81,
      z: 0,
    })
    try {
      world.createCollider(RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2).setTranslation(...position))
      world.step()
      const origin = new Vector3(0, -3, -31)
      const direction = new Vector3(0, -1, 0)
      const platformRay = new Raycaster(origin, direction)
      expect(platformRay.intersectObject(mesh)[0].point.y).toBe(-6)
      expect(world.castRay(new RAPIER.Ray(origin, direction), 4, true)!.timeOfImpact).toBe(3)
    } finally {
      geometry.dispose()
      material.dispose()
      world.free()
    }
  })
  test('the Oculus runs from its round north end, past the glass, to the tunnel toward Moonfall', () => {
    expect(walls.find(wall => wall.id === 'oculus-north')!.center[2]).toBeCloseTo(oculusApse.northZ - oculusApse.depth)
    expect(walls.find(wall => wall.id === 'oculus-south')!.center[2]).toBe(-15)
    expect(oculus.center).toEqual([0, -25])
    expect(oculus.size).toEqual([18, 20])
    expect(lobby.opening.center).toEqual([0, -24])
    expect(lobby.opening.size).toEqual([8, 8])
    expect(insideGallery([0, -4.4, -39.99])).toBe(true)
    expect(insideGallery([0, -4.4, -40.01])).toBe(false)
    // The apse turns out of both side walls tangentially, round shoulders taking up half of each side, and reaches five meters north along its middle.
    expect(oculusApse.depth).toBe(5)
    expect(oculusApse.shoulderRadius).toBe(4.5)
    expect(apseBoundaryZ(0)).toBeCloseTo(-40)
    for (const side of [-1, 1]) {
      expect(apseBoundaryZ(side * 9)).toBeCloseTo(-35)
      expect(apseBoundaryZ(side * 8.99)! - -35).toBeLessThan(0)
      expect(apseBoundaryZ(side * 8.99)! - -35).toBeGreaterThan(-0.35)
      expect(apseBoundaryZ(side * 4.5)! - -35).toBeLessThan(-4.5)
      expect(insideGallery([side * 9.01, -5.4, -35.5])).toBe(false)
    }
    expect(roomAt([0, -6.4, -24])).toBe('oculus')
    expect(roomAt([0, 1.6, -24])).toBe('lobby')
    for (const [x, z] of [[0, -14.9], frameToWorld([0, 0.3]), frameToWorld([0, tunnelFrame.length / 2]), frameToWorld([0, tunnelFrame.length - 0.3]), [tunnel.south[0], tunnel.south[1] - 0.1]] as const) {
      const floor = tunnelFloorAt(x, z)!
      expect(insideGallery([x, floor + 1.6, z])).toBe(true)
      expect(floorHeight([x, floor + 1.6, z])).toBeCloseTo(floor)
      expect(roomAt([x, floor + 1.6, z])).toBe('exhibition')
    }
    // beside the tunnel’s straight run out of the south wall
    for (const side of [-1, 1]) {
      expect(insideGallery([side * (tunnel.width / 2 + 0.01), oculus.floorY + 1.6, -14.5])).toBe(false)
    }
  })
  test('the ceiling opening stays aligned with the transparent floor and contains no fixtures or lights', () => {
    const material = new MeshBasicMaterial
    const meshes = [
      ...roomFloorPlan(upper).slabs.map(({center: [x, z], size: [width, depth]}) => {
        const mesh = new Mesh(new BoxGeometry(width, floorThickness, depth), material)
        mesh.position.set(x + upper.center[0], -floorThickness / 2, z + upper.center[1])
        return mesh
      }),
      ...oculusCeiling.map(({center: [x, z], size: [width, depth]}) => {
        const mesh = new Mesh(new BoxGeometry(width, oculus.ceiling.thickness, depth), material)
        mesh.position.set(x + oculus.center[0], oculus.ceiling.topY - oculus.ceiling.thickness / 2, z + oculus.center[1])
        return mesh
      }),
    ]
    try {
      for (const mesh of meshes) {
        mesh.updateMatrixWorld(true)
      }
      for (const x of [-5, -3.9, 0, 3.9, 5]) {
        for (const z of [-34, -28.1, -27.9, -24, -20.1, -19.9, -18.5]) {
          const glass = Math.abs(x) < 4 && z > -28 && z < -20
          const sightline = new Raycaster(new Vector3(x, 4.9, z), new Vector3(0, -1, 0), 0, 13)
          expect(sightline.intersectObjects(meshes).length === 0).toBe(glass)
        }
      }
      const visit = (node: ReactNode) => {
        Children.forEach(node, child => {
          if (!isValidElement<{children?: ReactNode}>(child)) {
            return
          }
          if (typeof child.type === 'string') {
            expect(child.type).not.toMatch(/emissive|light/i)
          }
          visit(child.props.children)
        })
      }
      visit(renderOculusRoom({
        material,
        stone: material,
      }))
    } finally {
      for (const mesh of meshes) {
        mesh.geometry.dispose()
      }
      material.dispose()
    }
  })
})
test('stair flights reject degenerate dimensions rather than emitting broken geometry', () => {
  expect(() => new StairFlight('invalid', [0, 0, 0], [0, -4, 0], 2.6, 20)).toThrow(RangeError)
  expect(() => new StairFlight('invalid', [0, 0, 0], [8, 0, 1], 2.6, 20)).toThrow(RangeError)
  expect(() => new StairFlight('invalid', [0, 0, 0], [8, -4, 0], 2.6, 0)).toThrow(RangeError)
  expect(() => new StairFlight('invalid', [0, 0, 0], [8, -4, 0], 2.6, 20, 9)).toThrow(RangeError)
})
