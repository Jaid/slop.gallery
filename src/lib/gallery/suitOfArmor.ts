import {BoxGeometry} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'

/**
 * An empty suit of plate armor standing to attention, made for the knight’s helmet: its collar is where the border of the helmet’s gorget rests.
 * In its own frame it stands on the floor at the origin, looking along z, the axis of its neck rising straight up through the origin.
 * The whole knight, helmet included, is two meters tall: the helmet 40 cm, the headless body 160 cm up to the collar.
 */
export const suitOfArmor = {
  /** how high over the floor the helmet’s gorget rests on its shoulders */
  collar: 1.6,
  /** how tall the whole knight stands, the helmet on its shoulders */
  height: 2,
} as const

/** one convex piece of its collision, in its own frame: a hull, or a ball where a flat foot would stick to the paving */
export type ArmorCollider = {
  hull: Float32Array
} | {
  /** a ball’s middle and radius */
  ball: readonly [center: readonly [number, number, number], radius: number]
}

/** a box of its collision, by two opposite corners */
type Box = readonly [from: readonly [number, number, number], to: readonly [number, number, number]]

const span = (side: number, inner: number, outer: number) => [inner * side, outer * side].toSorted((a, b) => a - b)
/** the corners of a box between two opposite corners */
function boxCorners([from, to]: Box) {
  const geometry = new BoxGeometry(to[0] - from[0], to[1] - from[1], to[2] - from[2])
  geometry.translate((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2)
  const corners = Float32Array.from(geometry.getAttribute('position').array)
  geometry.dispose()
  return corners
}

/** the boxes its drawn collision is made of, the body’s top level with the collar */
const boxes: ReadonlyArray<Box> = [
  [[-0.19, 0.96, -0.16], [0.19, suitOfArmor.collar, 0.19]],
  ...[-1, 1].flatMap((side): Array<Box> => {
    const [legFrom, legTo] = span(side, 0.03, 0.15)
    const [armFrom, armTo] = span(side, 0.2, 0.32)
    return [
      [[legFrom, 0.22, -0.07], [legTo, 0.96, 0.07]],
      [[legFrom, 0, -0.06], [legTo, 0.2, 0.1]],
      [[armFrom, 0.82, -0.08], [armTo, suitOfArmor.collar - 0.14, 0.08]],
    ]
  }),
]

/**
 * Its collision surface, in its frame: the boxes round its body, legs, feet and arms, the body’s top level with the collar for the helmet to rest on.
 * It is a surface rather than solid boxes: against a convex shape, Rapier builds the contact of a hull’s face from only a few of its corners, and of the dozens round the border of its gorget, the helmet jitters on a box and walks off it, while it lies still on a surface, like on the floor.
 */
export function suitOfArmorCollision() {
  return mergeParts(boxes.map(([from, to]) => {
    const geometry = new BoxGeometry(to[0] - from[0], to[1] - from[1], to[2] - from[2])
    return geometry.translate((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2)
  }))
}

/** how far out to either side a sabaton’s ball stands, and how big it is */
const sole = {
  radius: 0.1,
  side: 0.1,
  // Under the mass, which sits on the suit’s middle, so it stands upright.
  forward: 0,
} as const

/**
 * The pieces the suit itself is simulated with: the cuirass, flat across the collar, a leg and an arm each side, and a ball of a sabaton under each leg.
 * The balls are what it stands on. A flat foot sinks into the paving’s welded skin and a shove cannot roll it, while a ball rolls, so a shove topples the suit.
 */
export function suitOfArmorColliders(): ReadonlyArray<ArmorCollider> {
  const {collar} = suitOfArmor
  return [
    {hull: boxCorners([[-0.19, 0.96, -0.16], [0.19, collar, 0.19]])},
    ...[-1, 1].flatMap(side => {
      const [legFrom, legTo] = span(side, 0.03, 0.15)
      const [armFrom, armTo] = span(side, 0.2, 0.32)
      return [
        {hull: boxCorners([[legFrom, 0.34, -0.07], [legTo, 0.96, 0.07]])},
        {ball: [[side * sole.side, sole.radius, sole.forward], sole.radius] as const},
        {hull: boxCorners([[armFrom, 0.82, -0.08], [armTo, collar - 0.14, 0.08]])},
      ]
    }),
  ]
}
