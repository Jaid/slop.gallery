import type {LiveSegments} from '#src/lib/overlay/index.ts'
import type {DebugRenderPipeline, RigidBodySet, Shape} from '@dimforge/rapier3d-compat'
import type {RapierCollider, RapierContext, RapierRigidBody} from '@react-three/rapier'
import type {Object3D} from 'three/webgpu'

import {collectMeshPattern, compileMeshPattern} from 'capture-session'
import {Quaternion, Vector3} from 'three/webgpu'

const empty = new Float32Array(0)
const position = new Vector3
const rotation = new Quaternion
type FixedMesh = {
  position: Vector3
  rotation: Quaternion
  shape: Shape
}
const enabled = (collider: RapierCollider) => collider.isEnabled() && collider.parent()?.isEnabled() !== false
/** A visual child can be a sibling of its body’s colliders. Resolve it to its closest physics owner; matching a collider itself must not select its siblings. */
function matchingColliders({colliderStates, rigidBodyStates}: RapierContext, scene: Object3D, pattern: string) {
  const owners = new Map<Object3D, RapierCollider | RapierRigidBody>
  const selected = new Set<RapierCollider | RapierRigidBody>
  const matcher = compileMeshPattern(pattern)
  for (const {object, rigidBody} of rigidBodyStates.values()) {
    owners.set(object, rigidBody)
    // A portrait has an ID in analyze_world and dump_portraits, but its body need not have a scene name.
    const id: unknown = object.userData.propId ?? object.userData.portraitId
    if (typeof id === 'string' && matcher.match(id)) {
      selected.add(rigidBody)
    }
  }
  for (const {object, collider} of colliderStates.values()) {
    owners.set(object, collider)
  }
  for (const match of collectMeshPattern(scene, pattern)) {
    for (let node: Object3D | null = match; node; node = node.parent) {
      const owner = owners.get(node)
      if (owner) {
        selected.add(owner)
        break
      }
    }
  }
  return (collider: RapierCollider) => {
    const parent = collider.parent()
    return (selected.has(collider) || parent !== null && selected.has(parent)) && enabled(collider)
  }
}

/** Reads the live shapes and their world poses from Rapier without stepping the simulation. */
export default class ColliderEdges implements LiveSegments {
  private fixed = new Map<RapierCollider, FixedMesh>
  private fixedEdges: Float32Array = empty
  private readonly noBodies: RigidBodySet
  private readonly pipeline: DebugRenderPipeline
  constructor(private readonly physics: RapierContext, private readonly scene: Object3D, private readonly selection: true | string) {
    this.noBodies = new physics.rapier.RigidBodySet
    this.pipeline = new physics.rapier.DebugRenderPipeline
  }
  dispose() {
    this.pipeline.free()
    this.noBodies.free()
  }
  read() {
    const {rapier, world} = this.physics
    const filter = this.selection === true ? enabled : matchingColliders(this.physics, this.scene, this.selection)
    // A newly spawned or teleported body’s colliders can still be at their previous poses while the world is paused.
    world.propagateModifiedBodyPositionsToColliders()
    // Fixed triangle meshes account for over a million edges in the gallery. Keep those together on the GPU until their membership, shape or pose actually changes.
    const fixed = new Map<RapierCollider, FixedMesh>
    const live = new Set<RapierCollider>
    let changed = false
    for (const collider of world.colliders.getAll()) {
      if (!filter(collider)) {
        continue
      }
      if (collider.shapeType() !== rapier.ShapeType.TriMesh || collider.parent()?.isFixed() === false || collider.isDeformable()) {
        live.add(collider)
        continue
      }
      collider.translation(position)
      collider.rotation(rotation)
      const previous = this.fixed.get(collider)
      if (previous?.shape === collider.shape && position.equals(previous.position) && rotation.equals(previous.rotation)) {
        fixed.set(collider, previous)
      } else {
        changed = true
        fixed.set(collider, {
          shape: collider.shape,
          position: position.clone(),
          rotation: rotation.clone(),
        })
      }
    }
    if (changed || fixed.size !== this.fixed.size) {
      this.fixedEdges = this.render(fixed)
    }
    this.fixed = fixed
    return [this.fixedEdges, this.render(live)]
  }
  private render(selected: Pick<Set<RapierCollider>, 'has' | 'size'>) {
    if (!selected.size) {
      return empty
    }
    const {world} = this.physics
    // world.debugRender() also draws axes and joints, even axes of colliderless bodies that no filter can exclude. The shapes only need the live collider set: their poses are already in world space.
    this.pipeline.render(this.noBodies, world.colliders, world.softBodies, world.impulseJoints, world.multibodyJoints, world.narrowPhase, undefined, collider => selected.has(collider))
    return this.pipeline.vertices
  }
}
