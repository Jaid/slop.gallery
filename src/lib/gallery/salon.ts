import type {Wall, WallOpening} from '../placement/wallGeometry.ts'
import type {Vec3} from './types.ts'

import lobby from './lobby.ts'
import {salonWindow} from './lobbyWindows.ts'

/**
 * The Salon sits north of the Banquet, behind the arch in the Banquet’s north wall. Its west wall backs onto the Lobby’s east extension, from
 * the Lobby’s north wall to as far south of the glass wall between them, keeping the window centered on it. The Banquet takes the rest.
 */
const salon = {
  center: [14, salonWindow.z],
  size: [12, (salonWindow.z - lobby.northZ) * 2],
  /** shared by the Banquet’s north wall and the Salon’s south wall; both are centered on x = 14 */
  doorway: {
    u: 0,
    width: 2.8,
    height: 3.8,
    profile: 'arch',
  },
} as const satisfies {
  center: readonly [number, number]
  doorway: WallOpening
  size: readonly [number, number]
}

/** The 18 cm ceiling slab every upper-floor room gets at 5.78 m. */
export const salonCeiling = {
  y: 5.78,
  thickness: 0.18,
  underside: 5.78 - 0.18 / 2,
} as const

/** The oval laylight above the Salon. The sill rests on a fluted plaster cove rising from the old cornice line. */
export const salonSkylight = {
  /** semi-axes of the glass, across and along the room */
  radii: [3.15, 4.55],
  glassY: salonCeiling.underside + 0.94,
  /** lowest point of the plaster bead round the foot of the cove */
  footY: salonCeiling.underside - 0.08,
} as const

/**
 * Lower wall finish: raised field panels on a painted dado under a gilt chair rail. The rail stays low enough that the placards
 * of the lowest frames clear it by more than a hand’s width, even seen from above.
 */
export const salonWainscot = {
  bottom: 0.44,
  railBottom: 0.82,
  railHeight: 0.07,
  railDepth: 0.045,
  panelDepth: 0.012,
  /** raised fields stand this far proud of the dado */
  fieldDepth: 0.012,
  /** target width of a raised field, before it is fitted to the span */
  fieldWidth: 1.2,
  /** stile between fields and rail above and below them */
  margin: 0.07,
} as const

/** Raised fields along one wainscot span, as [center, width] pairs. Short spans get a single field. */
export function wainscotFields(start: number, end: number) {
  const {fieldWidth, margin} = salonWainscot
  const length = end - start
  const count = Math.max(1, Math.round(length / fieldWidth))
  const pitch = length / count
  return Array.from({length: count}, (_, i) => [start + pitch * (i + 0.5), pitch - margin * 2] as const).filter(([, width]) => width > 0.1)
}

const benchDepth = 0.9

/** A double-sided velvet ottoman on the room axis, its south edge flush with the glass wall’s south end. */
export const salonBench = {
  position: [salon.center[0], 0, salonWindow.z + (salonWindow.width - benchDepth) / 2] as Vec3,
  width: 3.2,
  depth: benchDepth,
  legHeight: 0.28,
  apronHeight: 0.1,
  cushionHeight: 0.11,
  get seatHeight() {
    return this.legHeight + this.apronHeight + this.cushionHeight
  },
} as const

/** Ottoman leg centers relative to its position, inset from the corners. */
export const salonBenchLegs = [-1, 1].flatMap(x => [-1, 1].map(z => [x * (salonBench.width / 2 - 0.12), z * (salonBench.depth / 2 - 0.12)] as const))

/** The terrazzo floor: a light field within a dark border, which the brass inlays divide at the same distance from the walls as every stone floor’s. */
export const salonTerrazzo = {
  /** how far from the walls’ center lines the border reaches in, on the inlays’ line */
  border: 1.25,
  /** polished hard, so the red walls and the skylight mirror clearly in it, though only half as strongly as in the Banquet’s marble */
  polish: {
    strength: 0.2,
    grazingStrength: 0.1,
    loss: 0,
    roughness: 0.1,
  },
} as const

const sculptureSocketSize: Vec3 = [salonBench.width, 0.3, salonBench.width]

/** A sculpture socket of sawn stone with its north edge flush with the glass wall’s north end. */
export const salonSculptureSocket = {
  position: [14.05, 0, salonWindow.z - (salonWindow.width - sculptureSocketSize[2]) / 2] as Vec3,
  size: sculptureSocketSize,
} as const

/** where a sculpture pedestal stands on the floor, on the room’s axis, centered on the line of the glass wall’s north end */
export const salonPedestal: Vec3 = [salon.center[0], 0, salonWindow.z - salonWindow.width / 2]

/**
 * Wall-local u ranges a horizontal band of wall dressing can run along without crossing a walk-through opening or its trim.
 * The ends are pulled in by `inset`, so bands of neighboring walls meet at the corners instead of reaching through them.
 */
export function wallDressingSpans(wall: Pick<Wall, 'holes' | 'width'>, padding: number, inset = 0): Array<readonly [number, number]> {
  let spans: Array<readonly [number, number]> = [[-wall.width / 2 + inset, wall.width / 2 - inset]]
  for (const hole of wall.holes ?? []) {
    if ((hole.bottom ?? 0) > 0) {
      continue
    }
    const left = hole.u - hole.width / 2 - padding
    const right = hole.u + hole.width / 2 + padding
    spans = spans.flatMap(([start, end]) => [[start, Math.min(end, left)], [Math.max(start, right), end]] as const).filter(([start, end]) => end - start > 1e-6)
  }
  return spans
}

/** The Banquet’s north wall, which the Salon’s south wall backs onto */
export const salonSouthZ = salon.center[1] + salon.size[1] / 2

export default salon
