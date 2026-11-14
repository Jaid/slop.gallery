import type {GalleryRoomId as RoomId} from './SlopGallery.ts'

/** the floor mirrors of the gallery: one for the floors of the ground level and one for the Moonfall’s slate */
export type FloorMirror = 'base' | 'moonfall'
/** the ids of other rooms’ objects by the room they belong to: per room, the id or ids within it */
export type ForeignIds = Partial<Record<RoomId, ReadonlyArray<string> | string>>
/** what stays on beyond a room’s own objects while the player is inside it */
export type RoomRelations = {
  /** other rooms’ ambient sounds that stay audible, because they carry into this room */
  audibleAmbiences?: ForeignIds
  /** the floor mirror to render, none if left out */
  floorMirror?: FloorMirror
  /** the other rooms whose models stay enabled: the rooms a player can see into through up to three openings; the frustum still culls them per frame */
  rooms: ReadonlyArray<RoomId>
  /** other rooms’ lamps that stay on, because they reach into this room or can be seen from it */
  visibleLamps?: ForeignIds
}

/** an opening between two rooms: the holes of the walls it passes through, by global wall id and the hole’s name within its wall */
export type Opening = {
  holes: ReadonlyArray<readonly [string, string]>
  rooms: readonly [RoomId, RoomId]
}

/** the openings between rooms that RoomCulling looks through, as global wall ids with the names of their holes; passages list the holes at both of their ends. The glazed Lobby floor into the Oculus is an opening too, but takes its box from the Lobby’s floor, and so is the Vesper’s lantern, which looks out onto the Lobby’s vault. */
export const openings: ReadonlyArray<Opening> = [
  {
    rooms: ['lobby', 'vesper'],
    holes: [['lobby-west', 'vesper']],
  },
  {
    rooms: ['lobby', 'banquet'],
    holes: [['lobby-east', 'banquet']],
  },
  {
    rooms: ['lobby', 'antechamber'],
    holes: [['lobby-south', 'antechamber']],
  },
  {
    rooms: ['vesper', 'sienna'],
    holes: [['vesper-south', 'sienna']],
  },
  {
    rooms: ['banquet', 'salon'],
    holes: [['banquet-north', 'salon']],
  },
  {
    rooms: ['antechamber', 'moonfall'],
    holes: [['antechamber-east', 'stairway'], ['moonfall-east', 'stairway']],
  },
  {
    // The arch out of the Sienna’s vestibule onto the Corridor’s landing; the arch between the Sienna and its vestibule lies within the Sienna.
    rooms: ['sienna', 'corridor'],
    holes: [['sienna-vestibule_west', 'corridor']],
  },
  {
    rooms: ['moonfall', 'exhibition'],
    holes: [['moonfall-north', 'exhibition']],
  },
  {
    rooms: ['exhibition', 'oculus'],
    holes: [['oculus-south', 'exhibition']],
  },
  {
    // The doors from the balcony onto the staff stairways down to the displays.
    rooms: ['oculus', 'exhibition'],
    holes: [['oculus-east', 'staff_door']],
  },
  {
    rooms: ['oculus', 'exhibition'],
    holes: [['oculus-west', 'staff_door']],
  },
  {
    rooms: ['oculus', 'bastion'],
    holes: [['oculus-east', 'bastion']],
  },
  // The barred gate and windows in the apse, each through the apse’s wall and the wall of the Bastion’s curve behind it, the one toward the apse along that stretch of the curve.
  {
    rooms: ['oculus', 'bastion'],
    holes: [['oculus-north', 'west_window'], ['bastion-curve_wall_6', 'west_window']],
  },
  {
    rooms: ['oculus', 'bastion'],
    holes: [['oculus-north', 'gate'], ['bastion-curve_wall_6', 'gate']],
  },
  {
    rooms: ['oculus', 'bastion'],
    holes: [['oculus-north', 'east_window'], ['bastion-curve_wall_6', 'east_window']],
  },
  {
    rooms: ['bastion', 'lodge'],
    holes: [['lodge-east', 'bastion']],
  },
  {
    rooms: ['bastion', 'lodge'],
    holes: [['lodge-east', 'east_window']],
  },
  {
    rooms: ['oculus', 'bastion'],
    holes: [['oculus-west', 'bastion']],
  },
  {
    // The arch out of the Forge’s vestibule onto the Bastion’s approach; the arch between the Forge and its vestibule lies within the Forge.
    rooms: ['bastion', 'forge'],
    holes: [['forge-vestibule', 'bastion']],
  },
  {
    // The window through the vestibule’s wall, where the cistern’s flat wall touches it back to back with a hole of its own; that wall’s other air behind it, the passages under the Forge, lies nowhere near the window.
    rooms: ['bastion', 'forge'],
    holes: [['forge-vestibule', 'cistern']],
  },
  {
    rooms: ['lodge', 'corridor'],
    holes: [['lodge-north', 'corridor']],
  },
  {
    rooms: ['lodge', 'corridor'],
    holes: [['lodge-west', 'window'], ['corridor-wall_3', 'lodge_window']],
  },
  {
    // The glass wall between the Lobby extension and the Salon.
    rooms: ['lobby', 'salon'],
    holes: [['lobby-extension_east', 'salon_window'], ['salon-west', 'lobby_window']],
  },
  {
    // The glass wall between the Lobby extension and the Forge.
    rooms: ['lobby', 'forge'],
    holes: [['lobby-extension_west', 'forge_window'], ['forge-east', 'lobby_window']],
  },
]

