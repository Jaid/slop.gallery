import type bastionFences from '#src/rooms/bastion/fences.ts'
import type corridorFences from '#src/rooms/corridor/fences.ts'
import type lobbyFences from '#src/rooms/lobby/fences.ts'
import type moonfallFences from '#src/rooms/moonfall/fences.ts'
import type {GalleryRoomId as RoomId} from './SlopGallery.ts'

/** the gallery’s horizontal mirror planes: the ground floor, the Lodge’s planks and Moonfall’s ceiling */
export type ReflectionGroup = 'ground' | 'lodge' | 'moonfall'
/** the ids of other rooms’ objects by the room they belong to: per room, the id or ids within it */
export type ForeignIds = Partial<Record<RoomId, ReadonlyArray<string> | string>>
/** the id of a fence of the gallery: a room’s, which is the room’s id, or the global id of one of its other fences, like a part of a room */
export type FenceId = OtherFenceId<'bastion', typeof bastionFences> | OtherFenceId<'corridor', typeof corridorFences> | OtherFenceId<'lobby', typeof lobbyFences> | OtherFenceId<'moonfall', typeof moonfallFences> | RoomId
/** what stays on beyond the objects of the player’s own room while the player is in a fence */
export type Activation = {
  /** other rooms’ ambient sounds that stay audible, because they carry into the fence */
  audibleAmbiences?: ForeignIds
  /** the group that gets the shared planar reflection; omit to leave the selection to the other fences */
  reflectionGroup?: ReflectionGroup
  /** the other rooms whose models stay enabled: the rooms a player can see into from the fence through up to three openings; the frustum still culls them per frame */
  rooms?: ReadonlyArray<RoomId>
  /** other rooms’ lamps that stay on, because they reach into the fence or can be seen from it */
  visibleLamps?: ForeignIds
}
/** the global ids of the other fences of the room, given by their ids within it */
type OtherFenceId<Room extends RoomId, Fences> = `${Room}-${keyof Fences & string}`

/**
 * Per fence, a whitelist of neighbor objects. While the player is in a room, every other room’s models are hidden, its lamps are off and its ambient sounds are silent unless a fence the player is in lists them here: the room’s own, under the room’s id, or any other fence holding the player’s place, like a part of the room.
 * Rooms, lamps and sounds add up across fences. The planar reflection is exclusive: the last fence naming a group wins, so a part of a room can override the room. A fence that adds nothing, like the Lobby’s middle part, is left out.
 * A room’s own models, lamps and ambient sounds are always on inside it. Hiding a model only skips its draws, and switching a lamp off only dims it, so neither recompiles a shader.
 */
