import type {SculptureId} from '../../src/sculptures/index.ts'

import {expect, test} from 'bun:test'

import {salonSculptureSocket} from '../../src/lib/gallery/salon.ts'
import salonLantern, {salonLanternBase} from '../../src/lib/gallery/salonLantern.ts'
import {salonSculpture, salonSculptureId, salonSculptureSpot} from '../../src/lib/gallery/salonSculpture.ts'
import {environmentSeed} from '../../src/lib/gameSeed.ts'
import readQueryOverrides from '../../src/lib/queryOverrides.ts'
import {hitchSize} from '../../src/sculptures/hitch/config.ts'
import {HitchSculptureGeometry} from '../../src/sculptures/hitch/geometry.ts'
import {createSculpture, sculptures} from '../../src/sculptures/index.ts'
import {readSculpture} from '../../src/sculptures/lib/forcedSculpture.ts'

const ids = Object.keys(sculptures) as Array<SculptureId>
test('every sculpture has its own model and fits on the Salon socket under the ceiling', async () => {
  const {position: [x, y, z], size: [width, height, depth]} = salonSculptureSocket
  expect(salonSculptureSpot).toEqual([x, y + height, z])
  const models = new Set
  for (const id of ids) {
    const sculpture = createSculpture(id)
    expect(sculpture.id).toBe(id)
    expect(sculpture.title).toBeTruthy()
    expect(sculpture.description).toBeTruthy()
    expect(Number.isFinite(sculpture.mass) && sculpture.mass > 0).toBe(true)
    expect(sculpture.size.every(side => Number.isFinite(side) && side > 0)).toBe(true)
    expect(sculpture.size[0]).toBeLessThanOrEqual(width)
    expect(sculpture.size[2]).toBeLessThanOrEqual(depth)
    expect(salonSculptureSpot[1] + sculpture.size[1]).toBeLessThan(salonLanternBase - salonLantern.ring[1] - salonLantern.bead)
    const model = await sculpture.loadModel()
    expect(model).toBeFunction()
    models.add(model)
  }
  expect(models.size).toBe(ids.length)
})
test('the Salon builds the seeded sculpture, with Block as the seed-zero default', () => {
  expect(ids[0]).toBe('block')
  expect(salonSculptureId(0, '')).toBe('block')
  expect(salonSculpture).toBeInstanceOf(sculptures[salonSculptureId(environmentSeed)])
  const seeds = Array.from({length: 256}, (_, index) => 1 + index * 7919)
  const rolled = seeds.map(seed => salonSculptureId(seed, ''))
  expect(rolled).toEqual(seeds.map(seed => salonSculptureId(seed, '')))
  expect(new Set(rolled)).toEqual(new Set(ids))
})
test('?sculpture previews any registered item and ignores unknown IDs', () => {
  for (const id of ids) {
    const url = `http://localhost/?sculpture=${id}`
    expect(readSculpture(url)).toBe(id)
    expect(readQueryOverrides(url)).toEqual({sculpture: id})
    for (const seed of [0, 1, 763]) {
      expect(salonSculptureId(seed, id)).toBe(id)
    }
  }
  for (const value of ['', 'unknown', 'constructor']) {
    const url = `http://localhost/?sculpture=${value}`
    expect(readSculpture(url)).toBe('')
    expect(readQueryOverrides(url)).toBeUndefined()
  }
})
test('Hitch’s meshes fit their declared bounds under the sculpture triangle budget', () => {
  const geometry = new HitchSculptureGeometry
  geometry.foot.computeBoundingBox()
  geometry.knot.computeBoundingBox()
  const minimum = geometry.foot.boundingBox!.min.clone().min(geometry.knot.boundingBox!.min)
  const maximum = geometry.foot.boundingBox!.max.clone().max(geometry.knot.boundingBox!.max)
  const size = maximum.sub(minimum).toArray()
  try {
    expect(geometry.triangleCount).toBeLessThanOrEqual(32_768)
    expect(size[0]).toBeLessThanOrEqual(hitchSize[0])
    expect(size[1]).toBeLessThanOrEqual(hitchSize[1])
    expect(size[2]).toBeLessThanOrEqual(hitchSize[2])
    expect(geometry.knotColliders).toHaveLength(32)
  } finally {
    geometry.dispose()
  }
})
