import type {Rolls, Spread} from './base/OpeningStyle.ts'
import type {Polygon} from './lib/polygons.ts'

import MotifStyle from './base/MotifStyle.ts'
import {outline} from './lib/outlines.ts'
import {motifsWithin, point, star} from './lib/polygons.ts'

/** A whole number of steps about `step` long filling a span reaching `span` either way, the step they take, and the middle of each of them, or of each of `of` such steps. */
function fill(span: number, step: number) {
  const count = Math.max(1, Math.round(span * 2 / step))
  const taken = span * 2 / count
  return {
    taken,
    at: (index: number, of = count) => (index - (of - 1) / 2) * taken,
    count,
  }
}

/** Screens pierced with stars after Islamic geometric screens: eight-pointed stars on a square grid with small four-pointed ones between them, or six-pointed stars on a hexagonal one with small triangles between, one screen stretched over all the room or several of them. */
export default class GirihStyle extends MotifStyle {
  readonly description = 'Pierced screens of eight- or six-pointed stars'
  readonly id = 'girih'
  protected readonly layouts = {
    field: 5,
    row: 1,
    flanked: 1,
  }
  protected override readonly stretches = true

  protected motif(rolls: Rolls, reach: Spread) {
    const kind = rolls.item('outline', ['square', 'octagon', 'circle', 'hexagon', 'rounded', 'stadium'] as const)
    // About as large stars whatever the screen’s size.
    const pitch = rolls.between('pitch', 0.5, 0.9)
    const web = this.bar(rolls, 0.05, 0.08)
    const hexagonal = rolls.chance('hexagonal', 0.35)
    const motifs: Array<Polygon> = []
    if (hexagonal) {
      // Six-pointed stars in rows, every other row shifted half a step and one shorter, small triangles in the gaps of three.
      const [columns, rows] = [fill(reach.x, pitch), fill(reach.y, pitch * Math.sqrt(3) / 2)]
      // Neighboring stars’ tips meet across a web.
      const outer = (Math.min(columns.taken, rows.taken * 2 / Math.sqrt(3)) - web) / 2
      const triangle = columns.taken / Math.sqrt(3) - outer * 0.5 - web
      for (let row = 0; row < rows.count; row++) {
        const count = row % 2 ? columns.count - 1 : columns.count
        for (let column = 0; column < count; column++) {
          const center = point(columns.at(column, count), rows.at(row))
          motifs.push(star(6, outer, outer * 0.58, 0, center))
          if (triangle <= this.smallest / 2 || column === count - 1) {
            continue
          }
          // Between it and its neighbor along the row, toward each row next to it.
          for (const [toward, turn] of [[1, Math.PI / 2], [-1, -Math.PI / 2]] as const) {
            if (row + toward >= 0 && row + toward < rows.count) {
              motifs.push(star(3, triangle, triangle * 0.5, turn, point(center.x + columns.taken / 2, center.y + toward * rows.taken / 3)))
            }
          }
        }
      }
    } else {
      // Eight-pointed stars, a small four-pointed star in each gap of four.
      const [columns, rows] = [fill(reach.x, pitch), fill(reach.y, pitch)]
      const outer = (Math.min(columns.taken, rows.taken) - web) / 2
      const small = Math.min(columns.taken, rows.taken) * Math.SQRT1_2 - outer - web * 1.4
      const fat = rolls.between('fat', 0.42, 0.58)
      for (let row = 0; row < rows.count; row++) {
        for (let column = 0; column < columns.count; column++) {
          const center = point(columns.at(column), rows.at(row))
          motifs.push(star(8, outer, outer * fat, 0, center))
          if (small > this.smallest / 2 && column < columns.count - 1 && row < rows.count - 1) {
            motifs.push(star(4, small, small * 0.45, 0, point(center.x + columns.taken / 2, center.y + rows.taken / 2)))
          }
        }
      }
    }
    // The outermost tips reach right to the rim, which a millimeter forgives.
    return motifsWithin(outline(kind, reach), motifs, web / 2 - 0.001)
  }
}
