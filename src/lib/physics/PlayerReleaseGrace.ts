import type {Collider, RigidBody, World} from '@dimforge/rapier3d-compat'

/** Reserved exclusively for the gallery’s player. Its KCC queries use these groups too. */
export const playerCollisionGroups = 0x80_00_FF_FF
const playerBit = 0x80_00
const minimumGrace = 0.2

export function isPlayer(collider: Collider) {
  return (collider.parent()?.userData as {isPlayer?: boolean} | undefined)?.isPlayer === true
}

/** Ignore only the player, never scenery, until the release has had time to leave the capsule and is clear of it. Uses physics time, including catch-up steps, not wall time. */
export default class PlayerReleaseGrace {
  private elapsed = 0
  private saved: Array<{
    collider: Collider
    groups: number
  }> = []

  constructor(private readonly body: RigidBody, private readonly world: World) {}

  begin() {
    this.clear()
    for (let i = 0; i < this.body.numColliders(); i++) {
      const collider = this.body.collider(i)
      const groups = collider.collisionGroups()
      this.saved.push({
        collider,
        groups,
      })
      collider.setCollisionGroups(groups & ~playerBit)
    }
    this.elapsed = 0
  }

  clear() {
    for (const {collider, groups} of this.saved) {
      if (collider.isValid()) {
        collider.setCollisionGroups(groups)
      }
    }
    this.saved = []
  }

  step(seconds: number) {
    if (!this.saved.length || (this.elapsed += seconds) < minimumGrace) {
      return
    }
    // Direct shape queries deliberately bypass the temporarily masked groups. A little separation avoids restoring a grazing contact under the player’s feet.
    const players: Array<Collider> = []
    this.world.forEachCollider(player => {
      if (player.isEnabled() && !player.isSensor() && isPlayer(player)) {
        players.push(player)
      }
    })
    const overlapping = this.saved.some(({collider}) => collider.isValid() && players.some(player => player.contactCollider(collider, 0.04) !== null))
    if (!overlapping) {
      this.clear()
    }
  }
}
