import type {GalleryRoomId as RoomId} from './SlopGallery.ts'

/** an opening between two rooms: the holes of the walls it passes through, by global wall id and the hole’s name within its wall */
export type Opening = {
  holes: ReadonlyArray<readonly [string, string]>
  rooms: readonly [RoomId, RoomId]
}

/** the openings between rooms that RoomCulling looks through, as global wall ids with the names of their holes; passages list the holes at both of their ends. The glazed Lobby floor into the Oculus is an opening too, but takes its box from the Lobby’s floor, and so are the Vesper’s lantern and the windows of the Salon’s, which look out onto the Lobby’s vault. */
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
    // Both ends of Moonfall’s curved approach and stairway, kept as separate portals so their boxes stay tight around their doorways instead of spanning the Antechamber.
    rooms: ['antechamber', 'moonfall'],
    holes: [['antechamber-west_south', 'stairway']],
  },
  {
    rooms: ['antechamber', 'moonfall'],
    holes: [['moonfall-east', 'stairway']],
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
