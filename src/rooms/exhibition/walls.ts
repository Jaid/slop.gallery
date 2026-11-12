import type {RoomWall} from '../base/Room.ts'

import {tunnelWalls} from '#src/lib/gallery/exhibitionTunnel.ts'
import roomOrigins from '#src/lib/gallery/layout.ts'
import tunnelDisplays, {tunnelDisplayWindow} from '#src/lib/gallery/tunnelDisplays.ts'

import {localWalls} from '../lib/walls.ts'

const {glassThickness} = tunnelDisplayWindow
/** The tunnel’s walls on both sides, from the Oculus to Moonfall, with the glazed window onto the display behind the stretch rising along the diagonal on either side. */
const tunnel = tunnelWalls(Object.fromEntries(tunnelDisplays.map(display => [display.side, {
  range: display.window,
  bottom: tunnelDisplayWindow.bottom,
  height: tunnelDisplayWindow.top,
  glassThickness,
  profile: 'rectangle' as const,
}])))

export default {
  ...localWalls('exhibition', roomOrigins.exhibition, tunnel, {
    west: ['display'],
    east: ['display'],
  }),
  // The staff stairways’ walls, from the doors in the Oculus’ south wall down to the displays.
  ...localWalls('exhibition', roomOrigins.exhibition, tunnelDisplays.flatMap(({stairway}) => stairway.walls), {
    stairs_west_display_entry: ['door'],
    stairs_east_display_entry: ['door'],
  }),
} satisfies Record<string, RoomWall>
