import type {Striker} from '#src/lib/audio/impactSounds.ts'
import type {OrbitSettings} from '#src/lib/camera/OrbitInspection.ts'
import type {Vec3} from '#src/lib/gallery.ts'
import type {ItemIngredient} from '#src/lib/gallery/fusion/FusionRecipe.ts'
import type {Orb} from '#src/lib/gallery/orbs/index.ts'
import type {GrabbableBodyOptions} from '#src/lib/physics/GrabbableBody.ts'
import type {MoodId} from '#src/moods/index.ts'
import type {CollisionEnterPayload, RapierRigidBody, RigidBodyProps} from '@react-three/rapier'
import type {ReactNode} from 'react'
import type {Group, Object3D} from 'three/webgpu'

import {useFrame} from '@react-three/fiber'
import {RigidBody, useRapier} from '@react-three/rapier'
import Branch from 'branch-component'
import {useEffect, useLayoutEffect, useRef} from 'react'
import {Box3, Vector3} from 'three/webgpu'

import {impactSounds} from '#src/lib/audio/impactSounds.ts'
import {cameraPose, notify, requestItemFusion, useGallery} from '#src/lib/gallery.ts'
import {handBack, settle} from '#src/lib/gallery/fusion/handBack.ts'
import {impactOf} from '#src/lib/gallery/fusion/impact/strike.ts'
import {registerOrbitable} from '#src/lib/gallery/orbitables.ts'
import GrabbableBody from '#src/lib/physics/GrabbableBody.ts'
import {bodyThrow, clearBodyThrow} from '#src/lib/physics/ThrowState.ts'
import {snapshotObject} from '#src/lib/rendering/StudioSnapshotRenderer.ts'
import {telemetry} from '#src/lib/telemetry/index.ts'

