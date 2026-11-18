import type {Flight, Vec3} from '#src/lib/gallery.ts'
import type {EgoAction, EgoImpact, EgoPlayerHandle, EgoState} from 'ego-player'
import type {Camera} from 'three/webgpu'

import {useKeyboardControls} from '@react-three/drei/webgpu'
import {useThree} from '@react-three/fiber'
import {useAfterPhysicsStep} from '@react-three/rapier'
import EgoPlayer, {defaultEgoOptions} from 'ego-player'
import {useEffect, useRef, useState} from 'react'
import {Euler, PerspectiveCamera, Quaternion, Vector3} from 'three/webgpu'

import {attachPlayerAudio, onPlayerLand, onPlayerStep, onPlayerZoomChange, onPlayerZoomTransition} from '#src/lib/audio/playerAudio.ts'
import {isDevelopmentMode} from '#src/lib/developmentMode.ts'
import {bodyPose, cameraPose, dropPortrait, flingPlayer, galleryEvents, markPortraitInteracted, narrate, setCameraFocused, useGallery, wallRebound} from '#src/lib/gallery.ts'
import {cameraBookmarkFeet, findCameraBookmark} from '#src/lib/gallery/bookmarks.ts'
import {flyMode} from '#src/lib/gallery/flyMode.ts'
import {activateInteractiveObject} from '#src/lib/gallery/interactiveObjects.ts'
import {playerSession} from '#src/lib/gallery/PlayerSession.ts'
import portraitObjects from '#src/lib/gallery/portraitObjects.ts'
import {playerCollisionGroups} from '#src/lib/physics/collisionGroups.ts'
import PlayerGrace from '#src/lib/physics/PlayerGrace.ts'
import {playerTelemetry} from '#src/lib/telemetry/index.ts'
import {playerDumpHandler, playerDumps, snapshotPlayerDump} from '#src/lib/telemetry/recordPlayerDump.ts'
import world from '#src/worlds/current.ts'

const enabled = () => !cameraPose.focused
const cameraEnabled = () => !cameraPose.focused
const flying = () => flyMode.active
/** Takes the body’s capsule and place along with its feet. */
const placeBody = ([x, y, z]: Vec3, isFlying: boolean, crouching = false) => {
  bodyPose.height = crouching ? defaultEgoOptions.crouchHeight : defaultEgoOptions.height
  bodyPose.center = [x, y + bodyPose.height / 2, z]
  bodyPose.flying = isFlying
  bodyPose.place = isFlying ? [x, y + (crouching ? defaultEgoOptions.crouchEyeHeight : defaultEgoOptions.eyeHeight), z] : bodyPose.center
}
const setFov = (camera: Camera, fov: number) => {
  if (camera instanceof PerspectiveCamera && camera.fov !== fov) {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }
}
const pointerLock = {selector: '#pointer-lock-managed-by-gallery'}
const onInteract = () => {
  const {active, held} = useGallery.getState()
  if (!active || held || activateInteractiveObject(active)) {
    return
  }
  if (portraitObjects.has(active)) {
    markPortraitInteracted(active)
    narrate(active)
  }
}
/**
 * Speed in m/s toward a hung work at which jumping into it or landing on it knocks it off the wall. Above a walking (3) or dodging (4.5) jump, below a sprinting jump (9) and the landing after a fall of a meter (6.3).
 */
