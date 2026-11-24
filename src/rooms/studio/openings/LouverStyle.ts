import type {Rolls, Spread} from './base/OpeningStyle.ts'
import type {Polygon} from './lib/polygons.ts'

import OpeningStyle from './base/OpeningStyle.ts'
import {panes, point, rectangle, round} from './lib/polygons.ts'

/** Long strips side by side over all the room they have, running along it or by chance across it, each crossed by slats like louvers, which lay ladders of light onto the floor. */
export default class LouverStyle extends OpeningStyle {
  readonly description = 'Strips crossed by louver slats, along or across the room'
  readonly id = 'louvers'

  make(rolls: Rolls, spread: Spread) {
    const lengthwise = spread.x >= spread.y !== rolls.chance('crosswise', 0.3)
    // The strips run along `along`, side by side along `across`.
    const [along, across] = lengthwise ? ['x', 'y'] as const : ['y', 'x'] as const
    const slat = this.bar(rolls, 0.04, 0.07)
    const pitch = rolls.between('pitch', 0.15, 0.3)
    const gap = rolls.between('gap', 0.25, 0.55)
    const length = spread[along] * 2
    // As many strips as fit side by side at about the width rolled, widened to fill the room.
    const wanted = rolls.between('width', 0.4, 0.9)
    const strips = Math.max(1, Math.round((spread[across] * 2 + gap) / (wanted + gap)))
    const width = (spread[across] * 2 - (strips - 1) * gap) / strips
    // Rounded ends nearly as round as the strip is wide, which a strip rounded by its whole half width wouldn’t survive.
    const corner = rolls.chance('rounded', 0.4) ? Math.min(width, length) * 0.45 : 0
    return Array.from({length: strips}, (_, index) => {
      const offset = (index - (strips - 1) / 2) * (width + gap)
      const middle = along === 'x' ? point(0, offset) : point(offset, 0)
      const strip = rectangle(middle, along === 'x' ? length : width, along === 'x' ? width : length)
      const frame = corner ? round([strip], corner) : [strip]
      // The slats cross the strip at even steps, a slat right in its middle.
      const cells: Array<Polygon> = []
      const count = Math.ceil(length / pitch / 2) + 1
      for (let step = -count; step < count; step++) {
        const at = (step + 0.5) * pitch
        cells.push(along === 'x' ? rectangle(point(at, offset), pitch, width * 2) : rectangle(point(offset, at), width * 2, pitch))
      }
      return panes(frame, cells, slat, this.smallest)
    }).flat()
  }
}
