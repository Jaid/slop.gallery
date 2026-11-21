import type {BoxInput, Fence, GeofenceSessionOptions, MultimatchGeofenceSessionOptions, Position} from '../src/main.ts'

import {describe, expect, test} from 'bun:test'

import GeofenceCollection, {BeamBox, Box, boxInputSchema, ClosedBox, createBox, Geofence, GeofenceSession, MultimatchGeofenceSession, RelationalGeofence, SkyBox, VoidBox} from '../src/main.ts'

const beam = {
  x: 0,
  z: 0,
  x2: 4,
  z2: 2,
}
const record = <Id>(session: GeofenceSession<Id>) => {
  const events: Array<Array<unknown>> = []
  session.on('enter', id => events.push(['enter', id]))
  session.on('leave', id => events.push(['leave', id]))
  session.on('change', (match, previous) => events.push(['change', match, previous]))
  return events
}
const createCollection = () => new GeofenceCollection([
  ['room', new Geofence([{
    ...beam,
    y: 0,
    y2: 3,
  }])],
  ['sky', new Geofence([{
    ...beam,
    floor: 2,
  }])],
])
const create = (options?: GeofenceSessionOptions) => new GeofenceSession(createCollection(), options)
const createMultimatch = (options?: MultimatchGeofenceSessionOptions) => new MultimatchGeofenceSession(createCollection(), options)
describe('Box.contains', () => {
  const cases: Array<[string, BoxInput, Position, boolean]> = [
    ['beamBox inside', beam, [2, 0, 1], true],
    ['beamBox at any height', beam, [2, -1000, 1], true],
    ['beamBox on an edge', beam, [4, 7, 2], true],
    ['beamBox on a corner', beam, [0, 7, 0], true],
    ['beamBox beside it on x', beam, [4.001, 0, 1], false],
    ['beamBox beside it on z', beam, [2, 0, -0.001], false],
    ['beamBox with NaN in the position', beam, [Number.NaN, 0, 1], false],
    ['skyBox above the floor', {
      ...beam,
      floor: 3,
    }, [2, 100, 1], true],
    ['skyBox exactly on the floor', {
      ...beam,
      floor: 3,
    }, [2, 3, 1], true],
    ['skyBox below the floor', {
      ...beam,
      floor: 3,
    }, [2, 2.999, 1], false],
    ['skyBox above the floor but outside the beam', {
      ...beam,
      floor: 3,
    }, [5, 100, 1], false],
    ['voidBox below the ceiling', {
      ...beam,
      ceiling: 3,
    }, [2, -100, 1], true],
    ['voidBox exactly on the ceiling', {
      ...beam,
      ceiling: 3,
    }, [2, 3, 1], true],
    ['voidBox above the ceiling', {
      ...beam,
      ceiling: 3,
    }, [2, 3.001, 1], false],
    ['voidBox below the ceiling but outside the beam', {
      ...beam,
      ceiling: 3,
    }, [2, -100, 3], false],
    ['closedBox inside', {
      ...beam,
      y: 1,
      y2: 3,
    }, [2, 2, 1], true],
    ['closedBox on the bottom face', {
      ...beam,
      y: 1,
      y2: 3,
    }, [2, 1, 1], true],
    ['closedBox on the top face', {
      ...beam,
      y: 1,
      y2: 3,
    }, [2, 3, 1], true],
    ['closedBox on a corner', {
      ...beam,
      y: 1,
      y2: 3,
    }, [4, 3, 2], true],
    ['closedBox below it', {
      ...beam,
      y: 1,
      y2: 3,
    }, [2, 0.999, 1], false],
    ['closedBox above it', {
      ...beam,
      y: 1,
      y2: 3,
    }, [2, 3.001, 1], false],
    ['closedBox beside it', {
      ...beam,
      y: 1,
      y2: 3,
    }, [-1, 2, 1], false],
    ['flat closedBox on its plane', {
      ...beam,
      y: 1,
      y2: 1,
    }, [2, 1, 1], true],
    ['swapped beamBox inside', {
      x: 4,
      z: 2,
      x2: 0,
      z2: 0,
    }, [2, 0, 1], true],
    ['swapped closedBox inside', {
      x: 4,
      z: 2,
      x2: 0,
      z2: 0,
      y: 3,
      y2: 1,
    }, [2, 2, 1], true],
    ['swapped closedBox above it', {
      x: 4,
      z: 2,
      x2: 0,
      z2: 0,
      y: 3,
      y2: 1,
    }, [2, 3.001, 1], false],
  ]
  test.each(cases)('%s', (_, input, position, expected) => {
    expect(createBox(input).contains(position)).toBe(expected)
  })
})
describe('createBox', () => {
  test('picks the class by the keys', () => {
    expect(createBox(beam)).toBeInstanceOf(BeamBox)
    expect(createBox({
      ...beam,
      floor: 1,
    })).toBeInstanceOf(SkyBox)
    expect(createBox({
      ...beam,
      ceiling: 1,
    })).toBeInstanceOf(VoidBox)
    expect(createBox({
      ...beam,
      y: 1,
      y2: 2,
    })).toBeInstanceOf(ClosedBox)
    expect(createBox(beam)).toBeInstanceOf(Box)
  })
  test('keeps boxes as they are', () => {
    const box = new SkyBox({
      ...beam,
      floor: 1,
    })
    expect(createBox(box)).toBe(box)
  })
  test('sorts the values of every axis', () => {
    expect(createBox({
      x: 4,
      z: 5,
      x2: 0,
      z2: 2,
      y: 3,
      y2: 1,
    })).toEqual(new ClosedBox({
      x: 0,
      z: 2,
      x2: 4,
      z2: 5,
      y: 1,
      y2: 3,
    }))
    expect(createBox({
      x: 4,
      z: 5,
      x2: 0,
      z2: 2,
      floor: 7,
    })).toEqual(new SkyBox({
      x: 0,
      z: 2,
      x2: 4,
      z2: 5,
      floor: 7,
    }))
    expect(createBox({
      x: 4,
      z: 5,
      x2: 0,
      z2: 2,
      ceiling: -7,
    })).toEqual(new VoidBox({
      x: 0,
      z: 2,
      x2: 4,
      z2: 5,
      ceiling: -7,
    }))
    expect(createBox({
      x: 4,
      z: 5,
      x2: 0,
      z2: 2,
    })).toEqual(new BeamBox({
      x: 0,
      z: 2,
      x2: 4,
      z2: 5,
    }))
  })
  test('rejects mixed, incomplete and unknown keys', () => {
    expect(() => createBox({
      ...beam,
      floor: 1,
      ceiling: 2,
    })).toThrow()
    expect(() => createBox({
      ...beam,
      y: 1,
    })).toThrow()
    expect(() => createBox({
      ...beam,
      y2: 1,
    })).toThrow()
    expect(() => createBox({
      x: 0,
      z: 0,
      x2: 1,
    } as unknown as BoxInput)).toThrow()
    expect(() => createBox({
      ...beam,
      w: 1,
    } as unknown as BoxInput)).toThrow()
  })
  test('rejects non-finite values', () => {
    expect(() => createBox({
      ...beam,
      x: Number.NaN,
    })).toThrow()
    expect(() => createBox({
      ...beam,
      floor: Number.NEGATIVE_INFINITY,
    })).toThrow()
    expect(() => new ClosedBox({
      ...beam,
      y: 0,
      y2: Number.POSITIVE_INFINITY,
    })).toThrow()
  })
  test('round-trips through JSON', () => {
    const box = createBox({
      x: 4,
      z: 5,
      x2: 0,
      z2: 2,
      y: 3,
      y2: 1,
    })
    const json = JSON.stringify(box)
    expect(json).toBe('{"x":0,"x2":4,"z":2,"z2":5,"y":1,"y2":3}')
    const input = boxInputSchema.parse(JSON.parse(json))
    expect(createBox(input)).toEqual(box)
    expect(createBox(input)).toBeInstanceOf(ClosedBox)
  })
})
describe('Box.translate', () => {
  test('moves every kind of box and keeps its class', () => {
    const boxes = [beam, {
      ...beam,
      floor: 1,
    }, {
      ...beam,
      ceiling: 1,
    }, {
      ...beam,
      y: 1,
      y2: 2,
    }].map(input => createBox(input))
    const moved = boxes.map(box => box.translate([10, 5, -10]))
    expect(moved.map(box => box.constructor)).toEqual([BeamBox, SkyBox, VoidBox, ClosedBox])
    const footprint = {
      x: 10,
      z: -10,
      x2: 14,
      z2: -8,
    }
    expect(moved).toEqual([
      new BeamBox(footprint),
      new SkyBox({
        ...footprint,
        floor: 6,
      }),
      new VoidBox({
        ...footprint,
        ceiling: 6,
      }),
      new ClosedBox({
        ...footprint,
        y: 6,
        y2: 7,
      }),
    ])
  })
  test('rejects non-finite offsets', () => {
    const box = new BeamBox(beam)
    expect(() => box.translate([Number.NaN, 0, 0])).toThrow()
  })
})
describe('Box.overlaps', () => {
  const room = {
    ...beam,
    y: 0,
    y2: 3,
  }
  const cases: Array<[string, BoxInput, BoxInput, boolean]> = [
    ['a box and itself', room, room, true],
    ['a closedBox reaching into another', room, {
      x: 3,
      z: 1,
      x2: 9,
      z2: 9,
      y: 2,
      y2: 8,
    }, true],
    ['a closedBox within another', room, {
      x: 1,
      z: 0.5,
      x2: 2,
      z2: 1,
      y: 1,
      y2: 2,
    }, true],
    ['closedBoxes side by side on x, sharing a face', room, {
      ...room,
      x: 4,
      x2: 8,
    }, false],
    ['closedBoxes side by side on z, sharing a face', room, {
      ...room,
      z: -2,
      z2: 0,
    }, false],
    ['closedBoxes on top of each other, sharing a face', room, {
      ...beam,
      y: 3,
      y2: 6,
    }, false],
    ['closedBoxes sharing only an edge', room, {
      x: 4,
      z: 2,
      x2: 8,
      z2: 4,
      y: 0,
      y2: 3,
    }, false],
    ['closedBoxes apart', room, {
      ...room,
      x: 5,
      x2: 9,
    }, false],
    ['a skyBox whose floor lies under a closedBox’s top', room, {
      ...beam,
      floor: 2.9,
    }, true],
    ['a skyBox standing on a closedBox', room, {
      ...beam,
      floor: 3,
    }, false],
    ['a voidBox whose ceiling lies over a closedBox’s bottom', room, {
      ...beam,
      ceiling: 0.1,
    }, true],
    ['a voidBox hanging under a closedBox', room, {
      ...beam,
      ceiling: 0,
    }, false],
    ['a skyBox standing on a voidBox', {
      ...beam,
      floor: 1,
    }, {
      ...beam,
      ceiling: 1,
    }, false],
    ['a skyBox reaching into a voidBox', {
      ...beam,
      floor: 1,
    }, {
      ...beam,
      ceiling: 1.5,
    }, true],
    ['two skyBoxes over crossing footprints, however far apart their floors', {
      ...beam,
      floor: -500,
    }, {
      x: 3,
      z: -4,
      x2: 3.5,
      z2: 40,
      floor: 900,
    }, true],
    ['a beamBox and a box of any kind over its footprint', beam, {
      ...beam,
      ceiling: -1000,
    }, true],
    ['a beamBox and a box beside its footprint', beam, {
      ...beam,
      x: 4,
      x2: 5,
      floor: 0,
    }, false],
    ['a flat closedBox, which takes up no space', room, {
      ...beam,
      y: 1,
      y2: 1,
    }, false],
  ]
  test.each(cases)('%s', (_, first, second, expected) => {
    expect(createBox(first).overlaps(createBox(second))).toBe(expected)
    expect(createBox(second).overlaps(createBox(first))).toBe(expected)
  })
  test('every kind of box tells how far down and up it reaches', () => {
    expect([createBox(room).bottom, createBox(room).top]).toEqual([0, 3])
    expect([createBox(beam).bottom, createBox(beam).top]).toEqual([-Infinity, Infinity])
    const sky = createBox({
      ...beam,
      floor: 2,
    })
    expect([sky.bottom, sky.top]).toEqual([2, Infinity])
    const hollow = createBox({
      ...beam,
      ceiling: 2,
    })
    expect([hollow.bottom, hollow.top]).toEqual([-Infinity, 2])
    // Neither is a field of its own, so a box’s own fields stay the plain data it was built from.
    expect(Object.keys(sky).toSorted()).toEqual(['floor', 'x', 'x2', 'z', 'z2'])
  })
})
describe('Geofence', () => {
  test('turns plain data into boxes and keeps given boxes', () => {
    const sky = new SkyBox({
      ...beam,
      floor: 1,
    })
    const geofence = new Geofence([beam, sky, {
      ...beam,
      ceiling: 1,
    }, {
      ...beam,
      y: 1,
      y2: 2,
    }])
    expect(geofence.boxes.map(box => box.constructor)).toEqual([BeamBox, SkyBox, VoidBox, ClosedBox])
    expect(geofence.boxes[1]).toBe(sky)
    expect(Object.isFrozen(geofence.boxes)).toBe(true)
  })
  test('contains what any of its boxes contains', () => {
    const geofence = new Geofence([{
      ...beam,
      y: 0,
      y2: 1,
    }, {
      x: 10,
      z: 10,
      x2: 12,
      z2: 12,
      floor: 5,
    }])
    expect(geofence.contains([1, 0.5, 1])).toBe(true)
    expect(geofence.contains([11, 50, 11])).toBe(true)
    expect(geofence.contains([11, 0, 11])).toBe(false)
    expect(geofence.contains([6, 0.5, 1])).toBe(false)
  })
  test('rejects no boxes', () => {
    expect(() => new Geofence([])).toThrow()
  })
  test('rejects invalid boxes', () => {
    expect(() => new Geofence([{
      ...beam,
      x: Number.NaN,
    }])).toThrow()
  })
})
describe('Geofence.translate', () => {
  const geofence = new Geofence([beam, {
    ...beam,
    floor: 1,
  }, {
    ...beam,
    ceiling: 1,
  }, {
    ...beam,
    y: 1,
    y2: 2,
  }])
  const moved = geofence.translate([10, 5, -10])
  test('moves every box', () => {
    expect(moved.boxes).toEqual([
      new BeamBox({
        x: 10,
        z: -10,
        x2: 14,
        z2: -8,
      }),
      new SkyBox({
        x: 10,
        z: -10,
        x2: 14,
        z2: -8,
        floor: 6,
      }),
      new VoidBox({
        x: 10,
        z: -10,
        x2: 14,
        z2: -8,
        ceiling: 6,
      }),
      new ClosedBox({
        x: 10,
        z: -10,
        x2: 14,
        z2: -8,
        y: 6,
        y2: 7,
      }),
    ])
  })
  test('returns a new geofence and leaves the original alone', () => {
    expect(moved).toBeInstanceOf(Geofence)
    expect(moved).not.toBe(geofence)
    expect(geofence.boxes[0]).toEqual(new BeamBox(beam))
  })
  test('contains what the original contains, moved', () => {
    expect(geofence.contains([1, 1.5, 1])).toBe(true)
    expect(moved.contains([11, 6.5, -9])).toBe(true)
    expect(moved.contains([1, 1.5, 1])).toBe(false)
  })
})
describe('Geofence.overlaps', () => {
  const hall = new Geofence([{
    ...beam,
    floor: 0,
  }])
  test('shares space with a fence one of whose boxes reaches into one of its own', () => {
    const part = new Geofence([{
      x: 100,
      z: 100,
      x2: 101,
      z2: 101,
    }, {
      x: 3,
      z: 1,
      x2: 6,
      z2: 5,
      y: 1,
      y2: 2,
    }])
    expect(hall.overlaps(part)).toBe(true)
    expect(part.overlaps(hall)).toBe(true)
    expect(hall.overlaps(hall)).toBe(true)
  })
  test('shares none with fences beside it, under it or apart from it, whose boxes share faces with its own at most', () => {
    const neighbor = new Geofence([{
      x: 4,
      z: 0,
      x2: 9,
      z2: 2,
      floor: 0,
    }])
    const cellar = new Geofence([{
      ...beam,
      ceiling: 0,
    }])
    const far = new Geofence([{
      x: 50,
      z: 50,
      x2: 60,
      z2: 60,
    }])
    // On the plane between them, both hold a position, and yet they share no space.
    expect(hall.contains([4, 1, 1]) && neighbor.contains([4, 1, 1])).toBe(true)
    for (const other of [neighbor, cellar, far]) {
      expect(hall.overlaps(other)).toBe(false)
      expect(other.overlaps(hall)).toBe(false)
    }
  })
})
describe('Geofence.subtract', () => {
  const hall = new Geofence([{
    ...beam,
    floor: 0,
  }])
  /** Positions off every plane the boxes of the fences below end on, in, around, under and far over them. */
  const samples = [-0.75, 0.25, 1.25, 2.25, 3.25, 4.75].flatMap(x => [-0.75, 0.25, 0.75, 1.25, 1.75, 2.75].flatMap(z => [-900, -0.5, 0.5, 1.5, 2.5, 900].map((y): Position => [x, y, z])))
  /** Whether no two boxes of the fence share any space. */
  const apart = ({boxes}: Geofence) => boxes.every((box, index) => boxes.slice(index + 1).every(other => !box.overlaps(other)))
  test('leaves a fence that shares no space with the other one as it is', () => {
    const neighbor = new Geofence([{
      x: 4,
      z: 0,
      x2: 9,
      z2: 2,
      floor: 0,
    }])
    const left = hall.subtract(neighbor)!
    expect(left).not.toBe(hall)
    expect(left.boxes).toEqual(hall.boxes)
    expect(left.boxes[0]).toBe(hall.boxes[0])
  })
  test('leaves nothing of a fence the other one covers, in one box or in several', () => {
    expect(hall.subtract(hall)).toBeNull()
    expect(hall.subtract(new Geofence([beam]))).toBeNull()
    const halves = new Geofence([{
      ...beam,
      x2: 1.5,
      floor: -1,
    }, {
      ...beam,
      x: 1.5,
    }])
    expect(hall.subtract(halves)).toBeNull()
    // One half alone leaves the other.
    expect(hall.subtract(new Geofence([halves.boxes[0]]))!.boxes).toEqual([new SkyBox({
      ...beam,
      x: 1.5,
      floor: 0,
    })])
  })
  test('cuts a box out of the middle of a column into boxes of the kinds that reach as far, which share no space', () => {
    const cut = new Geofence([{
      x: 1,
      z: 0.5,
      x2: 3,
      z2: 1.5,
      y: 1,
      y2: 2,
    }])
    const left = hall.subtract(cut)!
    // west and east of it and north and south of it between them, from the floor up, the rest under it and the column over it
    expect(left.boxes.map(box => box.constructor)).toEqual([SkyBox, SkyBox, SkyBox, SkyBox, ClosedBox, SkyBox])
    expect(apart(left)).toBe(true)
    for (const position of samples) {
      expect(left.contains(position)).toBe(hall.contains(position) && !cut.contains(position))
    }
    // Like boxes side by side, what is left and what was cut out both hold the faces between them.
    for (const position of [[1, 1.5, 1], [2, 2, 1], [2, 1.5, 0.5]] satisfies Array<Position>) {
      expect(cut.contains(position)).toBe(true)
      expect(left.contains(position)).toBe(true)
    }
    // Out of an endless column, an endless one is left under it too.
    const column = new Geofence([beam])
    expect(column.subtract(cut)!.boxes.map(box => box.constructor)).toEqual([BeamBox, BeamBox, BeamBox, BeamBox, VoidBox, SkyBox])
    expect(column.subtract(hall)!.boxes).toEqual([new VoidBox({
      ...beam,
      ceiling: 0,
    })])
  })
  test('takes every box of the other one out of every box of its own', () => {
    const fence = new Geofence([{
      ...beam,
      y: 0,
      y2: 3,
    }, {
      x: 3,
      z: 1,
      x2: 5,
      z2: 3,
      ceiling: 2,
    }])
    const other = new Geofence([{
      x: -1,
      z: -1,
      x2: 1,
      z2: 1,
      floor: 1,
    }, {
      x: 2,
      z: 0.5,
      x2: 3.5,
      z2: 2.5,
      y: -1,
      y2: 1,
    }, {
      x: 50,
      z: 50,
      x2: 60,
      z2: 60,
    }])
    const left = fence.subtract(other)!
    for (const position of samples) {
      expect(left.contains(position)).toBe(fence.contains(position) && !other.contains(position))
    }
    // Neither fence changed.
    expect(fence.boxes).toHaveLength(2)
    expect(other.boxes).toHaveLength(3)
  })
})
describe('GeofenceCollection', () => {
  const geofences = new GeofenceCollection([
    ['ground', new Geofence([{
      ...beam,
      y: 0,
      y2: 3,
    }])],
    ['sky', new Geofence([{
      ...beam,
      floor: 2,
    }])],
    ['elsewhere', new Geofence([{
      x: 10,
      z: 10,
      x2: 12,
      z2: 12,
    }])],
  ])
  test('is a Map', () => {
    expect(geofences).toBeInstanceOf(Map)
    expect(geofences.size).toBe(3)
  })
  test('getMatch returns the first matching id', () => {
    expect(geofences.getMatch([1, 2.5, 1])).toBe('ground')
    expect(geofences.getMatch([1, 10, 1])).toBe('sky')
    expect(geofences.getMatch([11, 0, 11])).toBe('elsewhere')
  })
  test('getMatch returns null without a match', () => {
    expect(geofences.getMatch([100, 0, 100])).toBeNull()
    const empty = new GeofenceCollection
    expect(empty.getMatch([0, 0, 0])).toBeNull()
  })
  test('getMatches returns every matching id in insertion order', () => {
    expect(geofences.getMatches([1, 2.5, 1])).toEqual(['ground', 'sky'])
    expect(geofences.getMatches([1, 1, 1])).toEqual(['ground'])
    expect(geofences.getMatches([100, 0, 100])).toEqual([])
  })
  test('keeps literal ids', () => {
    const typed = new GeofenceCollection<'a' | 'b'>([['a', new Geofence([beam])]])
    const match: 'a' | 'b' | null = typed.getMatch([1, 0, 1])
    expect(match).toBe('a')
  })
  test('takes single boxes as fences', () => {
    const boxes = new GeofenceCollection<string, Box>([
      ['low', new ClosedBox({
        ...beam,
        y: 0,
        y2: 1,
      })],
      ['high', new SkyBox({
        ...beam,
        floor: 1,
      })],
    ])
    expect(boxes.getMatch([1, 0.5, 1])).toBe('low')
    expect(boxes.getMatches([1, 1, 1])).toEqual(['low', 'high'])
  })
  test('takes any fence and keeps its type', () => {
    class Sphere {
      constructor(readonly radius: number) {}
      contains([x, y, z]: Position) {
        return Math.hypot(x, y, z) <= this.radius
      }
    }
    const fences = new GeofenceCollection<string, Fence>([
      ['sphere', new Sphere(1)],
      ['everywhere', {contains: () => true}],
    ])
    expect(fences.getMatch([0, 1, 0])).toBe('sphere')
    expect(fences.getMatch([0, 2, 0])).toBe('everywhere')
    expect(fences.getMatches([0, 0.5, 0])).toEqual(['sphere', 'everywhere'])
    const spheres = new GeofenceCollection([['sphere', new Sphere(2)]])
    expect(spheres.get('sphere')?.radius).toBe(2)
  })
})
describe('RelationalGeofence', () => {
  test('is a Geofence of its own boxes, which may be none, and keeps its relations apart, each once, in their order', () => {
    const box = new BeamBox(beam)
    const fence = new RelationalGeofence(['b', beam, 'a', box, 'b'])
    expect(fence).toBeInstanceOf(Geofence)
    expect(fence.boxes).toHaveLength(2)
    expect(fence.boxes[1]).toBe(box)
    expect([...fence.relations]).toEqual(['b', 'a'])
    const relationsAlone = new RelationalGeofence(['a'])
    const boxesAlone = new RelationalGeofence([beam])
    expect(relationsAlone.boxes).toEqual([])
    expect(boxesAlone.relations.size).toBe(0)
  })
  test('rejects neither boxes nor relations, and invalid boxes', () => {
    expect(() => new RelationalGeofence([])).toThrow(RangeError)
    expect(() => new RelationalGeofence([{
      ...beam,
      floor: 1,
      ceiling: 2,
    }])).toThrow()
    expect(() => new Geofence([])).toThrow(RangeError)
  })
  test('on its own, contains what its own boxes contain', () => {
    const fence = new RelationalGeofence(['elsewhere', beam])
    expect(fence.contains([1, 0, 1])).toBe(true)
    expect(fence.contains([10, 0, 10])).toBe(false)
    const relationsAlone = new RelationalGeofence(['elsewhere'])
    expect(relationsAlone.contains([1, 0, 1])).toBe(false)
  })
  test('translates its boxes and keeps its relations', () => {
    const original = new RelationalGeofence(['a', beam])
    const fence = original.translate([10, 0, 0])
    expect(fence).toBeInstanceOf(RelationalGeofence)
    expect([...fence.relations]).toEqual(['a'])
    expect(fence.contains([11, 0, 1])).toBe(true)
    expect(fence.contains([1, 0, 1])).toBe(false)
  })
})
describe('GeofenceCollection, relational fences', () => {
  /** a fence that counts how often it is asked */
  class Counted {
    asked = 0
    constructor(private readonly fence: Fence) {}
    contains(position: Position) {
      this.asked++
      return this.fence.contains(position)
    }
  }
  const west = new Geofence([{
    x: 0,
    z: 0,
    x2: 2,
    z2: 2,
  }])
  const east = new Geofence([{
    x: 2,
    z: 0,
    x2: 4,
    z2: 2,
  }])
  const createRooms = () => new GeofenceCollection<string, Geofence>([
    ['room', new RelationalGeofence(['west', 'east'])],
    ['wing', new RelationalGeofence(['room', {
      x: 4,
      z: 0,
      x2: 6,
      z2: 2,
    }])],
    ['west', west],
    ['east', east],
  ])
  test('match wherever their own boxes or any fence they relate to holds the position, through theirs, even before those', () => {
    const fences = createRooms()
    expect(fences.getMatch([1, 0, 1])).toBe('room')
    expect(fences.getMatches([1, 0, 1])).toEqual(['room', 'wing', 'west'])
    expect(fences.getMatches([3, 0, 1])).toEqual(['room', 'wing', 'east'])
    expect(fences.getMatches([2, 0, 1])).toEqual(['room', 'wing', 'west', 'east'])
    expect(fences.getMatches([5, 0, 1])).toEqual(['wing'])
    expect(fences.getMatch([5, 0, 1])).toBe('wing')
    expect(fences.getMatches([7, 0, 1])).toEqual([])
    expect(fences.getMatch([7, 0, 1])).toBeNull()
  })
  test('contains tells about one fence the same way', () => {
    const fences = createRooms()
    expect(fences.contains('room', [3, 0, 1])).toBe(true)
    expect(fences.contains('room', [5, 0, 1])).toBe(false)
    expect(fences.contains('wing', [1, 0, 1])).toBe(true)
    expect(fences.contains('west', [3, 0, 1])).toBe(false)
    expect(fences.contains('nowhere', [1, 0, 1])).toBe(false)
  })
  test('ask every fence’s own boxes at most once per query, however many fences relate to it', () => {
    const parts = Object.fromEntries(['a', 'b', 'c'].map(id => [id, new Counted(new Geofence([{
      ...beam,
      y: 0,
      y2: 1,
    }]))]))
    const fences = new GeofenceCollection<string, Fence>([
      ['all', new RelationalGeofence(['a', 'b', 'c'])],
      ['some', new RelationalGeofence(['b', 'c'])],
      ['all again', new RelationalGeofence(['all', 'some'])],
      ...Object.entries(parts),
    ])
    // Nothing holds the position: every part is asked once.
    expect(fences.getMatches([1, 5, 1])).toEqual([])
    expect(Object.values(parts).map(part => part.asked)).toEqual([1, 1, 1])
    // Everything does: the first fence finds the first part, and every other fence only asks what it still needs.
    expect(fences.getMatches([1, 0.5, 1])).toEqual(['all', 'some', 'all again', 'a', 'b', 'c'])
    expect(Object.values(parts).map(part => part.asked)).toEqual([2, 2, 2])
    // The first match needs no more than the first part.
    expect(fences.getMatch([1, 0.5, 1])).toBe('all')
    expect(Object.values(parts).map(part => part.asked)).toEqual([3, 2, 2])
  })
  test('go round cycles of relations', () => {
    const fences = new GeofenceCollection<string, Geofence>([
      ['a', new RelationalGeofence(['b'])],
      ['b', new RelationalGeofence(['c', 'a'])],
      ['c', new RelationalGeofence(['a', beam])],
    ])
    expect(fences.getMatches([1, 0, 1])).toEqual(['a', 'b', 'c'])
    expect(fences.getMatches([10, 0, 10])).toEqual([])
    expect(fences.resolve('a')!.boxes).toHaveLength(1)
  })
  test('throw for a relation to a fence the collection lacks, whatever holds the position, until it has that fence', () => {
    const fences = new GeofenceCollection<string, Geofence>([['a', new RelationalGeofence([beam, 'missing'])]])
    expect(() => fences.getMatches([1, 0, 1])).toThrow('relates to “missing”')
    expect(() => fences.getMatch([1, 0, 1])).toThrow(RangeError)
    expect(() => fences.contains('a', [10, 0, 10])).toThrow(RangeError)
    expect(() => fences.relationsOf('a')).toThrow(RangeError)
    fences.set('missing', new Geofence([{
      x: 10,
      z: 10,
      x2: 11,
      z2: 11,
    }]))
    expect(fences.getMatches([10, 0, 10])).toEqual(['a', 'missing'])
  })
  test('follow every change of their fences', () => {
    const fences = createRooms()
    expect(fences.getMatches([1, 0, 1])).toEqual(['room', 'wing', 'west'])
    fences.delete('west')
    expect(() => fences.getMatches([1, 0, 1])).toThrow(RangeError)
    fences.set('west', east)
    expect(fences.getMatches([1, 0, 1])).toEqual([])
    expect(fences.getMatches([3, 0, 1])).toEqual(['room', 'wing', 'east', 'west'])
    fences.set('room', new RelationalGeofence(['east']))
    expect(fences.getMatches([3, 0, 1])).toEqual(['room', 'wing', 'east', 'west'])
    fences.clear()
    expect(fences.getMatches([3, 0, 1])).toEqual([])
    expect(fences.contains('room', [3, 0, 1])).toBe(false)
  })
  test('relationsOf lists what a fence relates to, none for a plain one or an unknown id', () => {
    const fences = createRooms()
    expect(fences.relationsOf('room')).toEqual(['west', 'east'])
    expect(fences.relationsOf('wing')).toEqual(['room'])
    expect(fences.relationsOf('west')).toEqual([])
    expect(fences.relationsOf('nowhere')).toEqual([])
  })
  test('resolve into geofences of every box they take in, each once, and leave plain fences as they are', () => {
    const fences = createRooms()
    const room = fences.resolve('room')!
    expect(room).not.toBeInstanceOf(RelationalGeofence)
    expect(room.boxes).toEqual([...west.boxes, ...east.boxes])
    expect(room.boxes[0]).toBe(west.boxes[0])
    const wing = fences.resolve('wing')!
    expect(wing.boxes).toHaveLength(3)
    expect(wing.contains([5, 0, 1])).toBe(true)
    expect(wing.contains([1, 0, 1])).toBe(true)
    expect(fences.resolve('west')).toBe(west)
    expect(fences.resolve('nowhere')).toBeUndefined()
    const shared = new GeofenceCollection([
      ['both', new RelationalGeofence(['west', 'again'])],
      ['again', new RelationalGeofence(['west'])],
      ['west', west],
    ])
    expect(shared.resolve('both')!.boxes).toEqual(west.boxes)
    const spheres = new GeofenceCollection<string, Fence>([
      ['ball', {contains: () => true}],
      ['around', new RelationalGeofence(['ball'])],
    ])
    expect(spheres.getMatches([0, 0, 0])).toEqual(['ball', 'around'])
    expect(() => spheres.resolve('around')).toThrow(TypeError)
  })
  test('drive sessions like any other fence', () => {
    const session = new MultimatchGeofenceSession(createRooms())
    const events = record(session)
    session.update([1, 0, 1])
    session.update([3, 0, 1])
    session.update([5, 0, 1])
    expect(events).toEqual([
      ['enter', 'room'],
      ['enter', 'wing'],
      ['enter', 'west'],
      ['change', 'room', null],
      ['leave', 'west'],
      ['enter', 'east'],
      ['leave', 'room'],
      ['leave', 'east'],
      ['change', 'wing', 'room'],
    ])
  })
})
describe('GeofenceSession', () => {
  test('defaults to a sticky match', () => {
    const session = create()
    expect(session.announceEmpty).toBe(false)
    expect(session.match).toBeNull()
  })
  test('only follows the first match', () => {
    const session = create()
    const events = record(session)
    expect(session.update([1, 1, 1])).toBe('room')
    expect(events.splice(0)).toEqual([['enter', 'room'], ['change', 'room', null]])
    // also in the sky fence, but the room fence comes first
    expect(session.update([1, 2.5, 1])).toBe('room')
    expect(events.splice(0)).toEqual([])
    expect(session.update([1, 10, 1])).toBe('sky')
    expect(events.splice(0)).toEqual([['leave', 'room'], ['enter', 'sky'], ['change', 'sky', 'room']])
  })
  test('listeners see the new state', () => {
    const session = create()
    const seen: Array<unknown> = []
    session.on('change', () => seen.push(session.match))
    session.update([1, 1, 1])
    expect(seen).toEqual(['room'])
  })
  test('keeps its match outside of every fence', () => {
    const session = create()
    session.update([1, 1, 1])
    const events = record(session)
    expect(session.update([100, 0, 100])).toBe('room')
    expect(session.match).toBe('room')
    expect(session.update([1, 10, 1])).toBe('sky')
    expect(events).toEqual([['leave', 'room'], ['enter', 'sky'], ['change', 'sky', 'room']])
  })
  test('announces leaving every fence with announceEmpty', () => {
    const session = create({announceEmpty: true})
    session.update([1, 1, 1])
    const events = record(session)
    expect(session.update([100, 0, 100])).toBeNull()
    session.update([100, 0, 101])
    expect(session.update([1, 1, 1])).toBe('room')
    expect(events).toEqual([['leave', 'room'], ['change', null, 'room'], ['enter', 'room'], ['change', 'room', null]])
  })
  test('keeps a removed fence’s id until another fence matches', () => {
    const session = create()
    session.update([1, 1, 1])
    const events = record(session)
    session.geofences.delete('room')
    expect(session.update([1, 1, 1])).toBe('room')
    expect(session.update([1, 2.5, 1])).toBe('sky')
    expect(events).toEqual([['leave', 'room'], ['enter', 'sky'], ['change', 'sky', 'room']])
  })
})
describe('GeofenceSession, initialValue', () => {
  test('starts with the given match', () => {
    const session = create({initialValue: 'sky'})
    expect(session.match).toBe('sky')
  })
  test('stays silent while the position is still in that fence', () => {
    const session = create({initialValue: 'room'})
    const events = record(session)
    expect(session.update([1, 1, 1])).toBe('room')
    expect(events).toEqual([])
  })
  test('reports leaving it like any other match', () => {
    const session = create({initialValue: 'room'})
    const events = record(session)
    expect(session.update([1, 10, 1])).toBe('sky')
    expect(events).toEqual([['leave', 'room'], ['enter', 'sky'], ['change', 'sky', 'room']])
  })
  test('sticks outside of every fence without announceEmpty', () => {
    const session = create({initialValue: 'room'})
    const events = record(session)
    expect(session.update([100, 0, 100])).toBe('room')
    expect(events).toEqual([])
  })
  test('is announced as left with announceEmpty', () => {
    const session = create({
      initialValue: 'room',
      announceEmpty: true,
    })
    const events = record(session)
    expect(session.update([100, 0, 100])).toBeNull()
    expect(events).toEqual([['leave', 'room'], ['change', null, 'room']])
  })
  test('null starts without a match', () => {
    const session = create({initialValue: null})
    expect(session.match).toBeNull()
  })
  test('only takes known ids', () => {
    const geofences = new GeofenceCollection([['a', new Geofence([beam])], ['b', new Geofence([beam])]] as const)
    const session = new GeofenceSession(geofences, {initialValue: 'b'})
    expect(session.match).toBe('b')
    // @ts-expect-error TS2322 not an id of the geofences
    const unknownSession = new GeofenceSession(geofences, {initialValue: 'c'})
    expect(unknownSession.match as unknown).toBe('c')
  })
})
describe('MultimatchGeofenceSession', () => {
  test('is a GeofenceSession', () => {
    const session = createMultimatch()
    expect(session).toBeInstanceOf(GeofenceSession)
    expect(session.match).toBeNull()
    expect([...session.matches]).toEqual([])
  })
  test('follows every match', () => {
    const session = createMultimatch({announceEmpty: true})
    const events = record(session)
    expect(session.update([1, 1, 1])).toBe('room')
    expect(events.splice(0)).toEqual([['enter', 'room'], ['change', 'room', null]])
    session.update([1, 2.5, 1])
    expect(events.splice(0)).toEqual([['enter', 'sky']])
    expect([...session.matches]).toEqual(['room', 'sky'])
    session.update([1, 10, 1])
    expect(events.splice(0)).toEqual([['leave', 'room'], ['change', 'sky', 'room']])
    session.update([100, 10, 1])
    expect(events.splice(0)).toEqual([['leave', 'sky'], ['change', null, 'sky']])
  })
  test('listeners see the new state', () => {
    const session = createMultimatch()
    const seen: Array<unknown> = []
    session.on('enter', () => seen.push(session.match, [...session.matches]))
    session.update([1, 2.5, 1])
    expect(seen).toEqual(['room', ['room', 'sky'], 'room', ['room', 'sky']])
  })
  test('stays silent while nothing changes', () => {
    const session = createMultimatch({announceEmpty: true})
    session.update([1, 1, 1])
    const events = record(session)
    session.update([2, 1.5, 1])
    session.update([100, 0, 100])
    session.update([100, 0, 101])
    expect(events).toEqual([['leave', 'room'], ['change', null, 'room']])
  })
  test('keeps its last matches outside of every fence without announceEmpty', () => {
    const session = createMultimatch()
    session.update([1, 2.5, 1])
    const events = record(session)
    session.update([1, 10, 1])
    expect(events.splice(0)).toEqual([['leave', 'room'], ['change', 'sky', 'room']])
    expect(session.update([100, 0, 100])).toBe('sky')
    expect([...session.matches]).toEqual(['sky'])
    expect(events).toEqual([])
  })
  test('keeps every match when jumping out of all of them at once without announceEmpty', () => {
    const session = createMultimatch()
    session.update([1, 2.5, 1])
    const events = record(session)
    session.update([100, 0, 100])
    expect([...session.matches]).toEqual(['room', 'sky'])
    expect(events).toEqual([])
  })
  test('notices fences removed from its geofences', () => {
    const session = createMultimatch({announceEmpty: true})
    session.update([1, 1, 1])
    const events = record(session)
    session.geofences.delete('room')
    session.update([1, 1, 1])
    expect(events).toEqual([['leave', 'room'], ['change', null, 'room']])
  })
})
describe('MultimatchGeofenceSession, initialValue', () => {
  test('takes a single id', () => {
    const session = createMultimatch({initialValue: 'room'})
    expect(session.match).toBe('room')
    expect([...session.matches]).toEqual(['room'])
  })
  test('never splits a string id into characters', () => {
    const session = createMultimatch({initialValue: 'sky'})
    expect([...session.matches]).toEqual(['sky'])
  })
  test('takes several ids, the first one as match, without duplicates', () => {
    const session = createMultimatch({initialValue: ['sky', 'room', 'sky']})
    expect(session.match).toBe('sky')
    expect([...session.matches]).toEqual(['sky', 'room'])
  })
  test('null and an empty array start without a match', () => {
    for (const initialValue of [null, []]) {
      const session = createMultimatch({initialValue})
      expect(session.match).toBeNull()
      expect([...session.matches]).toEqual([])
    }
  })
  test('stays silent while the position is in exactly those fences', () => {
    const session = createMultimatch({initialValue: ['room', 'sky']})
    const events = record(session)
    session.update([1, 2.5, 1])
    expect(events).toEqual([])
  })
  test('reports differences like any other matches', () => {
    const session = createMultimatch({initialValue: ['sky', 'room']})
    const events = record(session)
    // the geofences’ order decides the match, not the initial order
    expect(session.update([1, 2.5, 1])).toBe('room')
    expect(events.splice(0)).toEqual([['change', 'room', 'sky']])
    session.update([1, 1, 1])
    expect(events).toEqual([['leave', 'sky']])
  })
  test('only takes known ids', () => {
    const geofences = new GeofenceCollection([['a', new Geofence([beam])], ['b', new Geofence([beam])]] as const)
    const session = new MultimatchGeofenceSession(geofences, {initialValue: ['b', 'a']})
    expect([...session.matches]).toEqual(['b', 'a'])
    // @ts-expect-error TS2322 not an id of the geofences
    const unknownSession = new MultimatchGeofenceSession(geofences, {initialValue: ['a', 'c']})
    expect([...unknownSession.matches] as Array<unknown>).toEqual(['a', 'c'])
  })
})
