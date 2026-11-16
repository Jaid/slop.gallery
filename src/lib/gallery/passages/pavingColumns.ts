import {wallFace} from '../architectureDimensions.ts'

/**
 * Columns across a routed floor, from its left wall’s center line to its right one’s: where its height can bend across – both edges, its centerline and where a crossfall reaches the walls’ faces, `wallFace` inside the nearer wall’s center line, see `RoutedPassage.sag` – and strips at most half a meter wide in between. The bend columns make every strip’s crosswise fall exact, where columns only every 25 cm used to repeat the same planes; the remaining strips still follow how the swept surface twists round a turn, which is what steers whatever rolls across it.
 */
export default function pavingColumns(width: number, left = width / 2, right = width / 2) {
  const strips = Math.ceil(width / 2 / 0.5)
  const inner = Math.min(left, right) - wallFace
  return [
    ...Array.from({length: strips + 1}, (_, index) => -left + left * index / strips),
    ...Array.from({length: strips}, (_, index) => right * (index + 1) / strips),
    ...inner > 0 ? [-inner, inner] : [],
  ].toSorted((a, b) => a - b).filter((value, index, all) => index === 0 || value - all[index - 1] > 1e-9)
}
