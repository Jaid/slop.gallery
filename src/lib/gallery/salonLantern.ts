import {salonCeiling} from './salon.ts'

/** a point of a section through the lantern, square to one of its sides: how far out from its axis, measured on the plan from the middle of that side’s face, and how high */
export type LanternSection = readonly [out: number, y: number]

/** how much farther a corner of the octagon lies from its middle than the middle of a side */
const cornerReach = 1 / Math.cos(Math.PI / 8)
/** half the length of a side of the octagon, per meter of its apothem */
export const halfSide = Math.tan(Math.PI / 8)

/**
 * The Salon’s lantern, after the Tribuna of the Uffizi: an octagonal drum standing on the ceiling slab over an opening of the same shape, lit by a round-headed window in each of its eight sides, under a cloister dome whose eight sails are inlaid with mother-of-pearl shells in red lacquer, gilt ribs along its creases and a little glazed lantern over its eye.
 * The flat ceiling around it is ivory stucco, divided by molded bands into a square bay round the opening, with a gilt rosette in each of its spandrels, and a bay at either end.
 * Its sides face the walls. All values are in meters, relative to the room’s middle at floor level.
 */
const salonLantern = {
  /** from the middle to the drum’s inner face, the same as to the opening’s edge */
  apothem: 4.1,
  /** the molded ring round the opening, hanging below the ceiling: how wide and how deep */
  ring: [0.3, 0.1] as const,
  /** the gilt bead on the ring’s inner arris: its square section */
  bead: 0.05,
  drum: {
    /** thick enough to stand, thin enough that the sun at 51° still lights most of each window on the sunny side */
    thickness: 0.16,
    /** where the drum ends and the dome springs, on top of its inner cornice */
    top: 8.35,
  },
  window: {
    width: 2,
    /** the sill’s height, just above the slab */
    sill: 5.9,
    /** the arch’s crown, under the cornice */
    crown: 8.03,
    /** bronze glazing bars: width across them and depth into the drum */
    bar: [0.04, 0.06] as const,
    /** how far in from the drum’s outer face the glass sits */
    glassInset: 0.04,
  },
  /** the folded strip in every corner of the drum, carrying the dome’s ribs down to the opening: its width on either face and how far it stands out */
  strip: [0.2, 0.06] as const,
  /** the band under the windows, its height and how far it stands out */
  sillBand: [0.06, 0.035] as const,
  /** the architrave round every window: width and projection; its head stays clear of the cornice */
  architrave: [0.065, 0.035] as const,
  /** the inner cornice under the dome: its gilt lower band and its stucco upper one, each as height and projection */
  cornice: [[0.08, 0.1], [0.17, 0.2]] as const,
  dome: {
    rise: 1.6,
    /** the apothem of its eye, wide enough that much of the lantern’s light still falls past the drum’s north side into the room */
    oculus: 1.4,
    /** how much higher and farther out the outer face meets the eye than the inner one */
    shell: [0.2, 0.15] as const,
    /** segments of its profile, the least any shell course is cut into */
    segments: 32,
    /** the gilt ribs along its creases: width and how far they stand out */
    rib: [0.12, 0.05] as const,
  },
  shells: {
    /** the target width of a shell; every course fits a whole number of them between the ribs */
    width: 0.24,
    /** the height of a course, per meter of the shells’ width in it */
    course: 0.5,
    /** the plain lacquer between the shells and the creases, the cornice and the eye */
    margins: {
      ribs: 0.12,
      foot: 0.2,
      eye: 0.3,
    },
    /** how far the gilt fillets keep from the shells: those along the creases from the creases, those across the sail from the first and the last course */
    crease: 0.09,
    fillet: 0.07,
  },
  lantern: {
    /** the bronze curb round the eye that carries it: its apothems and height */
    curb: [1.38, 1.62, 0.06] as const,
    /** the apothem of the glass pyramid’s foot and its rise to the apex */
    glass: [1.52, 0.6] as const,
    /** the bronze hips */
    hip: [0.045, 0.05] as const,
    /** radius of the gilt ball on the apex */
    finial: 0.08,
  },
  /** the stucco bands dividing the ceiling: the square bay’s half size and the bands’ width and depth */
  bay: {
    half: 4.75,
    band: [0.2, 0.06] as const,
  },
  /** the molded border along the walls: how far in from their faces, its width and depth */
  border: [0.3, 0.12, 0.05] as const,
  /** the radii of the gilt rosettes in the square bay’s spandrels and of the larger ones in the end bays */
  rosettes: [0.36, 0.5] as const,
} as const

/** the underside of the ceiling slab, the flat ceiling around the lantern */
export const salonLanternBase = salonCeiling.underside
/** the dome’s springing line, the top of the drum */
export const salonDomeSpringY = salonLantern.drum.top
/** the dome’s eye, inside */
export const salonDomeEyeY = salonDomeSpringY + salonLantern.dome.rise
/** the top of the dome’s shell round the eye, where the lantern’s curb stands */
export const salonDomeTopY = salonDomeEyeY + salonLantern.dome.shell[0]
/** the foot of the lantern’s glass, on its curb */
export const salonLanternGlassY = salonDomeTopY + salonLantern.lantern.curb[2]
/** the apex of the lantern’s glass pyramid */
export const salonLanternApexY = salonLanternGlassY + salonLantern.lantern.glass[1]
/** the top of the finial, the highest point of the room */
export const salonLanternTopY = salonLanternApexY + salonLantern.lantern.finial * 2
/** the height of the arch’s springing in every window */
export const salonWindowSpringY = salonLantern.window.crown - salonLantern.window.width / 2
/** where the drum’s outer face lies from its middle */
export const salonDrumOuterApothem = salonLantern.apothem + salonLantern.drum.thickness

/** The eight corners of an octagon of the apothem around the middle, as [x, z], its sides facing ±x and ±z, counterclockwise seen from above with north up, starting with the corner south of the side facing +x; side `index` runs from corner `index` to the next. */
export function octagon(apothem: number): Array<readonly [number, number]> {
  const radius = apothem * cornerReach
  return Array.from({length: 8}, (_, index) => {
    const angle = -Math.PI / 8 + index * Math.PI / 4
    return [radius * Math.cos(angle), -radius * Math.sin(angle)] as const
  })
}

/** The outward unit normal [x, z] of the octagon’s side between corner `index` and the next: +x for the first, then on counterclockwise, −z (north) for the third. */
export function octagonSide(index: number) {
  const angle = index * Math.PI / 4
  return [Math.cos(angle), -Math.sin(angle)] as const
}

/**
 * The dome’s inner face at `angle`, from 0 at its springing, where it rises upright from the drum, to π/2 at its eye, where it lies flat: how far out from the middle the middle of a sail lies, and how high.
 * Every section is the springing’s octagon shrunk toward the middle, so each sail is a cylinder lying along its side.
 */
export function domeSection(angle: number, outer = false): LanternSection {
  const {apothem, dome, drum} = salonLantern
  const [foot, eye, rise] = outer ? [apothem + drum.thickness, dome.oculus + dome.shell[1], dome.rise + dome.shell[0]] : [apothem, dome.oculus, dome.rise]
  return [eye + (foot - eye) * Math.cos(angle), salonDomeSpringY + rise * Math.sin(angle)]
}

export default salonLantern
