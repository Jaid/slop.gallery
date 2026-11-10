import type {OrnamentOptions} from './frameGeometry.ts'

import {BoxGeometry, ExtrudeGeometry, LatheGeometry, Shape, Vector2} from 'three/webgpu'

import {ornament} from './frameGeometry.ts'

/** a point of a turned outline: how far out from its axis and how far along it */
export type TurnedPoint = readonly [radius: number, height: number]

/** A turned ornament like a rosette, a boss or a stud: the outline revolved round the z axis, which faces the viewer, in `segments` sides. */
export function turned(outline: ReadonlyArray<TurnedPoint>, segments: number, options?: OrnamentOptions) {
  const lathe = new LatheGeometry(outline.map(([radius, height]) => new Vector2(radius, height)), segments)
  // A lathe turns about y; tipped forward, its axis points at the viewer.
  lathe.rotateX(Math.PI / 2)
  return ornament(lathe, options)
}

/** A round-topped stud of `radius`, `height` over its foot, in `segments` sides and `rings` steps from its rim to its crown. */
export function dome(radius: number, height: number, {segments = 8, rings = 3, ...options}: OrnamentOptions & {
  rings?: number
  segments?: number
} = {}) {
  // From the rim round a quarter ellipse to the crown, which lies exactly on the axis.
  const outline = Array.from({length: rings + 1}, (_, ring): TurnedPoint => {
    const angle = ring / rings * Math.PI / 2
    return ring === rings ? [0, height] : [Math.cos(angle) * radius, Math.sin(angle) * height]
  })
  return turned(outline, segments, options)
}

/** A box of `width` × `height` × `depth` meters, its back on z = 0. */
export function block(width: number, height: number, depth: number, options?: OrnamentOptions) {
  const box = new BoxGeometry(width, height, depth)
  box.translate(0, 0, depth / 2)
  return ornament(box, options)
}

/** A flat shape of points in meters, counterclockwise, raised `depth` toward the viewer from z = 0, its front edge eased by a bevel of `bevel` meters. */
export function relief(points: ReadonlyArray<readonly [number, number]>, depth: number, {bevel = 0, ...options}: OrnamentOptions & {bevel?: number} = {}) {
  const shape = new Shape(points.map(([x, y]) => new Vector2(x, y)))
  const extrusion = new ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, depth - bevel),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  })
  // The bevel grows behind the back as well as in front; the back is against the frame, so it moves forward by it.
  extrusion.translate(0, 0, bevel)
  return ornament(extrusion, options)
}
