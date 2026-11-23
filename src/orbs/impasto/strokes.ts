import type {ImpastoPaint} from '#src/lib/materials/impastoPaints.ts'

import {Vector3} from 'three/webgpu'

import {impastoIndex} from '#src/lib/materials/impastoPaints.ts'

/**
 * The ball of paint inside the glass, in orb radii: the core the knife strokes are laid on, how high their paint stands over it at most, how many courses of strokes run round it from pole to pole, how much longer than high a course’s cells are at its middle and how far its axis leans off the axis the ball turns round, in radians, so its poles wander as it turns.
 * The core never shows; every point of it lies under paint.
 */
export const impastoBall = {
  core: 0.62,
  relief: 0.15,
  courses: 13,
  aspect: 1.6,
  tilt: 0.2,
} as const

/**
 * The outline of a stroke in its own coordinates, `x` along the way the knife was dragged and `y` across it, both −1 to 1 at its nominal ends and sides: how far its torn sides stray out and in, how far the rounded end where the blade set down curves back at the sides, how far its heaped lip strays out and in, and how soft its cut edges are, in radians round the ball.
 * The shader and {@link strokeFootprint} share it, so the tests can check what the shader draws.
 */
export const impastoOutline = {
  ragged: 0.08,
  setDown: 0.32,
  lip: 0.06,
  edge: 0.01,
} as const

/** the knife’s twisted dab of paint on either pole, laid last, over the ends of the courses converging there: its radius, in radians, and how far its edge strays out and in, as a share of it */
export const impastoCap = {
  radius: 0.24,
  ragged: 0.08,
} as const

/** how high a course is, in radians of latitude */
export const courseHeight = Math.PI / impastoBall.courses

/**
 * One course of strokes round the ball: how many strokes it holds, which way they are dragged, 1 eastward (toward growing longitude, `atan2(z, x)`) or −1 westward, how far round its cells are shifted, in cells, and the index of its first stroke in {@link impastoStrokes}.
 * The courses are laid from the bottom up, each partly over the one below, and the strokes of a course against the way they are dragged, so every stroke’s heaped lip lies on top of where the next one ahead set down, but for the one place round the course where the first and the last stroke meet.
 */
export type ImpastoCourse = {
  count: number
  direction: -1 | 1
  offset: number
  start: number
}

/**
 * A knife stroke laid on the ball: its middle and the way it was dragged and across it, unit vectors in the ball’s frame, how far it reaches out of its middle along and across, in radians round the ball, how thick its paint is, as a share of the usual, its paint by its index in `impastoOrder`, a number from 0 to 100 telling it apart for its torn edges and scoring, the course and cell it lies in and its place in the order all strokes were laid in, the last one on top.
 */
export type ImpastoStroke = ImpastoStrokeShape & {
  paint: number
}

/** where a stroke lies and how it is shaped, everything of it but its paint */
export type ImpastoStrokeShape = {
  across: Vector3
  along: Vector3
  cell: number
  center: Vector3
  course: number
  halfLength: number
  halfWidth: number
  layer: number
  load: number
  seed: number
}

/** A pseudo-random number from 0 to 1 for the number, the same on every run. */
const scatter = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43_758.5453
  return value - Math.floor(value)
}
/**
 * The paints a stroke takes by where it lies, from the bottom of the ball to the top, a dusk over the sea wrapped round it: Prussian blue in the deep below, cobalt teal swells, alizarin and cadmium orange glowing along a wavering horizon, Naples yellow and titanium white above.
 * Where a stroke it touches already has the paint of its place, the knife rather takes the next one up or down the ramp, so neighbors stand apart without the dusk breaking up.
 */
const dusk = ['prussianBlue', 'cobaltTeal', 'alizarinCrimson', 'cadmiumOrange', 'naplesYellow', 'titaniumWhite'] as const satisfies ReadonlyArray<ImpastoPaint>
/** the heights on the ball (`y`, −1–1) at which the paints of {@link dusk} are each the knife’s first pick, from the deep to the sky */
const duskHeights = [-0.8, -0.4, -0.04, 0.2, 0.48, 0.8] as const
/** Where on the dusk ramp the paint at `center` comes from, 0 at the bottom to the last paint’s index at the top, the horizon wavering round the ball. */
function duskAt(center: Vector3) {
  const longitude = Math.atan2(center.z, center.x)
  const y = center.y - Math.sin(longitude * 2 + 0.7) * 0.1 - Math.sin(longitude * 3 - 1.9) * 0.05
  const above = duskHeights.findIndex(height => height > y)
  if (above === 0) {
    return 0
  }
  if (above === -1) {
    return dusk.length - 1
  }
  return above - 1 + (y - duskHeights[above - 1]) / (duskHeights[above] - duskHeights[above - 1])
}
/** how far up or down the ramp the knife would rather go than repeat the paint of a stroke it touches in its own course and in the next; it rather repeats one than goes two steps */
const repeatCost = {
  course: 1.6,
  next: 0.7,
} as const
/** the latitude of the middle of course `course`, in radians */
const courseLatitude = (course: number) => -Math.PI / 2 + (course + 0.5) * courseHeight

