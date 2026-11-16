/** Columns across a routed floor: its walls’ centerlines and centerline, plus intermediate strips when the floor sags toward its middle. */
export default function pavingColumns(width: number, left = width / 2, right = width / 2, crossfall = true) {
  if (!crossfall) {
    return [-left, -left / 2, 0, right / 2, right]
  }
  const strips = Math.ceil(width / 2 / 0.5)
  return [
    ...Array.from({length: strips + 1}, (_, index) => -left + left * index / strips),
    ...Array.from({length: strips}, (_, index) => right * (index + 1) / strips),
  ]
}
