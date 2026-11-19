import {wallFace, wallTop} from './architectureDimensions.ts'
import forge, {forgeRowTables, forgeVestibule} from './forge.ts'
import {salonCeiling} from './salon.ts'

/**
 * The Forge’s foundry clerestory roof, open-web parabolic wrought-iron arch trusses, industrial workshop pendant lamps and 8-ribbed vestibule cupola.
 * All main-hall coordinates are in meters relative to the Forge’s center at floor level; cupola coordinates are relative to the vestibule’s center at floor level.
 */
const forgeCeiling = {
  /** underside of the perimeter bluestone soffit band, matching the height of the Salon’s ceiling */
  baseY: salonCeiling.underside,
  /** springing height of the sloped roof deck, flush with the walls’ top */
  springY: wallTop,
  /** flat perimeter ledge inward from the wall faces; 0.50 m clears the Lobby vault’s 0.34 m overhang on the east wall with 16 cm to spare */
  ledge: 0.5,
  /** sloped limewashed foundry deck rising from the perimeter ledge to the monitor curb */
  deck: {
    topY: 7.45,
    /** upward parabolic vault sag along the slope so the limewashed bays catch soft gradients */
    arch: 0.14,
    /** vertical thickness of the closed outer roof shell */
    shell: 0.22,
    /** segments along the curved slope */
    segments: 6,
  },
  /** raised gable-ended industrial clerestory monitor crowning the central spine */
  monitor: {
    /** half-width (x) and half-length (z) of the clear monitor opening */
    halfX: 2.6,
    halfZ: 5.6,
    /** height of the bluestone curb from deck top to clerestory window sill */
    curbHeight: 0.3,
    /** horizontal thickness of the monitor curb wall */
    curbThickness: 0.22,
    /** height of the vertical factory-mullioned clerestory windows */
    windowHeight: 1.2,
    /** height of the pitched glazed skylight roof from eaves to ridge */
    roofRise: 1.25,
    /** bays along the monitor’s length (1.4 m each) and across its ends (1.3 m each) */
    sideBays: 8,
    endBays: 4,
    /** purlin rows dividing each pitched skylight slope */
    roofRows: 2,
    /** sleek wrought-iron ridge beam and brass cresting along the pitched skylight apex */
    ventilator: {
      halfX: 0.08,
      rise: 0.16,
    },
  },
  /** four main open-web parabolic wrought-iron arch trusses along the hall, aligned with the monitor’s 1.4 m bay grid */
  trusses: {
    offsets: [-4.2, -1.4, 1.4, 4.2] as const,
    /** springing height of the parabolic arch chord on its wall corbels */
    springY: 5.45,
    /** crown height of the parabolic arch chord at x = 0 */
    crownY: 7.35,
    /** height of the horizontal tension tie-rod spanning between the arch shoulders (well above the cannon’s 3.25 m orb peak) */
    tieY: 6.2,
    /** x offsets of the longitudinal wrought-iron purlins running along the sloped roof flanks (3.25 m sits straight above the four flanking tables) */
    purlinsX: [3.25, 4.35] as const,
  },
  /** engaged bluestone and iron pilasters supporting the trusses along the west brick wall and flanking the east Lobby window */
  pilasters: {
    width: 0.28,
    depth: 0.1,
    /** local z coordinates on the east wall (clear of the z ∈ [-4.17, 4.17] Lobby window casing) */
    eastOffsets: [-4.55, 4.55] as const,
  },
  /** industrial spun-enamel & hammered-brass workshop pendant lamps over the four flanking tables and flanking the south alchemy workbench */
  pendants: {
    /** height of each flared shade’s lower rim */
    rimY: 3.3,
    /** height of each Edison bulb’s center */
    bulbY: 3.29,
    /** height of each point light just beneath the globe */
    lightY: 3.08,
    /** outer radius of the flared vitreous-enamel shade */
    shadeRadius: 0.3,
    /** local [x, z] positions of the two lamps flanking the alchemy workbench (clear of the cannon’s x = 0 firing axis) */
    benchFlankX: 1.75,
    benchFlankZ: 6.15,
  },
  /** the 8-ribbed wrought-iron and limewashed cupola over the round vestibule north of the Forge */
  cupola: {
    /** flat ring ledge inward from the vestibule’s inner wall face */
    ledge: 0.235,
    /** inner radius of the compression ring and glazed oculus lantern */
    oculusRadius: 1.15,
    /** height where the dome meets the compression ring */
    oculusY: 7.15,
    /** height of the bluestone oculus curb */
    curbHeight: 0.2,
    /** horizontal thickness of the dome shell and curb */
    shell: 0.18,
    /** height of the 8-sided vertical glazed lantern drum */
    drumHeight: 0.55,
    /** rise of the 8-sided glazed conical lantern roof */
    coneRise: 0.48,
    /** top radius where the conical glass meets the bronze finial cap */
    capRadius: 0.22,
    /** height of the finial above the glass apex */
    finialHeight: 0.34,
    /** number of wrought-iron meridional ribs and lantern sides */
    ribs: 8,
  },
} as const

