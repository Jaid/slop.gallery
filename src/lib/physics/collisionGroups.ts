/**
 * Rapier interaction groups: the groups a collider belongs to in the high 16 bits, those it interacts with in the low 16. Two colliders touch only where each belongs to a group the other interacts with, and so do character controller queries filtered by the player’s groups.
 * Every collider but the player’s keeps Rapier’s default, belonging to and interacting with every group.
 */

/** the group only the player’s capsule belongs to */
export const playerGroup = 0x00_01
/** the player’s capsule: in its own group only, interacting with everything */
export const playerCollisionGroups = (playerGroup << 16 | 0xFF_FF) >>> 0
/** a prop that just left the player’s hands: like every other collider, but passing through the player’s capsule */
export const releasedCollisionGroups = (0xFF_FF << 16 | 0xFF_FF & ~playerGroup) >>> 0

/** Whether colliders in `a` and `b` interact, as Rapier decides it. */
export function interacts(a: number, b: number) {
  return (a >>> 16 & b & 0xFF_FF) !== 0 && (b >>> 16 & a & 0xFF_FF) !== 0
}
