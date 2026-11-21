import type {Vec3} from 'math'

/** Append independent segments for an axis-aligned box. Omit either horizontal rim for a box drawn with an open end. */
export default function appendBoxEdges(edges: Array<number>, [x, y, z]: Readonly<Vec3>, [x2, y2, z2]: Readonly<Vec3>, bottom = true, top = true) {
  const rim = (height: number) => {
    edges.push(x, height, z, x2, height, z, x2, height, z, x2, height, z2, x2, height, z2, x, height, z2, x, height, z2, x, height, z)
  }
  if (bottom) {
    rim(y)
  }
  if (top) {
    rim(y2)
  }
  for (const cx of [x, x2]) {
    for (const cz of [z, z2]) {
      edges.push(cx, y, cz, cx, y2, cz)
    }
  }
}
