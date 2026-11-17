/**
 * Columns across a routed floor, from its left wall’s center line `left` meters left of its centerline to its right one’s `right` meters right of it: its walls, its centerline and, with `valley`, where a crossfall starts falling toward the centerline that many meters to either side of it.
 * Between them the floor runs straight across, so a level stretch or a straight ramp needs no strips of its own; a ramp round a turn twists between them, as its inner edge climbs as much as its outer one over a shorter run, so with a `step`, strips about that wide follow its twist, as many in each stretch between those columns as the passage’s own `width` takes, so every station along a run, which an outline may widen, has as many.
 * A floor shaped across otherwise brings columns of its own, like an inlet’s or an outlet’s.
 */
export default function pavingColumns(left: number, right: number, valley?: number, twist?: {
  step: number
  width: number
}) {
  const kinks = (half: number) => (valley === undefined ? [] : [-valley, valley].filter(lateral => lateral > -half + 1e-9 && lateral < half - 1e-9 && Math.abs(lateral) > 1e-9))
  const columns = [-left, ...kinks(Math.min(left, right)), 0, right].toSorted((a, b) => a - b)
  if (!twist) {
    return columns
  }
  // How many strips each stretch takes, from the passage’s own width.
  const half = twist.width / 2
  const nominal = [-half, ...kinks(half), 0, half].toSorted((a, b) => a - b)
  if (nominal.length !== columns.length) {
    throw new RangeError('A twisting floor’s columns need its crossfall to start falling inside its walls all along.')
  }
  return [columns[0], ...columns.slice(1).flatMap((column, index) => {
    const previous = columns[index]
    const strips = Math.max(1, Math.ceil((nominal[index + 1] - nominal[index]) / twist.step - 1e-9))
    return Array.from({length: strips}, (_, strip) => previous + (column - previous) * (strip + 1) / strips)
  })]
}
