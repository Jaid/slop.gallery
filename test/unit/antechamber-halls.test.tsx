import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterAll, beforeAll, describe, expect, test} from 'bun:test'

import {Ray} from '@dimforge/rapier3d-compat'
import {Texture} from 'three/webgpu'
import {GraphicsModeProvider} from 'use-graphics-mode'

import {antechamberLanding, antechamberLandingSlab, antechamberStairs, stairHallHeight, stairHalls} from '../../src/lib/gallery/antechamber.ts'
import StairHalls from '../../src/rooms/antechamber/components/AntechamberRoom/StairHalls.tsx'
import {mountPhysics} from './helpers/inertPhysics.tsx'

const stone = new Texture
let mounted: Awaited<ReturnType<typeof mountPhysics>>
beforeAll(async () => {
  mounted = await mountPhysics(<GraphicsModeProvider isHeavy onChange={() => {}}>
    <StairHalls stone={stone} />
  </GraphicsModeProvider>)
  mounted.physics.step(1 / 60)
})
afterAll(async () => {
  await mounted[Symbol.asyncDispose]()
  stone.dispose()
})
/** How far a ray from the point travels straight up or down until it meets a collider, or undefined if it meets none within `reach`. */
const cast = ([x, y, z]: Vec3, up: boolean, reach = 10) => mounted.physics.world.castRay(new Ray({
  x,
  y,
  z,
}, {
  x: 0,
  y: up ? 1 : -1,
  z: 0,
}), reach, true)?.timeOfImpact
describe('the Antechamber’s halls as mounted', () => {
  test('every hall holds what lands on its floor and what is thrown up at its ceiling', () => {
    for (const {center: [x, z], size: [width, depth]} of Object.values(stairHalls)) {
      for (const [dx, dz] of [[0, 0], [-0.45, -0.45], [0.45, 0.45]]) {
        const point: Vec3 = [x + dx * width, 1.6, z + dz * depth]
        expect(cast(point, false)).toBeCloseTo(1.6, 6)
        expect(cast(point, true)).toBeCloseTo(stairHallHeight - 0.09 - 1.6, 6)
      }
    }
  })
  test('every tread of the flight up and its landing hold what lands on them, under a roof and a ceiling that stop whatever is thrown up', () => {
    for (const {position, top} of antechamberStairs.blocks) {
      const point: Vec3 = [position[0], top + 1.6, position[2]]
      expect(cast(point, false)).toBeCloseTo(1.6, 6)
      const roof = cast(point, true)
      expect(roof).toBeDefined()
      expect(roof!).toBeLessThan(antechamberStairs.headroom - 1.6)
    }
    const [x, z] = antechamberLanding.center
    const [width, depth] = antechamberLanding.size
    for (const [dx, dz] of [[0, 0], [-0.45, -0.45], [0.45, 0.45]]) {
      const point: Vec3 = [x + dx * width, antechamberLanding.floorY + 1.6, z + dz * depth]
      expect(cast(point, false)).toBeCloseTo(1.6, 6)
      expect(cast(point, true)).toBeCloseTo(antechamberLanding.height - antechamberLandingSlab.ceiling / 2 - 1.6, 6)
    }
  })
})
