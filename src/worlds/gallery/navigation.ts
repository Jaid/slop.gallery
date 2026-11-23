import type {Vec3} from '#src/lib/gallery/types.ts'
import type PlacedRoom from '../base/PlacedRoom.ts'
import type {GalleryRoom} from './SlopGallery.ts'

import {antechamberStairFloor, insideAntechamberStairs, stairHallFloor, stairHallHeight} from '#src/lib/gallery/antechamber.ts'
import {bastionFloors, insideBastion} from '#src/lib/gallery/bastionNetwork.ts'
import {corridorLanding, corridorPassage, corridorStairFloor, insideCorridor} from '#src/lib/gallery/corridor.ts'
import {floorThickness} from '#src/lib/gallery/floors.ts'
import {forgeVestibule} from '#src/lib/gallery/forge.ts'
import {forgeVestibuleFloor} from '#src/lib/gallery/forgeVestibule.ts'
import {insideLodgeWindow, lodgeBayFloor, lodgeWindowFloor} from '#src/lib/gallery/lodge.ts'
import {rampFloorHeight, tunnelContains, tunnelFloorHeight} from '#src/lib/gallery/lowerGallery.ts'
import {ceilingSlab} from '#src/lib/gallery/moonfall/config.ts'
import {craterTerrain} from '#src/lib/gallery/moonfall/CraterTerrain.ts'
import {insideApse, platformFloorHeight} from '#src/lib/gallery/oculusApse.ts'
import {balconyFloorHeight} from '#src/lib/gallery/oculusBalcony.ts'
import {towerFloorHeight} from '#src/lib/gallery/oculusTower.ts'
import {siennaVestibule, siennaVestibuleFloor} from '#src/lib/gallery/sienna.ts'
import {insideStairway, stairFloorHeight} from '#src/lib/gallery/staircase.ts'
import {displayFloorHeight, insideTunnelDisplay} from '#src/lib/gallery/tunnelDisplays.ts'

type Hall = PlacedRoom<GalleryRoom> & {size: NonNullable<GalleryRoom['size']>}

/** how high the rooms’ vestibules beyond their floor plans reach: the Sienna’s under its lower ceiling, the Forge’s up to the hub of its hood */
const annexCeilings: Partial<Record<Hall['id'], number>> = {
  sienna: siennaVestibule.height,
  forge: forgeVestibule.crown,
}
// Tunnel containment and floor height are provided by lowerGallery.
const inPlan = ({center, size}: Hall, x: number, z: number) => Math.abs(x - center[0]) <= size[0] / 2 && Math.abs(z - center[1]) <= size[1] / 2
/** how far under a floor a point still lies on it: through the ground floor’s slab and the ceiling slab of a room under it, like Moonfall’s or the Oculus’, right under which that room’s air begins */
const underFloor = floorThickness + ceilingSlab.thickness
/** The ground under the point in the room: its floor, or Moonfall’s crater where it dips below. */
const groundOf = (room: Hall, x: number, z: number) => room.floorY + (room.id === 'moonfall' ? craterTerrain.height(x - room.center[0], z - room.center[1]) : 0)

/**
 * How the gallery’s rooms, stairways and passages hold a player or an artwork: where they may be and how high the floor under them lies.
 * Rooms around a rectangular floor plan hold everything over it from a meter under their floor, or Moonfall’s crater, to 20 cm over their highest ceiling; the rest has a shape of its own.
 */
export default class GalleryNavigation {
  private readonly halls: ReadonlyArray<Hall>

  constructor(rooms: ReadonlyArray<PlacedRoom<GalleryRoom>>) {
    this.halls = rooms.filter((room): room is Hall => room.size !== undefined)
  }

  /** Whether the position lies anywhere a player or an artwork may be. */
  contains(position: Vec3) {
    return position.every(Number.isFinite) && (this.halls.some(room => this.hallContains(room, position)) || insideAntechamberStairs(position) || insideStairway(position) || tunnelContains(position) || insideTunnelDisplay(position) || insideLodgeWindow(position) || insideBastion(position))
  }

  /**
   * The height of the walkable floor under the position: the highest nearby floor below it rather than the first one found, which also catches loose objects slightly below a slab of stacked rooms, though not those in the air of the room under the slab.
   */
  floorHeight([x, y, z]: Vec3) {
    const floors = [
      ...this.halls.filter(room => inPlan(room, x, z)).map(room => groundOf(room, x, z)),
      stairHallFloor(x, z),
      antechamberStairFloor(x, z),
      ...bastionFloors(x, z),
      corridorPassage.floorAt(x, z),
      corridorLanding.floorAt(x, z),
      siennaVestibuleFloor(x, z),
      forgeVestibuleFloor(x, z),
      platformFloorHeight(x, z),
      tunnelFloorHeight(x, z),
      lodgeWindowFloor(x, z),
      lodgeBayFloor(x, z),
      corridorStairFloor(x, z),
      balconyFloorHeight(x, z),
      towerFloorHeight(x, z),
      stairFloorHeight(x, z),
      rampFloorHeight(x, z),
      displayFloorHeight(x, z),
    ].filter(height => height !== undefined).toSorted((a, b) => b - a)
    return floors.find(height => y >= height - underFloor) ?? floors.at(-1) ?? 0
  }

  private hallContains(room: Hall, position: Vec3) {
    if (room.id === 'corridor') {
      return insideCorridor(position)
    }
    const [x, y, z] = position
    const main = inPlan(room, x, z)
    // The Antechamber’s halls beyond its floor plan, up to just over their flat ceilings.
    if (!main && room.id === 'antechamber' && stairHallFloor(x, z) !== undefined) {
      return y >= room.floorY - 1 && y <= stairHallHeight + 0.2
    }
    const ground = Math.min(room.floorY, groundOf(room, x, z))
    // Up to the top of its box, the vault’s or the dome’s crown or the Forge’s ridges included, and beyond its floor plan up to its vestibule’s own ceiling where it has one.
    const ceiling = main ? room.air[0].max.y : annexCeilings[room.id] ?? room.air[0].max.y
    return y >= ground - 1 && y <= ceiling + 0.2 && (main || room.id === 'lodge' && lodgeBayFloor(x, z) !== undefined || room.id === 'sienna' && siennaVestibuleFloor(x, z) !== undefined || room.id === 'forge' && forgeVestibuleFloor(x, z) !== undefined || room.id === 'oculus' && insideApse(x, z))
  }
}
