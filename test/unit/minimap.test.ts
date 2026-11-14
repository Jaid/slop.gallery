import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterEach, expect, spyOn, test} from 'bun:test'

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {PerspectiveCamera} from 'three/webgpu'

import Minimap from '#component/GalleryMinimap'
import {frameBack} from '#src/frames/base/PortraitFrame.ts'
import {portraitFrame} from '#src/frames/index.ts'
import SoundEngine from '#src/lib/audio/SoundEngine.ts'
import {narrate} from '#src/lib/gallery/actions.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

import createGrabController from '../../src/components/Scene/interaction/grabController.ts'
import {cameraPose, useGallery} from '../../src/lib/gallery.ts'
import {climbApex} from '../../src/lib/gallery/climb.ts'
import lowerGallery from '../../src/lib/gallery/lowerGallery.ts'
import {isLowerPosition, minimapHeading, minimapPortrait, minimapPortraitDepth, minimapRooms, minimapViewBox} from '../../src/lib/gallery/minimap.ts'
import portraitObjects from '../../src/lib/gallery/portraitObjects.ts'
import samplePortraits from './fixtures/portraits.ts'

import minimapCss from '../../src/components/GalleryMinimap/style.module.sass'

type PortraitObject = Parameters<typeof portraitObjects.set>[1]

/** where the eyes of a player standing on the floor at the height are */
const eye = ([x, floor, z]: Readonly<Vec3>): Vec3 => [x, floor + 1.62, z]
const initial = {
  ...useGallery.getInitialState(),
  interacted: new Set(useGallery.getInitialState().interacted),
}
const pose = {
  position: cameraPose.position,
  direction: cameraPose.direction,
}
afterEach(() => {
  Object.assign(useGallery.getInitialState(), {
    ...initial,
    interacted: new Set(initial.interacted),
  })
  useGallery.setState({
    ...initial,
    interacted: new Set(initial.interacted),
  })
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
test('both layers render every room’s drawing and rectangular portrait markers without visible labels, numbers or legends', () => {
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
  expect(html).not.toMatch(/<circle[^>]+data-portrait=/gu)
  const players = html.match(/<path[^>]+aria-label="Your position"[^>]*>/gu)!
  expect(players).toHaveLength(2)
  expect(players.filter(player => player.includes('display="inline"'))).toHaveLength(1)
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
test('hanging portrait markers match the frame’s width, back offset and wall angle', () => {
  const portrait = {
    ...samplePortraits[0],
    hung: true,
    width: 2.4,
    height: 1.6,
    frame: 'louis' as const,
    rotation: -Math.PI / 4,
    wallId: 'lodge-northeast',
    position: [-21.5, -3, -41.2] as [number, number, number],
  }
  const frame = portraitFrame(portrait.frame)
  const marker = minimapPortrait(portrait)
  expect(marker.width).toBeCloseTo(2.4 + frame.reach * 2, 9)
  expect(marker.depth).toBe(Math.max(frame.depth, minimapPortraitDepth))
  expect(marker.y).toBe(frameBack)
  expect(marker.angle).toBeCloseTo(45, 9)
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
test('portrait rectangles follow rigid body position and yaw instead of the store', () => {
  const portrait = {
    ...samplePortraits[0],
    id: 'minimap-test',
    hung: false,
  }
  const frame = portraitFrame(portrait.frame)
  const physical: {
    x: number
    y: number
    z: number
  } = {
    x: lowerGallery.oculus.center[0],
    y: lowerGallery.floorY + 1,
    z: lowerGallery.oculus.center[1],
  }
  const yaw = Math.PI / 3
  const orientation = {
    x: 0,
    y: Math.sin(yaw / 2),
    z: 0,
    w: Math.cos(yaw / 2),
  }
  portraitObjects.set(portrait.id, Object.assign(Object.create(null) as PortraitObject, {
    body: {
      translation: () => physical,
      rotation: () => orientation,
    },
  }))
  try {
    const marker = minimapPortrait(portrait)
    expect(marker.position).toEqual([physical.x, physical.y, physical.z])
    expect(marker.lower).toBe(true)
    expect(marker.width).toBeCloseTo(portrait.width + frame.reach * 2, 9)
    expect(marker.depth).toBe(Math.max(frame.depth, minimapPortraitDepth))
    expect(marker.y).toBe(-marker.depth / 2)
    expect(marker.angle).toBeCloseTo(-60, 9)
    physical.x = 2
    orientation.y = 0
    orientation.w = 1
    const moved = minimapPortrait(portrait)
    expect(moved.position).toEqual([2, physical.y, physical.z])
    expect(moved.angle).toBeCloseTo(0, 9)
  } finally {
    portraitObjects.delete(portrait.id)
  }
})
test('portrait markers distinguish untouched, interacted and imported works', () => {
  const untouched = {
    ...samplePortraits[0],
    id: 'untouched',
    hung: true,
    wallId: 'lobby-north',
  }
  const interacted = {
    ...samplePortraits[0],
    id: 'interacted',
    hung: true,
    wallId: 'lobby-south',
  }
  const imported = {
    ...samplePortraits[1],
    id: 'imported',
    hung: true,
    imported: true,
    wallId: 'lobby-east',
  }
  Object.assign(useGallery.getInitialState(), {
    portraits: [untouched, interacted, imported],
    interacted: new Set([interacted.id, imported.id]),
  })
  const html = renderToStaticMarkup(createElement(Minimap, {lower: false}))
  const rect = (id: string) => {
    const pattern = new RegExp(`<rect[^>]*data-portrait="${id}"[^>]*>`, 'u')
    return pattern.exec(html)?.[0]
  }
  expect(rect('untouched')).not.toContain(minimapCss.interacted)
  expect(rect('untouched')).not.toContain(minimapCss.imported)
  expect(rect('interacted')).toContain(`class="${minimapCss.interacted}"`)
  // Imports stay green even after interaction.
  expect(rect('imported')).toContain(`class="${minimapCss.imported}"`)
  expect(rect('imported')).not.toContain(minimapCss.interacted)
})
test('listening to or grabbing a portrait marks it interacted while non-portraits are ignored', () => {
  const [first, second] = samplePortraits
  useGallery.setState({portraits: [first, second]})
  const soundSpy = spyOn(SoundEngine, 'get').mockReturnValue({resume: async () => {}} as unknown as SoundEngine)
  try {
    narrate('__intro')
    expect(useGallery.getState().interacted.size).toBe(0)
    narrate(first.id)
    expect([...useGallery.getState().interacted]).toEqual([first.id])
    const controller = createGrabController(new PerspectiveCamera, {current: null})
    useGallery.setState({
      active: second.id,
      held: null,
    })
    controller.grab()
    expect(useGallery.getState().interacted.has(second.id)).toBe(true)
    controller.cancel()
  } finally {
    soundSpy.mockRestore()
  }
})
