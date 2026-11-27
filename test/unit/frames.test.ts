import type PortraitFrame from '../../src/frames/base/PortraitFrame.ts'
import type {Portrait, PortraitRatio, Vec3} from '../../src/lib/gallery/types.ts'

import {describe, expect, test} from 'bun:test'

import {frameBack, frameDetail, frameTriangleBudget, maximumFrameReach} from '../../src/frames/base/PortraitFrame.ts'
import {classicFrame, frames, portraitFrame} from '../../src/frames/index.ts'
import {choiceFrames, pickFrame} from '../../src/frames/lib/frameChoice.ts'
import {frameIds, readFrame} from '../../src/frames/lib/frameParameter.ts'
import {inspectionFov} from '../../src/lib/camera/OrbitInspection.ts'
import {arrivalFrame} from '../../src/lib/gallery/actions.ts'
import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import {hangDefaultWorks} from '../../src/lib/gallery/defaultPortraits.ts'
import {imageSize} from '../../src/lib/gallery/ImageImporter.ts'
import portraitOrbit, {portraitRocking} from '../../src/lib/gallery/portraitOrbit.ts'
import {portraitRatios, slotAreas, slotFrame} from '../../src/lib/placement/portraitSlots.ts'
import {hangingOffset} from '../../src/lib/placement/wallGeometry.ts'
import {graphicsProfiles} from '../../src/lib/rendering/graphicsMode.ts'
import MaterialOutputsNode from '../../src/lib/rendering/MaterialOutputsNode.ts'
import {orbs} from '../../src/orbs/index.ts'
import artworks from '../../src/worlds/gallery/artworks.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import sandbox from '../../src/worlds/sandbox/cell.ts'

