import type {Rolls, Spread} from './base/OpeningStyle.ts'
import type {Polygon, Polygons} from './lib/polygons.ts'

import OpeningStyle from './base/OpeningStyle.ts'
import {arc, circle, inset, narrowerThan, point, rotate, stroke, subtract, translate} from './lib/polygons.ts'

/** A lancet `width` wide, its foot on the x axis from `left`, rising `springing` straight along +y before its equilateral pointed arch: each side’s arc as wide as the lancet, round the opposite springing point. */
function lancet(width: number, springing: number, left = -width / 2): Polygon {
  const right = left + width
  // The arcs meet over the middle, where each has turned 60° from its springing point.
  return [
    point(left, 0),
    point(right, 0),
    ...arc(point(left, springing), width, 0, Math.PI / 3),
    ...arc(point(right, springing), width, Math.PI * 2 / 3, Math.PI).slice(1),
  ]
}

/** Pointed Gothic lancets side by side over all the room they have, in one tier or, where they would grow too slender, in two or three, every other tier’s heads turned the other way, each glazed plain or by chance in Y tracery. */
export default class LancetStyle extends OpeningStyle {
  readonly description = 'Tiers of Gothic lancets, by chance in Y tracery with an oculus'
  readonly id = 'lancets'

  make(rolls: Rolls, spread: Spread) {
    const along = spread.x >= spread.y ? 'x' : 'y'
    const across = along === 'x' ? 'y' : 'x'
    const bar = this.bar(rolls, 0.05, 0.08)
    const gap = rolls.between('gap', 0.25, 0.5)
    const widest = rolls.between('width', 0.8, 1.3)
    const slender = rolls.between('slender', 2.2, 3.6)
    const tracery = rolls.chance('tracery', 0.65)
    const flip = rolls.chance('flip', 0.5)
    // As many tiers as keep the lancets about as slender as rolled, as many side by side as keep them about as wide, then more of them if a tier is too shallow for their heads.
    const tiers = Math.min(3, Math.max(1, Math.round((spread[across] * 2 + gap) / (widest * slender + gap))))
    const length = (spread[across] * 2 - (tiers - 1) * gap) / tiers
    let count = Math.max(1, Math.round((spread[along] * 2 + gap) / (widest + gap)))
    const width = () => (spread[along] * 2 - (count - 1) * gap) / count
    while (width() > length / 1.3) {
      count++
    }
    const head = width() * Math.sqrt(3) / 2
    const springing = Math.max(0, length - head)
    const single = tracery ? this.traced(width(), springing, bar) : [lancet(width(), springing)]
    // A tier centered on the origin, its heads along +y.
    const tier = Array.from({length: count}, (_, index) => translate(single, point((index - (count - 1) / 2) * (width() + gap), -length / 2))).flat()
    const stacked = Array.from({length: tiers}, (_, index) => rotate(tier, index % 2 === 1 === flip ? 0 : Math.PI, point(0, (index - (tiers - 1) / 2) * (length + gap)))).flat()
    // A row along y lies turned a quarter.
    return along === 'x' ? stacked : rotate(stacked, Math.PI / 2)
  }

  /**
   * The panes of a lancet `width` wide rising `springing` before its head, its foot on the origin, in Y tracery: a mullion up its middle into two lights half as wide, springing a little lower, and an oculus over their heads as large as fits between them and the head’s arches, all of it stone `bar` wide, and glass wherever the stone leaves room, the spandrels round the oculus too.
   */
  private traced(width: number, springing: number, bar: number): Polygons {
    const drop = width * 0.12
    const lights = [lancet(width / 2, springing - drop, -width / 2), lancet(width / 2, springing - drop, 0)]
    // An oculus touching both of the head’s arches stands as high as its size lets it; the largest that still clears the lights’ inner arches, which turn round their outer springing points.
    const rise = (size: number) => Math.sqrt((width - size) ** 2 - (width / 2) ** 2)
    const clears = (size: number) => Math.hypot(width / 2, rise(size) + drop) >= width / 2 + size
    let [small, large] = [0, width / 2]
    for (let step = 0; step < 32; step++) {
      const size = (small + large) / 2
      if (clears(size)) {
        small = size
      } else {
        large = size
      }
    }
    const oculus = circle(point(0, springing + rise(small)), small)
    const glass = subtract(inset([lancet(width, springing)], bar / 2), stroke([...lights, oculus], bar))
    // The spandrels are small, so they only have to be wide enough to show at all.
    return glass.filter(pane => !narrowerThan(pane, this.smallest / 2))
  }
}
