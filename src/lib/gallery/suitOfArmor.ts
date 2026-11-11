import type {Vec3} from './types.ts'

/**
 * An empty suit of plate armor standing to attention, made for the knight’s helmet: its collar is where the border of the helmet’s gorget rests.
 * Headless, it stands 160 cm tall, and with the helmet of 40 cm on its shoulders, 2 m. It is no statue but a body of its own, which tips over when pushed, and the helmet, a body of its own too, sitting loose in the cradle across its shoulders, slides off or flies off as it falls, wherever the fall takes it.
 * In its own frame it stands on the floor at the origin, looking along z, its left side toward x, the axis of its neck rising straight up through the origin.
 */
export const suitOfArmor = {
  /** how high over the floor the helmet’s gorget rests on its shoulders, which is as tall as it stands without the helmet */
  collar: 1.6,
  /** how steeply the cradle across its shoulders rises outward from where the border of the helmet’s gorget sits in it, in degrees: enough to settle the helmet back into its middle as the suit rocks, little enough to let it slide out once the suit leans over */
  cradle: 6,
  /** how much its steel grips what it falls on */
  friction: 0.9,
  /** how much its feet grip the floor, by the larger of theirs and the floor’s: so much that pushed, even by its feet, it tips over rather than slides */
  footing: 1.4,
  /** how heavy it is, in kilograms, about as much as a real harness of plate */
  mass: 30,
  /** how much it bounces back off what it strikes: hardly at all, a heap of steel */
  restitution: 0.08,
  /** how much the cradle grips the helmet, by the smaller of its own and the helmet’s: polished steel on polished steel, so the helmet slides out of it once the suit leans some 20° over */
  seat: 0.3,
} as const

/** a box of its body, by two opposite corners in its frame, how much of its mass it holds and how much it grips, its friction by the larger of its own and what it touches */
export type ArmorBox = {
  friction?: number
  from: Vec3
  mass: number
  name: string
  to: Vec3
}

/** how far under the collar the top of its chest’s box lies, so only the cradle across its shoulders holds the helmet up */
const shoulderGap = 0.012
const box = (name: string, from: Vec3, to: Vec3, mass: number, friction?: number): ArmorBox => ({
  name,
  from,
  to,
  mass,
  ...friction === undefined ? {} : {friction},
})
const mirrored = (side: number, [x0, y0, z0]: Vec3, [x1, y1, z1]: Vec3): [Vec3, Vec3] => {
  const [from, to] = [x0 * side, x1 * side].toSorted((a, b) => a - b)
  return [[from, y0, z0], [to, y1, z1]]
}

/**
 * The boxes its body collides with: its chest up to the level top of its shoulders, under the helmet’s gorget, its hips, its arms, its legs and its feet, each with its share of its mass, so it stands top-heavy enough to tip over and lands on its plates.
 * Its swelling breast stands proud of everything under it, and its feet stop short of the points of its sabatons: a player walking into it meets its chest first, high over its middle, and tips it over instead of shoving it along the floor.
 * Everything over the collar is the helmet’s own, and the top of its chest lies a little under it, see `suitOfArmorCradle`.
 */
export const suitOfArmorBoxes: ReadonlyArray<ArmorBox> = [
  box('chest', [-0.205, 1.18, -0.19], [0.205, suitOfArmor.collar - shoulderGap, 0.215], 9),
  box('hips', [-0.19, 0.9, -0.165], [0.19, 1.18, 0.185], 4),
  ...[1, -1].flatMap(side => {
    const name = side > 0 ? 'left' : 'right'
    return [
      box(`${name}-arm`, ...mirrored(side, [0.205, 0.71, -0.15], [0.37, suitOfArmor.collar - 0.03, 0.14]), 3.5),
      box(`${name}-leg`, ...mirrored(side, [0.025, 0.06, -0.11], [0.19, 0.9, 0.12]), 4),
      box(`${name}-foot`, ...mirrored(side, [0.04, 0, -0.1], [0.19, 0.11, 0.19]), 1, suitOfArmor.footing),
    ]
  }),
]

