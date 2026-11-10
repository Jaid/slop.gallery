import type {LobedProfilePoint} from '#src/lib/gallery/LobedProfileGeometry.ts'
import type {ProfilePoint} from '#src/lib/gallery/RevolvedProfileGeometry.ts'

const gravity = 9.81
const degrees = Math.PI / 180

/** Water leaving the stone as a free sheet, sampled at equal flight times so that its UV v is the age of the water in seconds. */
export type WaterSheet = {
  /** horizontal speed away from the axis in m/s */
  outward: number
  /** mean distance from the axis where the water leaves the stone */
  radius: number
  /** height of the receiving pool */
  until: number
  /** height where the water leaves the stone, the brim of the overflowing pool */
  y: number
}

/** A thin stream launched from a nozzle: a parabola in a vertical plane through the fountain’s axis. */
export type WaterJet = {
  /** angle above the horizontal in radians */
  elevation: number
  /** horizontal unit direction of the stream */
  heading: [number, number]
  /** half-thickness of the stream at the nozzle */
  radius: number
  /** launch speed in m/s */
  speed: number
  /** where the stream leaves the nozzle, in the fountain frame */
  start: [number, number, number]
  /** height of the pool the stream lands in */
  until: number
}

/** The lip of a lobed bowl: its mean radius and height, the depth of its scallops and how far the troughs dip below the crests. */
export type BowlLip = {
  dip: number
  radius: number
  scallop: number
  y: number
}

export function sheetFlightTime({y, until}: WaterSheet) {
  return Math.sqrt(2 * (y - until) / gravity)
}

export function sheetPoint(sheet: WaterSheet, age: number): ProfilePoint {
  return [sheet.radius + sheet.outward * age, sheet.y - gravity / 2 * age ** 2]
}

/** where a sheet meets its pool, measured from the axis */
export function sheetLanding(sheet: WaterSheet) {
  return sheetPoint(sheet, sheetFlightTime(sheet))[0]
}

export function jetFlightTime({elevation, speed, start, until}: WaterJet) {
  const up = speed * Math.sin(elevation)
  return (up + Math.sqrt(up ** 2 + 2 * gravity * (start[1] - until))) / gravity
}

export function jetPoint(jet: WaterJet, age: number): [number, number, number] {
  const [hx, hz] = jet.heading
  const along = jet.speed * Math.cos(jet.elevation) * age
  return [jet.start[0] + hx * along, jet.start[1] + jet.speed * Math.sin(jet.elevation) * age - gravity / 2 * age ** 2, jet.start[2] + hz * along]
}

export function jetVelocity(jet: WaterJet, age: number): [number, number, number] {
  const [hx, hz] = jet.heading
  const horizontal = jet.speed * Math.cos(jet.elevation)
  return [hx * horizontal, jet.speed * Math.sin(jet.elevation) - gravity * age, hz * horizontal]
}

/** where a jet meets its pool */
export function jetLanding(jet: WaterJet) {
  return jetPoint(jet, jetFlightTime(jet))
}

export function jetApex(jet: WaterJet) {
  return jet.start[1] + (jet.speed * Math.sin(jet.elevation)) ** 2 / (2 * gravity)
}

/**
 * Launch speed that lands a jet at `distance` from its nozzle along its heading, given its elevation and the drop to its pool.
 *
 * Solving the parabola for the speed keeps the landing spots in the config, so the jets stay inside their bowls when the stone changes.
 */
export function jetSpeedFor(elevation: number, drop: number, distance: number) {
  const cos = Math.cos(elevation)
  const tan = Math.tan(elevation)
  const denominator = 2 * cos ** 2 * (distance * tan + drop)
  if (!(denominator > 0)) {
    throw new RangeError('A jet cannot reach that far at this elevation.')
  }
  return Math.sqrt(gravity * distance ** 2 / denominator)
}

