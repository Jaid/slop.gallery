import type {PropHandle} from '../../src/components/Scene/GrabbableProp.tsx'
import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterEach, describe, expect, test} from 'bun:test'

import {Group, Vector3} from 'three/webgpu'

import Satellites from '../../src/components/FusionPortal/Satellites.ts'
import {propObjects} from '../../src/components/Scene/GrabbableProp.tsx'
import Fusion from '../../src/lib/gallery/fusion/Fusion.ts'
import {portalFrame} from '../../src/lib/gallery/fusion/portalFrame.ts'
import {fusionTiming} from '../../src/lib/gallery/fusion/timing.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import {orbs, promptOrbs, transparentOrb} from '../../src/orbs/index.ts'

const id = 'prop-orb-spook-remains-1'
const work = {
  id: 'work',
  position: [2, 1.7, -3] as Vec3,
  rotation: 0.4,
  width: 1,
  height: 1,
}
const frame = portalFrame(work, {
  floor: 0,
  room: 4,
  sides: [3, 3],
})
const center = new Vector3(...frame.center)
/** the moment the result flips out, as the director would let it */
const emergedAt = fusionTiming.minimum + fusionTiming.climax
/** A fusion of the hung work with a Spook Orb whose remains entered the world withheld, like `Orb` mounts them, with what the portal handed them out with. */
const open = (left = true) => {
  const fusion = new Fusion({
    work,
    partner: {
      kind: 'item',
      id: 'prop-orb-spook',
      consumed: true,
      remains: id,
    },
    images: ['/work.jxl'],
    latches: ['charge', 'glass'],
    effects: [],
  }, {frame})
  const holder = new Group
  const group = new Group
  holder.position.set(...frame.center)
  holder.add(group)
  group.visible = false
  let seized = true
  const unleashed: Array<[Vec3, Vec3]> = []
  propObjects.set(id, {
    group,
    seized: () => seized,
    unleash: (velocity: Vec3, spin: Vec3) => {
      seized = false
      group.visible = true
      unleashed.push([velocity, spin])
    },
  } as unknown as PropHandle)
  useGallery.setState({
    remains: left ? [{
      id,
      orb: transparentOrb,
      position: frame.center,
    }] : [],
  })
  return {
    fusion,
    group,
    satellites: new Satellites(fusion),
    unleashed,
  }
}
const worldPosition = (group: Group) => {
  group.updateWorldMatrix(true, false)
  const position = new Vector3
  return position.setFromMatrixPosition(group.matrixWorld)
}
afterEach(() => {
  propObjects.delete(id)
  useGallery.setState({remains: []})
})
describe('fusion remains', () => {
  test('every themed orb leaves the Transparent Orb, which leaves nothing', () => {
    for (const orb of promptOrbs) {
      expect(orb.remains).toBe(transparentOrb)
    }
    expect(orbs.filter(orb => !orb.remains)).toEqual([transparentOrb])
  })
  test('the portal holds the remains in its middle, too small to see, until they flip out after the result and grow to their size', () => {
    const {fusion, group, satellites, unleashed} = open()
    satellites.update(0.1)
    expect(group.visible).toBe(true)
    expect(worldPosition(group).distanceTo(center)).toBeLessThan(1e-9)
    expect(group.scale.x).toBeCloseTo(1e-4, 9)
    fusion.outcome = {
      kind: 'success',
      at: fusionTiming.minimum,
    }
    fusion.emergedAt = emergedAt
    satellites.update(emergedAt + 0.05)
    expect(unleashed).toEqual([])
    expect(group.scale.x).toBeCloseTo(1e-4, 9)
    satellites.update(emergedAt + 0.4)
    expect(unleashed).toHaveLength(1)
    const [[velocity, spin]] = unleashed
    const [nx, , nz] = frame.normal
    // Toward the room, below the result’s flight.
    expect(velocity[0] * nx + velocity[2] * nz).toBeCloseTo(2.4, 9)
    expect(velocity[1]).toBe(1.6)
    expect(Math.hypot(...spin)).toBeGreaterThan(0)
    expect(worldPosition(group).y).toBeCloseTo(frame.center[1] - 0.25, 9)
    expect(group.scale.x).toBeCloseTo(0.05, 9)
    satellites.update(emergedAt + 1)
    expect(group.scale.x).toBeCloseTo(1, 9)
    satellites.dispose()
    expect(unleashed).toHaveLength(1)
    fusion.abort()
  })
  test('a failed fusion never shows the remains, which leave the world unseen', () => {
    const {fusion, group, satellites, unleashed} = open()
    satellites.update(1)
    fusion.outcome = {
      kind: 'failure',
      at: fusionTiming.intro,
    }
    satellites.update(fusionTiming.intro + fusionTiming.fizzle)
    satellites.dispose()
    expect(unleashed).toEqual([])
    expect(group.visible).toBe(false)
    fusion.abort()
  })
  test('a success that didn’t use the orb up after all never shows the remains the director took out of the world', () => {
    const {fusion, group, satellites, unleashed} = open(false)
    satellites.update(1)
    fusion.outcome = {
      kind: 'success',
      at: fusionTiming.minimum,
    }
    fusion.emergedAt = emergedAt
    satellites.update(emergedAt + 1)
    satellites.dispose()
    expect(unleashed).toEqual([])
    expect(group.visible).toBe(false)
    fusion.abort()
  })
  test('a portal closing before the remains flipped out spits them out at once, at their size', () => {
    const {fusion, group, satellites, unleashed} = open()
    satellites.update(1)
    fusion.outcome = {
      kind: 'success',
      at: fusionTiming.minimum,
    }
    fusion.emergedAt = emergedAt
    satellites.update(emergedAt)
    satellites.dispose()
    expect(unleashed).toHaveLength(1)
    expect(group.scale.x).toBe(1)
    fusion.abort()
  })
  test('the portal waits for the remains to enter the world', () => {
    const {fusion, group, satellites} = open()
    const handle = propObjects.get(id)!
    propObjects.delete(id)
    satellites.update(0.05)
    expect(group.visible).toBe(false)
    propObjects.set(id, handle)
    satellites.update(0.1)
    expect(group.visible).toBe(true)
    expect(group.scale.x).toBeCloseTo(1e-4, 9)
    satellites.dispose()
    fusion.abort()
  })
})
