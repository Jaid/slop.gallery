/** Columns across a routed floor, with a knot on its centerline and strips at most 25 cm wide before any outline widens it. */
export default function pavingColumns(width: number, left = width / 2, right = width / 2) {
  const strips = Math.ceil(width / 2 / 0.25)
  return [
    ...Array.from({length: strips + 1}, (_, index) => -left + left * index / strips),
    ...Array.from({length: strips}, (_, index) => right * (index + 1) / strips),
  ]
}