/** the courses of strokes from the bottom pole up: as many cells round as fit cells {@link impastoBall}`.aspect` times as long as high at the course’s middle, at least three, so the strokes of a polar course all lie within one cell of each other, as the shader looks no farther */
export const impastoCourses: ReadonlyArray<ImpastoCourse> = (() => {
  const courses: Array<ImpastoCourse> = []
  let start = 0
  for (let course = 0; course < impastoBall.courses; course++) {
    const count = Math.max(3, Math.round(Math.PI * 2 * Math.cos(courseLatitude(course)) / (courseHeight * impastoBall.aspect)))
    courses.push({
      count,
      direction: course % 2 ? 1 : -1,
      // Golden-ratio steps from course to course keep the ends of the strokes from lining up in columns.
      offset: (course * 0.618034 + 0.13) % 1,
      start,
    })
    start += count
  }
  return courses
})()

/** the strokes’ shapes and places, before their paints are picked */
const strokeShapes: ReadonlyArray<ImpastoStrokeShape> = impastoCourses.flatMap(({count, direction, offset, start}, course) => {
  const latitude = courseLatitude(course)
  // Cells widen toward the equator, so strokes are sized for the cells a little equatorward of the course’s middle, where they need the length to meet end to end, most of all round the poles.
  const cellWidth = Math.PI * 2 * Math.cos(latitude - Math.sign(latitude) * courseHeight * 0.2) / count
  return Array.from({length: count}, (_, cell) => {
    const seed = course * 37 + cell * 3.7 + 0.5
    const strokeLatitude = latitude + (scatter(seed + 0.1) - 0.5) * 0.16 * courseHeight
    const longitude = (cell + offset + (scatter(seed + 0.2) - 0.5) * 0.26) * Math.PI * 2 / count
    const center = new Vector3(Math.cos(strokeLatitude) * Math.cos(longitude), Math.sin(strokeLatitude), Math.cos(strokeLatitude) * Math.sin(longitude))
    const east = new Vector3(-Math.sin(longitude), 0, Math.cos(longitude))
    const north = new Vector3
    north.crossVectors(east, center).normalize()
    // Every course slants its strokes up the way they are dragged, which turns from course to course, so the courses lock together like a herringbone; every stroke strays a little off it.
    const slant = 0.24 + (scatter(seed + 0.3) - 0.5) * 0.24
    const along = east.clone().multiplyScalar(Math.cos(slant) * direction).addScaledVector(north, Math.sin(slant)).normalize()
    const across = new Vector3
    across.crossVectors(center, along).normalize()
    return {
      center,
      along,
      across,
      halfLength: cellWidth * (0.76 + scatter(seed + 0.8) * 0.1),
      halfWidth: courseHeight * (0.78 + scatter(seed + 0.9) * 0.08),
      load: 0.85 + scatter(seed + 1.1) * 0.3,
      seed: scatter(seed + 1.2) * 100,
      course,
      cell,
      layer: start + (direction > 0 ? count - 1 - cell : cell),
    }
  })
})
/** Whether the paint of the two strokes may touch anywhere: whether any point of a grid over the first one’s footprint lies within the second one’s reach. */
function touching(first: ImpastoStrokeShape, second: ImpastoStrokeShape) {
  const reach = (stroke: ImpastoStrokeShape) => Math.hypot(stroke.halfLength * (1 + impastoOutline.lip), stroke.halfWidth * (1 + impastoOutline.ragged))
  if (first.center.angleTo(second.center) > reach(first) + reach(second)) {
    return false
  }
  const point = new Vector3
  for (let u = -1; u <= 1 + impastoOutline.lip; u += 0.15) {
    for (let v = -1 - impastoOutline.ragged; v <= 1 + impastoOutline.ragged; v += 0.15) {
      point.copy(first.center).addScaledVector(first.along, u * first.halfLength).addScaledVector(first.across, v * first.halfWidth).normalize()
      if (strokeMayCover(second, point)) {
        return true
      }
    }
  }
  return false
}

