import type {GalleryRoomId} from '#src/worlds/gallery/index.ts'

import {antechamberEastWing, antechamberHall, antechamberWestWing, antechamberWing, moonfallLandingSouth, moonfallPassage} from './antechamber.ts'
import lobby from './lobby.ts'

export type FloorRectangle = {
  center: readonly [number, number]
  size: readonly [number, number]
}
/** a room whose floor covers its rectangular plan, centered in world x and z */
export type FloorRoom = FloorRectangle & {
  floorY: number
  id: GalleryRoomId
}
export const floorThickness = 0.24
/** a height inside the ground floor’s slab, where the fences of the ground floor’s rooms, which reach up from it, meet those of the rooms below, which reach down from it */
export const groundFenceY = -0.2
export const floorGlassThickness = 0.12
/** edge length of the square floor tiles, measured from each room’s north-west corner */
export const floorTile = 2

// Split slabs and their decoration with the same cut, leaving no invisible floor
// collider or floating grout across an opening. Rectangles never overlap.
export function subtractFloorOpening(rectangle: FloorRectangle, opening?: FloorRectangle): Array<FloorRectangle> {
  if (!opening) {
    return [rectangle]
  }
  const [x, z] = rectangle.center
  const [width, depth] = rectangle.size
  const minX = x - width / 2
  const maxX = x + width / 2
  const minZ = z - depth / 2
  const maxZ = z + depth / 2
  const left = Math.max(minX, opening.center[0] - opening.size[0] / 2)
  const right = Math.min(maxX, opening.center[0] + opening.size[0] / 2)
  const north = Math.max(minZ, opening.center[1] - opening.size[1] / 2)
  const south = Math.min(maxZ, opening.center[1] + opening.size[1] / 2)
  if (left >= right || north >= south) {
    return [rectangle]
  }
  const sections = [
    [minX, maxX, minZ, north],
    [minX, maxX, south, maxZ],
    [minX, left, north, south],
    [right, maxX, north, south],
  ] as const
  return sections.filter(([x1, x2, z1, z2]) => x2 > x1 && z2 > z1).map(([x1, x2, z1, z2]) => ({
    center: [(x1 + x2) / 2, (z1 + z2) / 2],
    size: [x2 - x1, z2 - z1],
  }))
}

export function roomFloorPlan(room: FloorRoom) {
  const opening: FloorRectangle | undefined = room.id === 'lobby' ? {
    center: [lobby.opening.center[0] - room.center[0], lobby.opening.center[1] - room.center[1]],
    size: lobby.opening.size,
  } : undefined
  const cut = (rectangle: FloorRectangle) => subtractFloorOpening(rectangle, opening)
  const extras = room.id === 'antechamber' ? antechamberFloors(room) : []
  const [width, depth] = room.id === 'antechamber' ? antechamberHall.size : room.size
  const seams: Array<FloorRectangle> = [
    ...Array.from({length: Math.floor(width / floorTile) + 1}, (_, i): FloorRectangle => ({
      center: [i * floorTile - width / 2, 0],
      size: [0.012, depth],
    })),
    ...Array.from({length: Math.floor(depth / floorTile) + 1}, (_, i): FloorRectangle => ({
      center: [0, i * floorTile - depth / 2],
      size: [width, 0.012],
    })),
  ]
  const inlays = [-1, 1].flatMap((side): Array<FloorRectangle> => [
    {
      center: [side * (width / 2 - 1.25), 0],
      size: [0.026, depth - 2.5],
    },
    {
      center: [0, side * (depth / 2 - 1.25)],
      size: [width - 2.5, 0.026],
    },
  ])
  return {
    glazing: opening,
    slabs: [{
      center: [0, 0] as const,
      size: [width, depth] as const,
    }, ...extras].flatMap(cut),
    seams: seams.flatMap(cut),
    inlays: inlays.flatMap(cut),
  }
}
/** The Antechamber’s wings and the gallery stairway, as floor rectangles relative to the hall’s middle. */
function antechamberFloors(room: FloorRoom): Array<FloorRectangle> {
  const wing = (center: readonly [number, number]): FloorRectangle => ({
    center: [center[0] - room.center[0], center[1] - room.center[1]],
    size: antechamberWing.size,
  })
  return [wing(antechamberWestWing.center), wing(antechamberEastWing.center), {
    center: [moonfallPassage.west + moonfallPassage.width / 2 - room.center[0], (moonfallPassage.north + moonfallLandingSouth) / 2 - room.center[1]],
    size: [moonfallPassage.width, moonfallLandingSouth - moonfallPassage.north],
  }]
}
