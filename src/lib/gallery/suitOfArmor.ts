import {BoxGeometry} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'

/**
 * An empty suit of plate armor standing to attention, made for the knight’s helmet: its collar is where the border of the helmet’s gorget rests.
 * In its own frame it stands on the floor at the origin, looking along z, the axis of its neck rising straight up through the origin.
 */
export const suitOfArmor = {
  /** how high over the floor the helmet’s gorget rests on its shoulders */
  collar: 1.6,
} as const

/** a box of its collision, by two opposite corners */
type Box = readonly [from: readonly [number, number, number], to: readonly [number, number, number]]

/** the boxes its collision is made of: its body from the waist up to the collar, its legs and its feet, and its arms, below the collar, clear of the helmet’s hull */
const boxes: ReadonlyArray<Box> = [
  [[-0.2, 0.96, -0.17], [0.2, suitOfArmor.collar, 0.2]],
  ...[-1, 1].flatMap((side): Array<Box> => {
    const span = (inner: number, outer: number) => [inner * side, outer * side].toSorted((a, b) => a - b)
    const [legFrom, legTo] = span(0.02, 0.18)
    const [armFrom, armTo] = span(0.22, 0.36)
    return [
      [[legFrom, 0, -0.1], [legTo, 0.96, 0.12]],
      [[legFrom, 0, 0.12], [legTo, 0.13, 0.26]],
      [[armFrom, 0.76, -0.11], [armTo, suitOfArmor.collar - 0.08, 0.12]],
    ]
  }),
]

/**
 * Its collision surface, in its frame: the boxes round its body, legs, feet and arms, the body’s top level with the collar for the helmet to rest on.
 * It is a surface rather than solid boxes: against a convex shape, Rapier builds the contact of a hull’s face from only a few of its corners, and of the dozens round the border of its gorget, the helmet jitters on a box and walks off it, while it lies still on a surface, like on the floor.
 */
export function suitOfArmorCollision() {
  return mergeParts(boxes.map(([[x0, y0, z0], [x1, y1, z1]]) => {
    const box = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0)
    return box.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  }))
}
