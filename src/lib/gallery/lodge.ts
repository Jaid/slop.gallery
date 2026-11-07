import type {PlankOptions} from '../materials/PlankMaterial.ts'
import type {FloorRectangle} from './floors.ts'
import type {PassageCutout} from './passages/Passage.ts'
import type {Vec3} from './types.ts'

import lowerGallery from './lowerGallery.ts'
import {towerBridge} from './oculusTower.ts'

const timberWidth = 4
/** The Lodge lies west of the Oculus’ north end, and everything here keeps its place relative to its north wall. */
const northZ = lowerGallery.oculus.center[1] - lowerGallery.oculus.size[1] / 2 - 5
const lodge = {
  center: [-25, northZ + 5],
  size: [10, 10],
  // three meters over Moonfall’s floor
  floorY: lowerGallery.floorY + 3,
  height: 3.9,
  // Keep the widened doorway inset from Sienna’s neighboring corner.
  siennaZ: 8.4 + timberWidth / 2,
  // Expand the long timber passage westward, keeping its east wall fixed.
  approachX: -31.7 - timberWidth / 2,
  timberWidth,
  /** the Bastion’s width, as wide as the doorway the Oculus’ east bridge leads into */
  passageWidth: towerBridge.mouthWidth,
  // The widened stone doorway sits beside the north wall: its jamb stays 2 cm in front of the north baseboard’s cap (25 cm from the
  // wall) and 7 cm in front of its face (20 cm), and its casing still tucks into the north wall’s logs (10.5 cm). On the baseboard’s
  // face, the jamb shared that plane and flickered.
  tunnelZ: northZ + 0.27 + towerBridge.mouthWidth / 2,
} as const
const westX = lodge.center[0] - lodge.size[0] / 2
const eastX = lodge.center[0] + lodge.size[0] / 2
const southZ = lodge.center[1] + lodge.size[1] / 2
/** how far the bay reaches north past the old north wall’s line */
const bayDepth = 2.74
/**
 * The bay that takes the place of the Lodge’s north wall, from the corner of its west wall to the one beside the tunnel’s doorway: half an octagon, with walls at 45° out of both corners and a back wall parallel to the old one, which the Corridor leaves through.
 *
 * Its corners are where the planes of its walls meet, from west to east, so each wall faces into the room from one corner to the next.
 */
export const lodgeBay = {
  depth: bayDepth,
  corners: [[westX, northZ], [westX + bayDepth, northZ - bayDepth], [eastX - bayDepth, northZ - bayDepth], [eastX, northZ]],
  /** the box around the bay, from the old north wall’s line to the back wall */
  bounds: {
    center: [lodge.center[0], northZ - bayDepth / 2],
    size: [lodge.size[0], bayDepth],
  },
} as const satisfies {
  bounds: FloorRectangle
  corners: ReadonlyArray<readonly [number, number]>
  depth: number
}
/** The Lodge’s floor plan along the planes of its walls, bay included, around from the south-west corner. It is convex. */
export const lodgeOutline: ReadonlyArray<readonly [number, number]> = [[westX, southZ], ...lodgeBay.corners, [eastX, southZ]]

/** The Lodge’s floor height inside its bay, north of the old north wall’s line and within the bay’s walls. */
export function lodgeBayFloor(x: number, z: number) {
  const depth = northZ - z
  return depth >= -1e-6 && depth <= bayDepth + 1e-6 && x >= westX + depth - 1e-6 && x <= eastX - depth + 1e-6 ? lodge.floorY : undefined
}

export const lodgeWindow = {
  roomX: lodge.center[0] - lodge.size[0] / 2,
  // The pane meets the vertical plank lining, never projecting into the passage.
  tunnelX: lodge.approachX + lodge.timberWidth / 2 - 0.09,
  z: northZ + 6.5,
  width: 2.4,
  bottom: lodge.floorY + 1.35,
  top: lodge.floorY + 2.65,
  lining: 0.1,
  glassThickness: 0.04,
} as const
/** The Lodge’s east window looks sideways into the straight blind stone passage. */
export const lodgeEastWindow = {
  x: lodge.center[0] + lodge.size[0] / 2,
  z: lodgeWindow.z,
  width: lodgeWindow.width,
  bottom: lodgeWindow.bottom,
  top: lodgeWindow.top,
  glassThickness: lodgeWindow.glassThickness,
  /** how far its reveal’s head and jambs reach past the opening */
  border: 0.09,
  /** how far its reveal’s sill reaches under the opening */
  sill: 0.16,
} as const

export const lodgeWindowCutout: PassageCutout = {
  position: [(lodgeWindow.roomX + lodge.approachX) / 2, (lodgeWindow.bottom + lodgeWindow.top) / 2, lodgeWindow.z],
  size: [lodgeWindow.roomX - lodge.approachX + 0.04, lodgeWindow.top - lodgeWindow.bottom + lodgeWindow.lining * 2, lodgeWindow.width + lodgeWindow.lining * 2],
}

// Clear the post remnant below the sill without cutting the plank backing or wall.
export const lodgeWindowRibCutouts: ReadonlyArray<PassageCutout> = [
  {
    position: [lodgeWindowCutout.position[0], (lodge.floorY - 0.3 + lodgeWindow.bottom) / 2, lodgeWindow.z],
    size: [lodgeWindowCutout.size[0], lodgeWindow.bottom - lodge.floorY + 0.3, lodgeWindowCutout.size[2]],
  },
]

export function lodgeWindowGlassDistance(origin: Vec3, direction: Vec3) {
  if (Math.abs(direction[0]) < 1e-9) {
    return
  }
  const x = lodgeWindow.tunnelX + (direction[0] < 0 ? lodgeWindow.glassThickness : 0)
  const distance = (x - origin[0]) / direction[0]
  const y = origin[1] + distance * direction[1]
  const z = origin[2] + distance * direction[2]
  if (distance >= 0 && y >= lodgeWindow.bottom && y <= lodgeWindow.top && Math.abs(z - lodgeWindow.z) <= lodgeWindow.width / 2) {
    return distance
  }
}

export function lodgeWindowFloor(x: number, z: number) {
  return x >= lodgeWindow.tunnelX && x <= lodgeWindow.roomX && Math.abs(z - lodgeWindow.z) <= lodgeWindow.width / 2 ? lodgeWindow.bottom : undefined
}

/**
 * The Lodge’s wide-plank oak floor. It is mapped in world space, so the tunnel’s timber transition continues its boards and joints.
 *
 * The boards run east–west, along the last span of the tunnel and straight into the room.
 */
export const lodgeFloorPlanks = {
  axis: 'x',
  width: 0.17,
  length: [1.6, 3.4],
  knots: 0.3,
  bevel: 0.004,
  seam: 0.0024,
  seed: 3,
  roughness: 0.62,
  envMapIntensity: 0.25,
  colors: {
    dark: '#5a3a22',
    light: '#8e6239',
    ring: '#3a2312',
    seam: '#1a0f08',
  },
} as const satisfies PlankOptions

/** Whether the position lies in the window’s deep niche, on its sill up to its lintel. */
export function insideLodgeWindow(position: Vec3) {
  const sill = lodgeWindowFloor(position[0], position[2])
  return sill !== undefined && position[1] >= sill - 0.1 && position[1] <= lodgeWindow.top
}

export default lodge
