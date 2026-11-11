import type {Vec3} from '../../../src/lib/gallery/types.ts'
import type {BufferGeometry} from 'three/webgpu'

import RAPIER from '@dimforge/rapier3d-compat'
import {ExtrudeGeometry, Matrix4, Quaternion, Vector3} from 'three/webgpu'

import {colliderGeometry, createArchitectureGeometry} from '../../../src/lib/gallery/architecture.ts'
import {bastionCrater} from '../../../src/lib/gallery/bastion.ts'
import {bastionLinkGate, bastionNetwork, climbMouthHollow, lodgeSpurArmor, lodgeSpurGrille} from '../../../src/lib/gallery/bastionNetwork.ts'
import CisternGeometry, {cisternWindowGeometry} from '../../../src/lib/gallery/cistern/CisternGeometry.ts'
import InflowGeometry from '../../../src/lib/gallery/cistern/InflowGeometry.ts'
import {climbMouth} from '../../../src/lib/gallery/climb.ts'
import {helmet} from '../../../src/lib/gallery/curios/index.ts'
import {slabHulls} from '../../../src/lib/gallery/floorPolygons.ts'
import forge from '../../../src/lib/gallery/forge.ts'
import {forgeRoundVestibule, vestibuleArches} from '../../../src/lib/gallery/forgeVestibule.ts'
import gateGeometry from '../../../src/lib/gallery/gateGeometry.ts'
import Passage from '../../../src/lib/gallery/passages/Passage.ts'
import RouteVaultGeometry from '../../../src/lib/gallery/passages/RouteVaultGeometry.ts'
import VaultGeometry from '../../../src/lib/gallery/passages/VaultGeometry.ts'
import roundRevealGeometry from '../../../src/lib/gallery/roundRevealGeometry.ts'
import {roundVestibuleFloorShape, vestibuleArchOpening} from '../../../src/lib/gallery/roundVestibule.ts'
import {suitOfArmor, suitOfArmorColliders} from '../../../src/lib/gallery/suitOfArmor.ts'
import {weldedSurfaceSkin} from '../../../src/lib/physics/weldedSurface.ts'
import walls from '../fixtures/gallery.ts'
import {bastionCraterGeometry} from './bastionCrater.ts'

type Shape = {
  /** giving nothing back, its restitution 0 by the Min rule */
  dead?: boolean
  /** welded, so nothing catches on its facets’ inner edges, with its skin, like `MeshSurfaceCollider` */
  fix?: boolean
  rotation?: number
  translation?: Vec3
  triangles: [Float32Array, Uint32Array]
}
/** The Bastion’s walls, passages, the hollow in its western mouth, its gate and crater in its blind branch with the barred window behind where the suit of armor stands, as the game builds their fixed colliders. The armor itself is a dynamic body, see `addSuitOfArmor`. */
export function bastionColliders() {
  const colliders = new Colliders
  colliders.walls(['bastion'])
  for (const passage of bastionNetwork) {
    if (passage instanceof Passage) {
      const vault = new VaultGeometry(passage)
      for (const part of [vault.shell, vault.ribs]) {
        if (part.hasAttribute('position')) {
          colliders.surface(part)
        }
      }
      vault.dispose()
      // A straight passage’s floor and ceiling are slabs of their own, the floor without its hollow’s footprint, see CoveredPassage.
      const hollow = passage === climbMouth ? climbMouthHollow : undefined
      const crown = passage.floorY + passage.height
      for (const floor of passage.floors) {
        colliders.hulls.push(...slabHulls(floor, crown, crown + 0.24))
        for (const piece of hollow ? hollow.cut(floor) : [floor]) {
          colliders.hulls.push(...slabHulls(piece, passage.floorY - 0.24, passage.floorY))
        }
      }
      if (hollow) {
        const sunken = hollow.geometry()
        colliders.surface(sunken, true)
        sunken.dispose()
      }
      continue
    }
    const vault = new RouteVaultGeometry(passage)
    colliders.surface(vault.pavingCollision, passage.fixPavingEdges)
    colliders.surface(vault.shell)
    colliders.surface(vault.ribs)
    vault.dispose()
  }
  for (const grille of [bastionLinkGate, lodgeSpurGrille]) {
    const bars = gateGeometry(grille)
    colliders.surface(bars)
    bars.dispose()
  }
  for (const part of [bastionCraterGeometry.flags, bastionCraterGeometry.rubble, bastionCraterGeometry.shards]) {
    colliders.surface(part, true, bastionCrater.center)
  }
  return colliders
}

/** The Bastion’s colliders and the Forge’s: its walls, its floor, its vestibule’s floor and the reveals of its arches, and the Bastion’s cistern behind the vestibule, its floor, its dead channel, its inflow’s pipe and the window onto the vestibule. */
export function forgeAndBastionColliders() {
  const colliders = bastionColliders()
  colliders.walls(['forge'])
  const floor = new ExtrudeGeometry(roundVestibuleFloorShape(forgeRoundVestibule), {
    depth: 0.24,
    bevelEnabled: false,
    curveSegments: 96,
  })
  floor.rotateX(-Math.PI / 2).translate(forgeRoundVestibule.center[0], -0.24, forgeRoundVestibule.center[1])
  colliders.surface(floor, true)
  floor.dispose()
  const ring = walls.find(wall => wall.id === 'forge-vestibule')!
  const place = new Matrix4
  place.makeRotationY(ring.rotation).setPosition(...ring.center)
  for (const arch of vestibuleArches) {
    const reveal = roundRevealGeometry(ring, ring.holes!.find(hole => hole.name === arch.name)!, vestibuleArchOpening(forgeRoundVestibule, arch)).applyMatrix4(place)
    colliders.surface(reveal)
    reveal.dispose()
  }
  const [halfWidth, halfDepth] = [forge.size[0] / 2, forge.size[1] / 2]
  const [x, z] = forge.center
  colliders.hulls.push(...slabHulls([[x - halfWidth, z - halfDepth], [x + halfWidth, z - halfDepth], [x + halfWidth, z + halfDepth], [x - halfWidth, z + halfDepth]], -0.24, 0))
  const cistern = new CisternGeometry
  colliders.surface(cistern.floor, true)
  colliders.shapes.push({
    triangles: colliderGeometry(cistern.channelCollision),
    fix: true,
    dead: true,
  })
  cistern.dispose()
  const inflow = new InflowGeometry
  colliders.surface(inflow.collision)
  inflow.dispose()
  const reveal = cisternWindowGeometry()
  colliders.surface(reveal)
  reveal.dispose()
  return colliders
}

