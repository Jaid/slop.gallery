import type {ReactElement, ReactNode} from 'react'

import {expect, test} from 'bun:test'

import {Children, isValidElement} from 'react'
import {Box3} from 'three/webgpu'

import LodgeStranger from '../../src/components/LodgeStranger/index.tsx'
import {lodgeSpur} from '../../src/lib/gallery/bastionNetwork.ts'
import lodge, {lodgeEastWindow} from '../../src/lib/gallery/lodge.ts'
import lodgeInterior from '../../src/lib/gallery/lodgeInterior/layout.ts'
import StrangerGeometry from '../../src/lib/gallery/lodgeInterior/StrangerGeometry.ts'
import UpholsteredSeatGeometry from '../../src/lib/gallery/lodgeInterior/UpholsteredSeatGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import LodgeMaterials from '../../src/lib/materials/LodgeMaterials.ts'
import renderLodgeRoom from '../../src/rooms/lodge/components/LodgeRoom/index.tsx'
import slopGallery from '../../src/worlds/gallery/index.ts'

const {armchairSpread, seatWidth, strangerSeat} = lodgeInterior
const {armHeight, armRollRadius, armWidth, backHeight, depth, seatHeight} = UpholsteredSeatGeometry
const descendants = (node: ReactNode): Array<ReactElement<{children?: ReactNode}>> => Children.toArray(node).flatMap(child => {
  return isValidElement<{children?: ReactNode}>(child) ? [child, ...descendants(child.props.children)] : []
})
test('the stranger sits a meter tall in the armchair, between its arms, his feet on the floor in front of it', () => {
  const stranger = new StrangerGeometry(seatWidth + armchairSpread)
  const seat = new UpholsteredSeatGeometry(1, seatWidth + armchairSpread)
  try {
    const box = new Box3
    for (const part of [stranger.cloth, stranger.skin]) {
      expect(Object.keys(part.attributes).toSorted()).toEqual(['normal', 'position', 'uv'])
      box.union(part.boundingBox!)
    }
    // From the seat cushion under him to the crown of his hat, which stands over everything else of him
    expect(StrangerGeometry.height).toBe(1)
    expect(box.max.y).toBeCloseTo(seatHeight + StrangerGeometry.height, 6)
    expect(stranger.cloth.boundingBox!.max.y).toBeGreaterThan(stranger.skin.boundingBox!.max.y)
    // His head and his shoulders stand over the back of the armchair, which hides the rest of him from behind.
    expect(stranger.skin.boundingBox!.max.y).toBeGreaterThan(backHeight + 0.4)
    // His shoes stand on the floor, in front of the armchair.
    expect(box.min.y).toBeCloseTo(0, 6)
    expect(box.max.z).toBeGreaterThan(depth / 2 + 0.2)
    // He leans against the back cushion without sinking into the frame behind it, and keeps between the outsides of the arms, his hands on their rolls.
    expect(box.min.z).toBeGreaterThan(-depth / 2 + 0.22)
    expect(box.max.x).toBeLessThan(seat.width / 2)
    expect(box.min.x).toBeCloseTo(-box.max.x, 6)
    expect(stranger.skin.boundingBox!.max.x).toBeGreaterThan((seatWidth + armchairSpread) / 2)
    expect(stranger.skin.boundingBox!.min.y).toBeGreaterThan(armHeight + armRollRadius * 0.7)
    expect(stranger.skin.boundingBox!.max.x).toBeLessThan((seatWidth + armchairSpread) / 2 + armWidth)
    // A figure only ever seen from afar
    expect(triangleCount(stranger.cloth) + triangleCount(stranger.skin)).toBeLessThan(12_000)
  } finally {
    stranger.dispose()
    seat.dispose()
  }
})
test('a seat’s cushions lie where whoever sits on them finds them', () => {
  const seat = new UpholsteredSeatGeometry(1)
  try {
    expect(seatHeight).toBe(0.49)
    expect(seat.leather.boundingBox!.max.y).toBeCloseTo(backHeight, 6)
    expect(seat.leather.boundingBox!.max.x).toBeCloseTo(seat.width / 2 + UpholsteredSeatGeometry.armRollOffset + armRollRadius - armWidth / 2, 6)
  } finally {
    seat.dispose()
  }
})
test('the stranger’s armchair stands in front of the Lodge’s east window, its back to it, where the knight’s alley sees his hat over the sill', () => {
  const [x, , z] = strangerSeat.position
  const seat = [lodge.center[0] + x, lodge.center[1] + z] as const
  // In front of the window, inside the room, and facing away from it: the window is in the east wall.
  expect(Math.abs(seat[1] - lodgeEastWindow.z)).toBeLessThan(lodgeEastWindow.width / 2)
  expect(seat[0]).toBeLessThan(lodgeEastWindow.x - 1)
  expect(Math.sin(strangerSeat.yaw)).toBeLessThan(-0.7)
  // A player standing in the middle of the alley in front of the window looks through it, over its sill, at the crown of his hat and the middle of his head.
  const eye = [lodgeSpur.route.start[0], lodge.floorY + 1.6, lodgeEastWindow.z] as const
  expect(slopGallery.geofences.getMatches([eye[0], eye[1] - 0.7, eye[2]])).toContain('knight_alley')
  for (const height of [seatHeight + StrangerGeometry.height - 0.02, seatHeight + StrangerGeometry.height - 0.22]) {
    const target = [seat[0], lodge.floorY + height, seat[1]] as const
    const share = (lodgeEastWindow.x - eye[0]) / (target[0] - eye[0])
    const y = eye[1] + (target[1] - eye[1]) * share
    const acrossZ = eye[2] + (target[2] - eye[2]) * share
    expect(share).toBeGreaterThan(0)
    expect(share).toBeLessThan(1)
    expect(y).toBeGreaterThan(lodgeEastWindow.bottom)
    expect(y).toBeLessThan(lodgeEastWindow.top)
    expect(Math.abs(acrossZ - lodgeEastWindow.z)).toBeLessThan(lodgeEastWindow.width / 2)
  }
})
test('the Lodge keeps a place for the stranger, who decides himself when he is there', () => {
  const materials = new LodgeMaterials
  try {
    // The room itself renders the same whether he is there or not.
    expect(descendants(renderLodgeRoom({materials})).filter(child => child.type === LodgeStranger)).toHaveLength(1)
  } finally {
    materials.dispose()
  }
})
