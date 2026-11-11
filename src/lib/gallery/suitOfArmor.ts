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
type ArmorBox = readonly [from: readonly [number, number, number], to: readonly [number, number, number]]

/** the height in the plate patterns’ drafting frame */
const originalCollar = 1.47
/** Boxes around its body, legs, feet and arms, in the finished armor’s frame. */
const suitOfArmorBoxes: ReadonlyArray<ArmorBox> = [
  [[-0.21, 0.88, -0.16], [0.21, originalCollar, 0.23]],
  ...[-1, 1].flatMap((side): Array<ArmorBox> => {
    const span = (inner: number, outer: number) => [inner * side, outer * side].toSorted((a, b) => a - b)
    const [legFrom, legTo] = span(0.02, 0.17)
    const [armFrom, armTo] = span(0.2, 0.33)
    return [
      [[legFrom, 0, -0.09], [legTo, 0.88, 0.11]],
      [[legFrom, 0, 0.11], [legTo, 0.12, 0.24]],
      [[armFrom, 0.7, -0.1], [armTo, originalCollar - 0.08, 0.11]],
    ]
  }),
].map(([from, to]) => [
  [from[0], from[1] * suitOfArmor.collar / originalCollar, from[2]],
  [to[0], to[1] * suitOfArmor.collar / originalCollar, to[2]],
] as const)

/**
 * Its collision surface, in its frame: the boxes round its body, legs, feet and arms, the body’s top level with the collar for the helmet to rest on.
 * It is a surface rather than solid boxes: against a convex shape, Rapier builds the contact of a hull’s face from only a few of its corners, and of the dozens round the border of its gorget, the helmet jitters on a box and walks off it, while it lies still on a surface, like on the floor.
 */
export function suitOfArmorCollision() {
  return mergeParts(suitOfArmorBoxes.map(([[x0, y0, z0], [x1, y1, z1]]) => {
    const box = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0)
    return box.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  }))
}
