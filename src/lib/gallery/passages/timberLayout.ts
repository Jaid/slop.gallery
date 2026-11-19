import type {Vec3} from '../types.ts'
import type Passage from './Passage.ts'

export type TimberSpan = {
  end: Vec3
  entryProjection?: number
  from?: number
  height: number
  /** whether the corners behind the knees are boarded up at both ends, where the lining ends in the open rather than in a room’s wall; by default only where it stops inside its span */
  spandrels?: boolean
  start: Vec3
  to?: number
  width: number
}

/** How far a timber lining projects past the structural wall ends at a room entrance, like a fitted reveal. */
export const timberEntranceProjection = 0.03
/** How far the ribs stand proud of a lining’s plank backing, into the passage and down from its crown. */
export const timberRibInset = 0.16
/** At most this far between two ribs of a lining, leaving a bay of plank backing wide enough for a work between them while framing the Lodge’s window cleanly. */
export const timberRibSpacing = 1.8

/** The timber spans lining a passage, one per span of its path. */
export function passageTimberSpans(passage: Passage): Array<Required<TimberSpan>> {
  return passage.spans.map(({start, end, from, to}, i) => ({
    start: [start[0], passage.floorY, start[1]],
    end: [end[0], passage.floorY, end[1]],
    width: passage.width,
    height: passage.height,
    entryProjection: i === 0 ? timberEntranceProjection : 0,
    // Keep the entire elbow open; the passage's timber ceiling closes these junctions.
    from,
    to,
    spandrels: false,
  }))
}

/** The ribs of a lining running from `front` to `to` along its span, as the distances where each starts and ends: one flush with either end and the rest evenly between, at most {@link timberRibSpacing} apart. */
export function timberRibs(front: number, to: number) {
  const count = Math.max(1, Math.ceil((to - front) / timberRibSpacing))
  const depth = Math.min(0.19, (to - front) / 3)
  return Array.from({length: count + 1}, (_, rib) => {
    const start = front + (to - front - depth) * rib / count
    return [start, start + depth] as const
  })
}

/** The ribs of a passage’s timber lining along one of its spans, see {@link timberRibs}. */
export function passageRibs(passage: Passage, span: number) {
  const {from, entryProjection, to} = passageTimberSpans(passage)[span]
  return timberRibs(from - entryProjection, to)
}