export type PropHandle = {
  body: RapierRigidBody
  cancel: () => void
  /** whether a grab would currently succeed, without attempting it */
  canGrab: () => boolean
  /** Throws the prop from `position` with `velocity`, in m/s, as if the player had let go of it there, like the `throw_prop` tool does; false while it is carried or a fusion holds it. */
  fling: (position: Vec3, velocity: Vec3) => boolean
  grab: () => boolean
  group: Group
  /** the id of the mood that comes over the world while the player holds the prop */
  mood?: MoodId
  /** the kind of orb the prop is, if it is one */
  orb?: Orb
  release: (throwing: boolean) => void
  /** Takes the prop out of the physics for a fusion, which flies it around by its `group` until it calls `unleash`; false while the player carries it. */
  seize: () => boolean
  /** whether a fusion holds the prop */
  seized: () => boolean
  /** Photographs the prop as it is now in the studio, as a WebP, which it contributes to a fusion by default. */
  snapshot: () => Promise<Blob>
  title: string
  /** Hands the prop back to the physics where its `group` is, flying off with the velocities, and shows it if it was withheld. */
  unleash: (velocity: Vec3, spin: Vec3) => void
}
export const propObjects = new Map<string, PropHandle>
const propTarget = new Vector3
/** Moves a seized prop’s group, inside its body’s object, to the point in the world. */
export function showPropAt({group}: PropHandle, point: Vec3) {
  const holder = group.parent
  if (!holder) {
    return
  }
  holder.updateWorldMatrix(true, false)
  group.position.copy(holder.worldToLocal(propTarget.set(...point)))
}
/** how far below the middle of the view a carried prop floats, in radians: low and in the middle, as if held in front of the chest */
const holdTilt = 15 * Math.PI / 180
/** how far from the eye a carried prop’s surface stays, roughly, in meters, before its size adds to it: very near, without reaching the near plane */
const holdGap = 0.35
/** how much a carried prop’s size, half its longest side, adds to its distance, so a large one stays in view instead of filling it; an orb floats 0.55 m away */
const holdSpread = 1.4
/** how far below the eye the line a carried prop is let go along starts, in meters, safely inside the player’s capsule */
const holdDrop = 0.22
const worldUp: Vec3 = [0, 1, 0]
type HoldLine = {
  /** where the view looks, which a throw follows */
  direction: Vec3
  /** inside the player’s capsule, where letting go starts looking for room */
  origin: Vec3
  /** where the prop floats */
  target: Vec3
}
/** Where a prop held `distance` away floats, for an eye at `position` looking along `direction` with `up` as the view’s up: down the view’s middle, tilted by {@link holdTilt}. */
const holdLine = (position: Vec3, direction: Vec3, distance: number, up: Vec3 = worldUp): HoldLine => {
  // The view’s up, square to where it looks, also when only the world’s up is known.
  const along = up[0] * direction[0] + up[1] * direction[1] + up[2] * direction[2]
  const square = up.map((value, axis) => value - direction[axis] * along)
  const length = Math.hypot(...square) || 1
  const tilt = direction.map((value, axis) => value * Math.cos(holdTilt) - square[axis] / length * Math.sin(holdTilt))
  return {
    direction,
    origin: [position[0], position[1] - holdDrop, position[2]],
    target: position.map((value, axis) => value + tilt[axis] * distance) as Vec3,
  }
}
/** what the player does with a prop, logged as `gallery.prop.<event>` */
type PropEvent = 'dropped' | 'grabbed' | 'thrown'
/** why a dropped prop left the hand: let go of, put back where it was picked up for want of room, or put back as carrying it was canceled */
type DropCause = 'canceled' | 'no_room' | 'released'
const propVerbs: Record<PropEvent, string> = {
  dropped: 'Dropped',
  grabbed: 'Grabbed',
  thrown: 'Threw',
}
/** Round to millimeters, or millimeters per second, without negative zero. */
const round = (value: number) => Math.round(value * 1000) / 1000 || 0
const eye = new Vector3
const look = new Vector3
const viewUp = new Vector3
const holding = new Vector3
const bounds = new Box3
const size = new Vector3
/** a stand-in to photograph instead of the prop’s own children, built in the prop’s own frame, and how to release what was made for it */
export type SnapshotSubject = {
  dispose: () => void
  object: Object3D
}
type GrabbablePropProps = Omit<RigidBodyProps, 'children' | 'position' | 'ref'> & GrabbableBodyOptions & {
  blockedMessage?: () => string
  children: ReactNode
  /** colliders of its own, like a hull round all of its meshes, instead of those built from its children; they stay with its body while its children float in front of the camera */
  collider?: ReactNode
  /** whether a fusion it is thrown into uses it up on success, like an orb, instead of spitting it back out */
  consumable?: boolean
  id: string
  /** the prop as an ingredient of the fusion of a portrait it is thrown into, with what it contributes, like an orb’s prompt, or nothing at all; by default, it contributes a studio photograph of itself */
  ingredient?: ItemIngredient
  /** the id of the mood that comes over the world while the player holds the prop */
  mood?: MoodId
  /** the kind of orb the prop is, if it is one */
  orb?: Orb
  /** lets holding V orbit around the prop */
  orbit?: OrbitSettings
  position: Vec3
  /** the orb a fusion that uses the prop up leaves of it, which flips out of the portal after the result, like a themed orb’s clear glass */
  remains?: Orb
  /** For props drawn elsewhere, e.g. by an instanced batch, whose children are only invisible stand-ins: builds what the studio photographs when the prop is thrown into a portrait. */
  snapshotSubject?: () => SnapshotSubject
  /** what the prop sounds like striking something, like an orb’s glass; silent if left out */
  striker?: Striker
  title: string
  /** whether the prop enters the world held by a fusion’s portal, as what the fusion leaves of an item it uses up: seized, out of the physics and invisible until the portal shows it in its middle, from the very first frame */
  withheld?: boolean
}

/**
 * A prop the player can pick up, carry, drop and throw. Carried, it is out of the physics altogether: its body stays disabled where it was picked up, and its inner group floats in front of the camera, so nothing bumps into it on the way. Letting go puts the body where it fits along the line from the player to the prop.
 * Once a fusion used it up, like an orb, it is gone.
 */
export default function GrabbableProp(props: GrabbablePropProps) {
  const consumed = useGallery(s => s.consumed.includes(props.id))
  return <Branch not={consumed}><PresentProp {...props} /></Branch>
}

