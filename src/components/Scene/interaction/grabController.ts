import type {Placement} from '#src/lib/gallery.ts'
import type {MutableRef} from './types.ts'
import type {World} from '@dimforge/rapier3d-compat'
import type {RootState} from '@react-three/fiber'

import {Quaternion, Vector3} from 'three/webgpu'

import throwVoices from '#src/lib/audio/throwVoices.ts'
import {bodyPose, cameraPose, chime, markPortraitInteracted, notify, playSound, useGallery} from '#src/lib/gallery.ts'
import {requestHanging} from '#src/lib/gallery/hanging/hangings.ts'
import portraitObjects from '#src/lib/gallery/portraitObjects.ts'
import {itemLaunch, itemMass} from '#src/lib/physics/itemLaunch.ts'
import PropPlacement from '#src/lib/physics/PropPlacement.ts'
import {telemetry} from '#src/lib/telemetry/index.ts'
import world from '#src/worlds/current.ts'

import {propObjects} from '../GrabbableProp.tsx'

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

export default function createGrabController(camera: RootState['camera'], placement: MutableRef<Placement | null>, physics: World) {
  const clear = () => {
    useGallery.setState({
      held: null,
      placement: null,
    })
    placement.current = null
  }
  const release = (throwing = false, hanging = true) => {
    const state = useGallery.getState()
    const id = state.held
    if (!id) {
      return
    }
    const prop = propObjects.get(id)
    if (prop) {
      if (!prop.release(throwing)) {
        return
      }
      clear()
      return
    }
    const portrait = state.portraits.find(candidate => candidate.id === id)
    if (!portrait) {
      return
    }
    // Releasing onto a valid wall still hangs the work. Everywhere else, including Escape/unfocus, it drops locally just like a prop.
    if (!throwing && hanging) {
      const candidate = world.placement.findPlacement(camera.position.toArray(), camera.getWorldDirection(new Vector3).toArray(), portrait.width, portrait.height, state.portraits, portrait.id, portrait.labelAbove === true)
      if (candidate?.valid) {
        state.commit(state.portraits.map(item => {
          return item.id === id ? {
            ...item,
            position: candidate.position,
            rotation: candidate.rotation,
            wallId: candidate.wallId,
            labelAbove: candidate.labelAbove === true ? true : undefined,
            hung: true,
            orientation: undefined,
            velocity: undefined,
          } : item
        }))
        requestHanging(id, candidate.position, candidate.rotation)
        clear()
        return
      }
      const reason = candidate?.reason ?? 'noWall'
      telemetry?.event('placement.refused', {
        reason,
        room: state.room,
        'wall.id': candidate?.wallId ?? 'none',
        'placement.in_reach': candidate?.inReach ?? false,
      }, `Placement refused: ${reason}`)
    }
    const physical = portraitObjects.get(id)
    if (!physical) {
      return
    }
    const direction = camera.getWorldDirection(new Vector3)
    const origin = camera.getWorldPosition(new Vector3)
    origin.y -= 0.22
    const rotation = Math.atan2(-direction.x, -direction.z)
    const previous = physical.body.rotation()
    const orientation = new Quaternion
    physical.body.setRotation(orientation.setFromAxisAngle(new Vector3(0, 1, 0), rotation), false)
    const clearance = new PropPlacement(physics, physical.body)
    const position = clearance.reach(origin.toArray(), origin.clone().addScaledVector(direction, 1.45).toArray())
    physical.body.setRotation(previous, false)
    if (!position) {
      notify('Not enough room to let go. Move into a more open space.')
      return
    }
    const launch = itemLaunch(itemMass(physical.body), direction.toArray(), cameraPose.posed ? [0, 0, 0] : bodyPose.velocity, throwing)
    state.commit(state.portraits.map(candidate => (candidate.id === id ? {
      ...candidate,
      hung: false,
      wallId: undefined,
      orientation: undefined,
      position,
      rotation,
      velocity: launch.velocity,
      spin: launch.spin,
    } : candidate)))
    playSound(throwVoices(launch), `release:${id}`)
    clear()
  }
  return {
    cancel: () => release(false, false),
    grab,
    release,
  }
}
