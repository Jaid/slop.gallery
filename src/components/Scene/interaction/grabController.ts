import type {Placement, Vec3} from '#src/lib/gallery.ts'
import type {Toss} from '#src/lib/physics/throwMotion.ts'
import type {MutableRef} from './types.ts'
import type {RootState} from '@react-three/fiber'

import {Euler, Quaternion, Vector3} from 'three/webgpu'

import {portraitFrame} from '#src/frames/index.ts'
import tossVoices from '#src/lib/audio/tossVoices.ts'
import {cameraPose, chime, markPortraitInteracted, playSound, useGallery} from '#src/lib/gallery.ts'
import {requestHanging} from '#src/lib/gallery/hanging/hangings.ts'
import portraitObjects from '#src/lib/gallery/portraitObjects.ts'
import PlayerGrace from '#src/lib/physics/PlayerGrace.ts'
import {sprintSpeed, toss} from '#src/lib/physics/throwMotion.ts'
import {telemetry} from '#src/lib/telemetry/index.ts'
import world from '#src/worlds/current.ts'

import {carrierVelocity, propObjects} from '../GrabbableProp.tsx'

const grab = () => {
  const state = useGallery.getState()
  if (state.held || !state.active || cameraPose.focused) {
    return
  }
  const portrait = state.portraits.find(candidate => candidate.id === state.active)
  if (portrait?.fusing || portrait?.reserved) {
    return
  }
  useGallery.setState({held: state.active})
  const prop = propObjects.get(state.active)
  if (prop && !prop.grab()) {
    useGallery.setState({held: null})
    return
  }
  if (portrait) {
    markPortraitInteracted(portrait.id)
  }
  chime(440)
}
/** how fast the player throws a work standing still, in m/s, and how much it lifts on top, as a share of that */
const workThrow = {
  speed: 14,
  lift: 1.5 / 14,
}
/** The 8 m/s run-up toward the throw, expressed as a share of full sprint speed. */
const frisbeeDrive = 8 / sprintSpeed
/** three turns per second about the portrait’s face normal at release, in radians per second */
const frisbeeSpin = 6 * Math.PI
const workThrowRotation = ({drive, velocity: [x, y, z]}: Toss) => {
  if (drive < frisbeeDrive) {
    return {
      orientation: undefined,
      spin: undefined,
    }
  }
  // Lay the frame face-up with its top edge leading along the actual launch velocity, including on a jump shot.
  const pitch = Math.atan2(y, Math.hypot(x, z))
  const yaw = Math.atan2(-x, -z)
  const orientation = new Quaternion
  orientation.setFromEuler(new Euler(pitch - Math.PI / 2, yaw, 0, 'YXZ'))
  const spin = new Vector3(0, 0, frisbeeSpin)
  return {
    orientation: orientation.toArray(),
    spin: spin.applyQuaternion(orientation).toArray(),
  }
}
let tosses = 0
/** Sounds a throw or a drop as it leaves the hand, heard from where it left it. */
const sound = (thrown: Toss, position: Vec3) => {
  const index = tosses++
  playSound(tossVoices(thrown, Math.sin(index * 2.39996)), `toss:${index}`, position)
}

export default function createGrabController(camera: RootState['camera'], placement: MutableRef<Placement | null>) {
  /** Ends carrying whatever the player carries, as the pause menu opening or the window losing focus do: a prop drops from the hand, silently, a work stays where it hangs or lies. */
  const cancel = () => {
    const state = useGallery.getState()
    if (state.held) {
      propObjects.get(state.held)?.release(false, true)
    }
    useGallery.setState({
      held: null,
      placement: null,
    })
    placement.current = null
  }
  const release = (throwing = false) => {
    const state = useGallery.getState()
    const id = state.held
    if (!id) {
      return
    }
    const prop = propObjects.get(id)
    if (prop) {
      const thrown = prop.release(throwing)
      useGallery.setState({
        held: null,
        placement: null,
      })
      if (thrown) {
        const {x, y, z} = prop.body.translation()
        sound(thrown, [x, y, z])
      }
      return
    }
    const portrait = state.portraits.find(candidate => candidate.id === id)
    if (!portrait) {
      return
    }
    if (throwing) {
      const direction = camera.getWorldDirection(new Vector3)
      const origin = camera.position.toArray()
      const distance = Math.min(1.45, Math.max(0.35, world.wallDistance(origin, direction.toArray()) - 0.4))
      const position = camera.position.clone().addScaledVector(direction, distance)
      const body = portraitObjects.get(id)?.body
      const thrown = toss({
        carrier: carrierVelocity(),
        direction: direction.toArray(),
        mass: body?.mass() || portraitFrame(portrait.frame).mass(portrait.width, portrait.height),
        throwing: true,
        ...workThrow,
      })
      state.commit(state.portraits.map(candidate => {
        return candidate.id === id ? {
          ...candidate,
          hung: false,
          wallId: undefined,
          position: position.toArray(),
          rotation: Math.atan2(-direction.x, -direction.z),
          ...workThrowRotation(thrown),
          velocity: thrown.velocity,
        } : candidate
      }))
      // A work let go of this close to the eye starts out in the player’s capsule as often as not.
      if (body) {
        PlayerGrace.of(body).begin()
      }
      sound(thrown, position.toArray())
    } else {
      const candidate = world.placement.findPlacement(camera.position.toArray(), camera.getWorldDirection(new Vector3).toArray(), portrait.width, portrait.height, state.portraits, {
        ignoreId: portrait.id,
        placard: world.placement.placardOf(portrait),
      })
      if (candidate?.valid) {
        state.commit(state.portraits.map(item => {
          return item.id === id ? {
            ...item,
            position: candidate.position,
            rotation: candidate.rotation,
            wallId: candidate.wallId,
            labelAbove: candidate.placard === 'above' ? true : undefined,
            hung: true,
            orientation: undefined,
            spin: undefined,
            velocity: undefined,
          } : item
        }))
        requestHanging(id, candidate.position, candidate.rotation)
      } else {
        const reason = candidate?.reason ?? 'noWall'
        telemetry?.event('placement.refused', {
          reason,
          room: state.room,
          'wall.id': candidate?.wallId ?? 'none',
          'placement.in_reach': candidate?.inReach ?? false,
        }, `Placement refused: ${reason}`)
      }
    }
    useGallery.setState({
      held: null,
      placement: null,
    })
    placement.current = null
  }
  return {
    cancel,
    grab,
    release,
  }
}
