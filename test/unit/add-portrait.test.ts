import {afterEach, beforeEach, expect, test} from 'bun:test'

import {frameIds} from '../../src/frames/lib/frameParameter.ts'
import {maximumPortraits} from '../../src/lib/gallery/imagePolicy.ts'
import {usePortraitSlots} from '../../src/lib/gallery/portraitSlotStore.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import {environmentSeed} from '../../src/lib/gameSeed.ts'
import {asPortrait, slotArea} from '../../src/lib/placement/portraitSlots.ts'
import {wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import addPortrait, {findPortraitDestination} from '../../src/lib/webmcp/addPortrait.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const original = useGallery.getState()
const originalSlots = usePortraitSlots.getState()
const [slot] = slopGallery.portraitSlots()
const previous = {
  createImageBitmap: globalThis.createImageBitmap,
  fetch: globalThis.fetch,
  OffscreenCanvas: globalThis.OffscreenCanvas,
}
/** the pixels of the image the page fetches, twice as wide as high */
const pixels = {
  width: 64,
  height: 32,
}
let status = 200
beforeEach(() => {
  status = 200
  useGallery.setState(original, true)
  // Whatever other tests left in the stores, the slot is there with a work hanging in it.
  usePortraitSlots.setState({slots: slopGallery.portraitSlots()})
  useGallery.setState({portraits: [{
    ...asPortrait(slot),
    id: 'hanging',
  }]})
  Object.assign(globalThis, {
    fetch: async () => new Response(new Blob(['pixels'], {type: 'image/png'}), {status}),
    createImageBitmap: async () => ({
      ...pixels,
      close() {},
    }),
    OffscreenCanvas: class {
      async convertToBlob() {
        return new Blob(['normalized'], {type: 'image/webp'})
      }
      getContext() {
        return {
          fillStyle: '',
          fillRect() {},
          drawImage() {},
        }
      }
    },
  })
})
afterEach(() => {
  Object.assign(globalThis, previous)
  useGallery.setState(original, true)
  usePortraitSlots.setState(originalSlots, true)
})
const image = 'http://127.0.0.1:8080/night_watch-2.png'
const stored = (id: string) => useGallery.getState().portraits.find(portrait => portrait.id === id)!
/** a plain flat wall works hang on, wide and high enough for anything the tests hang */
const wall = slopGallery.placement.walls.find(candidate => candidate.sticky !== false && !candidate.holes?.length && !candidate.reservations?.length && !candidate.curveRadius && !candidate.slope && candidate.width > 6 && candidate.height > 3.5)!
test('a slot takes the image in place of the work hanging there, at its own area and in its room’s frame unless told otherwise', async () => {
  const {portraits} = useGallery.getState()
  const [hanging] = portraits
  const added = await addPortrait({
    image,
    target: {slot: slot.id},
  })
  expect(added).toMatchObject({
    title: 'night watch 2',
    hung: true,
    slot: slot.id,
    wallId: slot.wallId,
    replaced: hanging.id,
    position: slot.position,
    rotation: slot.rotation,
  })
  expect(added.width / added.height).toBeCloseTo(2, 10)
  expect(Math.abs(added.size - slotArea(slot))).toBeLessThanOrEqual(1)
  expect(useGallery.getState().portraits).toHaveLength(portraits.length)
  expect(stored(hanging.id)).toBeUndefined()
  expect(stored(added.id)).toMatchObject({
    hung: true,
    imported: true,
    wallId: slot.wallId,
    frame: added.frame,
  })
  expect(Boolean(stored(added.id).labelAbove)).toBe(Boolean(slot.labelAbove))
  // Again, with everything told: it takes the place of the one before.
  const told = await addPortrait({
    image,
    target: {slot: slot.id},
    id: 'told',
    title: 'Told',
    frame: 'louis',
    size: 7500,
  })
  expect(told).toMatchObject({
    id: 'told',
    title: 'Told',
    frame: 'louis',
    size: 7500,
    replaced: added.id,
  })
  expect(told.width * told.height).toBeCloseTo(0.75, 10)
  expect(stored('told').frame).toBe('louis')
  await expect(addPortrait({
    image,
    target: {slot: slot.id},
    id: 'told',
  })).rejects.toThrow(/already has the id/)
  await expect(addPortrait({
    image,
    target: {slot: 'attic_0'},
  })).rejects.toThrow(/no portrait slot/)
})
test('a spot on a wall takes the image where it fits, in the frame and at the area of the wall’s room, and says why where it does not', async () => {
  useGallery.setState({portraits: []})
  const target = {
    wallId: wall.id,
    position: {
      x: 0.5,
      y: wall.height / 2,
    },
  }
  const added = await addPortrait({
    image,
    target,
    id: 'on-the-wall',
  })
  expect(added).toMatchObject({
    hung: true,
    wallId: wall.id,
    position: wallPosition(wall, 0.5, wall.center[1] + wall.height / 2),
    rotation: wall.rotation,
  })
  expect(added.slot).toBeUndefined()
  expect(added.replaced).toBeUndefined()
  expect(Math.abs(added.size - slopGallery.portraitArea(wall.id, wall.room))).toBeLessThanOrEqual(1)
  expect(added.frame).toBe(slopGallery.roomById(wall.room)?.frame(environmentSeed, 'on-the-wall'))
  expect(stored('on-the-wall')).toMatchObject({
    hung: true,
    wallId: wall.id,
  })
  await expect(addPortrait({
    image,
    target,
  })).rejects.toThrow(/too close to a work/)
  await expect(addPortrait({
    image,
    target: {
      wallId: wall.id,
      position: {
        x: wall.width / 2,
        y: wall.height / 2,
      },
    },
  })).rejects.toThrow(/reach past the wall/)
  // too large for any wall
  await expect(addPortrait({
    image,
    target: {
      wallId: wall.id,
      position: {
        x: -2,
        y: wall.height / 2,
      },
    },
    size: 10_000_000,
  })).rejects.toThrow(/does not fit/)
  await expect(addPortrait({
    image,
    target: {
      wallId: 'attic-north',
      position: {
        x: 0,
        y: 2,
      },
    },
  })).rejects.toThrow(/no wall/)
  expect(useGallery.getState().portraits).toHaveLength(1)
})
test('a world position takes the image loose, in the frame and at the area of the room there, and none outside of the world', async () => {
  const [x, y, z] = slopGallery.spawn.position
  const room = slopGallery.roomAt([x, y + 1.5, z])!
  const {length} = useGallery.getState().portraits
  const added = await addPortrait({
    image,
    target: {position: {
      x,
      y: y + 1.5,
      z,
    }},
    id: 'loose',
  })
  expect(added).toMatchObject({
    hung: false,
    position: [x, y + 1.5, z],
    rotation: 0,
  })
  expect(added.wallId).toBeUndefined()
  expect(Math.abs(added.size - room.portraitArea)).toBeLessThanOrEqual(1)
  expect(added.frame).toBe(room.frame(environmentSeed, 'loose'))
  expect(stored('loose').hung).toBe(false)
  expect(useGallery.getState().portraits).toHaveLength(length + 1)
  expect(() => findPortraitDestination({position: {
    x: 900,
    y: 900,
    z: 900,
  }})).toThrow(/outside of the world/)
})
test('a work is named after the file of its image, which only a URL on a server has', async () => {
  const target = {position: {
    x: slopGallery.spawn.position[0],
    y: slopGallery.spawn.position[1] + 1.5,
    z: slopGallery.spawn.position[2],
  }}
  for (const [url, title] of [
    ['http://127.0.0.1:8080/works/The%20Night_Watch.final.png?width=640#top', 'The Night Watch.final'],
    ['http://127.0.0.1:8080/', 'An untitled arrival'],
    ['data:image/png;base64,iVBORw0KGgo/AAAANSUhEUgAAA+yAAAAB/CAYAAADc', 'An untitled arrival'],
    ['blob:http://127.0.0.1:8080/1b671a64-40d5-491e-99b0-da01ff1f3341', 'An untitled arrival'],
  ]) {
    expect(await addPortrait({
      image: url,
      target,
    })).toHaveProperty('title', title)
  }
  expect(await addPortrait({
    image: 'data:image/png;base64,iVBORw0KGgo/AAAANSUhEUgAAA+yAAAAB/CAYAAADc',
    target,
    title: 'Told',
  })).toHaveProperty('title', 'Told')
})
test('unknown frames, images that do not load and a full collection add nothing', async () => {
  const target = {position: {
    x: slopGallery.spawn.position[0],
    y: slopGallery.spawn.position[1] + 1.5,
    z: slopGallery.spawn.position[2],
  }}
  await expect(addPortrait({
    image,
    target,
    frame: 'gilt',
  })).rejects.toThrow(new RegExp(frameIds.slice(0, 3).join(', ')))
  status = 404
  await expect(addPortrait({
    image,
    target,
  })).rejects.toThrow(/HTTP 404/)
  status = 200
  useGallery.setState({portraits: Array.from({length: maximumPortraits}, (_, index) => ({
    ...asPortrait(slot),
    id: `filler-${index}`,
    hung: false,
  }))})
  await expect(addPortrait({
    image,
    target,
  })).rejects.toThrow(/collection is full/)
  expect(useGallery.getState().portraits).toHaveLength(maximumPortraits)
})