/** every knife stroke on the ball, course after course from the bottom up, each course’s strokes in the order of their cells */
export const impastoStrokes: ReadonlyArray<ImpastoStroke> = (() => {
  const neighbors = strokeShapes.map(stroke => strokeShapes.filter(other => other !== stroke && (touching(stroke, other) || touching(other, stroke))))
  const picked = new Map<ImpastoStrokeShape, number>
  return strokeShapes.map((stroke, index) => {
    const seed = stroke.course * 37 + stroke.cell * 3.7 + 0.5
    const share = duskAt(stroke.center) + (scatter(seed + 0.4) - 0.5) * 0.5
    const cost = (paint: number, place: number) => Math.abs(place - share) + Math.max(0, ...neighbors[index].map(other => (picked.get(other) === paint ? (other.course === stroke.course ? repeatCost.course : repeatCost.next) : 0)))
    const ranked = dusk.map((paint, place) => ({
      paint: impastoIndex(paint),
      cost: cost(impastoIndex(paint), place),
    })).toSorted((a, b) => a.cost - b.cost)
    const {paint} = ranked[0]
    picked.set(stroke, paint)
    return {
      ...stroke,
      paint,
    }
  })
})()

/**
 * Where the direction `point` (unit, in the ball’s frame) lies in the stroke’s own coordinates, the way the glass’s shader reckons it: `x` along and `y` across, −1 to 1 at its nominal ends and sides, projected onto the plane touching the ball at the stroke’s middle. Points on the far side of the ball lie far out.
 */
export function strokeFootprint(stroke: ImpastoStrokeShape, point: Vector3) {
  const facing = Math.max(point.dot(stroke.center), 0.2)
  return {
    x: point.dot(stroke.along) / facing / stroke.halfLength,
    y: point.dot(stroke.across) / facing / stroke.halfWidth,
  }
}

/** Whether the stroke’s paint may reach `point` however its torn sides and lip stray. */
export function strokeMayCover(stroke: ImpastoStrokeShape, point: Vector3) {
  if (point.dot(stroke.center) < 0.2) {
    return false
  }
  const {x, y} = strokeFootprint(stroke, point)
  return x >= y * y * impastoOutline.setDown - 1 && x <= 1 + impastoOutline.lip && Math.abs(y) <= 1 + impastoOutline.ragged
}

/** Whether the stroke’s paint covers `point` fully however its torn sides and lip stray. */
export function strokeSurelyCovers(stroke: ImpastoStrokeShape, point: Vector3) {
  if (point.dot(stroke.center) < 0.2) {
    return false
  }
  const {x, y} = strokeFootprint(stroke, point)
  const along = impastoOutline.edge / stroke.halfLength
  const across = impastoOutline.edge / stroke.halfWidth
  return x >= y * y * impastoOutline.setDown - 1 + along && x <= 1 - impastoOutline.lip - along && Math.abs(y) <= 1 - impastoOutline.ragged - across
}

/** Whether a pole’s dab covers `point` fully. */
export function capSurelyCovers(point: Vector3) {
  const facing = Math.abs(point.y)
  return Math.hypot(point.x, point.z) / facing <= impastoCap.radius * (1 - impastoCap.ragged) - impastoOutline.edge
}

/** The course the direction `point` (unit, in the ball’s frame) lies in and the cell it lies in of any course, the way the glass’s shader finds the strokes that may cover it: those of its own cell and the next either way, in its own course and the next either way. */
export function impastoCell(point: Vector3) {
  const latitude = Math.asin(Math.min(1, Math.max(-1, point.y)))
  const longitude = Math.atan2(point.z, point.x)
  const course = Math.min(impastoBall.courses - 1, Math.max(0, Math.floor((latitude + Math.PI / 2) / courseHeight)))
  const cellIn = ({count, offset}: ImpastoCourse) => {
    const cell = Math.floor(longitude / (Math.PI * 2) * count - offset + 0.5)
    return (cell % count + count) % count
  }
  return {
    course,
    cellIn,
  }
}

/** The indices in {@link impastoStrokes} of the strokes the shader looks at for the direction `point`. */
export function impastoCandidates(point: Vector3) {
  const {course, cellIn} = impastoCell(point)
  const candidates = new Set<number>
  for (const neighbor of [course - 1, course, course + 1]) {
    const entry = impastoCourses[neighbor] as ImpastoCourse | undefined
    if (!entry) {
      continue
    }
    const cell = cellIn(entry)
    for (const step of [-1, 0, 1]) {
      candidates.add(entry.start + ((cell + step) % entry.count + entry.count) % entry.count)
    }
  }
  return candidates
}