/** height of the clerestory window sill above the floor */
export const forgeMonitorSillY = forgeCeiling.deck.topY + forgeCeiling.monitor.curbHeight
/** height of the clerestory eaves where the vertical glazing meets the pitched skylight roof */
export const forgeMonitorEavesY = forgeMonitorSillY + forgeCeiling.monitor.windowHeight
/** height of the pitched skylight roof’s ridge */
export const forgeMonitorRidgeY = forgeMonitorEavesY + forgeCeiling.monitor.roofRise
/** highest point of the main hall’s roof, at the top of the ridge ventilator cresting */
export const forgeMonitorTopY = forgeMonitorRidgeY + forgeCeiling.monitor.ventilator.rise
/** height of the vestibule cupola’s oculus sill */
export const forgeCupolaSillY = forgeCeiling.cupola.oculusY + forgeCeiling.cupola.curbHeight
/** height of the vestibule cupola’s lantern eaves */
export const forgeCupolaEavesY = forgeCupolaSillY + forgeCeiling.cupola.drumHeight
/** height of the vestibule cupola’s conical glass apex */
export const forgeCupolaApexY = forgeCupolaEavesY + forgeCeiling.cupola.coneRise
/** highest point of the vestibule cupola, at the tip of its finial */
export const forgeCupolaTopY = forgeCupolaApexY + forgeCeiling.cupola.finialHeight

/** Inner span of the sloped roof at its springing, inside the perimeter ledge. */
export function forgeRoofSpringHalf(size: readonly [number, number] = forge.size): readonly [number, number] {
  return [size[0] / 2 - wallFace - forgeCeiling.ledge, size[1] / 2 - wallFace - forgeCeiling.ledge]
}

/**
 * One point along the gently vaulted sloped foundry deck at parameter `t ∈ [0, 1]`, from the perimeter ledge (`t = 0`) to the monitor curb (`t = 1`), returning `[halfX, halfZ, y]`.
 */
export function forgeDeckRing(t: number, size: readonly [number, number] = forge.size): readonly [number, number, number] {
  const [sx, sz] = forgeRoofSpringHalf(size)
  const {halfX, halfZ} = forgeCeiling.monitor
  const {arch, topY} = forgeCeiling.deck
  const hx = sx + (halfX - sx) * t
  const hz = sz + (halfZ - sz) * t
  const y = forgeCeiling.springY + (topY - forgeCeiling.springY) * t + arch * 4 * t * (1 - t)
  return [hx, hz, y]
}

/**
 * Height of a parabolic arch truss’s lower chord at local `x`, springing from the perimeter ledge up to its crown over the central aisle.
 */
export function forgeTrussArchY(x: number, size: readonly [number, number] = forge.size) {
  const [sx] = forgeRoofSpringHalf(size)
  const {crownY, springY} = forgeCeiling.trusses
  const u = x / sx
  return crownY - (crownY - springY) * u * u
}

/** Local `|x|` where a truss’s horizontal tie-rod meets the parabolic arch chord. */
export function forgeTrussTieHalfX(size: readonly [number, number] = forge.size) {
  const [sx] = forgeRoofSpringHalf(size)
  const {crownY, springY, tieY} = forgeCeiling.trusses
  return sx * Math.sqrt((crownY - tieY) / (crownY - springY))
}

/** Height of the sloped roof’s underside directly above a point `(x, z)` in the main hall, used to fit pendant downrods cleanly to the ceiling. */
export function forgeRoofUndersideY(x: number, z: number, size: readonly [number, number] = forge.size) {
  const [sx, sz] = forgeRoofSpringHalf(size)
  const {halfX, halfZ} = forgeCeiling.monitor
  const tx = (sx - Math.abs(x)) / (sx - halfX)
  const tz = (sz - Math.abs(z)) / (sz - halfZ)
  const t = Math.max(0, Math.min(1, Math.min(tx, tz)))
  return forgeDeckRing(t, size)[2]
}

/** Height of the pitched skylight roof at local `|x| ≤ monitor.halfX`. */
export function forgeSkylightRoofY(x: number) {
  const {halfX, roofRise} = forgeCeiling.monitor
  return forgeMonitorEavesY + roofRise * (1 - Math.abs(x) / halfX)
}

/** One point along the vestibule cupola’s elliptical inner dome at angle `theta ∈ [0, π/2]`, from the ring ledge (`0`) to the oculus compression ring (`π/2`), returning `[radius, y]`. */
export function forgeCupolaSection(theta: number): readonly [number, number] {
  const outer = forgeVestibule.radius - wallFace - forgeCeiling.cupola.ledge
  const {oculusRadius, oculusY} = forgeCeiling.cupola
  const r = oculusRadius + (outer - oculusRadius) * Math.cos(theta)
  const y = forgeCeiling.springY + (oculusY - forgeCeiling.springY) * Math.sin(theta)
  return [r, y]
}

/** Every Forge workshop pendant lamp’s id and room-local `[x, z]` anchor: one centered over each of the four flanking tables and two flanking the south alchemy workbench. */
export const forgePendantSpots = [
  ...forgeRowTables.map(({center: [worldX, worldZ], name}) => ({
    id: name.replace('forge-', '').replaceAll('-', '_'),
    x: worldX - forge.center[0],
    z: worldZ - forge.center[1],
  })),
  {
    id: 'bench_west',
    x: -forgeCeiling.pendants.benchFlankX,
    z: forgeCeiling.pendants.benchFlankZ,
  },
  {
    id: 'bench_east',
    x: forgeCeiling.pendants.benchFlankX,
    z: forgeCeiling.pendants.benchFlankZ,
  },
] as const

export default forgeCeiling
