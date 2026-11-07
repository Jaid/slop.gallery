import type {Wall, WallOpening} from './wallGeometry.ts'

import {BufferGeometry, Float32BufferAttribute} from 'three/webgpu'

import {wallFace} from '../gallery/architectureDimensions.ts'
import {curveSegments} from '../gallery/CurvedBoxGeometry.ts'
import {openingBottom, openingTop, wallPosition} from './wallGeometry.ts'

/** a stretch of a wall from `from` to `to` along it and from `bottom` to `top` over its foot, in meters */
export type WallPatch = {
  bottom: number
  from: number
  to: number
  top: number
}

/** how far in front of a wall’s plaster the overlays lie, so the two never fight over depth */
const lift = 0.01
/** the widest column under or over the curved edge of an arch or a round opening, in meters */
const arcStep = 0.05
/** how many columns at least follow the curved edge of an arch or a round opening, however narrow */
const arcColumns = 32
/** the largest cell of an overlay drawn toward the camera, so its faces stay close to the wall wherever it is seen from */
const nudgedCell = 0.2
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
/**
 * The faces of the walls that artworks can hang on, every wall that isn’t `sticky: false`, with every opening and reservation left out, since nothing can hang over them.
 */
export function stickySurfaceGeometry(walls: ReadonlyArray<Wall>) {
  const sheet = new WallSheet
  for (const wall of walls) {
    if (wall.sticky === false) {
      continue
    }
    const cutouts = [...wall.holes ?? [], ...wall.reservations ?? []]
    for (const [from, to] of wallColumns(wall, cutouts)) {
      const middle = (from + to) / 2
      const crossing = cutouts.filter(cutout => Math.abs(middle - cutout.u) < cutout.width / 2).toSorted((a, b) => openingBottom(a, middle) - openingBottom(b, middle))
      const left = solidSpans(wall, crossing, from)
      const right = solidSpans(wall, crossing, to)
      for (const [index, span] of left.entries()) {
        sheet.quad(wall, from, to, span, right[index])
      }
    }
  }
  return sheet.build()
}

/** The reservations declared on the walls, each in its own outline, cut off where it reaches past its wall, in cells small enough to be drawn toward the camera. */
export function reservationGeometry(walls: ReadonlyArray<Wall>) {
  const sheet = new WallSheet(nudgedCell)
  for (const wall of walls) {
    for (const reservation of wall.reservations ?? []) {
      const half = reservation.width / 2
      for (const [from, to] of wallColumns(wall, [reservation], [reservation.u - half, reservation.u + half], nudgedCell)) {
        sheet.quad(wall, from, to, cutoutSpan(wall, reservation, from), cutoutSpan(wall, reservation, to))
      }
    }
  }
  return sheet.build()
}

/** Patches of walls, in cells small enough to be drawn toward the camera. */
export function patchGeometry(patches: ReadonlyArray<readonly [Wall, ReadonlyArray<WallPatch>]>) {
  const sheet = new WallSheet(nudgedCell)
  for (const [wall, wallPatches] of patches) {
    for (const {from, to, bottom, top} of wallPatches) {
      sheet.quad(wall, from, to, [bottom, top], [bottom, top])
    }
  }
  return sheet.build()
}