/** A world stepping like the game’s, with the colliders in it. */
export function physicsWorld(colliders: Colliders) {
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  world.timestep = 1 / 60
  // what `<Physics>` of @react-three/rapier sets by default
  Object.assign(world.integrationParameters, {
    normalizedAllowedLinearError: 0.001,
    normalizedPredictionDistance: 0.002,
  })
  colliders.into(world)
  addSuitOfArmor(world)
  return world
}

/**
 * The suit of armor’s body in the world, as `BastionArmor` builds it: a dynamic compound body on flat sabatons
 * at `lodgeSpurArmor`, heavy in its legs, with the flat collar seat on top for the helmet.
 */
export function addSuitOfArmor(world: RAPIER.World, position: Vec3 = [...lodgeSpurArmor]) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...position).setCcdEnabled(true).setLinearDamping(suitOfArmor.linearDamping).setAngularDamping(suitOfArmor.angularDamping))
  for (const collider of suitOfArmorColliders) {
    const shape = collider.kind === 'cylinder' ? RAPIER.ColliderDesc.cylinder((collider.size as readonly [number, number])[1] / 2, (collider.size as readonly [number, number])[0]) : (collider.kind === 'ball' ? RAPIER.ColliderDesc.ball(collider.size as number) : RAPIER.ColliderDesc.cuboid(...(collider.size as readonly [number, number, number]).map(value => value / 2) as [number, number, number]))
    shape.setTranslation(...collider.position).setMass(collider.mass).setFriction(suitOfArmor.friction).setRestitution(suitOfArmor.restitution)
    world.createCollider(shape, body)
  }
  return body
}

/** The knight’s helmet in the world, as its curio builds it: a convex hull of its meshes resting where a game begins. */
export function addHelmet(world: RAPIER.World) {
  const model = helmet.createModel()
  try {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...helmet.position).setCcdEnabled(true))
    world.createCollider(RAPIER.ColliderDesc.convexHull(model.hull)!.setMass(helmet.mass).setFriction(0.8).setRestitution(0.32), body)
    return body
  } finally {
    model.dispose()
  }
}

/** The suit of armor’s body already in a world from `physicsWorld`, by its mass. */
export function suitOfArmorBody(world: RAPIER.World) {
  let armor: RAPIER.RigidBody | undefined
  world.forEachRigidBody(body => {
    if (body.mass() === suitOfArmor.mass) {
      armor = body
    }
  })
  return armor!
}

/** An orb’s body in the world at the position, as `GrabbableProp` builds it: a ball of 1.8 kg, friction 0.8 and restitution 0.32. */
export function addOrb(world: RAPIER.World, position: Vec3) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...position).setCcdEnabled(true))
  world.createCollider(RAPIER.ColliderDesc.ball(0.14).setMass(1.8).setFriction(0.8).setRestitution(0.32), body)
  return body
}

/** Collects the shapes once, as the game builds them, to put into as many worlds as asked. */
class Colliders {
  readonly hulls: Array<Float32Array> = []
  readonly shapes: Array<Shape> = []

  /** Puts all of them into the world. */
  into(world: RAPIER.World) {
    for (const {dead, fix, rotation, translation, triangles: [vertices, indices]} of this.shapes) {
      const shape = fix ? RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setContactSkin(weldedSurfaceSkin) : RAPIER.ColliderDesc.trimesh(vertices, indices)
      if (dead) {
        shape.setRestitution(0).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min)
      }
      if (translation) {
        shape.setTranslation(...translation)
      }
      if (rotation) {
        const turn = new Quaternion
        shape.setRotation(turn.setFromAxisAngle(new Vector3(0, 1, 0), rotation))
      }
      world.createCollider(shape)
    }
    for (const vertices of this.hulls) {
      world.createCollider(RAPIER.ColliderDesc.convexHull(vertices)!)
    }
  }

  surface(geometry: BufferGeometry, fix = false, translation?: Vec3) {
    this.shapes.push({
      triangles: colliderGeometry(geometry),
      fix,
      ...translation ? {translation} : {},
    })
  }

  /** Every wall of the rooms, welded like `WallSurface` welds them. */
  walls(rooms: ReadonlyArray<string>) {
    for (const wall of walls) {
      if (!rooms.includes(wall.room)) {
        continue
      }
      const geometry = createArchitectureGeometry(wall)
      for (const triangles of geometry.collision) {
        this.shapes.push({
          fix: true,
          triangles,
          translation: wall.center,
          rotation: wall.rotation,
        })
      }
      geometry.dispose()
    }
  }
}
