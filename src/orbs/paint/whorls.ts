import {impastoPaints} from '#src/lib/materials/impastoPaints.ts'

const {alizarinCrimson, cadmiumOrange, cobaltTeal, naplesYellow, prussianBlue, titaniumWhite} = impastoPaints

/** The half-width of a load, in shares of its angular sector. A crooked pull uses part of the remaining margin, never its neighbor’s. */
export const blade = {
  heel: 0.95,
  taper: 0.32,
  variation: 0.035,
  wander: 0.73,
}

/** Whorls of a double-sided paint flower, in radii of the glass. Each owns a conical band (depth + slope × radius ± loft); within it each blade-load owns one twisting angular sector. The lips can shingle over other colors in projection but never occupy the same volume. */
export const whorls = [
  {
    count: 11,
    root: 0.1,
    tip: 0.68,
    depth: 0,
    slope: 0,
    loft: 0.097,
    turn: 1.24,
    phase: 0.1,
    body: '#284960',
    load: cobaltTeal,
  },
  // Coral petals open around a saffron eye.
  {
    count: 9,
    root: 0.16,
    tip: 0.617,
    depth: 0.153,
    slope: 0.22,
    loft: 0.077,
    turn: 0.9,
    phase: 0.39,
    body: alizarinCrimson,
    load: '#ff936c',
  },
  {
    count: 7,
    root: 0.08,
    tip: 0.442,
    depth: 0.262,
    slope: 0.54,
    loft: 0.069,
    turn: 1.08,
    phase: 0.15,
    body: cadmiumOrange,
    load: '#ffd68b',
  },
  {
    count: 5,
    root: 0.004,
    tip: 0.229,
    depth: 0.402,
    slope: 0.55,
    loft: 0.066,
    turn: 1.26,
    phase: 0.63,
    body: naplesYellow,
    load: titaniumWhite,
  },
  // Turn it over: a second bloom in petrol, turquoise and celadon.
  {
    count: 10,
    root: 0.16,
    tip: 0.612,
    depth: -0.149,
    slope: -0.23,
    loft: 0.079,
    turn: -0.8,
    phase: 0.72,
    body: prussianBlue,
    load: '#599ab0',
  },
  {
    count: 7,
    root: 0.075,
    tip: 0.43,
    depth: -0.262,
    slope: -0.54,
    loft: 0.067,
    turn: -1.09,
    phase: 0.36,
    body: cobaltTeal,
    load: '#b1e6cc',
  },
  {
    count: 5,
    root: 0.004,
    tip: 0.226,
    depth: -0.402,
    slope: -0.56,
    loft: 0.065,
    turn: -1.32,
    phase: 0.62,
    body: '#a3c687',
    load: '#fff1af',
  },
] as const
