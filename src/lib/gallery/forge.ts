import {wallFace} from './architectureDimensions.ts'
import salon, {salonCeiling} from './salon.ts'

/**
 * A round rooflight: a disc of clear cast glass open to the sky, held in a square grid of bars and framed by a deep ring of plaster hanging below the slab, like the eye of a Roman dome let into a flat ceiling.
 * All values are in meters, relative to its middle.
 */
export type Rooflight = {
  barDepth: number
  barWidth: number
  /** the gilt bead along the ring’s lower inner edge */
  bead: number
  /** how far the ring hangs below the ceiling */
  depth: number
  /** width of the plaster ring around the opening */
  frame: number
  /** the glass sits 1 cm below the slab, above the glazing bars */
  glassY: number
  /** glazing bars split the glass into square panes of this size, a whole number of them across the opening */
  pane: number
  /** radius of the glazed opening cut through the slab */
  radius: number
}

/**
 * The Forge sits north of the Vesper, across the Lobby’s north extension from the Salon, whose floor plan it mirrors: its east wall backs onto the Lobby’s west extension, from the Lobby’s north wall to the Vesper’s north wall’s line.
 * The Bastion climbs from the Oculus’ west bridge and enters its round vestibule, north of the room, from the west.
 */
const forge = {
  center: [-salon.center[0], salon.center[1]],
  size: salon.size,
} as const satisfies {
  center: readonly [number, number]
  size: readonly [number, number]
}
const northZ = forge.center[1] - forge.size[1] / 2
const westX = forge.center[0] - forge.size[0] / 2

/**
 * The painter’s table against the middle of the west wall, which the painting set lies on: a slab of hammered brass on a frame of blackened iron, running along the wall.
 * All values are in meters. It runs along z; its legs stand `inset` in from the top’s edge, past the baseboard’s cap.
 */
export const forgeTable = {
  /** how long it is along the wall */
  length: 2.4,
  /** how deep it is, from the wall into the room */
  width: 1.15,
  height: 0.82,
  /** how thick its top is */
  top: 0.024,
  /** how deep the frame hangs under the top and how thick its bars are */
  apron: [0.06, 0.026] as const,
  /** how thick its square legs are */
  leg: 0.05,
  /** how far its legs stand in from the top’s edge */
  inset: 0.14,
} as const
/** where the middle of the table stands in plan, in the world’s frame: its back a hand’s width from the west wall’s face, its legs clear of the baseboard’s cap */
export const forgeTableCenter = [westX + wallFace + 0.08 + forgeTable.width / 2, forge.center[1]] as const

/** The round rooflight in the middle of the ceiling, relative to the room’s center. */
export const forgeRooflight = {
  radius: 2.5,
  frame: 0.55,
  depth: 0.34,
  pane: 1,
  barWidth: 0.05,
  barDepth: 0.07,
  glassY: salonCeiling.underside - 0.01,
  bead: 0.04,
} as const satisfies Rooflight

const vestibuleRadius = 3
/**
 * The vestibule north of the Forge, still the Forge’s: a round anteroom at its floor on its axis, whose wall touches the middle of its north wall back to back, where an arch opens through both into the room.
 * The Bastion’s approach arrives through a second arch, from the west. Its ceiling is as high as the room’s, pierced in the middle by a round rooflight of its own.
 */
export const forgeVestibule = {
  center: [forge.center[0], northZ - vestibuleRadius],
  /** the radius of its wall’s center line */
  radius: vestibuleRadius,
  /** relative to the vestibule’s center: a smaller eye than the room’s, in panes half as large */
  rooflight: {
    radius: 1,
    frame: 0.4,
    depth: 0.26,
    pane: 0.5,
    barWidth: 0.04,
    barDepth: 0.06,
    glassY: salonCeiling.underside - 0.01,
    bead: 0.03,
  },
} as const satisfies {
  center: readonly [number, number]
  radius: number
  rooflight: Rooflight
}

export default forge
