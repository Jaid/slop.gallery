import type {ProfilePoint} from '#src/lib/gallery/RevolvedProfileGeometry.ts'

const gravity = 9.81

/** Water leaving the stone as a free sheet, sampled at equal flight times so that its UV v is the age of the water in seconds. */
export type WaterSheet = {
  /** horizontal speed away from the axis in m/s */
  outward: number
  /** distance from the axis where the water leaves the stone */
  radius: number
  /** height of the receiving pool */
  until: number
  /** height where the water leaves the stone, the brim of the overflowing pool */
  y: number
}

/**
 * Water thrown from a nozzle as a free jet, sampled at equal flight times like the sheets so that its UV v is the age of the water in seconds.
 *
 * The jet leaves the nozzle above the pool it falls back into, so apart from its launch it only descends.
 */
export type WaterJet = {
  /** horizontal speed away from the axis in m/s */
  outward: number
  /** distance from the axis where the jet leaves its nozzle */
  radius: number
  /** vertical launch speed in m/s, enough to clear the fall back into the pool */
  rise: number
  /** height of the receiving pool */
  until: number
  /** height of the nozzle’s mouth */
  y: number
}

export function sheetFlightTime({y, until}: Pick<WaterSheet, 'until' | 'y'>) {
  return Math.sqrt(2 * (y - until) / gravity)
}

export function sheetPoint(sheet: WaterSheet, age: number): ProfilePoint {
  return [sheet.radius + sheet.outward * age, sheet.y - gravity / 2 * age ** 2]
}

/** where a sheet meets its pool, measured from the axis */
export function sheetLanding(sheet: WaterSheet) {
  return sheetPoint(sheet, sheetFlightTime(sheet))[0]
}

export function jetFlightTime(jet: Pick<WaterJet, 'rise' | 'until' | 'y'>) {
  return (jet.rise + Math.sqrt(jet.rise ** 2 + 2 * gravity * (jet.y - jet.until))) / gravity
}

export function jetPoint(jet: WaterJet, age: number): [number, number] {
  return [jet.radius + jet.outward * age, jet.y + jet.rise * age - gravity / 2 * age ** 2]
}

/** where a jet meets its pool, measured from the axis */
export function jetLanding(jet: WaterJet) {
  return jetPoint(jet, jetFlightTime(jet))[0]
}

/** Height of a jet above its nozzle after `age` seconds. */
export function jetHeight(jet: WaterJet, age: number) {
  return jetPoint(jet, age)[1]
}

/** The height a jet reaches before it falls back. */
export function jetApex(jet: WaterJet) {
  return jet.y + jet.rise ** 2 / (2 * gravity)
}

/**
 * The three bowls of the fountain, from the widest to the smallest.
 *
 * Every bowl brims a little over its lip: the water surface lies `brim` above the lip’s crest, so the overflowing sheet clears the stone as it falls. `floor` is the lowest point of the bowl’s inside, `under` where its underside leaves the stem below.
 */
const bowls = {
  lower: {
    brim: 0.012,
    floor: 1.5,
    lip: 1.3,
    rim: 1.8,
    under: 1.26,
    outward: 0.28,
  },
  middle: {
    brim: 0.012,
    floor: 2.88,
    lip: 0.95,
    rim: 3.16,
    under: 2.66,
    outward: 0.21,
  },
  cup: {
    brim: 0.012,
    floor: 3.86,
    lip: 0.54,
    rim: 4.06,
    under: 3.74,
    outward: 0.15,
  },
} as const

export type Bowl = typeof bowls[keyof typeof bowls]

/** Height of the water in each bowl and in the basin. */
const pools = {
  basin: 0.68,
  lower: bowls.lower.rim + bowls.lower.brim,
  middle: bowls.middle.rim + bowls.middle.brim,
  cup: bowls.cup.rim + bowls.cup.brim,
} as const
const basinApothem = 1.95
const basinInnerApothem = 1.66
/**
 * The overflowing sheets of the three bowls, each leaving the outer corner of a lip – where the stone hides its top edge – and falling into the pool below.
 */
const veils = {
  lower: {
    radius: bowls.lower.lip,
    y: bowls.lower.rim - 0.004,
    outward: bowls.lower.outward,
    until: pools.basin,
  },
  middle: {
    radius: bowls.middle.lip,
    y: bowls.middle.rim - 0.004,
    outward: bowls.middle.outward,
    until: pools.lower,
  },
  cup: {
    radius: bowls.cup.lip,
    y: bowls.cup.rim - 0.004,
    outward: bowls.cup.outward,
    until: pools.middle,
  },
} satisfies Record<string, WaterSheet>
/**
 * Eight slender jets ring the fountain just inside the basin’s wall. They leave the water through small gilt nozzles, rise well above the rim and break into droplets that fall back into the basin.
 */
const ringJet = {
  radius: 1.42,
  y: pools.basin + 0.075,
  rise: 5.1,
  outward: 0.1,
  until: pools.basin,
} satisfies WaterJet
const ringJets = 8
/** A laminar jet rising from the cup that thins, swells and breaks into droplets near its apex. */
const jet = {
  radius: 0.03,
  /** height of the nozzle’s mouth, where the water leaves the gilt finial in the cup */
  y: 4.16,
  /** launch speed in m/s */
  speed: 4.7,
  /** fraction of the rise that is drawn as a solid column, droplets take over above it */
  solid: 0.84,
}
/** An octagonal limestone basin on a stepped foot carrying a baluster and three brimming bowls, ringed by eight jets, crowned by a tall jet. */
const fountain = {
  /** apothem of the basin’s rim, its flat sides face the benches */
  basinApothem,
  /** apothem of the stepped foot the basin stands on */
  footApothem: 2.06,
  /** circumradius of the foot, the farthest the fountain reaches from its axis */
  radius: 2.06 / Math.cos(Math.PI / 8),
  /** apothem of the basin’s inner wall */
  basinInnerApothem,
  /** radius of the basin’s water surface, tucked into the inner wall */
  basinPoolRadius: basinInnerApothem + 0.004,
  basinFloor: 0.32,
  rimTop: 0.686,
  poolY: pools.basin,
  pools,
  bowls,
  veils,
  /** the ring of jets around the pedestal */
  ringJet,
  ringJets,
  jet,
  /** how many droplets the spray carries: the crown, the three veils and the eight ring jets */
  sprayCount: 320,
  /** how many drifting mist puffs the spray adds */
  mistCount: 44,
  gravity,
}

/** how high the central jet’s water rises over the floor the fountain stands on, where its last drops turn back, the column having broken up below */
export const crownHeight = jet.y + jet.speed ** 2 / (2 * gravity)

export default fountain
