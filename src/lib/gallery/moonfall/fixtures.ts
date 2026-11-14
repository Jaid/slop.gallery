import type {Vec3} from '../types.ts'

import walls from '#src/rooms/moonfall/walls.ts'

import {defaultBaseboardHeight, wallFace, wallOpeningTrim} from '../architectureDimensions.ts'

export type MoonfallWallLed = {
  /** the id of its lamp in the room */
  id: string
  /** the unit direction out of the wall into the room */
  inward: readonly [number, number]
  /** the middle of its housing, room-local */
  position: Vec3
  /** its wall’s rotation, which turns the housing’s local +z out into the room */
  rotation: number
  wall: LedWall
}
type LedWall = 'east' | 'north' | 'west'

/** the housing of every wall LED: its extent along the wall, up it and out of it */
export const wallLedHousing = {
  width: 0.25,
  height: 2.8,
  depth: 0.14,
}

/** A housing at `u` along the wall from its center, `y` over the floor, its rear face meeting the wall rather than hovering in front of it. */
function wallLed(id: string, wall: LedWall, u: number, y: number): MoonfallWallLed {
  const {center: [x, , z], rotation} = walls[wall]
  const inward = [Math.sin(rotation), Math.cos(rotation)] as const
  const out = wallFace + wallLedHousing.depth / 2
  return {
    id,
    wall,
    position: [x + Math.cos(rotation) * u + inward[0] * out, y, z - Math.sin(rotation) * u + inward[1] * out],
    rotation,
    inward,
  }
}
/** A pair flanking an opening, the one before it along the wall first, each as far from the casing’s side as from the casing’s top and the baseboard. */
function flankingLeds(wall: LedWall, hole: string, [beforeId, afterId]: readonly [string, string]) {
  const {u, width, height} = walls[wall].holes![hole]
  const padding = (height + wallOpeningTrim - defaultBaseboardHeight - wallLedHousing.height) / 2
  const y = defaultBaseboardHeight + padding + wallLedHousing.height / 2
  const reach = width / 2 + wallOpeningTrim + padding + wallLedHousing.width / 2
  return [wallLed(beforeId, wall, u - reach, y), wallLed(afterId, wall, u + reach, y)]
}
/** Four down the west wall, leaving its middle dark, and a pair flanking each of the openings, the stair door in the east wall and the Exhibition’s tunnel in the north wall. */
const moonfallWallLeds: ReadonlyArray<MoonfallWallLed> = [
  ...[10, 5, -5, -10].map((u, index) => wallLed(`wall_west_${index + 1}`, 'west', u, 2.2)),
  ...flankingLeds('east', 'stairway', ['wall_east_north', 'wall_east_south']),
  ...flankingLeds('north', 'exhibition', ['wall_north_west', 'wall_north_east']),
]

export default moonfallWallLeds