const basinApothem = 2
const basinInnerApothem = 1.62
const basinFloor = 0.16
const copingTop = 0.79
/** apothem of the coping’s flat top, its inner edge */
const copingInner = 1.68
const lobes = {
  lower: 24,
  upper: 16,
  column: 16,
  stem: 12,
} as const
const lips = {
  lower: {
    radius: 1.135,
    y: 1.72,
    scallop: 0.03,
    dip: 0.012,
  },
  upper: {
    radius: 0.59,
    y: 2.72,
    scallop: 0.02,
    dip: 0.008,
  },
} satisfies Record<string, BowlLip>
/** A pool brims between the crests and the troughs of its lip, a hair below the crests. */
const pools = {
  basin: 0.62,
  lower: lips.lower.y - 0.004,
  upper: lips.upper.y - 0.003,
} as const
/** Every profile runs from the axis outward with the stone on its right, see RevolvedProfileGeometry. */
const profiles = {
  basin: [
    [0, basinFloor],
    [basinInnerApothem, basinFloor],
    [basinInnerApothem, copingTop - 0.05],
    [basinInnerApothem + 0.02, copingTop - 0.02],
    [copingInner, copingTop],
    [1.9, copingTop],
    [1.935, copingTop - 0.012],
    [1.96, copingTop - 0.04],
    [1.97, copingTop - 0.08],
    [1.955, copingTop - 0.12],
    [1.925, copingTop - 0.14],
    [1.9, copingTop - 0.16],
    [1.86, copingTop - 0.19],
    [1.86, 0.17],
    [1.885, 0.15],
    [1.94, 0.12],
    [1.985, 0.08],
    [basinApothem, 0.05],
    [basinApothem, 0],
  ],
  // The pedestal’s foot, submerged in the basin.
  foot: [
    [0, 0.46],
    [0.5, 0.46],
    [0.55, 0.42],
    [0.58, 0.36],
    [0.58, 0.3],
    [0.64, 0.26],
    [0.66, 0.22],
    [0.66, basinFloor - 0.01],
  ],
  // The gilt finial in the upper bowl, a vase that narrows to the main jet’s mouth.
  finial: [
    [0, 3.025],
    [0.024, 3.02],
    [0.03, 3.015],
    [0.045, 2.99],
    [0.05, 2.96],
    [0.055, 2.92],
    [0.07, 2.88],
    [0.075, 2.84],
    [0.06, 2.8],
    [0.045, 2.77],
    [0.045, 2.74],
    [0.062, 2.72],
    [0.062, 2.68],
    [0.045, 2.62],
    [0, 2.62],
  ],
  // A basin nozzle along its own axis, from its mouth at the origin down into the water, as a profile up −y: built pointing down, then turned toward its jet. A turned stalk with a knop, long enough to stand on the basin floor.
  nozzle: [
    [0, 0.004],
    [0.016, 0],
    [0.022, -0.004],
    [0.024, -0.03],
    [0.02, -0.05],
    [0.03, -0.08],
    [0.036, -0.1],
    [0.03, -0.12],
    [0.024, -0.14],
    [0.024, -0.3],
    [0, -0.3],
  ],
} satisfies Record<string, Array<ProfilePoint>>
/**
 * Lobed parts: [mean radius, height, scallop depth, lobe dip]. The bowls are gadrooned, strongest on their undersides; the
 * balusters are fluted along their shafts and plain at their collars.
 */