export const portraitDropSpeed = 6
const onImpact = (impact: EgoImpact) => {
  if (!impact.airborne || impact.speed < portraitDropSpeed) {
    return
  }
  const id: unknown = (impact.collider.parent()?.userData as {portraitId?: unknown} | undefined)?.portraitId
  if (typeof id !== 'string') {
    return
  }
  const portrait = useGallery.getState().portraits.find(candidate => candidate.id === id)
  // The body bounces back off the wall, so it stops pushing the falling work into it.
  if (portrait && dropPortrait(id)) {
    flingPlayer([Math.sin(portrait.rotation) * wallRebound.out, wallRebound.lift, Math.cos(portrait.rotation) * wallRebound.out])
  }
}
export default function Player() {
  useEffect(attachPlayerAudio, [])
  const player = useRef<EgoPlayerHandle>(null)
  const input = useKeyboardControls<EgoAction>()[1]
  const camera = useThree(s => s.camera)
  const [initial] = useState(() => playerSession.snapshot())
  const [angles] = useState(() => new Euler(0, 0, 0, 'YXZ'))
  // Props that just left the player’s hands pass through the capsule until they are clear of it.
  useAfterPhysicsStep(physicsWorld => PlayerGrace.step(physicsWorld, physicsWorld.timestep))
  useEffect(() => {
    const read = () => player.current?.getState() ?? null
    playerTelemetry.read = read
    const capture = () => player.current?.dump() ?? null
    playerDumps.capture = capture
    const dump = () => {
      const captured = capture()
      return captured ? snapshotPlayerDump(captured) : null
    }
    globalThis.slopGallery ??= {}
    globalThis.slopGallery.dump = dump
    const releaseZoom = () => player.current?.releaseZoom()
    galleryEvents.addEventListener('release-zoom', releaseZoom)
    /** Puts the feet there, flying or not as the fly mode says. */
    const arrive = (feet: Vec3, rotation?: Flight['rotation']) => {
      player.current?.teleport(feet, rotation)
      // The menu can freeze the scene before the next interaction frame samples the new camera.
      cameraPose.position = camera.position.toArray()
      cameraPose.direction = camera.getWorldDirection(new Vector3).toArray()
      // The body is there before the player’s next update, so whatever follows it, like the room the player is in, never sees it where it was.
      placeBody(feet, flyMode.active)
      bodyPose.velocity = [0, 0, 0]
    }
    const teleport = (event: Event) => {
      const {position, rotation, feet} = (event as CustomEvent<{
        feet?: boolean
        position: [number, number, number]
        rotation: [number, number, number, number]
      }>).detail
      setCameraFocused(false)
      // Gallery navigation describes camera poses; ego-player consistently uses feet.
      const destination = feet ? position : [position[0], Math.max(world.floorHeight(position) + 0.04, position[1] - defaultEgoOptions.eyeHeight), position[2]] as [number, number, number]
      // A flying player is where its eyes are.
      if (!world.contains(flyMode.active ? [destination[0], destination[1] + defaultEgoOptions.eyeHeight, destination[2]] : destination)) {
        return
      }
      arrive(destination, rotation)
    }
    galleryEvents.addEventListener('teleport', teleport)
    // A flight goes anywhere, so nothing asks whether the world holds its destination. Without one, the eyes stay where the body has them.
    const fly = (event: Event) => {
      const {position, rotation} = (event as CustomEvent<Flight>).detail
      setCameraFocused(false)
      const state = player.current?.getState()
      if (!state) {
        return
      }
      const [x, y, z] = position ?? [state.position.x, state.position.y + (state.crouching ? defaultEgoOptions.crouchEyeHeight : defaultEgoOptions.eyeHeight), state.position.z]
      arrive([x, y - defaultEgoOptions.eyeHeight, z], rotation)
    }
    galleryEvents.addEventListener('fly', fly)
    const fling = (event: Event) => {
      const [x, y, z] = (event as CustomEvent<Vec3>).detail
      player.current?.fling({
        x,
        y,
        z,
      })
    }
    galleryEvents.addEventListener('fling', fling)
    return () => {
      galleryEvents.removeEventListener('release-zoom', releaseZoom)
      galleryEvents.removeEventListener('teleport', teleport)
      galleryEvents.removeEventListener('fly', fly)
      galleryEvents.removeEventListener('fling', fling)
      if (playerTelemetry.read === read) {
        playerTelemetry.read = null
      }
      if (playerDumps.capture === capture) {
        playerDumps.capture = null
      }
      const diagnostics = globalThis.slopGallery
      if (diagnostics) {
        delete diagnostics.player
        if (diagnostics.dump === dump) {
          delete diagnostics.dump
        }
      }
    }
  }, [camera])
  useEffect(() => {
    const pose = playerSession.snapshot()
    const sessionRotation = new Quaternion
    galleryEvents.dispatchEvent(new CustomEvent('teleport', {
      detail: {
        feet: true,
        position: pose.position,
        rotation: sessionRotation.setFromEuler(new Euler(pose.pitch, pose.yaw, 0, 'YXZ')).toArray(),
      },
    }))
    const bookmark = isDevelopmentMode ? null : findCameraBookmark()
    // The player starts flying at a ?spawn camera bookmark, its eyes where the camera is, and looks through the bookmark’s field of view while still there. With ?development, the player flies on with the game’s own.
    if (bookmark && cameraBookmarkFeet(bookmark).every((value, index) => value === pose.position[index])) {
      setFov(camera, bookmark.fov)
    }
  }, [camera])
  const onUpdate = (state: EgoState) => {
    const {x, y, z} = state.position
    placeBody([x, y, z], state.flying, state.crouching)
    bodyPose.grounded = state.grounded
    bodyPose.velocity = [state.velocity.x, state.velocity.y, state.velocity.z]
    if (!cameraPose.focused) {
      angles.setFromQuaternion(camera.quaternion, 'YXZ')
      playerSession.capture({
        position: [x, y, z],
        yaw: angles.y,
        pitch: angles.x,
      }, state.flying)
    }
    const diagnostics = globalThis.slopGallery
    if (diagnostics) {
      diagnostics.player = {
        keys: input(),
        position: state.position,
        enabled: true,
        grounded: state.grounded,
      }
    }
  }
  return <EgoPlayer cameraEnabled={cameraEnabled} collisionGroups={playerCollisionGroups} enabled={enabled} fallbackPosition={world.spawnInReach.position} flying={flying} input={input} pitch={initial.pitch} pointerLock={pointerLock} position={initial.position} yaw={initial.yaw} ref={player} onDump={playerDumpHandler} onImpact={onImpact} onInteract={onInteract} onLand={onPlayerLand} onStep={onPlayerStep} onUpdate={onUpdate} onZoomChange={onPlayerZoomChange} onZoomTransition={onPlayerZoomTransition} />
}
