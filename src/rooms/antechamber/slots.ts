import type {RoomPortraitSlot} from '../base/Room.ts'

import {hangingOffset} from '#src/lib/placement/wallGeometry.ts'

import walls from './walls.ts'

/** rounded to a nanometer, so the slots along the axes don’t stray off them by a rounding error */
const round = (value: number) => Math.round(value * 1e9) / 1e9
/** A slot hanging `y` over the floor on the wall with the id, `u` along it from its middle. */
const slot = (wallId: keyof typeof walls, u: number, y: number, ratio: RoomPortraitSlot['ratio'], area: number): RoomPortraitSlot => {
  const {center: [x, , z], rotation} = walls[wallId]
  return {
    wallId,
    ratio,
    area,
    position: [round(x + Math.cos(rotation) * u + Math.sin(rotation) * hangingOffset), y, round(z - Math.sin(rotation) * u + Math.cos(rotation) * hangingOffset)],
    rotation,
  }
}

export default {
  // Facing the doorway from the Lobby.
  south_0: slot('south', 0, 3, '1:1', 100_000),
  // At the end of the view west through both wings’ doorways from the middle.
  west_wing_west_0: slot('west_wing_west', 0, 2.2, '3:2', 30_000),
  west_wing_north_0: slot('west_wing_north', 0, 2.1, '1:1', 30_000),
  east_wing_north_0: slot('east_wing_north', 0, 2.1, '1:1', 30_000),
  east_wing_south_0: slot('east_wing_south', 0, 2.1, '1:1', 30_000),
  // Down the gallery toward the stairs, three on its west wall and two across from the gaps between them.
  gallery_west_0: slot('gallery_west', 5.5, 2.1, '3:2', 30_000),
  gallery_west_1: slot('gallery_west', 0, 2.1, '3:2', 30_000),
  gallery_west_2: slot('gallery_west', -5.5, 2.1, '3:2', 30_000),
  gallery_east_0: slot('gallery_east', -2.75, 2.1, '1:1', 15_000),
  gallery_east_1: slot('gallery_east', 2.75, 2.1, '1:1', 15_000),
} satisfies Record<string, RoomPortraitSlot>