const entries: Array<[string, PortraitFrame]> = Object.entries(frames)
/** every size a work can come in: each slot ratio at each slot area, and imported images at both of the crop’s limits and square at each slot area, which rooms take their portrait areas from */
const sizes = [
  ...Object.keys(portraitRatios).flatMap(ratio => slotAreas.map(area => slotFrame(ratio as PortraitRatio, area))),
  ...slotAreas.flatMap(area => [[2, 1], [1, 2], [1, 1]].map(([width, height]) => imageSize(width, height, area))),
]
/** the triangles frames may take in each graphics mode, fewest first */
const budgets = [...new Set(Object.values(graphicsProfiles).map(profile => profile.frameTriangles))].toSorted((a, b) => a - b)
describe('frames', () => {
  test('every id has a frame and the default comes first', () => {
    expect(Object.keys(frames)).toEqual([...frameIds])
    expect(frameIds[0]).toBe('classic')
    expect(frames.classic).toBe(classicFrame)
  })
  test('Louis uses burnished-only reflections', () => {
    const frame = portraitFrame('louis')
    expect(frame).toBe(frames.louis)
    expect(frame.materials[0]).toHaveProperty('mrtNode', expect.any(MaterialOutputsNode))
  })
  test('fast and heavy graphics give frames their budget, cinematic graphics four times as many', () => {
    expect(graphicsProfiles.fast.frameTriangles).toBe(frameTriangleBudget)
    expect(graphicsProfiles.heavy.frameTriangles).toBe(frameTriangleBudget)
    expect(graphicsProfiles.cinematic.frameTriangles).toBe(frameTriangleBudget * 4)
    expect(frameDetail(frameTriangleBudget)).toBe(1)
    expect(frameDetail(frameTriangleBudget * 4)).toBe(2)
  })
  for (const [id, frame] of entries) {
    test(`${id} stays within every graphics mode’s budget and its envelope at every size, and takes the same room in each`, () => {
      expect(frame.reach).toBeGreaterThan(0)
      expect(frame.reach).toBeLessThanOrEqual(maximumFrameReach)
      expect(frame.imageDepth).toBeGreaterThan(frameBack)
      expect(frame.imageDepth).toBeLessThan(frame.front)
      const materials = frame.materials
      for (const {width, height} of sizes) {
        const boxes = budgets.map(budget => {
          const geometry = frame.createGeometry(width, height, budget)
          try {
            const triangles = geometry.getAttribute('position').count / 3
            expect(triangles).toBeLessThanOrEqual(budget)
            // Every triangle belongs to exactly one group, whose material exists.
            expect(geometry.groups.reduce((sum, group) => sum + group.count, 0)).toBe(triangles * 3)
            for (const group of geometry.groups) {
              expect(materials[group.materialIndex!]).toBeDefined()
            }
            // Nothing reaches into the wall behind the frame, nor out past the reach the clearance between hung works leaves room for.
            const box = geometry.boundingBox!
            expect(box.isEmpty()).toBe(false)
            expect(box.min.z).toBeGreaterThan(wallFace - hangingOffset)
            for (const [low, high, half] of [[box.min.x, box.max.x, width / 2], [box.min.y, box.max.y, height / 2]]) {
              expect(Math.max(-low, high)).toBeLessThanOrEqual(half + maximumFrameReach + 1e-6)
            }
            return box
          } finally {
            geometry.dispose()
          }
        })
        // A larger budget only cuts the ornaments finer, which moves their outlines by a few millimeters at most.
        for (const box of boxes.slice(1)) {
          for (const [finer, plainer] of [[box.min, boxes[0].min], [box.max, boxes[0].max]]) {
            expect(finer.distanceTo(plainer)).toBeLessThan(0.004)
          }
        }
      }
    })
  }
  test('every frame leaves the image in sight up to its moulding’s sight edge, a little less of it from closer by', () => {
    for (const [, frame] of entries) {
      for (const {width, height} of sizes) {
        const [far, near] = [frame.opening(width, height, 50), frame.opening(width, height, 0.5)]
        for (const [seen, nearer, whole] of [[far.width, near.width, width], [far.height, near.height, height]]) {
          expect(seen).toBeLessThanOrEqual(whole)
          expect(seen).toBeGreaterThan(whole - 0.02)
          expect(nearer).toBeLessThanOrEqual(seen + 1e-6)
          expect(nearer).toBeGreaterThan(whole - 0.02)
        }
      }
    }
  })
  test('from its viewing distance, what a frame leaves in sight of the image just fills the view along its tighter sides', () => {
    for (const [, frame] of entries) {
      for (const [width, height, aspect] of [[1.2, 0.8, 1], [0.8, 1.2, 16 / 9], [2, 2, 1]]) {
        const distance = frame.viewingDistance(width, height, aspect, 50)
        const opening = frame.opening(width, height, distance)
        const reach = Math.tan(25 * Math.PI / 180) * distance
        // its edges just outside the view, the frame’s sight edge beyond them
        expect(Math.max(opening.height / 2 / reach, opening.width / 2 / (reach * aspect))).toBeCloseTo(1 / 0.997, 6)
        expect(distance).toBeLessThanOrEqual(Math.max(height, width / aspect) / 2 / Math.tan(25 * Math.PI / 180))
      }
    }
  })
  test('V views a hung portrait from where its image fills the view up to its frame’s sight edge', () => {
    const portrait = {
      width: 1.2,
      height: 0.8,
      position: [0, 2, 0],
      rotation: 0,
      frame: 'crate',
    } as unknown as Portrait
    const {center, orbit} = portraitOrbit(portrait, false, 1)
    expect(orbit.distance).toBeCloseTo(frames.crate.viewingDistance(1.2, 0.8, 1, inspectionFov), 9)
    expect(center[2]).toBeCloseTo(frames.crate.imageDepth, 9)
    // with its name plate, from further back, both rocking alike
    const label = portraitOrbit(portrait, true, 1).orbit
    expect(label.distance).toBeGreaterThan(orbit.distance!)
    expect(orbit.rocking).toBe(portraitRocking)
    expect(label.rocking).toBe(portraitRocking)
  })
  test('?frame forces one of them or nothing', () => {
    const id = frameIds.at(-1)!
    expect(readFrame(`https://example.com/?frame=${id}`)).toBe(id)
    expect(readFrame('https://example.com/?frame=gilded-potato')).toBe('')
    expect(readFrame('https://example.com/')).toBe('')
    expect(portraitFrame()).toBe(classicFrame)
    expect(portraitFrame(id)).toBe(frames[id])
  })
})
const seeds = Array.from({length: 64}, (_, index) => index * 7919 + 1)
/** every room across the worlds */
const rooms = new Map([...slopGallery.rooms, ...sandbox.rooms, ...knottingham.rooms].map(room => [room.id, room.room]))
/** the frame choices of the rooms that have one */
const roomChoices = rooms.values().flatMap(room => (room.frame ? [room.frame] : [])).toArray()
/** the frame choices of the orbs that bring one */
const orbChoices = orbs.flatMap(orb => (orb.frame ? [orb.frame] : []))
describe('frame choices', () => {
  test('a single frame is always picked, and of several, every seed picks one, which one depending on the seed', () => {
    expect(pickFrame(5, 'tramp')).toBe('tramp')
    expect(choiceFrames('tramp')).toEqual(['tramp'])
    for (const choice of [...roomChoices, ...orbChoices]) {
      const picks = new Set(seeds.map(seed => pickFrame(seed, choice)))
      expect([...picks].every(id => choiceFrames(choice).includes(id))).toBe(true)
      expect(picks.size).toBe(choiceFrames(choice).length)
    }
  })
  test('rooms and ingredients each pick on their own, so a seed does not pick the first frame everywhere', () => {
    const several = [...roomChoices, ...orbChoices].filter(choice => choiceFrames(choice).length > 1)
    for (const seed of seeds.slice(0, 8)) {
      const positions = new Set(several.map(choice => choiceFrames(choice).indexOf(pickFrame(seed, choice))))
      expect(positions.size).toBeGreaterThan(1)
    }
  })
  test('every configured sampler contains distinct catalog frames and has a favorite', () => {
    for (const choice of [...roomChoices, ...orbChoices]) {
      const ids = choiceFrames(choice)
      expect(ids.length).toBeGreaterThan(0)
      const distinct = new Set(ids)
      expect(distinct.size).toBe(ids.length)
      expect(ids.every(id => frameIds.includes(id))).toBe(true)
    }
  })
})
describe('room frames', () => {
  test('every slot carries the frames of its room, and every default work wears its own roll of them', () => {
    for (const world of [slopGallery, sandbox]) {
      for (const room of world.rooms) {
        for (const slot of room.slots()) {
          expect(slot.frame).toBe(room.room.frame)
        }
      }
    }
    const slots = slopGallery.portraitSlots()
    for (const seed of seeds.slice(0, 4)) {
      for (const portrait of hangDefaultWorks(slots, artworks, seed)) {
        const room = slopGallery.roomById(slopGallery.walls.find(wall => wall.id === portrait.wallId)!.room)!
        expect(portrait.frame).toBe(room.frame(seed, portrait.id))
        expect(portrait.frame).toBe(room.room.frame && pickFrame(seed, room.room.frame, portrait.id))
      }
    }
  })
  test('in the default environment, rooms and ingredients use the first frame of their sampler', () => {
    const several = [...slopGallery.rooms, ...sandbox.rooms].filter(room => room.room.frame && choiceFrames(room.room.frame).length > 1)
    expect(several.length).toBeGreaterThan(0)
    for (const room of several) {
      for (let index = 0; index < 24; index++) {
        expect(room.frame(0, `work-${index}`)).toBe(choiceFrames(room.room.frame!)[0])
      }
    }
    for (const portrait of hangDefaultWorks(slopGallery.portraitSlots(), artworks, 0)) {
      const room = slopGallery.roomById(slopGallery.walls.find(wall => wall.id === portrait.wallId)!.room)!
      expect(portrait.frame).toBe(room.room.frame && choiceFrames(room.room.frame)[0])
    }
    for (const orb of orbs) {
      const frame = orb.ingredient(0).contributions.find(entry => entry.kind === 'frame')
      expect(frame?.frame).toBe(orb.frame && choiceFrames(orb.frame)[0])
    }
  })
  test('the works of a room with several frames wear all of them between them', () => {
    const several = slopGallery.rooms.filter(room => room.room.frame && choiceFrames(room.room.frame).length > 1)
    expect(several.length).toBeGreaterThan(0)
    const works = Array.from({length: 24}, (_, index) => `work-${index}`)
    for (const room of several) {
      const worn = new Set(works.map(work => room.frame(1, work)))
      expect(worn.size).toBe(choiceFrames(room.room.frame!).length)
    }
    // Every work draws for itself, not the same frame in every room.
    const positions = new Set(several.map(room => choiceFrames(room.room.frame!).indexOf(room.frame(1, 'work-0')!)))
    expect(positions.size).toBeGreaterThan(1)
  })
  test('rooms frame the works arriving in them, and a work arriving outside of every room takes the frame of the room it came from', () => {
    for (const seed of seeds.slice(0, 4)) {
      for (const work of ['arrival-a', 'arrival-b']) {
        for (const room of slopGallery.rooms) {
          const inside = room.spawn.position
          const lifted: Vec3 = [inside[0], inside[1] + 1.2, inside[2]]
          expect(arrivalFrame(lifted, lifted, work, seed)).toBe(room.frame(seed, work))
        }
        const lobby = slopGallery.room('lobby')
        const outside: Vec3 = [1e4, 0, 1e4]
        expect(slopGallery.roomAt(outside)).toBeUndefined()
        expect(arrivalFrame(outside, lobby.spawn.position, work, seed)).toBe(lobby.frame(seed, work))
      }
    }
  })
})
