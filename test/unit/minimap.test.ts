import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterEach, expect, test} from 'bun:test'

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

import Minimap from '#component/GalleryMinimap'
import slopGallery from '#src/worlds/gallery/index.ts'

import createGrabController from '../../src/components/Scene/interaction/grabController.ts'
import {portraitFrame} from '../../src/frames/index.ts'
import {cameraPose, markPortraitInteracted, useGallery} from '../../src/lib/gallery.ts'
import {climbApex} from '../../src/lib/gallery/climb.ts'
import lowerGallery from '../../src/lib/gallery/lowerGallery.ts'
import {isLowerPosition, minimapHeading, minimapPortrait, minimapRooms, minimapViewBox, portraitMarkerMinimumThickness} from '../../src/lib/gallery/minimap.ts'
import portraitObjects from '../../src/lib/gallery/portraitObjects.ts'
import samplePortraits from './fixtures/portraits.ts'

type PortraitObject = Parameters<typeof portraitObjects.set>[1]

/** where the eyes of a player standing on the floor at the height are */
const eye = ([x, floor, z]: Readonly<Vec3>): Vec3 => [x, floor + 1.62, z]
const initial = {...useGallery.getInitialState()}
const pose = {
  position: cameraPose.position,
  direction: cameraPose.direction,
}
afterEach(() => {
  Object.assign(useGallery.getInitialState(), initial)
  Object.assign(cameraPose, pose)
})
test.each([
  [[0, 0, -1], 0],
  [[1, 0, 0], 90],
  [[0, 0, 1], 180],
  [[-1, 0, 0], -90],
  [[0.5, 0.8, -0.5], 45],
] as const)('the red cone projects direction %j to %d degrees', (direction, degrees) => {
  expect(minimapHeading([...direction])).toBeCloseTo(degrees)
})
test('both layers share a scale and frame every room’s drawing', () => {
  const [x, z, width, height] = minimapViewBox.split(' ').map(Number)
  expect(minimapRooms.some(room => room.lower)).toBe(true)
  expect(minimapRooms.some(room => !room.lower)).toBe(true)
  for (const {frame: [roomX, roomZ, roomWidth, roomDepth]} of minimapRooms) {
    expect(roomX).toBeGreaterThan(x)
    expect(roomX + roomWidth).toBeLessThan(x + width)
    expect(roomZ).toBeGreaterThan(z)
    expect(roomZ + roomDepth).toBeLessThan(z + height)
  }
})
test('both layers render every room’s drawing without visible labels, numbers or legends', () => {
  cameraPose.position = [1, 1.6, 2]
  cameraPose.direction = [1, 0, 0]
  const [upper, lower] = [false, true].map(isLower => renderToStaticMarkup(createElement(Minimap, {lower: isLower})))
  const html = upper + lower
  expect(html.match(/<svg\b/gu)).toHaveLength(2 + minimapRooms.length)
  expect(html.match(/viewBox="/gu)).toHaveLength(2 + minimapRooms.length)
  expect(html).not.toContain('Upper level')
  expect(html).not.toContain('Lower level')
  expect(html).not.toMatch(/<(?:button|h[1-6]|text)\b/u)
  expect(html).toContain('translate(1 2) rotate(90)')
  // Every room’s drawing on its own floor, placed at the room’s origin.
  for (const room of minimapRooms) {
    expect((room.lower ? lower : upper).split(`<g data-room="${room.id}" opacity="${room.opacity(initial.room)}" transform="${room.transform}"><svg `)).toHaveLength(2)
  }
  expect(html.match(/<rect[^>]+data-portrait=/gu) ?? []).toHaveLength(initial.portraits.length * 2)
  expect(html).not.toMatch(/<circle[^>]+data-portrait=/u)
  expect(html.match(/data-tone="untouched"/gu) ?? []).toHaveLength(initial.portraits.length * 2)
  const players = html.match(/<path[^>]+aria-label="Your position"[^>]*>/gu)!
  expect(players).toHaveLength(2)
  expect(players.filter(player => player.includes('display="inline"'))).toHaveLength(1)
})
test('both layers render each work as a rectangle of its marker size in its tone', () => {
  const portraits = [
    {
      ...samplePortraits[0],
      id: 'tone-untouched',
    },
    {
      ...samplePortraits[1],
      id: 'tone-interacted',
      interacted: true,
    },
    {
      ...samplePortraits[2],
      id: 'tone-imported',
      imported: true,
      interacted: true,
    },
  ]
  Object.assign(useGallery.getInitialState(), {portraits})
  const html = [false, true].map(isLower => renderToStaticMarkup(createElement(Minimap, {lower: isLower}))).join('')
  for (const tone of ['untouched', 'interacted', 'imported']) {
    expect(html.match(new RegExp(`data-tone="${tone}"`, 'gu')) ?? []).toHaveLength(2)
  }
  const marker = minimapPortrait(portraits[0])
  expect(html).toContain(`width="${marker.width}"`)
  expect(html).toContain(`height="${marker.thickness}"`)
  expect(html).toContain(`x="${-marker.width / 2}"`)
  expect(html).toContain(`y="${-marker.thickness / 2}"`)
  expect(html).toContain(`transform="translate(${marker.center[0]} ${marker.center[1]}) rotate(${marker.angle})"`)
})
test('the room the player stands in shows a little stronger than the others', () => {
  const current = minimapRooms.find(room => room.id === initial.room)!
  const others = minimapRooms.filter(room => room !== current)
  expect(current.opacity(initial.room)).toBeLessThan(1)
  for (const room of others) {
    expect(room.opacity(initial.room)).toBeGreaterThan(0)
    expect(room.opacity(initial.room)).toBeLessThan(current.opacity(initial.room))
    expect(room.opacity(room.id)).toBe(current.opacity(initial.room))
  }
})
test('hanging portraits belong to their wall’s floor even when rooms overlap vertically', () => {
  const portrait = {
    ...samplePortraits[0],
    hung: true,
    wallId: 'oculus-north',
    position: [0, 0.1, -24] as [number, number, number],
  }
  expect(minimapPortrait(portrait).lower).toBe(true)
  expect(minimapPortrait({
    ...portrait,
    wallId: 'lobby-north',
  }).lower).toBe(false)
})
test('the Bastion shows on the lower floor up to the apex of its western hairpin and its climb to the Forge from there on the upper floor', () => {
  const drawings = minimapRooms.filter(room => room.id === 'bastion')
  expect(drawings.map(room => room.lower)).toEqual([true, false])
  const [apexX, apexZ] = climbApex.point
  // In the mouth under the run north, on the hairpin’s west leg and just short of the apex, then just past it, up the east leg and along the run north over the mouth.
  for (const [position, lower] of [
    [[-15, -3.9, -24], true],
    [[-22.3, -3.9, -24], true],
    [[-28.3, -3, -16], true],
    [[apexX - 0.3, -2, apexZ], true],
    [[apexX + 0.3, -1.9, apexZ], false],
    [[-22.3, -0.5, -16], false],
    [[-22.3, 0, -24], false],
    [[-22.3, 0, -30], false],
  ] as const) {
    const at = eye(position)
    expect(slopGallery.roomAt(at)?.id).toBe('bastion')
    expect(isLowerPosition('bastion', at)).toBe(lower)
  }
  expect(isLowerPosition('bastion', eye(slopGallery.room('bastion').spawn.position))).toBe(true)
})
test('portrait markers take their length and depth from the framed work hanging, with a readable thickness out of its back', () => {
  const portrait = {
    ...samplePortraits[8],
    frame: 'barbizon' as const,
    position: [3, 2, -4] as [number, number, number],
    rotation: 0,
  }
  const frame = portraitFrame(portrait.frame)
  const marker = minimapPortrait(portrait)
  expect(marker.width).toBeCloseTo(portrait.width + frame.reach * 2)
  expect(marker.depth).toBeCloseTo(frame.depth)
  expect(marker.thickness).toBe(portraitMarkerMinimumThickness)
  expect(marker.thickness).toBeGreaterThan(marker.depth)
  // Facing south, its back edge stays where the frame’s back lies behind its middle.
  expect(marker.center[0]).toBeCloseTo(portrait.position[0])
  expect(marker.center[1] - marker.thickness / 2).toBeCloseTo(portrait.position[2] + frame.front - frame.depth)
  expect(marker.angle).toBeCloseTo(0)
  expect(marker.tone).toBe('untouched')
})
test.each([
  [0, 0],
  [Math.PI / 2, -90],
  [-Math.PI / 2, 90],
  [Math.PI, -180],
  [Math.PI / 4, -45],
  [-Math.PI / 4, 45],
] as const)('a work hanging at %f radians turns its marker to %d degrees and grows toward where it faces', (rotation, degrees) => {
  const portrait = {
    ...samplePortraits[0],
    position: [1, 2, 2] as [number, number, number],
    rotation,
  }
  const frame = portraitFrame(portrait.frame)
  const marker = minimapPortrait(portrait)
  const out = frame.front - frame.depth + marker.thickness / 2
  expect(marker.angle).toBeCloseTo(degrees)
  expect(marker.center[0]).toBeCloseTo(portrait.position[0] + Math.sin(rotation) * out)
  expect(marker.center[1]).toBeCloseTo(portrait.position[2] + Math.cos(rotation) * out)
})
test('a loose work lying flat keeps its hanging marker size, centered on it and turned with its width', () => {
  const portrait = {
    ...samplePortraits[8],
    hung: false,
    orientation: [-Math.SQRT1_2, 0, 0, Math.SQRT1_2] as [number, number, number, number],
    position: [1, 0.2, 2] as [number, number, number],
    rotation: 0,
    wallId: undefined,
  }
  const hanging = minimapPortrait({
    ...portrait,
    hung: true,
    orientation: undefined,
  })
  const marker = minimapPortrait(portrait)
  expect(marker.width).toBeCloseTo(hanging.width)
  expect(marker.thickness).toBeCloseTo(hanging.thickness)
  expect(marker.angle).toBeCloseTo(0)
  expect(marker.center[0]).toBeCloseTo(portrait.position[0])
  expect(marker.center[1]).toBeCloseTo(portrait.position[2])
})
test.each([
  [{}, 'untouched'],
  [{interacted: true}, 'interacted'],
  [{imported: true}, 'imported'],
  [{
    imported: true,
    interacted: true,
  }, 'imported'],
] as const)('a work that is %j fills its marker as %s', (flags, tone) => {
  expect(minimapPortrait({
    ...samplePortraits[0],
    ...flags,
  }).tone).toBe(tone)
})
test('marking a work interacted changes only that work and only once', () => {
  const previous = {...useGallery.getState()}
  const portrait = {...samplePortraits[0]}
  useGallery.setState({portraits: [portrait]})
  try {
    markPortraitInteracted('prop-orb-spook')
    expect(useGallery.getState().portraits).toEqual([portrait])
    markPortraitInteracted(portrait.id)
    const marked = useGallery.getState().portraits
    expect(marked[0].interacted).toBe(true)
    markPortraitInteracted(portrait.id)
    expect(useGallery.getState().portraits).toBe(marked)
  } finally {
    useGallery.setState(previous)
  }
})
test('grabbing a work marks it interacted, by its name plate too', () => {
  const previous = {...useGallery.getState()}
  const portrait = {...samplePortraits[0]}
  useGallery.setState({
    active: portrait.id,
    activeLabel: portrait.id,
    held: null,
    portraits: [portrait],
    sound: false,
  })
  try {
    createGrabController({} as never, {current: null}).grab()
    expect(useGallery.getState().held).toBe(portrait.id)
    expect(useGallery.getState().portraits[0].interacted).toBe(true)
  } finally {
    useGallery.setState(previous)
  }
})
test('portrait markers follow rigid bodies instead of the positions in the store', () => {
  const portrait = {
    ...samplePortraits[0],
    id: 'minimap-test',
    hung: false,
  }
  const physical: {
    x: number
    y: number
    z: number
  } = {
    x: lowerGallery.oculus.center[0],
    y: lowerGallery.floorY + 1,
    z: lowerGallery.oculus.center[1],
  }
  let turned = {
    x: 0,
    y: 0,
    z: 0,
    w: 1,
  }
  portraitObjects.set(portrait.id, Object.assign(Object.create(null) as PortraitObject, {
    body: {
      translation: () => physical,
      rotation: () => turned,
    },
  }))
  try {
    const frame = portraitFrame(portrait.frame)
    const out = frame.front - frame.depth + portraitMarkerMinimumThickness / 2
    const marker = minimapPortrait(portrait)
    expect(marker.position).toEqual([physical.x, physical.y, physical.z])
    expect(marker.lower).toBe(true)
    expect(marker.angle).toBeCloseTo(0)
    expect(marker.center[0]).toBeCloseTo(physical.x)
    expect(marker.center[1]).toBeCloseTo(physical.z + out)
    expect(marker.width).toBeCloseTo(portrait.width + frame.reach * 2)
    expect(marker.depth).toBeCloseTo(frame.depth)
    expect(marker.thickness).toBe(portraitMarkerMinimumThickness)
    expect(marker.tone).toBe('untouched')
    physical.x = 2
    turned = {
      x: 0,
      y: Math.SQRT1_2,
      z: 0,
      w: Math.SQRT1_2,
    }
    const moved = minimapPortrait(portrait)
    expect(moved.position).toEqual([2, physical.y, physical.z])
    expect(moved.angle).toBeCloseTo(-90)
    expect(moved.center[0]).toBeCloseTo(2 + out)
    expect(moved.center[1]).toBeCloseTo(physical.z)
  } finally {
    portraitObjects.delete(portrait.id)
  }
})
