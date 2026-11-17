import type {Collider, RigidBody, World} from '@dimforge/rapier3d-compat'

/** Only the player belongs exclusively to group 1. All existing scenery keeps its usual groups. */
export const playerCollisionGroups = 0x00_02_FF_FF
const playerBit = 0x00_02
const duration = 0.25

export function isPlayerCollider(collider: Collider) {
  const data = collider.parent()?.userData
  return !!data && typeof data === 'object' && 'isPlayer' in data && data.isPlayer === true
}

/** Player-only release grace, including the character controller’s shape queries. No world collider is disabled. Time advances only with physics; after the minimum grace, overlap extends it until separation instead of switching contact on inside the capsule. */
export default class ReleaseGrace {
  private static worlds = new WeakMap<World, ReleaseGrace>
  static for(world: World) {
    let grace = this.worlds.get(world)
    if (!grace) {
      grace = new ReleaseGrace
      this.worlds.set(world, grace)
    }
    return grace
  }
  private bodies = new Map<RigidBody, {
    groups: Array<[Collider, number]>
    remaining: number
  }>

  private players: Array<Collider> = []

  begin(body: RigidBody) {
    this.end(body)
    const groups: Array<[Collider, number]> = []
    for (let i = 0; i < body.numColliders(); i++) {
      const collider = body.collider(i)
      const original = collider.collisionGroups()
      groups.push([collider, original])
      collider.setCollisionGroups((original & ~playerBit) >>> 0)
    }
    this.bodies.set(body, {
      remaining: duration,
      groups,
    })
  }

  end(body: RigidBody) {
    const grace = this.bodies.get(body)
    if (!grace) {
      return
    }
    for (const [collider, groups] of grace.groups) {
      if (collider.isValid()) {
        collider.setCollisionGroups(groups)
      }
    }
    this.bodies.delete(body)
  }

  step(world: World) {
    if (!this.bodies.size) {
      return
    }
    for (const [body, grace] of this.bodies) {
      if (!body.isValid() || !body.isEnabled()) {
        this.end(body)
        continue
      }
      grace.remaining -= world.timestep
      if (grace.remaining > 0) {
        continue
      }
      // Player colliders are stable for a world. Do not walk thousands of scenery colliders every tick (or at all during the unconditional grace).
      if (!this.players.length || this.players.some(collider => !collider.isValid())) {
        this.players = []
        world.forEachCollider(collider => {
          if (isPlayerCollider(collider)) {
            this.players.push(collider)
          }
        })
      }
      const overlapping = grace.groups.some(([collider]) => collider.isValid() && this.players.some(player => {
        if (!player.isEnabled() || !player.parent()?.isEnabled()) {
          return false
        }
        const contact = collider.contactCollider(player, 0.02)
        return contact && contact.distance < 0.02
      }))
      if (!overlapping) {
        this.end(body)
      }
    }
  }
}
