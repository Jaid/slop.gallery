import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterEach, expect, test} from 'bun:test'

import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {Vector3} from 'three/webgpu'

import Minimap from '#component/GalleryMinimap'
import {frames} from '#src/frames/index.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

import {cameraPose, useGallery} from '../../src/lib/gallery.ts'
import {climbApex} from '../../src/lib/gallery/climb.ts'
import lowerGallery from '../../src/lib/gallery/lowerGallery.ts'
import {isLowerPosition, minimapHeading, minimapPortrait, minimapPortraitFootprint, minimapPortraitStatus, minimapRooms, minimapViewBox} from '../../src/lib/gallery/minimap.ts'
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
  expect(html.match(/data-portrait=/gu) ?? []).toHaveLength(initial.portraits.length * 2)
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
test('portrait rectangles follow rigid bodies instead of the positions in the store', () => {
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
  portraitObjects.set(portrait.id, Object.assign(Object.create(null) as PortraitObject, {body: {translation: () => physical}}))
  try {
    expect(minimapPortrait(portrait)).toMatchObject({
      position: [physical.x, physical.y, physical.z],
      lower: true,
    })
    physical.x = 2
    expect(minimapPortrait(portrait).position).toEqual([2, physical.y, physical.z])
  } finally {
    portraitObjects.delete(portrait.id)
  }
})
// Use the mesh, not the clearance envelope: some frames have asymmetric ornaments or a shallower actual front.
test.each(Object.entries(frames))('%s portrait footprint matches the actual hanging mesh, including its frame', (frame, model) => {
  for (const [width, height] of [[0.65, 1.3], [2.7, 1.1]]) {
    const geometry = model.createGeometry(width, height)
    try {
      geometry.computeBoundingBox()
      const {min, max} = geometry.boundingBox!
      expect(minimapPortraitFootprint({
        width,
        height,
        frame: frame as keyof typeof frames,
      })).toEqual({
        x: min.x,
        y: min.z,
        width: max.x - min.x,
        height: max.z - min.z,
      })
    } finally {
      geometry.dispose()
    }
  }
})
test.each([0, Math.PI / 2, -Math.PI / 2, Math.PI, 0.72])('portrait footprint follows the mesh’s yaw %d, offset from its pivot', rotation => {
  const portrait = {
    ...samplePortraits[0],
    rotation,
  }
  const {x, y, width, height} = minimapPortraitFootprint(portrait)
  const marker = minimapPortrait(portrait)
  expect(marker.transform).toBe(`translate(${portrait.position[0]} ${portrait.position[2]}) rotate(${-rotation * 180 / Math.PI})`)
  const angle = Number(/rotate\(([^)]+)\)/u.exec(marker.transform)![1]) * Math.PI / 180
  for (const [dx, dz] of [[x, y], [x + width, y + height]]) {
    const actual = new Vector3(dx, 0, dz)
    actual.applyAxisAngle(new Vector3(0, 1, 0), rotation).add(new Vector3(...portrait.position))
    expect(portrait.position[0] + dx * Math.cos(angle) - dz * Math.sin(angle)).toBeCloseTo(actual.x, 8)
    expect(portrait.position[2] + dx * Math.sin(angle) + dz * Math.cos(angle)).toBeCloseTo(actual.z, 8)
  }
})
test('imports take precedence over interaction, and loose works retain their hanging footprint', () => {
  const portrait = samplePortraits[0]
  expect(minimapPortraitStatus(portrait)).toBe('unvisited')
  expect(minimapPortraitStatus({
    ...portrait,
    interacted: true,
  })).toBe('interacted')
  expect(minimapPortraitStatus({
    ...portrait,
    imported: true,
  })).toBe('imported')
  expect(minimapPortraitStatus({
    ...portrait,
    imported: true,
    interacted: true,
  })).toBe('imported')
  const loose = {
    ...portrait,
    hung: false,
    orientation: [0.7, 0, 0, 0.7] as const,
  }
  expect(minimapPortraitFootprint(loose)).toEqual(minimapPortraitFootprint(portrait))
})
test('the map renders dimensioned rectangles with the status of their work and hides reserved works', () => {
  const portraits = [
    {
      ...samplePortraits[0],
      id: 'new',
    },
    {
      ...samplePortraits[0],
      id: 'seen',
      interacted: true,
    },
    {
      ...samplePortraits[0],
      id: 'import',
      imported: true,
      interacted: true,
    },
    {
      ...samplePortraits[0],
      id: 'reserved',
      reserved: true,
    },
  ]
  Object.assign(useGallery.getInitialState(), {portraits})
  const html = renderToStaticMarkup(createElement(Minimap, {lower: false}))
  const markers = html.match(/<g[^>]+data-portrait=[^>]+>.*?<\/g>/gu)!
  expect(markers).toHaveLength(portraits.length)
  for (const [index, portrait] of portraits.entries()) {
    const marker = markers[index]
    // The colored rectangle and its outline share the exact footprint.
    expect(marker.match(/<rect\b/gu)).toHaveLength(2)
    for (const [key, value] of Object.entries(minimapPortraitFootprint(portrait))) {
      expect(marker).toContain(`${key}="${value}"`)
    }
    expect(marker).toContain(`data-status="${minimapPortraitStatus(portrait)}"`)
    expect(marker).toContain(`display="${portrait.reserved ? 'none' : 'inline'}"`)
    expect(marker).toContain(`transform="${minimapPortrait(portrait).transform}"`)
  }
})