const bowls = {
  lower: [
    [0, 1.49, 0, 0],
    [0.35, 1.5, 0, 0],
    [0.7, 1.55, 0.004, 0],
    [0.95, 1.63, 0.012, 0],
    [1.07, 1.69, 0.02, -0.004],
    [1.11, 1.715, 0.028, -0.01],
    [lips.lower.radius, lips.lower.y, lips.lower.scallop, -lips.lower.dip],
    [1.15, 1.71, 0.03, -0.01],
    [1.155, 1.69, 0.03, -0.004],
    [1.12, 1.65, 0.035, 0],
    [1, 1.55, 0.04, 0],
    [0.8, 1.44, 0.035, 0],
    [0.55, 1.35, 0.02, 0],
    [0.35, 1.31, 0.01, 0],
    [0.22, 1.3, 0, 0],
    [0.16, 1.31, 0, 0],
  ],
  upper: [
    [0, 2.56, 0, 0],
    [0.2, 2.57, 0, 0],
    [0.4, 2.62, 0.006, 0],
    [0.52, 2.68, 0.012, 0],
    [0.575, 2.715, 0.018, -0.005],
    [lips.upper.radius, lips.upper.y, lips.upper.scallop, -lips.upper.dip],
    [0.6, 2.71, 0.02, -0.006],
    [0.595, 2.695, 0.02, 0],
    [0.56, 2.65, 0.025, 0],
    [0.48, 2.56, 0.028, 0],
    [0.36, 2.48, 0.02, 0],
    [0.22, 2.43, 0.01, 0],
    [0.12, 2.42, 0, 0],
    [0.085, 2.43, 0, 0],
  ],
  // A baluster from inside the lower bowl down to the foot.
  column: [
    [0.17, 1.41, 0, 0],
    [0.17, 1.33, 0, 0],
    [0.22, 1.29, 0, 0],
    [0.22, 1.25, 0, 0],
    [0.19, 1.22, 0, 0],
    [0.19, 1.19, 0.012, 0],
    [0.21, 0.84, 0.014, 0],
    [0.21, 0.8, 0, 0],
    [0.26, 0.62, 0, 0],
    [0.3, 0.56, 0, 0],
    [0.3, 0.52, 0, 0],
    [0.4, 0.48, 0, 0],
    [0.4, 0.44, 0, 0],
  ],
  // A slimmer baluster from inside the upper bowl down into the lower one.
  stem: [
    [0.09, 2.6, 0, 0],
    [0.09, 2.5, 0, 0],
    [0.13, 2.46, 0, 0],
    [0.13, 2.42, 0, 0],
    [0.1, 2.39, 0, 0],
    [0.1, 2.36, 0.008, 0],
    [0.11, 1.98, 0.009, 0],
    [0.11, 1.95, 0, 0],
    [0.15, 1.78, 0, 0],
    [0.21, 1.63, 0, 0],
    [0.27, 1.52, 0, 0],
    [0.3, 1.47, 0, 0],
  ],
} satisfies Record<string, Array<LobedProfilePoint>>
const veils = {
  lower: {
    radius: lips.lower.radius + 0.012,
    y: pools.lower,
    outward: 0.45,
    until: pools.basin,
  },
  upper: {
    radius: lips.upper.radius + 0.008,
    y: pools.upper,
    outward: 0.3,
    until: pools.lower,
  },
} satisfies Record<string, WaterSheet>
/** A laminar jet that slows, swells and breaks into droplets near its apex. */
const jet = {
  radius: 0.028,
  y: 3.02,
  /** launch speed in m/s */
  speed: 6.4,
  /** fraction of the rise that is drawn as a solid column, droplets take over above it */
  solid: 0.8,
}
/** Eight gilt nozzles rise out of the basin’s water at its corners and throw arcs over the lower bowl’s lip into its pool. */
const basinNozzles = (() => {
  const elevation = 80 * degrees
  const length = 0.3
  /** distance of the nozzle’s mouth from the axis, inside the basin’s corner */
  const mouthRadius = 1.5
  const mouthY = pools.basin + 0.18
  const landingRadius = 0.8
  return Array.from({length: 8}, (_, i) => {
    const angle = Math.PI / 8 + i * Math.PI / 4
    const cos = Math.cos(angle)
    const sin = -Math.sin(angle)
    const start: [number, number, number] = [mouthRadius * cos, mouthY, mouthRadius * sin]
    const jetOfNozzle: WaterJet = {
      elevation,
      heading: [-cos, -sin],
      radius: 0.016,
      speed: jetSpeedFor(elevation, start[1] - pools.lower, mouthRadius - landingRadius),
      start,
      until: pools.lower,
    }
    // The nozzle leans along its stream, down into the water and onto a stand on the basin floor.
    const footRadius = mouthRadius + Math.cos(elevation) * length
    return {
      angle,
      jet: jetOfNozzle,
      length,
      foot: [footRadius * cos, mouthY - Math.sin(elevation) * length, footRadius * sin] as [number, number, number],
    }
  })
})()
/** Six slender jets from the finial’s belly lean out around the main jet and fall back into the upper bowl. */
const lilyJets = (() => {
  const elevation = 72 * degrees
  const rootRadius = 0.07
  const rootY = 2.88
  const length = 0.055
  const landingRadius = 0.42
  return Array.from({length: 6}, (_, i) => {
    const angle = i * Math.PI / 3 + Math.PI / 6
    const cos = Math.cos(angle)
    const sin = -Math.sin(angle)
    const mouthRadius = rootRadius + Math.cos(elevation) * length
    const start: [number, number, number] = [mouthRadius * cos, rootY + Math.sin(elevation) * length, mouthRadius * sin]
    const speed = jetSpeedFor(elevation, start[1] - pools.upper, landingRadius - mouthRadius)
    return {
      angle,
      jet: {
        elevation,
        // Lily jets lean away from the axis.
        heading: [cos, sin],
        radius: 0.007,
        speed,
        start,
        until: pools.upper,
      } satisfies WaterJet,
      length,
      root: [rootRadius * cos, rootY, rootRadius * sin] as [number, number, number],
    }
  })
})()
/**
 * A three-tier marble fountain: an octagonal carved basin, fluted balusters carrying two gadrooned bowls with scalloped lips that
 * overflow as continuous veils, and a gilt finial crowned by a tall jet. Lily jets lean out around the main jet, and eight gilt
 * nozzles rising from the basin throw arcs over the lower bowl into it.
 */
const fountain = {
  /** apothem of the octagonal plinth, its flat sides face the benches */
  basinApothem,
  /** circumradius of the plinth, the farthest the fountain reaches from its axis */
  radius: basinApothem / Math.cos(Math.PI / 8),
  /** apothem of the basin’s inner wall */
  basinInnerApothem,
  basinFloor,
  copingTop,
  copingInner,
  poolY: pools.basin,
  pools,
  lobes,
  lips,
  profiles,
  bowls,
  veils,
  jet,
  basinNozzles,
  lilyJets,
  /** the raised panels and corner pilasters carved on the basin’s faces */
  panels: {
    height: 0.3,
    /** middle height of the panels and pilasters on the face */
    y: 0.4,
    /** how far the panels stand proud of the face */
    relief: 0.018,
    /** margin from the pilasters to the panels */
    margin: 0.12,
    pilasterWidth: 0.11,
    pilasterRelief: 0.028,
    pilasterHeight: 0.42,
  },
  sprayCount: 640,
  gravity,
}

/** how high the main jet’s water rises over the floor the fountain stands on, where its last drops turn back */
export const mainJetApex = jet.y + jet.speed ** 2 / (2 * gravity)

export default fountain
