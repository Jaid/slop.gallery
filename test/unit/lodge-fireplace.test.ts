import type {Vec3} from '../../src/lib/gallery/types.ts'
import type {ReactElement, ReactNode} from 'react'

import {expect, test} from 'bun:test'

import {Children, isValidElement} from 'react'
import {Euler, Matrix4, Vector3} from 'three/webgpu'

import LodgeFire from '../../src/components/LodgeFire/index.tsx'
import LodgeFireGuard from '../../src/components/LodgeFireGuard/index.tsx'
import LodgeFurnishings from '../../src/components/LodgeFurnishings/index.tsx'
import fire, {fireWorldOrigin} from '../../src/lib/gallery/fireplace/config.ts'
import createFireGuardGeometry, {guardBarrier, guardDepth} from '../../src/lib/gallery/fireplace/FireGuardGeometry.ts'
import lodge from '../../src/lib/gallery/lodge.ts'
import lodgeInterior from '../../src/lib/gallery/lodgeInterior/layout.ts'
import LodgeMaterials from '../../src/lib/materials/LodgeMaterials.ts'
import renderLodgeRoom from '../../src/rooms/lodge/components/LodgeRoom/index.tsx'

type Props = {
  children?: ReactNode
  colliders?: false | string
  name?: string
  position?: Vec3
  rotation?: Vec3
  size?: Vec3
  type?: string
}
const descendants = (node: ReactNode): Array<ReactElement<Props>> => Children.toArray(node).flatMap(child => {
  return isValidElement<Props>(child) ? [child, ...descendants(child.props.children)] : []
})
test('the complete fireplace faces inward from the south wall without moving the furniture', () => {
  const materials = new LodgeMaterials
  try {
    const room = renderLodgeRoom({materials})
    const fireplace = descendants(room).find(child => child.props.name === 'lodge-fireplace')!
    expect(fireplace.props.rotation).toEqual([0, Math.PI, 0])
    const parts = descendants(fireplace.props.children)
    expect(parts.find(child => child.props.colliders === 'cuboid')!.props.type).toBe('fixed')
    expect(parts.some(child => child.type === LodgeFire)).toBe(true)
    expect(parts.some(child => child.type === LodgeFireGuard)).toBe(true)
    const transform = new Matrix4
    transform.makeRotationFromEuler(new Euler(...fireplace.props.rotation!)).setPosition(lodge.center[0], lodge.floorY, lodge.center[1])
    const toWorld = (position: Vec3) => {
      const worldPosition = new Vector3(...position)
      return worldPosition.applyMatrix4(transform)
    }
    const hearth = toWorld(parts.find(child => child.props.name === 'lodge-hearth')!.props.position!)
    expect(hearth.x).toBeCloseTo(lodge.center[0])
    expect(hearth.z).toBeCloseTo(lodge.center[1] + lodgeInterior.fireplace.hearth.z)
    // The fire sits where its crackling sounds from.
    const origin = toWorld(fire.position)
    for (const [axis, value] of origin.toArray().entries()) {
      expect(value).toBeCloseTo(fireWorldOrigin[axis])
    }
    expect(origin.x).toBeCloseTo(lodge.center[0])
    const fireplaceForward = new Vector3(0, 0, 1)
    expect(fireplaceForward.transformDirection(transform).z).toBeCloseTo(-1)
    expect(descendants(room).some(child => child.type === LodgeFurnishings)).toBe(true)
    expect(parts.some(child => child.type === LodgeFurnishings)).toBe(false)
    // The stonework builds the firebox of the layout around the fire: the hearth, the raised bed on it, the pillars’ inner faces, the lintel over them and the back behind the logs.
    const {fireplace: layout} = lodgeInterior
    const part = (name: string) => parts.filter(child => child.props.name === name).map(child => ({
      position: child.props.position!,
      size: child.props.size!,
    }))
    const [hearthBox] = part('lodge-hearth')
    expect(hearthBox.position[1] + hearthBox.size[1] / 2).toBeCloseTo(layout.hearth.size[1])
    // The hearth meets the stone breast at the back and projects into the room.
    expect(-hearthBox.position[2] - hearthBox.size[2] / 2).toBeCloseTo(layout.hearth.z - layout.hearth.size[2] / 2)
    expect(-hearthBox.position[2] + hearthBox.size[2] / 2).toBeCloseTo(layout.hearth.z + layout.hearth.size[2] / 2)
    expect(layout.hearth.z - layout.hearth.size[2] / 2).toBeLessThan(layout.front)
    const [raisedBed] = part('lodge-firebox-raised-bed')
    const raisedBedBottom = raisedBed.position[1] - raisedBed.size[1] / 2
    const raisedBedTop = raisedBed.position[1] + raisedBed.size[1] / 2
    expect(raisedBedBottom).toBeCloseTo(layout.hearth.size[1])
    expect(raisedBedTop).toBeCloseTo(layout.hearth.size[1] + layout.raisedBed.size[1])
    expect(fire.position[1]).toBeCloseTo(raisedBed.size[1])
    expect(raisedBed.position[2] + raisedBed.size[2] / 2).toBeGreaterThan(lodgeInterior.fireplace.guard.footZ)
    expect(raisedBed.position[2] - raisedBed.size[2] / 2).toBeLessThan(lodgeInterior.fireplace.guard.footZ)
    expect(guardBarrier.position[1] - guardBarrier.halfExtents[1]).toBeCloseTo(raisedBedTop)
    expect(guardBarrier.position[1] + guardBarrier.halfExtents[1]).toBeGreaterThan(1.6)
    expect(guardBarrier.halfExtents[0]).toBeCloseTo(lodgeInterior.fireplace.openingHalfWidth)
    const pillars = part('lodge-fireplace-pillar')
    expect(pillars).toHaveLength(2)
    for (const pillar of pillars) {
      expect(Math.abs(pillar.position[0]) - pillar.size[0] / 2).toBeCloseTo(layout.openingHalfWidth)
      expect(pillar.position[1] - pillar.size[1] / 2).toBeCloseTo(layout.hearth.size[1])
      expect(pillar.position[1] + pillar.size[1] / 2).toBeCloseTo(layout.opening)
    }
    const [lintel] = part('lodge-fireplace-lintel')
    expect(lintel.position[1] - lintel.size[1] / 2).toBeCloseTo(layout.opening)
    const [back] = part('lodge-firebox-back')
    expect(back.position[2] + back.size[2] / 2).toBeLessThan(fire.position[2] - 0.3)
    // The chimney breast reaches the ceiling and is buried in the south wall, so no seam shows against the logs.
    const [chimney] = part('lodge-chimney')
    expect(chimney.position[1] + chimney.size[1] / 2).toBeCloseTo(lodge.height)
    expect(-(chimney.position[2] - chimney.size[2] / 2)).toBeGreaterThan(lodge.size[1] / 2 - 0.105)
    expect(-(lintel.position[2] - lintel.size[2] / 2)).toBeGreaterThan(lodge.size[1] / 2 - 0.105)
    // The mantel sits on the lintel and stands proud of the breast.
    const [mantel] = part('lodge-mantel')
    expect(mantel.position[1] - mantel.size[1] / 2).toBeCloseTo(lintel.position[1] + lintel.size[1] / 2)
    expect(-(mantel.position[2] + mantel.size[2] / 2)).toBeLessThan(lodgeInterior.fireplace.front)
  } finally {
    materials.dispose()
  }
})
test('the iron fireguard bows into the room and blocks the full firebox entrance', () => {
  const {guard, hearth, raisedBed} = lodgeInterior.fireplace
  const bottom = hearth.size[1] + raisedBed.size[1]
  expect(guardDepth(bottom)).toBeCloseTo(guard.footZ)
  expect(guardDepth(guard.top)).toBeCloseTo(guard.footZ)
  expect(guardDepth((bottom + guard.top) / 2)).toBeCloseTo(guard.footZ + guard.bow)
  expect(guardBarrier.position[2]).toBeGreaterThan(guard.footZ)
  const geometry = createFireGuardGeometry()
  try {
    geometry.computeBoundingBox()
    expect(geometry.boundingBox!.max.z).toBeGreaterThan(guard.footZ + 0.15)
    // The gentler bow remains above the extended stone hearth, rather than hanging out over the floor.
    expect(-geometry.boundingBox!.max.z).toBeGreaterThan(hearth.z - hearth.size[2] / 2)
    expect(guard.bow).toBeLessThan(0.2)
    expect(guard.footZ).toBeGreaterThan(-lodgeInterior.fireplace.front)
    expect(geometry.boundingBox!.min.x).toBeLessThan(-1)
    expect(geometry.boundingBox!.max.x).toBeGreaterThan(1)
    expect(geometry.boundingBox!.min.y).toBeLessThan(bottom + 0.01)
    expect(geometry.boundingBox!.max.y).toBeGreaterThan(guard.top - 0.01)
  } finally {
    geometry.dispose()
  }
})
