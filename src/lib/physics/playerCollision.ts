import type {Collider, RigidBody, World} from '@dimforge/rapier3d-compat'

import {Quaternion, Vector3} from 'three/webgpu'

/** The player has an exclusive membership, so a released item can ignore only the player. */
const playerBit = 0x80_00
export const playerCollisionGroups = (playerBit << 16 | 0xFF_FF) >>> 0
const grace = 0.25

/** Temporarily removes the player from a body's collision mask, until time has passed and its shapes no longer overlap the player. */
export class PlayerCollisionGrace {
  private elapsed = 0
  private original: Array<{
    collider: Collider
    groups: number
  }> = []
  constructor(private readonly world: World, private readonly body: RigidBody) {}

  begin() {
    this.restore()
    this.elapsed = 0
    this.original = Array.from({length: this.body.numColliders()}, (_, i) => {
      const collider = this.body.collider(i)
      const groups = collider.collisionGroups()
      collider.setCollisionGroups((groups & ~playerBit) >>> 0)
      return {
        collider,
        groups,
      }
    })
  }

  restore() {
    for (const {collider, groups} of this.original) {
      if (collider.isValid()) {
        collider.setCollisionGroups(groups)
      }
    }
    this.original = []
  }

  update(delta: number) {
    if (!this.original.length) {
      return
    }
    this.elapsed += delta
    if (this.elapsed < grace) {
      return
    }
    const overlapping = {value: false}
    this.world.forEachCollider(player => {
      const data = player.parent()?.userData
      if (!player.isEnabled() || !data || typeof data !== 'object' || !('isPlayer' in data) || data.isPlayer !== true) {
        return
      }
      for (const {collider} of this.original) {
        if (!collider.isValid()) {
          continue
        }
        // Collider world poses are only propagated at the next Rapier step after a body teleport.
        const rotation = this.body.rotation()
        const parent = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
        const offset = collider.translationWrtParent()!
        const local = collider.rotationWrtParent()!
        const center = new Vector3(offset.x, offset.y, offset.z)
        const position = this.body.translation()
        center.applyQuaternion(parent).add(new Vector3(position.x, position.y, position.z))
        const orientation = parent.multiply(new Quaternion(local.x, local.y, local.z, local.w))
        if (player.intersectsShape(collider.shape, center, orientation)) {
          overlapping.value = true
        }
      }
    })
    if (!overlapping.value) {
      this.restore()
    }
  }
}