/** The columns, from and to along the wall within `range`, that split it where an opening or a reservation begins or ends, finely enough to follow arches, round openings and curved walls, and no wider than `maximumStep`. */
function wallColumns(wall: Wall, cutouts: ReadonlyArray<WallOpening>, range: readonly [number, number] = [-wall.width / 2, wall.width / 2], maximumStep = Infinity) {
  const [start, end] = [Math.max(range[0], -wall.width / 2), Math.min(range[1], wall.width / 2)]
  const edges = new Set([start, end])
  for (const cutout of cutouts) {
    for (const side of [-1, 1]) {
      edges.add(clamp(cutout.u + side * cutout.width / 2, start, end))
    }
  }
  const sorted = [...edges].toSorted((a, b) => a - b)
  const bendStep = wall.curveRadius ? wall.width / curveSegments(wall.width, wall.curveRadius) : Infinity
  const columns: Array<readonly [number, number]> = []
  for (const [index, from] of sorted.slice(0, -1).entries()) {
    const to = sorted[index + 1]
    if (to - from < 1e-6) {
      continue
    }
    const middle = (from + to) / 2
    const arcSteps = cutouts.filter(cutout => cutout.profile !== 'rectangle' && Math.abs(middle - cutout.u) < cutout.width / 2).map(cutout => Math.min(arcStep, cutout.width / arcColumns))
    const step = Math.min(bendStep, maximumStep, ...arcSteps)
    const count = Number.isFinite(step) ? Math.ceil((to - from) / step) : 1
    for (let column = 0; column < count; column++) {
      columns.push([from + (to - from) * column / count, from + (to - from) * (column + 1) / count])
    }
  }
  return columns
}
/** From and to over its wall’s foot, cut off at the wall, what a cutout covers at `u` along the wall; at its sides, a hair inside, where rounding can’t put `u` beside it. */
function cutoutSpan(wall: Wall, cutout: WallOpening, u: number) {
  const reach = cutout.width / 2 - 1e-9
  const along = clamp(u, cutout.u - reach, cutout.u + reach)
  const bottom = clamp(openingBottom(cutout, along), 0, wall.height)
  return [bottom, Math.max(bottom, clamp(openingTop(cutout, along), 0, wall.height))] as const
}
/** The stretches of a wall at `u` along it, from and to over its foot, that `cutouts`, sorted from the lowest up, leave solid; always one more than there are cutouts, some maybe empty. */
function solidSpans(wall: Wall, cutouts: ReadonlyArray<WallOpening>, u: number) {
  const spans: Array<readonly [number, number]> = []
  let floor = 0
  for (const cutout of cutouts) {
    const [bottom, top] = cutoutSpan(wall, cutout, u)
    spans.push([floor, Math.max(floor, bottom)])
    floor = Math.max(floor, top)
  }
  spans.push([floor, wall.height])
  return spans
}
/** An overlay on walls, in world space and just in front of their plaster, raked along with sloping walls and bent round curved ones; every vertex carries `wallPoint`, where along its wall and how high over its foot it lies, and `wallNormal`, the unit direction out of the wall into its room. */
class WallSheet {
  private readonly indices: Array<number> = []
  private readonly normals: Array<number> = []
  private readonly points: Array<number> = []
  private readonly positions: Array<number> = []

  constructor(private readonly cell = Infinity) {}

  build() {
    const geometry = new BufferGeometry
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('wallPoint', new Float32BufferAttribute(this.points, 2))
    geometry.setAttribute('wallNormal', new Float32BufferAttribute(this.normals, 3))
    geometry.setIndex(this.indices)
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return geometry
  }

  /** The quad between the column’s edges `from` and `to`, spanning `left` over its foot at `from` and `right` at `to`, in rows no taller than the sheet’s cell. */
  quad(wall: Wall, from: number, to: number, left: readonly [number, number], right: readonly [number, number]) {
    if (left[1] - left[0] < 1e-6 && right[1] - right[0] < 1e-6) {
      return
    }
    const rows = Number.isFinite(this.cell) ? Math.max(1, Math.ceil(Math.max(left[1] - left[0], right[1] - right[0]) / this.cell)) : 1
    const at = ([bottom, top]: readonly [number, number], row: number) => bottom + (top - bottom) * row / rows
    for (let row = 0; row < rows; row++) {
      // Counterclockwise seen from the room, so the front faces out of the wall.
      const corners = [this.vertex(wall, from, at(left, row)), this.vertex(wall, to, at(right, row)), this.vertex(wall, to, at(right, row + 1)), this.vertex(wall, from, at(left, row + 1))]
      this.indices.push(corners[0], corners[1], corners[2], corners[0], corners[2], corners[3])
    }
  }

  private vertex(wall: Wall, u: number, y: number) {
    const height = wall.center[1] + y + u * (wall.slope ?? 0)
    const position = wallPosition(wall, u, height, wallFace + lift)
    const outside = wallPosition(wall, u, height, wallFace + lift + 1)
    this.positions.push(...position)
    this.points.push(u, y)
    this.normals.push(...outside.map((value, axis) => value - position[axis]))
    return this.positions.length / 3 - 1
  }
}
