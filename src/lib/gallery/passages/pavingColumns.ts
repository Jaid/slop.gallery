/** The two planar slopes of the trough and the original bevel strips under its walls. Intermediate columns are coplanar and need no triangles of their own. */
export default function pavingColumns(width: number, left = width / 2, right = width / 2) {
  const strips = Math.ceil(width / 2 / 0.25)
  // Widened outlines can put the trough’s shoulder inside either half, so their original samples are not necessarily coplanar.
  if (left !== width / 2 || right !== width / 2) {
    return [
      ...Array.from({length: strips + 1}, (_, i) => -left + left * i / strips),
      ...Array.from({length: strips}, (_, i) => right * (i + 1) / strips),
    ]
  }
  return [...new Set([-left, -left + left / strips, 0, right - right / strips, right])]
}
