import type {Vec3} from '../../src/lib/gallery/types.ts'
import type {BufferGeometry} from 'three/webgpu'

import {expect, test} from 'bun:test'

import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import {studioFloorId, studioFloors, studioWallId, studioWalls} from '../../src/rooms/studio/finishes.ts'
import {defaultStudioLook, kelvinTint, studioFrames, studioLook, studioLookRanges} from '../../src/rooms/studio/look.ts'
import {skylightBars, studioSkylightTrim} from '../../src/rooms/studio/skylights.ts'
import StudioCeilingGeometry from '../../src/rooms/studio/StudioCeilingGeometry.ts'
import StudioSandbox from '../../src/worlds/sandbox/StudioSandbox.ts'

const studio = new StudioSandbox(0)
const within = (value: number, [min, max]: readonly [number, number]) => value >= min && value <= max
/** The box round the geometry. */
const bounds = (geometry: BufferGeometry) => {
  geometry.computeBoundingBox()
  return geometry.boundingBox!
}
/** the blue channel of a #rrggbb color */
const blue = (tint: string) => Number.parseInt(tint.slice(5), 16)
const room = studio.room('studio')
test('the Studio’s look is the Cell’s light and frame with its lamp at 5 m and its moon higher in the default environment, and every other seed rolls each of its values within its bounds and one of ten frames', () => {
  expect(studioLook(0)).toBe(defaultStudioLook)
  expect(defaultStudioLook.lamp.height).toBe(5)
  expect(studioLook(5)).toEqual(studioLook(5))
  expect(studioLook(5)).not.toEqual(studioLook(6))
  expect(defaultStudioLook.frame).toBe('louis')
  expect(studioFrames).toHaveLength(10)
  const frames = new Set<string>
  for (let seed = 1; seed <= 200; seed++) {
    const {fill, floor, frame, lamp, moon} = studioLook(seed)
    frames.add(frame)
    expect(within(fill.ambient, studioLookRanges.ambient)).toBe(true)
    expect(within(fill.hemisphere, studioLookRanges.hemisphere)).toBe(true)
    expect(within(floor.strength, studioLookRanges.floorStrength)).toBe(true)
    expect(within(floor.blur!, studioLookRanges.floorBlur)).toBe(true)
    expect(within(lamp.decay, studioLookRanges.lampDecay)).toBe(true)
    expect(within(lamp.height, studioLookRanges.lampHeight)).toBe(true)
    expect(within(lamp.strength, studioLookRanges.lampStrength)).toBe(true)
    expect(lamp.tint).toMatch(/^#[\da-f]{6}$/u)
    expect(within(moon.azimuth, studioLookRanges.moonAzimuth)).toBe(true)
    expect(within(moon.elevation, studioLookRanges.moonElevation)).toBe(true)
    expect(within(moon.intensity, studioLookRanges.moonIntensity)).toBe(true)
  }
  expect(frames).toEqual(new Set(studioFrames))
})
test('every work in the Studio hangs in the one frame the seed rolled, the default works and those hung later alike', () => {
  for (const seed of [0, 3, 17, 42]) {
    const sandbox = seed ? new StudioSandbox(seed) : studio
    const placed = sandbox.room('studio')
    const {frame} = studioLook(seed)
    expect(placed.room.frame).toBe(frame)
    for (const work of ['north_0', 'north_1', 'some-hung-work', 'another']) {
      expect(placed.frame(seed, work)).toBe(frame)
    }
  }
})
test('a lamp’s color temperature runs from candlelight orange to a cool white', () => {
  expect(kelvinTint(2200)).toBe('#ff9227')
  expect(kelvinTint(6500)).toBe('#fffefa')
  expect(blue(kelvinTint(3000))).toBeLessThan(blue(kelvinTint(5000)))
})
test('the Studio’s lamp hangs over the middle of its floor as the seed rolls it', () => {
  for (const seed of [0, ...Array.from({length: 60}, (_, index) => index + 1)]) {
    const look = studioLook(seed)
    const sandbox = seed ? new StudioSandbox(seed) : studio
    const placed = sandbox.room('studio')
    const [lamp] = sandbox.lamps()
    expect(placed.toLocal(lamp.position)).toEqual([0, look.lamp.height, 0])
    expect(lamp).toMatchObject({
      strength: look.lamp.strength,
      decay: look.lamp.decay,
      tint: look.lamp.tint,
    })
  }
})
test('the Studio’s ceiling has two round skylights along its middle, either side of the lamp, their trim clear of the walls and of each other, each sash’s bars crossing it twice either way into three rows of three panes', () => {
  const [width, depth] = room.size
  const {recess, sash} = studioSkylightTrim
  expect(room.room.skylights).toHaveLength(2)
  expect(room.room.skylights.every(({center: [x], radius}) => Math.abs(x) > radius)).toBe(true)
  const reaches = room.room.skylights.map(({center: [x, z], radius}) => {
    const reach = radius + recess.reach + recess.bead
    expect(Math.abs(x) + reach).toBeLessThan(width / 2 - wallFace)
    expect(Math.abs(z) + reach).toBeLessThan(depth / 2 - wallFace)
    // The panes’ diameter in thirds, between the ring and the bars.
    const panes = radius - sash.frame
    const [first, second] = skylightBars(radius)
    expect(first + panes).toBeCloseTo(second - first, 9)
    expect(panes - second).toBeCloseTo(second - first, 9)
    expect(second - first - sash.bar).toBeGreaterThan(0.5)
    return [x - reach, x + reach]
  })
  for (const [index, [, east]] of reaches.entries()) {
    expect(east).toBeLessThan(reaches[index + 1]?.[0] ?? Infinity)
  }
})
test('the Studio’s ceiling slab lies over the walls, its skylights’ recesses, casings, sashes and panes within it under its top, the casings hanging under the recesses, the panes facing down', () => {
  const geometry = new StudioCeilingGeometry(room.room)
  const {height} = room
  const [width, depth] = room.size
  const {casing, recess, slab} = studioSkylightTrim
  const {min, max} = bounds(geometry.slab)
  for (const [value, expected] of [[min.x, -width / 2], [min.y, height], [min.z, -depth / 2], [max.x, width / 2], [max.y, height + slab], [max.z, depth / 2]]) {
    expect(value).toBeCloseTo(expected, 5)
  }
  expect(bounds(geometry.casings).min.y).toBeCloseTo(height + recess.rise - casing.drop, 5)
  for (const part of [geometry.casings, geometry.glass, geometry.stiles]) {
    expect(bounds(part).min.y).toBeGreaterThan(height)
    expect(bounds(part).max.y).toBeLessThan(height + slab)
  }
  const normals = geometry.glass.getAttribute('normal')
  expect(Array.from({length: normals.count}, (_, index) => normals.getY(index)).every(y => y === -1)).toBe(true)
  geometry.dispose()
})
test('the moon falls through the Studio’s skylights onto a few patches of its floor or walls, wherever it stands', () => {
  const [width, depth] = room.size
  const {sash, slab} = studioSkylightTrim
  /** how high the sashes’ middles lie over the floor */
  const sashY = room.height + slab - sash.top - sash.depth / 2
  for (const seed of [0, 3, 17, 42]) {
    const sandbox = seed ? new StudioSandbox(seed) : studio
    const placed = sandbox.room('studio')
    const {skylights, toMoon} = placed.room
    /** Whether the moon reaches the point, in room coordinates: its way toward the moon meets the sashes in a pane, as the room is a closed box. */
    const moonlit = ([x, y, z]: Vec3) => {
      const travel = (sashY - y) / toMoon[1]
      const [atX, atZ] = [x + toMoon[0] * travel, z + toMoon[2] * travel]
      return skylights.some(({center: [centerX, centerZ], radius}) => {
        const [across, along] = [atX - centerX, atZ - centerZ]
        const clear = (offset: number) => skylightBars(radius).every(bar => Math.abs(offset - bar) > sash.bar / 2)
        return Math.hypot(across, along) < radius - sash.frame && clear(across) && clear(along)
      })
    }
    const samples: Array<Vec3> = []
    for (let v = 0.125; v < placed.height; v += 0.25) {
      for (let u = -width / 2 + 0.125; u < width / 2; u += 0.25) {
        samples.push([u, v, -depth / 2 + wallFace])
      }
      for (let u = -depth / 2 + 0.125; u < depth / 2; u += 0.25) {
        samples.push([width / 2 - wallFace, v, u])
      }
    }
    for (let u = -width / 2 + 0.125; u < width / 2; u += 0.25) {
      for (let w = -depth / 2 + 0.125; w < depth / 2; w += 0.25) {
        samples.push([u, 0, w])
      }
    }
    const lit = samples.filter(moonlit).length
    expect(lit, String(seed)).toBeGreaterThan(0)
    expect(lit / samples.length, String(seed)).toBeLessThan(0.1)
  }
})
test('the Studio keeps the Cell’s finishes in the default environment and rolls its walls’ and floor’s apart from each other for other seeds, every one of them in some', () => {
  expect([studioWallId(0), studioFloorId(0)]).toEqual(['cell', 'cell'])
  const seeds = Array.from({length: 300}, (_, index) => index + 1)
  expect(new Set<string>(seeds.map(seed => studioWallId(seed)))).toEqual(new Set(Object.keys(studioWalls)))
  expect(new Set<string>(seeds.map(seed => studioFloorId(seed)))).toEqual(new Set(Object.keys(studioFloors)))
  expect(seeds.some(seed => studioWallId(seed) !== studioFloorId(seed))).toBe(true)
  expect(studioWallId(7)).toBe(studioWallId(7))
})
test('every finish of the Studio loads and makes its materials, a floor’s mirror only where reflections are on', async () => {
  for (const load of Object.values(studioWalls)) {
    const finish = (await load())()
    expect(finish.surface.isMaterial).toBe(true)
    expect(finish.trim === undefined || finish.trim.isMaterial).toBe(true)
    finish.dispose()
  }
  for (const [id, load] of Object.entries(studioFloors)) {
    // The Cell’s wood draws its texture on a canvas, which Bun has none of.
    if (id === 'cell') {
      continue
    }
    const make = await load()
    for (const reflections of [false, true]) {
      const finish = make({
        anisotropy: 4,
        center: room.center,
        reflections,
        size: room.size,
      })
      expect(finish.material.isMaterial).toBe(true)
      if (!reflections || id === 'oculus') {
        expect(finish.material.reflectionTarget ?? null, id).toBeNull()
      } else {
        expect(finish.material.reflectionTarget, id).toBeTruthy()
      }
      finish.dispose()
    }
  }
})
