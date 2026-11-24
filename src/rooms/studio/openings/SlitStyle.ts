import type {Rolls, Spread} from './base/OpeningStyle.ts'
import type {Polygon} from './lib/polygons.ts'

import OpeningStyle from './base/OpeningStyle.ts'
import {point, rectangle, unite} from './lib/polygons.ts'

/** Narrow slits across all the room they have, which lay thin blades of light, after Tadao Ando’s Church of the Light: a cross, a double cross, an asterisk, a row of parallel slits whose lengths swell toward the middle or a field of small crosses, none of them closing round a piece of the ceiling, which nothing would hold. */
export default class SlitStyle extends OpeningStyle {
  readonly description = 'Narrow slits: a cross, a double cross, an asterisk, parallel blades or a field of crosses'
  readonly id = 'slits'

  make(rolls: Rolls, spread: Spread) {
    const width = rolls.between('width', 0.08, 0.14)
    const figure = rolls.item('figure', ['cross', 'asterisk', 'double', 'parallel', 'crosses'] as const, [3, 2, 2, 3, 2])
    const along = spread.x >= spread.y ? 'x' : 'y'
    const across = along === 'x' ? 'y' : 'x'
    const [long, short] = [spread[along] * 2, spread[across] * 2]
    /** a slit `length` long along the longer axis, or across it, centered on `at` along the other */
    const slit = (length: number, lengthwise: boolean, at = 0) => (lengthwise === (along === 'x') ? rectangle(point(0, at), length, width) : rectangle(point(at, 0), width, length))
    switch (figure) {
      case 'cross': {
        // A Latin cross sometimes, its crossbar a third of the way along, otherwise a Greek one.
        const latin = rolls.chance('latin', 0.5)
        const crossbar = latin ? Math.min(long * 0.6, short) : short
        return unite([slit(long, true), slit(crossbar, false, latin ? (along === 'x' ? -long / 6 : long / 6) : 0)])
      }
      case 'asterisk': {
        // Each arm as long as the oval through the room’s edges is wide its way.
        const arms = rolls.integer('arms', 3, 4)
        const turn = rolls.chance('turn', 0.5) ? Math.PI / arms / 2 : 0
        return unite(Array.from({length: arms}, (_, index) => {
          const angle = turn + index / arms * Math.PI
          const reach = 1 / Math.hypot(Math.cos(angle) / (spread.x - width / 2), Math.sin(angle) / (spread.y - width / 2))
          return rectangle(point(0, 0), reach * 2, width, angle)
        }))
      }
      case 'double': {
        // One long slit crossed by two shorter ones, the upper shorter still, like a patriarchal cross.
        const crossbar = Math.min(long * 0.55, short)
        const apart = long * rolls.between('apart', 0.18, 0.28)
        return unite([slit(long, true), slit(crossbar * 0.7, false, -apart / 2), slit(crossbar, false, apart / 2)])
      }
      case 'parallel': {
        const pitch = rolls.between('pitch', 0.3, 0.55)
        const count = Math.max(3, Math.floor((short - width) / pitch) + 1)
        const step = (short - width) / (count - 1)
        const swell = rolls.between('swell', 0.3, 0.8)
        return Array.from({length: count}, (_, index): Polygon => {
          const offset = (index - (count - 1) / 2) * step
          return slit(long * (1 - swell * (offset / ((short - width) / 2)) ** 2), true, offset)
        })
      }
      case 'crosses': {
        // Small Greek crosses in a grid, its outer ones at the room’s edges.
        const arm = rolls.between('arm', 0.35, 0.7)
        const pitch = arm + rolls.between('pitch', 0.3, 0.6)
        const middles = (span: number) => {
          const count = Math.max(1, Math.floor((span - arm) / pitch) + 1)
          return Array.from({length: count}, (_, index) => (count === 1 ? 0 : -(span - arm) / 2 + index * (span - arm) / (count - 1)))
        }
        return middles(spread.x * 2).flatMap(x => middles(spread.y * 2).flatMap(y => unite([rectangle(point(x, y), arm, width), rectangle(point(x, y), width, arm)])))
      }
    }
  }
}