/** The prop while it is still in the world. */
function PresentProp({id, title, consumable, ingredient, mood, orb, orbit, children, collider, canGrab, blockedMessage, onAttachmentChange, recoverAsDynamic, remains, snapshotSubject, striker, withheld = false, ...props}: GrabbablePropProps) {
  const body = useRef<RapierRigidBody>(null)
  const group = useRef<Group>(null)
  /** whether a fusion holds the prop, from the start if it is withheld */
  const seized = useRef(withheld)
  const controller = useRef<GrabbableBody | null>(null)
  /** the line the carried prop was last shown on, which letting go of it continues from */
  const shownOn = useRef<HoldLine | null>(null)
  /** how far from the eye the prop floats while carried, by its size when it was picked up */
  const holdDistance = useRef(0)
  const callbacks = useRef({
    canGrab,
    blockedMessage,
    onAttachmentChange,
    recoverAsDynamic,
    snapshotSubject,
  })
  // Only effects, frame callbacks and input handlers read these, so committing them before paint is early enough.
  useLayoutEffect(() => {
    callbacks.current = {
      canGrab,
      blockedMessage,
      onAttachmentChange,
      recoverAsDynamic,
      snapshotSubject,
    }
  }, [canGrab, blockedMessage, onAttachmentChange, recoverAsDynamic, snapshotSubject])
  // Hidden before any frame is drawn, since its portal only shows it once it is registered.
  useLayoutEffect(() => {
    if (seized.current && group.current) {
      group.current.visible = false
    }
  }, [])
  // Settings are read once per registration, so inline objects don’t re-register every render.
  const orbitSettings = useRef(orbit)
  const {world} = useRapier()
  const held = useGallery(s => s.held === id)
  useEffect(() => {
    if (!body.current || !group.current) {
      return
    }
    const carried = new GrabbableBody(body.current, world, {
      canGrab: () => callbacks.current.canGrab?.() ?? true,
      onAttachmentChange: attached => callbacks.current.onAttachmentChange?.(attached),
      recoverAsDynamic: () => callbacks.current.recoverAsDynamic?.() ?? false,
    })
    controller.current = carried
    const prop = group.current
    const rigidBody = body.current
    // A withheld prop stays out of the physics until its portal hands it out.
    if (seized.current) {
      rigidBody.setEnabled(false)
    }
    const record = (event: PropEvent, cause?: DropCause) => {
      if (!telemetry) {
        return
      }
      const {x, y, z} = rigidBody.translation()
      const velocity = event === 'thrown' ? rigidBody.linvel() : undefined
      telemetry.event(`prop.${event}`, {
        'prop.id': id,
        ...orb ? {'orb.id': orb.id} : {},
        room: useGallery.getState().room,
        'position.x': round(x),
        'position.y': round(y),
        'position.z': round(z),
        ...velocity ? {
          'velocity.x': round(velocity.x),
          'velocity.y': round(velocity.y),
          'velocity.z': round(velocity.z),
        } : {},
        ...cause ? {'drop.cause': cause} : {},
      }, `${propVerbs[event]} ${title}`)
    }
    const handle: PropHandle = {
      body: rigidBody,
      group: prop,
      mood,
      ...orb ? {orb} : {},
      title,
      seize: () => {
        if (seized.current || carried.active) {
          return false
        }
        seized.current = true
        clearBodyThrow(rigidBody)
        rigidBody.setEnabled(false)
        return true
      },
      seized: () => seized.current,
      unleash: (velocity, spin) => {
        if (!seized.current) {
          return
        }
        seized.current = false
        prop.visible = true
        handBack(rigidBody, prop, velocity, spin)
      },
      snapshot: async () => {
        const subject = callbacks.current.snapshotSubject?.()
        if (!subject) {
          const {image} = await snapshotObject(prop)
          return image
        }
        try {
          const {image} = await snapshotObject(subject.object)
          return image
        } finally {
          subject.dispose()
        }
      },
      canGrab: () => !seized.current && !carried.active && (callbacks.current.canGrab?.() ?? true),
      fling: (position, velocity) => {
        if (seized.current || !carried.fling(position, velocity)) {
          return false
        }
        settle(rigidBody, prop)
        record('thrown')
        return true
      },
      grab: () => {
        if (seized.current || !carried.grab()) {
          const message = callbacks.current.blockedMessage?.()
          if (message) {
            notify(message)
          }
          return false
        }
        bounds.setFromObject(prop).getSize(size)
        holdDistance.current = holdGap + holdSpread * Math.max(size.x, size.y, size.z) / 2
        // Where it was picked up, as its body stays there while carried.
        record('grabbed')
        return true
      },
      cancel: () => {
        shownOn.current = null
        if (carried.active) {
          carried.cancel()
          settle(rigidBody, prop)
          record('dropped', 'canceled')
        }
      },
      release: throwing => {
        // Let go of where it was shown, or before it was ever shown, where the camera holds it.
        const {direction, origin, target} = shownOn.current ?? holdLine(cameraPose.position, cameraPose.direction, holdDistance.current)
        shownOn.current = null
        const carrying = carried.active
        const returned = carried.release(origin, target, throwing, direction)
        settle(rigidBody, prop)
        if (!carrying) {
          return
        }
        // With no room to let go of it anywhere along the line, it went back where it was picked up, also when thrown.
        if (returned) {
          record('dropped', 'no_room')
        } else {
          record(throwing ? 'thrown' : 'dropped', throwing ? undefined : 'released')
        }
      },
    }
    propObjects.set(id, handle)
    const unregisterOrbitable = orbitSettings.current && registerOrbitable(id, {
      body: body.current,
      group: group.current,
      orbit: orbitSettings.current,
      title,
    })
    return () => {
      unregisterOrbitable?.()
      if (propObjects.get(id) === handle) {
        propObjects.delete(id)
      }
      if (controller.current === carried) {
        controller.current = null
      }
    }
  }, [id, mood, orb, title, world])
  useEffect(() => {
    if (!held) {
      propObjects.get(id)?.cancel()
    }
  }, [held, id])
  useEffect(() => {
    if (striker && body.current) {
      return impactSounds.register(body.current, striker)
    }
  }, [striker])
  useFrame(() => {
    controller.current?.recover()
  })
  // Placed right before the frame is drawn, once the camera has moved for it, so the prop never trails it by a frame: very near, low in the middle of the view. It keeps the turn it had when picked up, which is its body’s and so its holder’s.
  useFrame(({camera}) => {
    const prop = group.current
    const holder = prop?.parent
    if (!controller.current?.active || !holder) {
      return
    }
    camera.getWorldPosition(eye)
    camera.getWorldDirection(look)
    viewUp.setFromMatrixColumn(camera.matrixWorld, 1)
    const line = holdLine(eye.toArray(), look.toArray(), holdDistance.current, viewUp.toArray())
    shownOn.current = line
    holder.updateWorldMatrix(true, false)
    prop.position.copy(holder.worldToLocal(holding.fromArray(line.target)))
  }, {before: 'render'})
  const struck = (event: CollisionEnterPayload) => {
    const current = body.current
    // Only a throw fuses, not a drop or a knock; one throw fuses once, even if the prop bounces into another portrait.
    if (!current || !group.current || !bodyThrow(current)) {
      return
    }
    const other: unknown = event.other.rigidBodyObject?.userData.portraitId
    const target = useGallery.getState().portraits.find(portrait => portrait.id === other)
    if (!target?.hung || target.fusing || target.reserved) {
      return
    }
    const handle = propObjects.get(id)
    if (!handle) {
      return
    }
    clearBodyThrow(current)
    requestItemFusion(target.id, {
      id,
      title,
      consumable,
      remains,
      ...orb ? {orb} : {},
      ingredient: () => ingredient ?? {
        contributions: [
          {
            kind: 'image',
            image: handle.snapshot(),
          },
        ],
      },
    }, impactOf(current))
  }
  // A withheld prop’s colliders are built from its children while they are hidden.
  return <RigidBody ccd colliders={collider ? false : 'cuboid'} friction={0.8} includeInvisible={withheld} mass={1.8} restitution={0.32} ref={body} onCollisionEnter={struck} {...props}>
    {collider}
    <group
      name={id} userData={{
        pickup: true,
        propId: id,
        title,
      }} ref={group}
    >{children}</group>
  </RigidBody>
}
