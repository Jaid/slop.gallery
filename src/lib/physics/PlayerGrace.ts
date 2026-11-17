import type {Collider, RigidBody, World} from '@dimforge/rapier3d-compat'

import {releasedCollisionGroups} from './collisionGroups.ts'

/** how long a prop that left the player’s hands passes through the player at least, in seconds of physics, so running on after a throw or a drop never bumps into it at once */
export const graceTime = 0.25
/** how far from the player’s capsule a prop has to be before it bumps into it again, in meters, so it never comes back to a touch it is still resting in */
const graceMargin = 0.04
/** every grace that is running, which {@link PlayerGrace.step} looks after */
const running = new Set<PlayerGrace>
/** the grace of every body that ever had one, so a body never has two at once */
const graces = new WeakMap<RigidBody, PlayerGrace>
/** the colliders of the player’s capsule in the world last stepped, found again whenever one of them is gone */
let players: {
  colliders: Array<Collider>
  world: World
} | undefined

/** Whether `collider` belongs to the player’s capsule, by the `isPlayer` of its body’s user data. */
export function isPlayerCollider(collider: Collider) {
  const data = collider.parent()?.userData
  return Boolean(data && typeof data === 'object' && 'isPlayer' in data && data.isPlayer === true)
}

/** Whether `world` still holds `collider`, which a collider removed, or one of a freed world, isn’t. */
function holds(world: World, collider: Collider) {
  try {
    return world.getCollider(collider.handle) === collider
  } catch {
    return false
  }
}
/** The colliders of the player’s capsule in `world`. */
function playerColliders(world: World) {
  if (players?.world !== world || !players.colliders.length || !players.colliders.every(collider => holds(world, collider))) {
    const colliders: Array<Collider> = []
    world.forEachCollider(collider => {
      if (isPlayerCollider(collider)) {
        colliders.push(collider)
      }
    })
    players = {
      world,
      colliders,
    }
  }
  return players.colliders
}

/**
 * The moment after a prop left the player’s hands, while it passes through the player’s capsule instead of being shoved out of it, and the player through it: a hand lets go of things within the body’s reach, often where the capsule stands. Only the player’s capsule, which is in a collision group of its own (see `collisionGroups.ts`), lets it through; it strikes everything else as ever.
 * It lasts at least {@link graceTime} and then until the prop is clear of the capsule, however long that takes, so a prop let go of at the player’s feet waits until the player stepped off it instead of being kicked out of it.
 */
export default class PlayerGrace {
  /** The grace of `body`, the same one every time. */
  static of(body: RigidBody) {
    let grace = graces.get(body)
    if (!grace) {
      grace = new PlayerGrace(body)
      graces.set(body, grace)
    }
    return grace
  }

  /** Looks after every running grace once `world` took a step of `seconds`, ending those that are over, and those of bodies no longer in it. */
  static step(world: World, seconds: number) {
    if (!running.size) {
      return
    }
    for (const grace of running) {
      grace.step(world, seconds)
    }
  }

  /** every collider of the body with the interaction groups it had before, while the grace runs */
  private kept: Array<{
    collider: Collider
    groups: number
  }> = []

  /** how long the grace runs at least from now, in seconds */
  private left = 0

  private constructor(readonly body: RigidBody) {}

  get active() {
    return running.has(this)
  }

  /** Lets the body pass through the player’s capsule from now on, for at least `seconds`. */
  begin(seconds = graceTime) {
    if (!this.active) {
      this.kept = Array.from({length: this.body.numColliders()}, (_, index) => {
        const collider = this.body.collider(index)
        return {
          collider,
          groups: collider.collisionGroups(),
        }
      })
      for (const {collider} of this.kept) {
        collider.setCollisionGroups(releasedCollisionGroups)
      }
      running.add(this)
    }
    this.left = seconds
  }

  /** Ends the grace at once, so the body bumps into the player again. */
  end() {
    if (!this.active) {
      return
    }
    running.delete(this)
    for (const {collider, groups} of this.kept) {
      try {
        collider.setCollisionGroups(groups)
      } catch {
        // The collider left a world that is gone.
      }
    }
    this.kept = []
  }

  /** Counts down `seconds` of physics in `world` and ends the grace once its time is up and the body is clear of the player’s capsule there, or at once if the body isn’t in it anymore. */
  step(world: World, seconds: number) {
    if (!this.active) {
      return
    }
    if (!this.kept.every(({collider}) => holds(world, collider))) {
      this.end()
      return
    }
    this.left -= seconds
    if (this.left > 0 || this.touchesPlayer(world)) {
      return
    }
    this.end()
  }

  /** Whether any part of the body is within {@link graceMargin} of the player’s capsule in `world`; a player out of the physics, like one flying, touches nothing. */
  touchesPlayer(world: World) {
    if (!this.body.isEnabled()) {
      return false
    }
    return playerColliders(world).some(player => player.isEnabled() && player.parent()?.isEnabled() !== false && this.kept.some(({collider}) => collider.isEnabled() && collider.contactCollider(player, graceMargin) !== null))
  }
}
