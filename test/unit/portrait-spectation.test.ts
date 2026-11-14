import type {RapierRigidBody} from '@react-three/rapier'
import type {Group} from 'three/webgpu'

import {afterEach, describe, expect, test} from 'bun:test'

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

import PortraitSpectation from '#component/PortraitSpectation'

import {spectationDistance, spectationRadius} from '../../src/components/PortraitSpectation/Studio.tsx'
import portraitObjects from '../../src/lib/gallery/portraitObjects.ts'
import {portraitPosition, portraitRoom, portraitRoomTitle} from '../../src/lib/gallery/portraitRoom.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import samplePortraits from './fixtures/portraits.ts'

const goose = samplePortraits[0]
const render = (portrait = goose) => renderToStaticMarkup(createElement(PortraitSpectation, {
  portrait,
  titleId: 'menu-title',
  onClose: () => {},
}))
afterEach(() => {
  portraitObjects.delete(goose.id)
})
describe('portrait spectation view', () => {
  test('shows the work’s title, flavor text, creator, year and current room under its own canvas', () => {
    const html = render({
      ...goose,
      interacted: true,
      year: 1924,
    })
    expect(html).toContain('data-testid="portrait-spectation"')
    expect(html).toContain(`data-portrait="${goose.id}"`)
    expect(html).toContain('data-interacted="true"')
    // Its own canvas, above the details, at full strength for a work the player has interacted with.
    const canvas = html.indexOf('data-testid="portrait-spectation-canvas"')
    expect(canvas).toBeGreaterThan(-1)
    expect(html).toContain('data-faded="false"')
    expect(html.slice(canvas)).toContain('<canvas')
    expect(canvas).toBeLessThan(html.indexOf('id="menu-title"'))
    expect(html).toContain('Drag to orbit · Scroll to zoom')
    expect(html).toContain('>Back</span>')
    expect(html).toContain('Reset view')
    for (const value of [goose.title, goose.description, goose.creator, '1924']) {
      expect(html).toContain(value)
    }
    expect(html).toContain('>Creator</dt>')
    expect(html).toContain('>Year</dt>')
    expect(html).toContain('>Current room</dt>')
    // The goose hangs on the Lobby’s north wall.
    expect(html).toContain('data-testid="portrait-spectation-room">Lobby</dd>')
  })
  test('shows a work the player hasn’t interacted with yet with its model faded, and calls a missing year undated', () => {
    const html = render()
    expect(html).toContain('data-interacted="false"')
    expect(html).toContain('data-faded="true"')
    expect(html).toContain('Not interacted with yet')
    // Opening it is what gives its plate away, unlike the grid, which keeps even its title to itself.
    for (const value of [goose.title, goose.description, goose.creator]) {
      expect(html).toContain(value)
    }
    expect(html).toContain('Undated')
  })
  test('says so where a work has no flavor text yet', () => {
    const html = render({
      ...goose,
      description: '',
    })
    expect(html).toContain('No flavor text yet.')
  })
})
describe('a work’s current room', () => {
  test('is the room of the wall a hung work hangs on, wherever its face lies', () => {
    // Even read from out in the Banquet, the goose stays a Lobby work.
    const banquet = slopGallery.room('banquet').spawn.position
    expect(portraitRoom(goose, banquet)?.id).toBe('lobby')
    expect(portraitRoomTitle(goose, banquet)).toBe('Lobby')
    // A hung work whose wall the world doesn’t know falls back to where it lies.
    const astray = {
      ...goose,
      wallId: 'no-such-wall',
    }
    expect(portraitRoom(astray, banquet)?.id).toBe('banquet')
  })
  test('follows a loose work to the room it lies in, and calls the space between fences no room', () => {
    const loose = {
      ...goose,
      hung: false,
      wallId: undefined,
    }
    const oculus = slopGallery.room('oculus').spawn.position
    expect(portraitRoom(loose, oculus)?.id).toBe('oculus')
    expect(portraitRoomTitle(loose, oculus)).toBe('Oculus')
    expect(portraitRoom(loose, [1000, 0, 1000])).toBeUndefined()
    expect(portraitRoomTitle(loose, [1000, 0, 1000])).toBe('Between rooms')
  })
  test('reads where a loose work’s body is now, not where the store last put it', () => {
    const loose = {
      ...goose,
      hung: false,
      wallId: undefined,
    }
    const [x, y, z] = slopGallery.room('banquet').spawn.position
    portraitObjects.set(goose.id, {
      body: {translation: () => ({
        x,
        y,
        z,
      })} as unknown as RapierRigidBody,
      group: {} as Group,
    })
    expect(portraitPosition(loose)).toEqual([x, y, z])
    expect(portraitRoomTitle(loose)).toBe('The Banquet')
  })
})
describe('studio framing', () => {
  test('frames the sphere the framed work turns in, along the view’s tighter side', () => {
    expect(spectationRadius(2, 2, 0)).toBeCloseTo(Math.SQRT2)
    expect(spectationRadius(2, 1, 0.4)).toBeCloseTo(Math.hypot(2, 1, 0.4) / 2)
    // At a field of view of 90° both ways, a sphere of radius 1 fills the view from √2 out.
    expect(spectationDistance(1, 90, 1)).toBeCloseTo(Math.SQRT2)
    // A wider canvas is no tighter, so the vertical field of view still gives the distance.
    expect(spectationDistance(1, 90, 16 / 9)).toBeCloseTo(Math.SQRT2)
    // Half as wide as it is high, its horizontal field of view is the tighter one.
    expect(spectationDistance(1, 90, 0.5)).toBeCloseTo(Math.sqrt(5))
    // Without a usable aspect, the vertical field of view alone frames it.
    expect(spectationDistance(1, 90, 0)).toBeCloseTo(Math.SQRT2)
    expect(spectationDistance(2, 90, 1)).toBeCloseTo(2 * Math.SQRT2)
  })
})
