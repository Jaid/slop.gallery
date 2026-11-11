import type {Vec3} from './types.ts'

/**
 * An empty suit of plate armor standing to attention, made for the knight’s helmet: its collar is where the border of the helmet’s gorget rests.
 * In its own frame it stands on the floor at the origin, looking along +z, the axis of its neck rising straight up through the origin.
 *
 * It is a full 2 m tall with the helmet on: a 160 cm headless body and a 40 cm helmet over it. The body is a dynamic
 * rigid body of loose plate over an invisible stand-in frame, so a player who keeps pushing it overbalances it,
 * it strikes the wall or the floor, and the helmet — a separate body merely resting on its collar — is thrown off.
 */
export const suitOfArmor = {
  /** the height of the headless body, from its sabatons on the floor to the collar the helmet rests on */
  bodyHeight: 1.6,
  /** how high over the floor the helmet’s gorget rests on its shoulders, level with the top of the body */
  collar: 1.6,
  /** how heavy the body is, in kilograms: a full field harness, too heavy to carry but not to overbalance */
  mass: 32,
  /** its steel on stone: grippy enough that a push at chest height tips it over its sabatons instead of skating it across the floor */
  friction: 0.85,
  /** dead steel on stone, barely a bounce */
  restitution: 0.08,
  linearDamping: 0.01,
  angularDamping: 0.12,
} as const

/** one collider of the body’s physics frame, in the armor’s own frame; masses add up to {@link suitOfArmor.mass} */
export type SuitOfArmorCollider = {
  kind: 'ball' | 'cuboid' | 'cylinder'
  /** its share of the body’s mass, in kilograms */
  mass: number
  position: Vec3
  /** for a cuboid its full size, for a cylinder `[radius, full height]`, for a ball its radius */
  size: readonly [number, number, number] | readonly [number, number] | number
}

/**
 * The body’s physics frame: flat sabatons, legs, pelvis, cuirass, arms and shoulder balls under the visual plates,
 * and a flat-topped collar plate whose top is the seat the helmet’s gorget rests on: a hull lies still on a flat plate, where it walks off a curved one.
 * The mass sits low — legs, sabatons and pelvis carry most of it — so the suit stands steady when bumped,
 * sleeps standing up, and only a sustained push past its feet’s edge overbalances it.
 */
export const suitOfArmorColliders: ReadonlyArray<SuitOfArmorCollider> = [
  // The collar seat: a flat disc at the very top, wide enough for the gorget’s border all round.
  {
    kind: 'cuboid',
    size: [0.33, 0.05, 0.33],
    position: [0, suitOfArmor.collar - 0.025, 0],
    mass: 1,
  },
  // Cuirass and pelvis.
  {
    kind: 'cuboid',
    size: [0.38, 0.62, 0.3],
    position: [0, 1.24, 0],
    mass: 10,
  },
  {
    kind: 'cuboid',
    size: [0.36, 0.26, 0.28],
    position: [0, 0.88, 0],
    mass: 4,
  },
  // Legs and sabatons, the low ballast that keeps it standing.
  {
    kind: 'cuboid',
    size: [0.13, 0.78, 0.16],
    position: [-0.105, 0.45, 0.01],
    mass: 5,
  },
  {
    kind: 'cuboid',
    size: [0.13, 0.78, 0.16],
    position: [0.105, 0.45, 0.01],
    mass: 5,
  },
  {
    kind: 'cuboid',
    size: [0.13, 0.07, 0.33],
    position: [-0.11, 0.035, 0.05],
    mass: 1.5,
  },
  {
    kind: 'cuboid',
    size: [0.13, 0.07, 0.33],
    position: [0.11, 0.035, 0.05],
    mass: 1.5,
  },
  // Arms hanging at its sides, with a ball under each pauldron.
  {
    kind: 'cuboid',
    size: [0.11, 0.64, 0.13],
    position: [-0.27, 1.05, -0.005],
    mass: 1.6,
  },
  {
    kind: 'cuboid',
    size: [0.11, 0.64, 0.13],
    position: [0.27, 1.05, -0.005],
    mass: 1.6,
  },
  {
    kind: 'ball',
    size: 0.095,
    position: [-0.235, 1.47, -0.005],
    mass: 0.4,
  },
  {
    kind: 'ball',
    size: 0.095,
    position: [0.235, 1.47, -0.005],
    mass: 0.4,
  },
]

/** The body’s center of mass in its own frame, from its colliders’ masses — kept low and centered over its sabatons. */
export function suitOfArmorCenterOfMass(): Vec3 {
  const total = suitOfArmorColliders.reduce((sum, collider) => sum + collider.mass, 0)
  const center = suitOfArmorColliders.reduce<Vec3>((sum, {mass, position}) => [sum[0] + position[0] * mass, sum[1] + position[1] * mass, sum[2] + position[2] * mass], [0, 0, 0])
  return [center[0] / total, center[1] / total, center[2] / total]
}
