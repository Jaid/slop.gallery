import type {FloorSize, Lamp, RoomSpawn, RoomWall} from '../base/Room.ts'
import type CellLayout from './CellLayout.ts'
import type {Vec3} from 'math'
import type {Box3} from 'three/webgpu'

import {Geofence} from 'geofency'

import {cellLedY} from '#src/lib/gallery/CellCeilingGeometry.ts'
import {insideRoundVestibule, roundVestibuleWall} from '#src/lib/gallery/roundVestibule.ts'
import {chandelierLampY} from '#src/lib/physics/chandelier.ts'

import Room from '../base/Room.ts'
import floorBox from '../lib/floorBox.ts'
import footprint from '../lib/footprint.ts'
import {planWall} from '../lib/walls.ts'
import cellBaseboard, {cellBaseboardHeight} from './baseboard.ts'
import cellMap from './map.ts'
import slots from './slots.ts'

/** the lamp under the LED panel in the middle of the vestibule’s ceiling, like the Banquet’s under each of its panes: a white wash fading gently, which throws the shadows of the columns and what they carry, its light this far under the panel */
export const cellLed = {
  strength: 30,
  tint: '#eee3ff',
  decay: 1.5,
  drop: 0.32,
} as const

/** The Sandbox’s one room: a sealed hall with the Arena’s marble underfoot, papered like the Sienna under a gabled ceiling glazed with roof lights, which let in the moon, and the Sienna’s chandelier, laid out around the middle of its floor. Beyond the arch through its north wall, a short passage leads on to a round room where its layout stands a pedestal for every item it holds, upholstered in the Arena’s velvet and lit by an LED panel in the middle of its ceiling, or a door closes the arch while it holds none. */
export default class Cell extends Room {
  override readonly air: Array<Box3>
  override readonly description = 'Nothing in it yet.'
  override readonly fence: Geofence
  /** edge length of the floor’s marble tiles, which run whole from wall to wall */
  readonly floorTile: number
  override readonly height: number
  override readonly id = 'cell'
  override readonly size: FloorSize
  // In front of the south wall, looking north through the arch at the items, or at the door.
  override readonly spawn: RoomSpawn = {
    position: [0, 0.04, 2.5],
    yaw: 0,
    pitch: 0,
  }

  constructor(readonly layout: CellLayout) {
    const {chandelierLift, height, northZ, passage, roundHeight, size, vestibule} = layout
    const lamps: Record<string, Lamp> = {
      // The Sienna’s, below the swinging chandelier’s metalwork at rest, so the fixture can’t shadow its own source; it swings along with it.
      chandelier: {
        position: [0, chandelierLampY + chandelierLift, 0],
        strength: 50,
        tint: '#ffedc4',
        range: 25,
        decay: 1.5,
        shadow: true,
      },
    }
    if (vestibule) {
      const [x, z] = vestibule.center
      lamps.led = {
        position: [x, cellLedY(roundHeight) - cellLed.drop, z],
        strength: cellLed.strength,
        tint: cellLed.tint,
        // Across the whole round room, however large a rotunda grows.
        range: Math.max(8, vestibule.radius * 2),
        decay: cellLed.decay,
        shadow: true,
      }
    }
    // The arch through the north wall opens onto the passage, or a door that stays shut fills it.
    const opening = {
      ...layout.arch,
      u: vestibule?.center[0] ?? 0,
    }
    // Four plain walls, which artworks may hang on, with the Sienna’s baseboard of two plain bands, as low as the round room’s.
    const hall = {baseboardHeight: cellBaseboardHeight}
    const walls: Record<string, RoomWall> = {
      north: planWall(size, 'north', height, {
        ...hall,
        holes: vestibule ? {vestibule: opening} : {door: opening},
      }),
      east: planWall(size, 'east', height, hall),
      south: planWall(size, 'south', height, hall),
      west: planWall(size, 'west', height, hall),
      // The round room’s velvet wall keeps the Arena’s low molded baseboard in black lacquer.
      ...vestibule ? {
        vestibule: {
          ...roundVestibuleWall(vestibule, [0, 0, 0], roundHeight),
          baseboardSection: cellBaseboard,
        },
      } : {},
    }
    super({
      title: 'Cell',
      mood: 'cell',
      frame: ['coffer', 'gilding', 'crate'],
      map: cellMap(layout),
      slots,
      lamps,
      walls,
      // The night sky through the roof lights, and shafts of moonlight faint enough to leave the room dark.
      skybox: 'night',
      volumetricSun: 0.07,
    })
    this.floorTile = layout.floorTile
    this.height = height
    this.size = size
    this.air = [
      // Up to the ridge of its gabled ceiling.
      floorBox(size, 0, layout.ridgeHeight),
      ...vestibule ? [
        floorBox([layout.arch.width, passage], 0, height, [vestibule.center[0], northZ - passage / 2]),
        floorBox([vestibule.radius * 2, vestibule.radius * 2], 0, roundHeight, vestibule.center),
      ] : [],
    ]
    // Its whole floor plan, the passage’s and the round room’s at every height, as they are all there is.
    this.fence = new Geofence(this.air.map(box => footprint([box])))
  }

  /** Whether the position, relative to the room’s origin, lies on the floor of the room, of the passage through its north wall or of the round room beyond, at least `margin` meters from the walls’ center lines. */
  floorContains([x, , z]: Vec3, margin = 0) {
    const {arch, northZ, passage, size: [width, depth], vestibule} = this.layout
    const inRoom = Math.abs(x) <= width / 2 - margin && Math.abs(z) <= depth / 2 - margin
    if (inRoom || !vestibule) {
      return inRoom
    }
    // On through the north wall’s center line into the room and past the plane where the round room’s wall touches the passage, overlapping both.
    const inPassage = Math.abs(x - vestibule.center[0]) <= arch.width / 2 - margin && z <= northZ + margin && z >= northZ - passage - margin
    return inPassage || insideRoundVestibule(vestibule, x, z, margin)
  }
}
