import type {OrbitSettings} from '#src/lib/camera/OrbitInspection.ts'
import type {RapierRigidBody} from '@react-three/rapier'

import {useFrame, useThree} from '@react-three/fiber'
import {useRapier} from '@react-three/rapier'
import {lerp} from 'math'
import {useEffect, useRef} from 'react'
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js'
import {PerspectiveCamera, Vector3} from 'three/webgpu'

import inspectionPointerSensitivity from '#src/lib/camera/inspectionPointerSensitivity.ts'
import OrbitInspection, {orbitKeySpeed, orbitPointerSpeed} from '#src/lib/camera/OrbitInspection.ts'
import {cameraPose, galleryEvents, isTextInput, markPortraitInteracted, setCameraFocused, useGallery} from '#src/lib/gallery.ts'
import {orbitables} from '#src/lib/gallery/orbitables.ts'
import portraitObjects from '#src/lib/gallery/portraitObjects.ts'
import portraitOrbit from '#src/lib/gallery/portraitOrbit.ts'
import {setInspectionFocus} from '#src/lib/rendering/playerView.ts'

const inspectionDistanceSpeed = 0.45
const inspectionFocusSpeed = 8

type Target = {
  body?: RapierRigidBody
  /** writes where the orbit centers in the world, or reports that the object is gone */
  locate: (target: Vector3) => Vector3 | null
  orbit: OrbitSettings
}
type Session = {
  /** the background blur factor, 0 for none */
  blur: number
  id: string
  orbit: OrbitInspection
  restoreControls: () => void
  target: Target
}

/**
 * Holding V on an orbitable object or a hung portrait orbits the camera around it: the pointer turns around all axes, W/S change the
 * distance and A/D keep circling. Releasing V eases the camera back to the player. Each start or resumption dispatches an
 * `inspect` event with the object’s id.
 */
