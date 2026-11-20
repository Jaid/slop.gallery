import {DEGREES_TO_RADIANS as degrees} from 'math'

import {wallFace, wallTop} from './architectureDimensions.ts'
import lobby from './lobby.ts'

/** Inner face of the long walls, measured from the room’s axis. The vault springs from this plane. */
const halfSpan = lobby.width / 2 - wallFace
/** Inner face of the end walls, measured from the room center. */
const halfLength = (lobby.southZ - lobby.northZ) / 2 - wallFace
const springY = wallTop
const cofferDepth = 0.2
const shell = 0.35
/**
 * The Lobby’s coffered barrel vault, in meters relative to the room center at floor level.
 *
 * A semicircular vault springs from the wall faces right on top of the walls’ cornice. Transverse ribs span it every 4 m.
 * Between them, the flanks are coffered with a gilt rosette in every field, and a glazed band runs along the crown, showing the
 * sky and letting the sun in. A lunette closes each end; the north one is pierced by a clear wheel-rose window.
 *
 * Angles around the vault’s axis (z) are measured from +x: 0 is the east springing, π/2 the crown, π the west springing.
 */
const lobbyVault = {
  halfSpan,
  halfLength,
  springY,
  /** radius of the coffer frames’ inner face, flush with the walls below */
  radius: halfSpan,
  crownY: springY + halfSpan,
  bay: 4,
  rib: {
    width: 0.56,
    /** how far a rib hangs below the coffer frames */
    depth: 0.3,
    /** gilt fillets run along both edges of a rib’s soffit: their width, how far they stand proud and their inset from the edge */
    bead: 0.05,
    fillet: 0.012,
    beadInset: 0.08,
  },
  /** the spine rib along the crown, of the ribs’ profile but wider */
  spine: 1.1,
  coffer: {
    depth: cofferDepth,
    /** width of the frames between coffers */
    frame: 0.2,
    /** gilt molding lining each field inside its step: width and inset from the step */
    molding: 0.05,
    moldingInset: 0.12,
    rosette: 0.55,
  },
  /** shell thickness behind the coffers and the glass */
  shell,
  /** outer radius of the vault, which the attic walls and lunettes reach */
  outerRadius: halfSpan + cofferDepth + shell,
  /** the south lunette stays inside the wall it shares with the taller Antechamber, short of that room’s face */
  southLunetteThickness: wallFace * 2 - 0.01,
  glazing: {
    /** the glazed span reaches this angle on either side of the crown, leaving one row of coffers low on each flank */
    halfAngle: 60 * degrees,
    /** a longitudinal rib on either side of the spine, at this angle from the crown */
    purlin: 32 * degrees,
    /** size of the panes the bars divide every field into, and of the glass’s cast panes */
    pane: 1,
    bar: {
      width: 0.032,
      depth: 0.045,
    },
    /** heavier bars around every field */
    rim: 0.065,
    /** a bronze ring in the middle of every field */
    medallion: 0.34,
  },
  rose: {
    /** height of the center above the springing line */
    rise: 3.4,
    radius: 2.5,
    lunetteThickness: 0.4,
    /** bronze glazing bars: spokes from the gilt hub ring, a wheel across them and a small ring between each pair at the rim */
    spokes: 12,
    hub: 0.62,
    wheel: 1.54,
    foil: 0.3,
    bar: 0.035,
  },
} as const

export type VaultRib = {
  /** wall arches stand against the end walls and frame the lunettes */
  wallArch: boolean
  /** center along the room’s axis */
  z: number
}

/** Every transverse rib, north to south: the wall arches at both ends and one over each pilaster. */
export function vaultRibs(): Array<VaultRib> {
  const {bay, rib} = lobbyVault
  // Centered on the room, on the 4 m grid of its floor tiles and the old ceiling’s beams.
  const count = Math.floor((halfLength - rib.width) / bay)
  const inner = Array.from({length: count * 2 + 1}, (_, i) => (i - count) * bay)
  return [
    {
      z: -halfLength + rib.width / 2,
      wallArch: true,
    },
    ...inner.map(z => ({
      z,
      wallArch: false,
    })),
    {
      z: halfLength - rib.width / 2,
      wallArch: true,
    },
  ]
}

/** The clear stretches between neighboring ribs, as [north, south] z, where the coffers and the glazing sit. */
export function vaultBays(): Array<readonly [number, number]> {
  const ribs = vaultRibs()
  const half = lobbyVault.rib.width / 2
  return ribs.slice(1).map((rib, i) => [ribs[i].z + half, rib.z - half] as const)
}

/** Angle where the glazed band meets the east flank; the west one mirrors it at π minus this. */
export const glazingStart = Math.PI / 2 - lobbyVault.glazing.halfAngle

/**
 * The fields of the square coffers in the row along each flank, between the springing and the lowest longitudinal rib. They
 * follow their own spacing rather than the bays of the glazing above. Angles are on the east flank; the west one mirrors them.
 */
export function vaultCoffers() {
  const {coffer, radius, rib} = lobbyVault
  const top = glazingStart - rib.width / 2 / radius
  const frame = coffer.frame / radius
  const angles = [frame, top - frame] as const
  const side = (angles[1] - angles[0]) * radius
  const count = Math.round((halfLength * 2 - coffer.frame) / (side + coffer.frame))
  const length = (halfLength * 2 - coffer.frame * (count + 1)) / count
  return {
    /** the frames below and above the row */
    top,
    angles,
    z: Array.from({length: count}, (_, i) => {
      const north = -halfLength + coffer.frame + i * (length + coffer.frame)
      return [north, north + length] as const
    }),
  }
}

/** Height of a point on the vault’s inner face, or the springing height beyond it. */
export function vaultHeight(x: number) {
  const {radius} = lobbyVault
  return springY + Math.sqrt(Math.max(0, radius * radius - x * x))
}

/**
 * Three great chandeliers hang on long rods where arches cross the spine rib, one over the room’s center and two 8 m to
 * either side. The north one hangs right over the glass floor above the Oculus.
 */
export const lobbyChandeliers = {
  /** z relative to the room center */
  offsets: [-8, 0, 8],
  /** height of each chandelier’s hub above the floor */
  y: 8.5,
  /** height of each chandelier’s light above the floor, below its hub so it reaches past the candle ring */
  lightY: 6.6,
  /** where the rods meet the spine rib’s soffit */
  anchorY: lobbyVault.crownY - lobbyVault.rib.depth,
} as const

export default lobbyVault