/**
 * Per room, a whitelist of neighbor objects. While the player is in a room, every other room’s models are hidden, its lamps are off and its ambient sounds are silent unless the room lists them here.
 * A room’s own models, lamps and ambient sounds are always on inside it. Hiding a model only skips its draws, and switching a lamp off only dims it, so neither recompiles a shader.
 */
const relations = {
  lobby: {
    rooms: ['vesper', 'banquet', 'antechamber', 'moonfall', 'salon', 'forge', 'oculus', 'sienna', 'exhibition', 'bastion'],
    floorMirror: 'base',
    visibleLamps: {
      banquet: [
        'led_north',
        'led_middle',
        'led_south',
      ],
      exhibition: [
        'tunnel_north',
        'tunnel_green',
        'west_stairway_door',
        'east_stairway_door',
      ],
      sienna: 'chandelier',
    },
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
      sienna: [
        'chandelier',
        'vestibule',
      ],
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
      // Through the vestibule’s arch: the lantern in the landing’s elbow, and down the flight the one at its foot.
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
    // The last lantern along the approach hangs right before the vestibule’s arch, and the cistern’s shines out through the window.
    visibleLamps: {
      bastion: ['lantern_strip', 'lantern_cistern'],
    },
  },
  moonfall: {
    rooms: ['antechamber', 'exhibition', 'oculus'],
    floorMirror: 'moonfall',
    visibleLamps: {
      exhibition: [
        'tunnel_green',
        'tunnel_blue',
        'tunnel_red',
        'tunnel_south',
      ],
    },
  },
  corridor: {
    rooms: ['sienna', 'lodge', 'vesper', 'bastion'],
    visibleLamps: {
      sienna: [
        'chandelier',
        'vestibule',
      ],
      lodge: [
        'fire',
        'chandelier',
      ],
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
        'tunnel_green',
        'tunnel_blue',
        'tunnel_red',
        'west_stairway_door',
        'west_stairway_landing',
        'east_stairway_door',
        'east_stairway_landing',
      ],
      bastion: [
        'lantern_east',
        'lantern_north',
        'lantern_mouth',
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
        'wall_west_1',
        'wall_west_2',
        'wall_west_3',
        'wall_west_4',
        'wall_east_north',
        'wall_east_south',
        'wall_north_west',
        'wall_north_east',
        'spotlight',
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
        'lantern_lodge',
        'lantern_north',
        'lantern_middle',
        'lantern_south',
      ],
      bastion: ['lantern_north', 'lantern_spur_0'],
    },
  },
  bastion: {
    rooms: ['oculus', 'lodge', 'lobby', 'exhibition', 'corridor', 'salon', 'forge', 'vesper'],
    visibleLamps: {
      corridor: 'lantern_lodge',
      lodge: [
        'fire',
        'chandelier',
      ],
    },
  },
} satisfies Record<RoomId, RoomRelations>
/** The floor mirror to render while the player is in the room, none for a room without one or an id the gallery doesn’t know. */
export function floorMirror(room: string): FloorMirror | undefined {
  return Object.hasOwn(relations, room) ? (relations[room as RoomId] as RoomRelations).floorMirror : undefined
}

const roomIds = Object.keys(relations) as Array<RoomId>
/** The global ids of other rooms’ objects, given by the room they belong to. */
const globalIds = (byRoom: ForeignIds = {}) => Object.entries(byRoom).flatMap(([owner, ids = []]) => [ids].flat().map(id => `${owner}-${id}`))

/** The global ids of the other rooms’ ambient sounds that stay audible while the player is in the room, from its {@link RoomRelations.audibleAmbiences}. */
export function audibleAmbiences(room: RoomId): ReadonlyArray<string> {
  return globalIds((relations[room] as RoomRelations).audibleAmbiences)
}

/** The rooms an ambient sound of the room sounds in, by its global id: its own room and every room whose {@link RoomRelations.audibleAmbiences} lists it. */
export function audibleRooms(room: RoomId, ambience: string): ReadonlyArray<RoomId> {
  return [room, ...roomIds.filter(id => id !== room && audibleAmbiences(id).includes(ambience))]
}

/** The global ids of the other rooms’ lamps that stay on while the player is in the room, from its {@link RoomRelations.visibleLamps}. */
export function visibleLamps(room: RoomId): ReadonlyArray<string> {
  return globalIds((relations[room] as RoomRelations).visibleLamps)
}

/** The rooms a lamp of the room stays on in, by its global id: its own room and every room whose {@link RoomRelations.visibleLamps} lists it. */
export function litRooms(room: RoomId, lamp: string): ReadonlyArray<RoomId> {
  return [room, ...roomIds.filter(id => id !== room && visibleLamps(id).includes(lamp))]
}

export default relations