export default function OrbitViewing() {
  const {camera, controls, renderer} = useThree()
  const {rapier, world} = useRapier()
  const pointerSpeed = controls instanceof PointerLockControls ? controls.pointerSpeed : 1
  const session = useRef<Session | null>(null)
  const distanceKeys = useRef(new Set<'KeyS' | 'KeyW'>)
  const orbitKeys = useRef(new Set<'KeyA' | 'KeyD'>)
  const precisionPointer = useRef(false)
  const focusAmount = useRef(0)
  const focusPipelineActive = useRef(false)
  const center = useRef(new Vector3)
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || !(controls instanceof PointerLockControls)) {
      return
    }
    const finish = (restorePosition: boolean) => {
      const current = session.current
      if (!current) {
        return
      }
      if (restorePosition) {
        current.orbit.restore()
      } else {
        camera.fov = current.orbit.originalFov
        camera.updateProjectionMatrix()
      }
      current.restoreControls()
      distanceKeys.current.clear()
      orbitKeys.current.clear()
      session.current = null
      focusAmount.current = 0
      setInspectionFocus(0, 1, 0)
      if (focusPipelineActive.current) {
        focusPipelineActive.current = false
        galleryEvents.dispatchEvent(new Event('inspection-focus-end'))
      }
      setCameraFocused(false)
      useGallery.setState({inspecting: null})
    }
    const release = () => {
      distanceKeys.current.clear()
      orbitKeys.current.clear()
      session.current?.orbit.release()
      if (session.current && useGallery.getState().inspecting !== null) {
        useGallery.setState({inspecting: null})
      }
    }
    const down = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTextInput(event.target)) {
        return
      }
      if (event.code === 'KeyC') {
        precisionPointer.current = true
      }
      if (session.current && !session.current.orbit.returning) {
        if (event.code === 'KeyW' || event.code === 'KeyS') {
          event.preventDefault()
          if (!event.repeat) {
            distanceKeys.current.add(event.code)
          }
          return
        }
        if (event.code === 'KeyA' || event.code === 'KeyD') {
          event.preventDefault()
          if (!event.repeat) {
            orbitKeys.current.add(event.code)
          }
          return
        }
      }
      if (event.code !== 'KeyV' || event.repeat) {
        return
      }
      const state = useGallery.getState()
      if (!state.locked || state.held || !state.active || !controls.isLocked || document.pointerLockElement !== renderer.domElement) {
        return
      }
      const object = findTarget(state.active, state.activeLabel === state.active, camera.aspect)
      const target = object?.locate(center.current)
      if (!object || !target) {
        return
      }
      event.preventDefault()
      if (session.current) {
        if (session.current.id === state.active && session.current.orbit.returning) {
          session.current.orbit.returning = false
          markPortraitInteracted(state.active)
          useGallery.setState({inspecting: state.active})
          galleryEvents.dispatchEvent(new CustomEvent('inspect', {detail: state.active}))
        }
        return
      }
      if (cameraPose.focused) {
        return
      }
      const enabled = controls.enabled
      galleryEvents.dispatchEvent(new Event('release-zoom'))
      controls.enabled = false
      // The camera orbits down to whatever the prop rests on or floats above, such as a plinth’s top or the room’s floor.
      const below = world.castRay(new rapier.Ray(target, {
        x: 0,
        y: -1,
        z: 0,
      }), 100, true, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, object.body)
      session.current = {
        id: state.active,
        orbit: new OrbitInspection(camera, target, {
          floorY: below ? target.y - below.timeOfImpact : undefined,
          ...object.orbit,
        }),
        target: object,
        blur: object.orbit.blur ?? 1,
        restoreControls: () => {
          controls.enabled = enabled
        },
      }
      if (session.current.blur > 0) {
        focusPipelineActive.current = true
        setInspectionFocus(0, camera.position.distanceTo(target) + session.current.orbit.radius, session.current.orbit.getProximity(target), session.current.blur)
        galleryEvents.dispatchEvent(new Event('inspection-focus-start'))
      }
      setCameraFocused(true)
      markPortraitInteracted(state.active)
      useGallery.setState({inspecting: state.active})
      galleryEvents.dispatchEvent(new CustomEvent('inspect', {detail: state.active}))
    }
    const up = (event: KeyboardEvent) => {
      if (event.code === 'KeyC') {
        precisionPointer.current = false
      }
      if (event.code === 'KeyW' || event.code === 'KeyS') {
        distanceKeys.current.delete(event.code)
      } else if (event.code === 'KeyA' || event.code === 'KeyD') {
        orbitKeys.current.delete(event.code)
      } else if (event.code === 'KeyV') {
        release()
      }
    }
    const move = (event: MouseEvent) => {
      if (!controls.isLocked || document.pointerLockElement !== renderer.domElement) {
        return
      }
      const sensitivity = inspectionPointerSensitivity(orbitPointerSpeed * controls.pointerSpeed, precisionPointer.current, event.shiftKey)
      session.current?.orbit.addInput(event.movementX * sensitivity, -event.movementY * sensitivity)
    }
    const blur = () => {
      precisionPointer.current = false
      release()
    }
    const teleport = () => {
      finish(false)
    }
    const unsubscribe = useGallery.subscribe(state => {
      if (!state.locked) {
        release()
      }
    })
    globalThis.addEventListener('keydown', down)
    globalThis.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    document.addEventListener('mousemove', move)
    galleryEvents.addEventListener('cancel-view', release)
    galleryEvents.addEventListener('teleport', teleport)
    return () => {
      unsubscribe()
      globalThis.removeEventListener('keydown', down)
      globalThis.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      document.removeEventListener('mousemove', move)
      galleryEvents.removeEventListener('cancel-view', release)
      galleryEvents.removeEventListener('teleport', teleport)
      finish(true)
    }
  }, [camera, controls, rapier, renderer, world])
  useFrame((_, delta) => {
    const current = session.current
    const focusTarget = current && current.blur > 0 && !current.orbit.returning ? 1 : 0
    focusAmount.current = lerp(focusAmount.current, focusTarget, 1 - Math.exp(-Math.min(delta, 0.06) * inspectionFocusSpeed))
    if (!focusTarget && focusAmount.current < 0.002) {
      focusAmount.current = 0
    }
    if (!current) {
      // Only its own fade writes the focus, which another owner, like the intro, keeps otherwise.
      if (focusPipelineActive.current) {
        setInspectionFocus(focusAmount.current, 1, 0)
        if (!focusAmount.current) {
          focusPipelineActive.current = false
          galleryEvents.dispatchEvent(new Event('inspection-focus-end'))
        }
      }
      return
    }
    const located = current.target.locate(center.current)
    if (located) {
      const distanceDirection = Number(distanceKeys.current.has('KeyS')) - Number(distanceKeys.current.has('KeyW'))
      const orbitDirection = Number(orbitKeys.current.has('KeyD')) - Number(orbitKeys.current.has('KeyA'))
      current.orbit.adjustDistance(distanceDirection * inspectionDistanceSpeed * delta)
      current.orbit.addInput(orbitDirection * orbitKeySpeed * pointerSpeed * delta, 0)
    } else {
      distanceKeys.current.clear()
      orbitKeys.current.clear()
      current.orbit.release()
      if (useGallery.getState().inspecting !== null) {
        useGallery.setState({inspecting: null})
      }
    }
    const complete = current.orbit.update(center.current, delta)
    if (located && !complete && current.blur > 0) {
      setInspectionFocus(focusAmount.current, camera.position.distanceTo(center.current) + current.orbit.radius, current.orbit.getProximity(center.current))
    }
    if (complete) {
      current.restoreControls()
      distanceKeys.current.clear()
      orbitKeys.current.clear()
      session.current = null
      setCameraFocused(false)
      useGallery.setState({inspecting: null})
    }
  })
  return null
}

/** An orbitable object, or a hung portrait, which orbits from straight in front and frames its name plate when aimed at. */
function findTarget(id: string, label: boolean, aspect: number): Target | undefined {
  const orbitable = orbitables.get(id)
  if (orbitable) {
    const {body, center, group, orbit} = orbitable
    return {
      body,
      orbit,
      locate: target => {
        if (!group.visible) {
          return null
        }
        return center ? group.localToWorld(target.set(...center)) : group.getWorldPosition(target)
      },
    }
  }
  const portrait = useGallery.getState().portraits.find(candidate => candidate.id === id)
  const portraitObject = portraitObjects.get(id)
  if (portrait?.hung && portraitObject) {
    const {center, orbit} = portraitOrbit(portrait, label, aspect)
    return {
      body: portraitObject.body,
      orbit,
      locate: target => (useGallery.getState().portraits.find(candidate => candidate.id === id)?.hung ? target.set(...center) : null),
    }
  }
}
