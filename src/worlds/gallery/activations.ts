import type bastionFences from '#src/rooms/bastion/fences.ts'
import type corridorFences from '#src/rooms/corridor/fences.ts'
import type lobbyFences from '#src/rooms/lobby/fences.ts'
import type moonfallFences from '#src/rooms/moonfall/fences.ts'
import type {GalleryRoomId as RoomId} from './SlopGallery.ts'

/** the floor mirrors of the gallery: one for the floors of the ground level and one for the Moonfall’s slate */
export type FloorMirror = 'base' | 'moonfall'
/** the ids of other rooms’ objects by the room they belong to: per room, the id or ids within it */
export type ForeignIds = Partial<Record<RoomId, ReadonlyArray<string> | string>>
/** the id of a fence of the gallery: a room’s, which is the room’s id, or the global id of one of its other fences, like a part of a room */
export type FenceId = OtherFenceId<'bastion', typeof bastionFences> | OtherFenceId<'corridor', typeof corridorFences> | OtherFenceId<'lobby', typeof lobbyFences> | OtherFenceId<'moonfall', typeof moonfallFences> | RoomId
/** what stays on beyond the objects of the player’s own room while the player is in a fence */
export type Activation = {
  /** other rooms’ ambient sounds that stay audible, because they carry into the fence */
  audibleAmbiences?: ForeignIds
  /** the floor mirror to render, none if left out */
  floorMirror?: FloorMirror
  /** the other rooms whose models stay enabled: the rooms a player can see into from the fence through up to three openings; the frustum still culls them per frame */
  rooms?: ReadonlyArray<RoomId>
  /** other rooms’ lamps that stay on, because they reach into the fence or can be seen from it */
  visibleLamps?: ForeignIds
}
/** the global ids of the other fences of the room, given by their ids within it */
type OtherFenceId<Room extends RoomId, Fences> = `${Room}-${keyof Fences & string}`

/**
 * Per fence, a whitelist of neighbor objects. While the player is in a room, every other room’s models are hidden, its lamps are off and its ambient sounds are silent unless a fence the player is in lists them here: the room’s own, under the room’s id, or any other fence holding the player’s place, like a part of the room.
 * Whatever any of those fences lists is on, so a part of a room adds to what the room lists, and what only shows or shines in a part of a room is only on there. A fence that adds nothing, like the Lobby’s middle part, is left out.
 * A room’s own models, lamps and ambient sounds are always on inside it. Hiding a model only skips its draws, and switching a lamp off only dims it, so neither recompiles a shader.
 */
const activations = {
  lobby: {
    rooms: ['vesper', 'banquet', 'antechamber', 'salon', 'forge', 'oculus', 'sienna', 'exhibition', 'bastion'],
    floorMirror: 'base',
    visibleLamps: {
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
  // Moonfall’s stairway shows through the doorway into the Antechamber and on through the one in the Antechamber’s east wall. From the west of the Lobby’s middle part, a sliver of it still does, which shows the void until the Antechamber hides the stairway.
  'lobby-south': {
    rooms: ['moonfall'],
  },
  vesper: {
    rooms: ['lobby', 'bastion', 'sienna', 'banquet', 'antechamber', 'salon', 'forge', 'corridor', 'oculus'],
    floorMirror: 'base',
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
      sienna: 'chandelier',
    },
  },
  banquet: {
    rooms: ['lobby', 'salon', 'forge', 'vesper', 'antechamber', 'oculus'],
    floorMirror: 'base',
    visibleLamps: {
      lobby: [
        'chandelier_middle',
        'chandelier_south',
      ],
    },
  },
  antechamber: {
    rooms: ['lobby', 'moonfall', 'vesper', 'banquet', 'salon', 'forge', 'oculus'],
    floorMirror: 'base',
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
    floorMirror: 'base',
    visibleLamps: {
      banquet: [
        'led_north',
        'led_middle',
        'led_south',
      ],
    },
  },
  forge: {
    // Through its window, across the Lobby and through the Salon’s window, as the Salon sees across it the other way
    rooms: ['bastion', 'lobby', 'salon', 'vesper', 'banquet', 'antechamber', 'oculus', 'sienna', 'exhibition'],
    floorMirror: 'base',
  },
  moonfall: {
    rooms: ['antechamber', 'exhibition', 'oculus'],
    floorMirror: 'moonfall',
    visibleLamps: {
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
    floorMirror: 'moonfall',
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

/** The floor mirror to render while the player is in the fences with the ids: the one the last of them that names any names, so a part of a room decides over the room; none where none of them names one. */
export function floorMirror(fences: Iterable<string>): FloorMirror | undefined {
  let mirror: FloorMirror | undefined
  for (const fence of fences) {
    mirror = activation(fence)?.floorMirror ?? mirror
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
