import type {Placement} from '#src/lib/gallery.ts'
import type {MutableRef} from './types.ts'
import type {RootState} from '@react-three/fiber'

import {Vector3} from 'three/webgpu'

import throwVoices from '#src/lib/audio/throwVoices.ts'
import {bodyPose, cameraPose, chime, markPortraitInteracted, notify, playSound, useGallery} from '#src/lib/gallery.ts'
import {requestHanging} from '#src/lib/gallery/hanging/hangings.ts'
import portraitObjects from '#src/lib/gallery/portraitObjects.ts'
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

export default function createGrabController(camera: RootState['camera'], placement: MutableRef<Placement | null>) {
  const clear = () => {
    useGallery.setState({
      held: null,
      placement: null,
    })
    placement.current = null
  }
  const letGoPortrait = (id: string, throwing: boolean) => {
    const state = useGallery.getState()
    const direction = camera.getWorldDirection(new Vector3)
    const origin = camera.position.clone().add(new Vector3(0, -0.22, 0)).toArray()
    const target = camera.position.clone().addScaledVector(direction, 1.1).toArray()
    const physical = portraitObjects.get(id)
    const motion = physical?.release?.(origin, target, throwing, direction.toArray(), cameraPose.posed ? [0, 0, 0] : bodyPose.velocity)
    if (!motion || !physical) {
      notify('Not enough room to let go. Move away from the obstacle.')
      return false
    }
    const position = physical.body.translation()
    const rotation = physical.body.rotation()
    state.commit(state.portraits.map(candidate => (candidate.id === id ? {
      ...candidate,
      hung: false,
      wallId: undefined,
      orientation: [rotation.x, rotation.y, rotation.z, rotation.w],
      position: [position.x, position.y, position.z],
      rotation: Math.atan2(-direction.x, -direction.z),
      velocity: motion.velocity,
      spin: motion.spin,
    } : candidate)))
    playSound(throwVoices(motion), `release:${id}`, [position.x, position.y, position.z])
    return true
  }
  const release = (throwing = false, interrupted = false) => {
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
    if (throwing || interrupted) {
      if (!letGoPortrait(id, throwing)) {
        return
      }
    } else {
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
      } else {
        const reason = candidate?.reason ?? 'noWall'
        telemetry?.event('placement.refused', {
          reason,
          room: state.room,
          'wall.id': candidate?.wallId ?? 'none',
          'placement.in_reach': candidate?.inReach ?? false,
        }, `Placement refused: ${reason}`)
        if (!letGoPortrait(id, false)) {
          return
        }
      }
    }
    clear()
  }
  const cancel = () => {
    const id = useGallery.getState().held
    const prop = id && propObjects.get(id)
    if (prop) {
      if (!prop.cancel()) {
        return
      }
      clear()
    } else {
      release(false, true)
    }
  }
  return {
    cancel,
    grab,
    release,
  }
}