const activations = {
  // Moonfall’s stairway stays out of sight: a line through the doorway into the Antechamber and the arch into its lunar hall runs too far askew to pass the doorway onto the stairs.
  lobby: {
    rooms: ['vesper', 'banquet', 'antechamber', 'salon', 'forge', 'oculus', 'sienna', 'exhibition', 'bastion'],
    reflectionGroup: 'ground',
    visibleLamps: {
      // The lamps of the Antechamber’s halls light their walls, seen through the arches off its dome.
      antechamber: ['west', 'east'],
      banquet: [
        'led_north',
        'led_middle',
        'led_south',
      ],
      exhibition: [
        'west_stairway_door',
        'east_stairway_door',
      ],
      sienna: 'chandelier',
    },
  },
  // The lamp at the low north end of the Exhibition’s tunnel, green by default, shines up through the Lobby’s glazed floor, which only its north part lies around.
  'lobby-north': {
    visibleLamps: {
      exhibition: 'tunnel_north',
    },
  },
  vesper: {
    rooms: ['lobby', 'bastion', 'sienna', 'banquet', 'antechamber', 'salon', 'forge', 'corridor', 'oculus'],
    reflectionGroup: 'ground',
    visibleLamps: {
      // Across the Lobby, the lunar hall shows through the Antechamber’s doorway.
      antechamber: ['west', 'east'],
      lobby: [
        'chandelier_north',
        'chandelier_middle',
        'chandelier_south',
      ],
      banquet: [
        'led_north',
        'led_middle',
        'led_south',
      ],
      sienna: 'chandelier',
    },
  },
  banquet: {
    rooms: ['lobby', 'salon', 'forge', 'vesper', 'antechamber', 'oculus'],
    reflectionGroup: 'ground',
    visibleLamps: {
      // Across the Lobby, the solar hall shows through the Antechamber’s doorway.
      antechamber: ['west', 'east'],
      lobby: [
        'chandelier_middle',
        'chandelier_south',
      ],
    },
  },
  antechamber: {
    rooms: ['lobby', 'moonfall', 'vesper', 'banquet', 'salon', 'forge', 'oculus'],
    reflectionGroup: 'ground',
    visibleLamps: {
      lobby: [
        'chandelier_north',
        'chandelier_middle',
        'chandelier_south',
      ],
      banquet: [
        'led_north',
        'led_middle',
        'led_south',
      ],
      moonfall: 'stairs',
    },
  },
  sienna: {
    rooms: ['vesper', 'corridor', 'lobby', 'salon'],
    visibleLamps: {
      lobby: [
        'chandelier_north',
        'chandelier_middle',
        'chandelier_south',
      ],
      // From the landing’s boards and through the vestibule’s arch: the lantern at the top of the flight, and down it the one at its foot.
      corridor: [
        'lantern_landing',
        'lantern_south',
      ],
    },
  },
  salon: {
    rooms: ['banquet', 'lobby', 'forge', 'vesper', 'antechamber', 'oculus', 'sienna', 'exhibition'],
    reflectionGroup: 'ground',
    visibleLamps: {
      banquet: [
        'led_north',
        'led_middle',
        'led_south',
      ],
    },
  },
  forge: {
    // through its window, across the Lobby and through the Salon’s window, as the Salon sees across it the other way
    rooms: ['bastion', 'lobby', 'salon', 'vesper', 'banquet', 'antechamber', 'oculus', 'sienna', 'exhibition'],
    reflectionGroup: 'ground',
  },
  moonfall: {
    rooms: ['antechamber', 'exhibition', 'oculus'],
    reflectionGroup: 'moonfall',
    visibleLamps: {
      // Up the stairs, both halls of the Antechamber lie in line with the doorway onto them.
      antechamber: ['east', 'west'],
      exhibition: [
        'tunnel_north',
        'tunnel_middle',
        'tunnel_south',
      ],
    },
  },
  corridor: {
    // The Sienna’s boards on the landing are the Sienna’s, so the Vesper lies beyond sight from the flight’s head down.
    rooms: ['sienna', 'lodge', 'bastion'],
    visibleLamps: {
      sienna: 'chandelier',
      lodge: 'fire',
    },
  },
  // The Lodge’s planks show through its doorway from the Corridor, and no other floor that mirrors does.
  'corridor-seeing_lodge_floor': {
    reflectionGroup: 'lodge',
  },
  oculus: {
    rooms: ['lobby', 'exhibition', 'bastion', 'salon', 'forge', 'moonfall', 'banquet'],
    visibleLamps: {
      moonfall: [
        'planet_glow',
        'ember',
      ],
      exhibition: [
        'tunnel_north',
        'tunnel_middle',
        'tunnel_south',
        'west_stairway_door',
        'west_stairway_landing',
        'east_stairway_door',
        'east_stairway_landing',
      ],
      bastion: [
        'lantern_north',
        'lantern_elbow',
      ],
    },
  },
  exhibition: {
    rooms: ['oculus', 'moonfall', 'lobby', 'bastion', 'salon', 'forge'],
    reflectionGroup: 'moonfall',
    audibleAmbiences: {
      moonfall: 'orbital_sculpture',
    },
    visibleLamps: {
      banquet: [
        'led_north',
        'led_middle',
        'led_south',
      ],
      moonfall: [
        'wall_east_north',
        'wall_east_south',
        'wall_north_west',
        'wall_north_east',
        'planet_glow',
        'ember',
        'stairs',
      ],
    },
  },
  lodge: {
    rooms: ['bastion', 'corridor', 'oculus'],
    reflectionGroup: 'lodge',
    visibleLamps: {
      corridor: [
        'lantern_north',
        'lantern_middle',
        'lantern_south',
      ],
      bastion: 'lantern_north',
    },
  },
  bastion: {
    rooms: ['oculus', 'lodge', 'lobby', 'exhibition', 'corridor', 'salon', 'forge', 'vesper'],
    visibleLamps: {
      lodge: 'fire',
    },
  },
  // The Lodge’s planks show down the approach, through the Lodge’s east doorway, and through its east window, and no other floor that mirrors does.
  'bastion-seeing_lodge_floor': {
    reflectionGroup: 'lodge',
  },
} satisfies Partial<Record<FenceId, Activation>> & Record<RoomId, Activation>
/** the ids of the fences that keep something on */
const fenceIds = Object.keys(activations) as Array<keyof typeof activations>
/** What the fence with the id keeps on, or undefined for a fence that keeps nothing on, like one of another world. */
const activation = (fence: string): Activation | undefined => (Object.hasOwn(activations, fence) ? activations[fence as keyof typeof activations] : undefined)
/** The global ids of other rooms’ objects, given by the room they belong to. */
const globalIds = (byRoom: ForeignIds = {}) => Object.entries(byRoom).flatMap(([owner, ids = []]) => [ids].flat().map(id => `${owner}-${id}`))

/** The rooms whose models stay enabled while the player is in the fences with the ids, beyond the player’s own room: every room their {@link Activation.rooms} name, each once. */
export function enabledRooms(fences: Iterable<string>): Array<RoomId> {
  return [...new Set(Array.from(fences, fence => activation(fence)?.rooms ?? []).flat())]
}

/** The last group requested by the player’s fences, or undefined to leave the mirror pass off. */
export function reflectionGroup(fences: Iterable<string>): ReflectionGroup | undefined {
  let mirror: ReflectionGroup | undefined
  for (const fence of fences) {
    mirror = activation(fence)?.reflectionGroup ?? mirror
  }
  return mirror
}

/** The global ids of the other rooms’ ambient sounds that stay audible while the player is in the fence, from its {@link Activation.audibleAmbiences}. */
export function audibleAmbiences(fence: string): ReadonlyArray<string> {
  return globalIds(activation(fence)?.audibleAmbiences)
}

/** The fences an ambient sound of the room sounds in, by its global id: its own room’s and every fence whose {@link Activation.audibleAmbiences} lists it. */
export function audibleFences(room: RoomId, ambience: string): ReadonlyArray<FenceId> {
  return [room, ...fenceIds.filter(id => id !== room && audibleAmbiences(id).includes(ambience))]
}

/** The global ids of the other rooms’ lamps that stay on while the player is in the fence, from its {@link Activation.visibleLamps}. */
export function visibleLamps(fence: string): ReadonlyArray<string> {
  return globalIds(activation(fence)?.visibleLamps)
}

/** The fences a lamp of the room stays on in, by its global id: its own room’s and every fence whose {@link Activation.visibleLamps} lists it. */
export function litFences(room: RoomId, lamp: string): ReadonlyArray<FenceId> {
  return [room, ...fenceIds.filter(id => id !== room && visibleLamps(id).includes(lamp))]
}

export default activations
