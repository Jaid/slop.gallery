import type {Portrait} from '../../src/lib/gallery/types.ts'

import {afterEach, describe, expect, test} from 'bun:test'

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {Group, Mesh, Vector3} from 'three/webgpu'

import PortraitSpectation from '#component/PortraitSpectation'

import {frames} from '../../src/frames/index.ts'
import portraitObjects from '../../src/lib/gallery/portraitObjects.ts'
import portraitRoom from '../../src/lib/gallery/portraitRoom.ts'
import {portraitStudioBounds, portraitStudioDistance} from '../../src/lib/rendering/portraitStudio.ts'
import gallery from '../../src/worlds/gallery/index.ts'
import sandbox from '../../src/worlds/sandbox/index.ts'
import portraits from './fixtures/portraits.ts'

afterEach(() => portraitObjects.clear())
describe('portrait studio plate', () => {
  test.each([false, true])('shows the complete selectable plate, including unknown works (interacted: %s)', interacted => {
    const portrait = {
      ...portraits[0],
      interacted,
      year: 0,
    }
    const html = renderToStaticMarkup(createElement(PortraitSpectation, {
      portrait,
      onClose: () => {},
    }))
    expect(html).toContain('data-testid="portrait-spectation"')
    expect(html).toContain(`data-interacted="${String(interacted)}"`)
    for (const value of [portrait.title, portrait.creator, portrait.description, '>0</span>', 'Current room:']) {
      expect(html).toContain(value)
    }
    expect(html).not.toContain('Undated')
    expect(html).not.toContain('popover=')
    expect(html.includes('Not yet interacted')).toBe(!interacted)
    expect(html).toContain('Back to menu')
    expect(html).toContain('Resume')
    expect(html).toContain('Reset view')
    expect(portrait.interacted).toBe(interacted)
  })
  test('shows an undated work and outside-room position without inventing a room', () => {
    const portrait: Portrait = {
      ...portraits[0],
      year: undefined,
      hung: false,
      position: [1e6, 1e6, 1e6],
    }
    const html = renderToStaticMarkup(createElement(PortraitSpectation, {
      portrait,
      onClose: () => {},
    }))
    expect(html).toContain('Undated')
    expect(html).toContain('Outside the rooms')
  })
})
describe('portrait’s current room', () => {
  const slot = gallery.portraitSlots()[0]
  const portrait: Portrait = {
    ...portraits[0],
    ...slot,
    frame: undefined,
    id: 'room-test',
  }
  test('hung work follows its current wall even if its center lies outside the room fence', () => {
    const room = gallery.placement.wall(slot.wallId)!.room
    expect(portraitRoom(gallery, {
      ...portrait,
      position: [1e6, 1e6, 1e6],
    })?.id).toBe(room)
    const elsewhere = gallery.portraitSlots().find(candidate => gallery.placement.wall(candidate.wallId)!.room !== room)!
    expect(portraitRoom(gallery, {
      ...portrait,
      wallId: elsewhere.wallId,
    })?.id).toBe(gallery.placement.wall(elsewhere.wallId)!.room)
  })
  test('loose work ignores its old wall and uses its stored position without a mounted model', () => {
    const position = gallery.room('oculus').spawn.position
    expect(portraitRoom(gallery, {
      ...portrait,
      hung: false,
      position,
    })?.id).toBe('oculus')
  })
  test('loose and fusing works use their visible world position, including transformed parents', () => {
    const parent = new Group
    parent.position.fromArray(gallery.room('oculus').spawn.position)
    const group = new Group
    parent.add(group)
    // The body is deliberately unavailable: fusing groups move independently of it.
    portraitObjects.set(portrait.id, {group} as Parameters<typeof portraitObjects.set>[1])
    expect(portraitRoom(gallery, {
      ...portrait,
      hung: false,
    })?.id).toBe('oculus')
    expect(portraitRoom(gallery, {
      ...portrait,
      fusing: true,
    })?.id).toBe('oculus')
  })
  test('works without a wall and worlds other than the gallery use their own fences', () => {
    expect(portraitRoom(sandbox, {
      ...portrait,
      wallId: undefined,
      position: sandbox.spawn.position,
    })?.id).toBe('cell')
    expect(portraitRoom(gallery, {
      ...portrait,
      wallId: 'missing',
      position: gallery.spawn.position,
    })?.id).toBe(gallery.defaultRoom)
    expect(portraitRoom(gallery, {
      ...portrait,
      wallId: undefined,
      position: [1e6, 1e6, 1e6],
    })).toBeUndefined()
  })
})
describe('portrait studio framing', () => {
  test('all frame geometry fits the orbit sphere, for tall, square and wide works', () => {
    const point = new Vector3
    for (const frame of Object.values(frames)) {
      for (const [width, height] of [[0.5, 2], [1, 1], [2, 0.5]]) {
        const geometry = frame.createGeometry(width, height)
        const model = new Mesh(geometry)
        const {radius, center: middle} = portraitStudioBounds(model)
        try {
          const positions = geometry.getAttribute('position')
          for (let index = 0; index < positions.count; index++) {
            point.fromBufferAttribute(positions, index)
            expect(point.distanceTo(middle)).toBeLessThanOrEqual(radius + 1e-6)
          }
        } finally {
          geometry.dispose()
        }
      }
    }
  })
  test('the sphere stays inside both camera axes at every orbit angle and viewport aspect', () => {
    for (const radius of [0.1, 1, 10]) {
      for (const aspect of [0.2, 0.5, 1, 2, 5]) {
        const fov = 35
        const distance = portraitStudioDistance(radius, aspect, fov)
        const projected = Math.tan(Math.asin(radius / distance)) / Math.tan(fov * Math.PI / 360)
        expect(projected).toBeLessThan(1)
        expect(projected / aspect).toBeLessThan(1)
        expect(distance).toBeGreaterThan(radius)
      }
    }
  })
})
