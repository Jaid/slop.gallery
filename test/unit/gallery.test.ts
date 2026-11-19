import {beforeEach, describe, expect, test} from 'bun:test'
import {sep} from 'node:path'

import {dropPortrait} from '../../src/lib/gallery/actions.ts'
import {imageSize} from '../../src/lib/gallery/ImageImporter.ts'
import {maximumPortraits} from '../../src/lib/gallery/imagePolicy.ts'
import portraitLabel, {portraitLabelLayout} from '../../src/lib/gallery/portraitLabel.ts'
import {siennaVestibule} from '../../src/lib/gallery/sienna.ts'
import {useGallery} from '../../src/lib/gallery/store.ts'
import {defaultPortraitArea, slotAreas} from '../../src/lib/placement/portraitSlots.ts'
import {placementIssue, wallCoordinates, wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import artworks from '../../src/worlds/gallery/artworks.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import walls, {galleryPlacement, insideGallery, roomAt, rooms, roomVisit} from './fixtures/gallery.ts'
import samplePortraits from './fixtures/portraits.ts'

const initial = useGallery.getState()
beforeEach(() => {
  useGallery.setState({
    ...initial,
    portraits: samplePortraits.map(p => ({...p})),
    sound: false,
  }, true)
})
describe('wall geometry', () => {
  for (const wall of walls) {
    test(`${wall.id}: local coordinates round-trip`, () => {
      // Curved walls wrap; round-trip coordinates within the actual wall span.
      for (const fraction of [-0.45, 0, 0.45]) {
        const u = fraction * wall.width
        expect(wallCoordinates(wall, wallPosition(wall, u, 2.5))).toBeCloseTo(u)
      }
    })
  }
  test('the shipped exhibition leaves space for frames, plates and doors', () => {
    for (const p of samplePortraits) {
      const wall = walls.find(w => w.id === p.wallId)!
      expect(placementIssue(wall, p.position, p.width, p.height, samplePortraits, p.id)).toBe('')
    }
  })
  test('hits the facing wall and preserves the frame offset', () => {
    expect(galleryPlacement.findPlacement([4, 2.5, -24], [0, 0, -1], 2, 2, [])).toMatchObject({
      wallId: 'lobby-north',
      position: [4, 2.5, -31.78],
      valid: true,
    })
    expect(galleryPlacement.findPlacement([0, 2.5, 5], [0, 0, -1], 2, 2, [])).toMatchObject({
      wallId: 'lobby-north',
      inReach: false,
      valid: false,
    })
  })
  test('doorways are not hanging surfaces', () => {
    expect(galleryPlacement.findPlacement([0, 2, 0], [-1, 0, 0], 2, 2, [])).toMatchObject({
      wallId: 'vesper-west',
      inReach: false,
      valid: false,
    })
    const wall = walls.find(w => w.id === 'lobby-west')!
    expect(placementIssue(wall, wallPosition(wall, 0, 2.5), 2, 2, [])).toBe('doorway')
  })
  test('rejects edges, low labels, ceilings and overlaps', () => {
    const wall = walls[0]
    for (const [u, y] of [[7, 2.5], [0, 1], [0, 5]] as const) {
      expect(placementIssue(wall, wallPosition(wall, u, y), 2, 2, [])).not.toBe('')
    }
    const p = samplePortraits[0]
    expect(placementIssue(wall, p.position, p.width, p.height, samplePortraits)).toBe('neighbor')
    expect(placementIssue(wall, p.position, p.width, p.height, samplePortraits, p.id)).toBe('')
  })
  test('keeps distant wall previews but never accepts them as placements', () => {
    for (const z of [-21.999, 5, 7.5]) {
      expect(galleryPlacement.findPlacement([4, 2.5, z], [0, 0, -1], 2, 2, [])).toMatchObject({
        wallId: 'lobby-north',
        position: [4, 2.5, -31.78],
        fits: true,
        inReach: false,
        valid: false,
        reason: 'reach',
      })
    }
    const p = samplePortraits[0]
    expect(galleryPlacement.findPlacement([p.position[0], p.position[1], 5], [0, 0, -1], p.width, p.height, samplePortraits)).toMatchObject({
      fits: false,
      inReach: false,
      valid: false,
      reason: 'reach',
    })
    expect(galleryPlacement.findPlacement([4, 2.5, -22], [0, 0, -1], 2, 2, [])).toMatchObject({
      inReach: true,
      valid: true,
    })
    expect(galleryPlacement.findPlacement([4, 2.5, -22.001], [0, 0, -1], 2, 2, [])).toMatchObject({
      inReach: true,
      valid: true,
    })
  })
  test('reach is measured in world units, not ray parameter units', () => {
    expect(galleryPlacement.findPlacement([0, 2.5, 5], [0, 0, -2], 2, 2, [])).toMatchObject({
      inReach: false,
      valid: false,
    })
    expect(galleryPlacement.findPlacement([4, 2.5, -24], [0, 0, -0.5], 2, 2, [])).toMatchObject({
      inReach: true,
      valid: true,
    })
  })
  test('only wall hits produce previews and closer walls still occlude farther walls', () => {
    expect(galleryPlacement.findPlacement([0, 2.5, 0], [0, 1, 0], 2, 2, [])).toBeNull()
    expect(galleryPlacement.findPlacement([0, 2.5, 0], [0, 0, 0], 2, 2, [])).toBeNull()
    expect(galleryPlacement.findPlacement([0, 2.5, 3], [-1, 0, 0], 2, 2, [])).toMatchObject({
      wallId: 'lobby-west',
      inReach: true,
    })
    expect(galleryPlacement.findPlacement([0, 2.5, 0], [0, 0, 1], 2, 2, [])).toMatchObject({
      wallId: 'antechamber-south',
      inReach: false,
    })
  })
  test('the Antechamber is always available for hanging artwork', () => {
    expect(galleryPlacement.findPlacement([0, 2.5, 10], [0, 0, 1], 2, 2, [])).toMatchObject({
      wallId: 'antechamber-south',
      inReach: true,
      valid: true,
    })
    expect(galleryPlacement.findPlacement([0, 2.5, 10], [0, 0, -1], 2, 2, [])).toMatchObject({
      wallId: 'lobby-north',
      inReach: false,
    })
  })
  test('the Sienna connects through matching Vesper arches in both directions', () => {
    const vesper = walls.find(wall => wall.id === 'vesper-south')!
    const sienna = walls.find(wall => wall.id === 'sienna-north')!
    const entrance = wallPosition(vesper, vesper.holes![0].u, 2, 0)
    const exit = wallPosition(sienna, sienna.holes![0].u, 2, 0)
    for (const [i, value] of entrance.entries()) {
      expect(value).toBeCloseTo(exit[i])
    }
    expect(galleryPlacement.findPlacement([-14, 2.5, 6], [0, 0, 1], 2, 2, [])).toMatchObject({
      wallId: 'sienna-south',
      inReach: false,
    })
    expect(galleryPlacement.findPlacement([-14, 2.5, 10], [0, 0, -1], 2, 2, [])).toMatchObject({
      wallId: 'vesper-north',
      inReach: false,
    })
    // The Vesper’s centered south arch opens by the Sienna’s north-east corner, whose middle is solid.
    const siennaRoom = rooms.find(room => room.id === 'sienna')!
    expect(entrance[0]).toBeCloseTo(rooms.find(room => room.id === 'vesper')!.center[0])
    expect(sienna.holes![0].u).toBeGreaterThan(sienna.width / 4)
    expect(galleryPlacement.findPlacement([-10.2, 2.5, 6], [0, 0, 1], 2, 2, [])).toMatchObject({
      wallId: 'vesper-south',
      inReach: true,
    })
    expect(galleryPlacement.findPlacement([siennaRoom.center[0], 2.5, 10], [0, 0, -1], 2, 2, [])).toMatchObject({
      wallId: 'sienna-north',
      inReach: true,
    })
  })
  test('the Sienna has usable hanging walls', () => {
    expect(galleryPlacement.findPlacement([-14, 2.5, 14], [0, 0, 1], 2, 2, [])).toMatchObject({
      wallId: 'sienna-south',
      position: [-14, 2.5, 19.78],
      inReach: true,
      valid: true,
    })
  })
  test('gallery bounds include the Sienna and its vestibule but not the empty space beside them', () => {
    const {center: [x, z], size: [width, depth]} = rooms.find(room => room.id === 'sienna')!
    const [west, east, south] = [x - width / 2, x + width / 2, z + depth / 2]
    for (const position of [[x, 2, z], [-14, 2, 19.8], [0, 2, 14], [west, 0, south], [siennaVestibule.center[0], 2, siennaVestibule.center[1]]] as const) {
      expect(insideGallery([...position])).toBe(true)
    }
    // East of the Sienna, west of it, south of it beside the vestibule, under it and over it
    for (const position of [[-6, 2, 18], [east + 0.01, 2, z], [14, 3, 14], [east - 1, 2, south + 0.01], [west - 0.01, 2, z], [x, -1.01, z], [x, 6.01, z], [Number.NaN, 2, z]] as const) {
      expect(insideGallery([...position])).toBe(false)
    }
  })
  test('every floor-plan destination lands inside its own room', () => {
    for (const room of rooms) {
      const visit = roomVisit(room)
      expect(insideGallery(visit.position)).toBe(true)
      expect(roomAt(visit.position)).toBe(room.id)
      expect(Math.hypot(...visit.rotation)).toBeCloseTo(1)
    }
    expect(roomAt([-14, 2, 7.99])).toBe('vesper')
    expect(roomAt([-14, 2, 8.01])).toBe('sienna')
  })
  test('label clearance follows the physical sign footprint', () => {
    const wall = walls[0]
    const layout = portraitLabelLayout(2, 2)
    const lowestCenter = 0.48 - layout.bottom + portraitLabel.clearance
    expect(placementIssue(wall, wallPosition(wall, 4, lowestCenter - 0.001), 2, 2, [])).toBe('frame')
    expect(placementIssue(wall, wallPosition(wall, 4, lowestCenter + 0.001), 2, 2, [])).toBe('')
  })
  test('room boundaries are shared by UI and interaction', () => {
    expect(roomAt([-14, 2, 0])).toBe('vesper')
    expect(roomAt([14, 2, 0])).toBe('banquet')
    expect(roomAt([0, 2, 11])).toBe('antechamber')
    expect(roomAt([0, 2, 3])).toBe('lobby')
  })
})
describe('image dimensions', () => {
  test('keeps landscape, portrait and square aspect ratios at the default frame area', () => {
    for (const [width, height] of [[400, 200], [200, 400], [400, 400]]) {
      const size = imageSize(width, height)
      expect(size.width / size.height).toBeCloseTo(width / height, 9)
      expect(size.width * size.height * 10_000).toBeCloseTo(defaultPortraitArea, 5)
    }
  })
  test('frames an image at a given area', () => {
    const size = imageSize(1600, 900, 60_000)
    expect(size.width / size.height).toBeCloseTo(16 / 9, 9)
    expect(size.width * size.height).toBeCloseTo(6, 9)
  })
  for (const dimensions of [[0, 100], [-1, 100], [Number.NaN, 100], [Infinity, 100], [9000, 9000], [1300, 100], [100, 1300]]) {
    test(`rejects ${dimensions.join('×')}`, () => {
      expect(() => imageSize(dimensions[0], dimensions[1])).toThrow()
    })
  }
})
describe('import areas', () => {
  test('every portrait area is a slot area', () => {
    for (const room of slopGallery.rooms) {
      expect(slotAreas).toContain(room.portraitArea as typeof slotAreas[number])
    }
  })
  test('a hung work takes the area of the room owning its wall, a dropped one that of the player’s room', () => {
    const areaOf = (id: string) => slopGallery.rooms.find(room => room.id === id)!.portraitArea
    expect(areaOf('lodge')).not.toBe(areaOf('lobby'))
    const lodgeWall = walls.find(wall => wall.room === 'lodge')!
    expect(slopGallery.portraitArea(lodgeWall.id, 'lobby')).toBe(areaOf('lodge'))
    expect(slopGallery.portraitArea(undefined, 'lobby')).toBe(areaOf('lobby'))
    expect(slopGallery.portraitArea('nowhere', 'oculus')).toBe(areaOf('oculus'))
    expect(slopGallery.portraitArea(undefined, 'nowhere')).toBe(defaultPortraitArea)
  })
})
describe('collection changes', () => {
  test('a dropped work falls off its wall and the held work stays in hand', () => {
    const [dropped, held] = useGallery.getState().portraits
    useGallery.setState({held: held.id})
    expect(dropPortrait(dropped.id)).toBe(true)
    expect(useGallery.getState().held).toBe(held.id)
    const fallen = useGallery.getState().portraits.find(p => p.id === dropped.id)!
    expect(fallen).toMatchObject({
      hung: false,
      wallId: undefined,
      position: dropped.position,
    })
    // It tips forward, away from its wall.
    expect(fallen.velocity![0] * Math.sin(dropped.rotation) + fallen.velocity![2] * Math.cos(dropped.rotation)).toBeGreaterThan(0)
    expect(dropPortrait(dropped.id)).toBe(false)
    expect(dropPortrait(held.id)).toBe(false)
  })
  test('enforces collection capacity', () => {
    const p = samplePortraits[0]
    useGallery.setState({
      portraits: Array.from({length: maximumPortraits}, (_, i) => ({
        ...p,
        id: String(i),
      })),
    })
    expect(() => useGallery.getState().add({
      ...p,
      id: 'overflow',
    })).toThrow()
  })
})
describe('default artworks', () => {
  test('every artwork imports an image and maybe a narration named after its unique ID', async () => {
    const ids = new Set(artworks.map(artwork => artwork.id))
    expect(ids.size).toBe(artworks.length)
    for (const {id, source, narration} of artworks) {
      expect(id).toMatch(/^[a-z]+(?:-[a-z]+)*$/)
      // Bun imports them as their files, which the build names by their content.
      expect(source).toEndWith(`${sep}${id}.jxl`)
      expect(await Bun.file(source).exists()).toBe(true)
      if (!narration) {
        continue
      }
      expect(narration.audio).toEndWith(`${sep}${id}.opus`)
      expect(await Bun.file(narration.audio).exists()).toBe(true)
    }
  })
  test('the furnished gallery of the tests hangs the default artworks', () => {
    const ids = new Set(artworks.map(artwork => artwork.id))
    expect(samplePortraits.every(portrait => ids.has(portrait.id))).toBe(true)
  })
})
