import type {RoomMap} from '#src/rooms/index.ts'
import type {Portrait, Quat, Vec3} from './types.ts'

import {portraitFrame} from '#src/frames/index.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

import portraitObjects, {portraitPosition} from './portraitObjects.ts'

/** Whether a position in the room with the id, like the player’s, shows on the lower floor of the map. */
export const isLowerPosition = (id: string, position: Vec3) => slopGallery.isLowerFloor(slopGallery.roomById(id), position)
export const minimapHeading = ([x, , z]: Vec3) => Math.atan2(x, -z) * 180 / Math.PI

/** how a work’s marker is filled: an imported work’s own tone, otherwise dark once the player interacted with it and light while it is still untouched */
export type MinimapPortraitTone = 'imported' | 'interacted' | 'untouched'
/** How thick a work’s marker is at least, in meters: a hung frame is only a few centimeters deep, which the marker’s 0.25 m border would cover whole, leaving none of its fill to see; 0.8 m leaves 0.55 m of it between the borders. */
export const portraitMarkerMinimumThickness = 0.8

/**
 * A work’s marker on the map: a rectangle as long as the framed work is wide while hanging and as thick as its frame is deep, turned with its width, its back where the frame’s back lies.
 * Its thickness is at least {@link portraitMarkerMinimumThickness} and grows out of its back toward where it faces, so its fill stays visible inside its border; a loose work keeps its hanging size and turns with the plan view of its width instead of swelling to its face where it lies flat.
 */
export function minimapPortrait(portrait: Portrait) {
  const position = portraitPosition(portrait)
  const turned = portraitObjects.get(portrait.id)?.body.rotation()
  const [qx, qy, qz, qw]: Quat = turned ? [turned.x, turned.y, turned.z, turned.w] : portrait.orientation ?? [0, Math.sin(portrait.rotation / 2), 0, Math.cos(portrait.rotation / 2)]
  // The work’s width and the way it faces, laid flat on the map: the x and z of its own x and z axes.
  const across: readonly [number, number] = [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qz - qy * qw)]
  const facing: readonly [number, number] = [2 * (qx * qz + qy * qw), 1 - 2 * (qx * qx + qy * qy)]
  const frame = portraitFrame(portrait.frame)
  const depth = frame.depth
  const thickness = Math.max(depth, portraitMarkerMinimumThickness)
  const out = frame.front - depth + thickness / 2
  const tone: MinimapPortraitTone = portrait.imported ? 'imported' : (portrait.interacted ? 'interacted' : 'untouched')
  return {
    position,
    lower: slopGallery.isLowerFloor(slopGallery.portraitRoom(portrait, position), position),
    angle: Math.hypot(...across) > 1e-9 ? Math.atan2(across[1], across[0]) * 180 / Math.PI : -portrait.rotation * 180 / Math.PI,
    center: [position[0] + facing[0] * out, position[2] + facing[1] * out] as const,
    width: portrait.width + frame.reach * 2,
    depth,
    thickness,
    tone,
  }
}

/** Every drawing of a room’s floor plan, its own and the part on the floor above where it climbs there, each stitched to the others’ by placing it at the room’s origin. */
export const minimapRooms = slopGallery.rooms.flatMap(room => {
  const {id, center: [x, z], floorY, map, upperMap} = room
  const drawing = (part: RoomMap, lower: boolean) => ({
    id,
    lower,
    frame: part.placedFrame([x, z]),
    markup: part.markup,
    /** how opaque the world draws the room while the player is in the room with the id `current` */
    opacity: (current: string) => slopGallery.mapOpacity(room, current),
    transform: `translate(${x} ${z})`,
  })
  return [map && drawing(map, floorY < 0), upperMap && drawing(upperMap.map, false)].filter(drawn => drawn !== undefined)
})

// Both floors share one frame around every room’s, so they keep one scale and stay aligned.
const frames = minimapRooms.map(room => room.frame)
const minX = Math.min(...frames.map(([x]) => x)) - 3
const minZ = Math.min(...frames.map(([, z]) => z)) - 3
export const minimapViewBox = [minX, minZ, Math.max(...frames.map(([x, , width]) => x + width)) + 3 - minX, Math.max(...frames.map(([, z, , depth]) => z + depth)) + 3 - minZ].join(' ')
