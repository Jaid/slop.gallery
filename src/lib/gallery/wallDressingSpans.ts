import type {Wall} from '../placement/wallGeometry.ts'

/**
 * Wall-local u ranges a horizontal band of wall dressing can run along without crossing a walk-through opening or its trim.
 * The ends are pulled in by `inset`, so bands of neighboring walls meet at the corners instead of reaching through them.
 */
export default function wallDressingSpans(wall: Pick<Wall, 'holes' | 'width'>, padding: number, inset = 0): Array<readonly [number, number]> {
  let spans: Array<readonly [number, number]> = [[-wall.width / 2 + inset, wall.width / 2 - inset]]
  for (const hole of wall.holes ?? []) {
    if ((hole.bottom ?? 0) > 0) {
      continue
    }
    const left = hole.u - hole.width / 2 - padding
    const right = hole.u + hole.width / 2 + padding
    spans = spans.flatMap(([start, end]) => [[start, Math.min(end, left)], [Math.max(start, right), end]] as const).filter(([start, end]) => end - start > 1e-6)
  }
  return spans
}
