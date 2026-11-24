import type {Rolls, Spread} from './base/OpeningStyle.ts'

import MotifStyle from './base/MotifStyle.ts'
import {latticeCells} from './lib/cells.ts'
import {outline, outlineKinds} from './lib/outlines.ts'
import {panes, point} from './lib/polygons.ts'

/** Openings glazed in a lattice of upright panes, or of diamonds like leaded lights, in a round or angular frame, its bars meeting the frame’s box at its corners, one stretched over all the room or several of them. */
export default class LatticeStyle extends MotifStyle {
  readonly description = 'Upright or diamond lattice in a round or angular frame'
  readonly id = 'lattice'
  protected readonly layouts = {
    field: 4,
    row: 1,
    grid: 2,
    flanked: 1,
  }
  protected override readonly stretches = true

  protected motif(rolls: Rolls, reach: Spread) {
    const kind = rolls.item('outline', outlineKinds)
    const bar = this.bar(rolls)
    const diagonal = rolls.chance('diagonal', 0.4)
    // About as wide panes whatever the frame’s size, as many across either way as fill it exactly, diamonds a little wider; two at the least.
    const pane = rolls.between('pane', 0.4, 0.8) * (diagonal ? 1.3 : 1)
    const [width, depth] = [reach.x, reach.y].map(span => span * 2 / Math.max(2, Math.round(span * 2 / pane)))
    const corner = point(-reach.x, -reach.y)
    const cover = Math.hypot(reach.x, reach.y)
    // A diamond reaches a whole pane’s width and depth between its corners, which lie on the box’s corners too.
    const cells = diagonal ? latticeCells(point(width / 2, depth / 2), point(width / 2, -depth / 2), cover, corner) : latticeCells(point(width, 0), point(0, depth), cover, corner)
    return panes(outline(kind, reach), cells, bar, this.smallest)
  }
}
