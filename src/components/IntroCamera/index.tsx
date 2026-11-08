import type IntroOrbit from '#src/lib/camera/IntroOrbit.ts'

import {useFrame, useThree} from '@react-three/fiber'
import {defaultEgoOptions} from 'ego-player'
import {useEffect, useRef} from 'react'
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js'
import {Euler, PerspectiveCamera, Vector3} from 'three/webgpu'

import hearAtOnce from '#src/lib/audio/hearAtOnce.ts'
import inspectionPointerSensitivity from '#src/lib/camera/inspectionPointerSensitivity.ts'
import OrbitInspection, {orbitKeySpeed, orbitPointerSpeed} from '#src/lib/camera/OrbitInspection.ts'
import {frozenSeconds} from '#src/lib/frozenTime.ts'
import {galleryEvents, isTextInput, setCameraFocused} from '#src/lib/gallery.ts'
import {endIntro, introDirection} from '#src/lib/gallery/intro.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import pauseMenu from '#src/lib/pauseMenu.ts'
import {setInspectionFocus} from '#src/lib/rendering/playerView.ts'

/** the seconds the background blur takes to clear once the player has entered */
const blurFade = 0.3
const leftKeys = new Set(['ArrowLeft', 'KeyA'])
const rightKeys = new Set(['ArrowRight', 'KeyD'])
/**
 * Circles the camera on the world’s intro orbit while the first menu shows, one turn a minute, which way the game’s seed decides, with every sound of the world heard from it.
 * It is V-inspection’s orbit, held at the intro’s height and distance and circling on its own, with its blur of the background beyond the subject: dragging with the left mouse button anywhere but on the menu’s buttons and text or holding A and D turns it, and a few seconds after the last turn, it circles on its own again.
 * Once the player enters, the player stands with its eyes right where the camera was, looking the same way, and falls from there while the blur clears, which ends the intro.
 *
 * Mount it after the Player: the player’s own spawn releases the camera on mounting, and the player writes the camera before this does every frame.
 */
export default function IntroCamera({orbit}: {orbit: IntroOrbit}) {
  const camera = useThree(state => state.camera)
  const get = useThree(state => state.get)
  const inspection = useRef<{
    center: Vector3
    orbit: OrbitInspection
  }>(null)
  /** what the player turns the camera with right now: the pointer’s turn since the last frame and the held keys */
  const turn = useRef({
    dragging: false,
    pointer: 0,
    keys: new Set<string>,
  })
  /** how strongly the intro still blurs the background, or null while the camera still circles */
  const fading = useRef<number>(null)
  /** where the background blur starts, in meters from the camera, and how close the camera is on its orbit’s scale */
  const focus = useRef({
    distance: 1,
    proximity: 0,
  })
  useEffect(hearAtOnce, [])
  // Only Heavy graphics blur the background, as only they can focus; Fast graphics leave it sharp.
  useEffect(() => () => setInspectionFocus(0, 1, 0), [])
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) {
      return
    }
    setCameraFocused(true)
    const direction = introDirection(environmentSeed)
    // The orbit starts from wherever the camera is, so the camera starts on the intro’s ring.
    const start = orbit.pose(frozenSeconds ?? 0, direction)
    camera.position.set(...start.position)
    camera.quaternion.setFromEuler(new Euler(start.pitch, start.yaw, 0, 'YXZ'))
    const {distance} = orbit
    inspection.current = {
      center: new Vector3(...orbit.target),
      orbit: new OrbitInspection(camera, new Vector3(...orbit.target), {
        // W and S never reach it, so it keeps its distance.
        radius: orbit.subject,
        distance,
        pitchLimit: 0,
        fov: camera.fov,
        // Under ?frozen_time, the camera stands still like every animation.
        autoRotation: {
          delay: orbit.takeover,
          speed: frozenSeconds === undefined ? direction * orbit.speed : 0,
        },
      }),
    }
    const state = turn.current
    const stop = () => {
      state.dragging = false
      state.keys.clear()
    }
    const enter = () => {
      if (!pauseMenu.getSnapshot().locked || fading.current !== null) {
        return
      }
      // The teleport releases the camera and puts the player there at once, camera included, so the view never moves.
      galleryEvents.dispatchEvent(new CustomEvent('teleport', {
        detail: {
          feet: true,
          position: [camera.position.x, camera.position.y - defaultEgoOptions.eyeHeight, camera.position.z],
          rotation: camera.quaternion.toArray(),
        },
      }))
      fading.current = 1
      stop()
    }
    const down = (event: PointerEvent) => {
      if (event.button === 0 && fading.current === null && grabsScene(event.target)) {
        state.dragging = true
      }
    }
    const move = (event: PointerEvent) => {
      if (!state.dragging) {
        return
      }
      // A release outside the window never arrives as a pointerup.
      if (!(event.buttons & 1)) {
        state.dragging = false
        return
      }
      // The scene follows the pointer like a swipe, the reverse of V-inspection’s orbit under the locked pointer.
      state.pointer -= event.movementX * inspectionPointerSensitivity(orbitPointerSpeed * pointerSpeed(), false, event.shiftKey)
    }
    const up = (event: PointerEvent) => {
      if (event.button === 0) {
        state.dragging = false
      }
    }
    const keyDown = (event: KeyboardEvent) => {
      if (fading.current === null && !event.ctrlKey && !event.metaKey && !event.altKey && !isTextInput(event.target) && (leftKeys.has(event.code) || rightKeys.has(event.code))) {
        state.keys.add(event.code)
      }
    }
    const keyUp = (event: KeyboardEvent) => {
      state.keys.delete(event.code)
    }
    const unsubscribe = pauseMenu.subscribe(enter)
    globalThis.addEventListener('pointerdown', down, true)
    globalThis.addEventListener('pointermove', move, true)
    globalThis.addEventListener('pointerup', up, true)
    globalThis.addEventListener('keydown', keyDown)
    globalThis.addEventListener('keyup', keyUp)
    window.addEventListener('blur', stop)
    return () => {
      unsubscribe()
      globalThis.removeEventListener('pointerdown', down, true)
      globalThis.removeEventListener('pointermove', move, true)
      globalThis.removeEventListener('pointerup', up, true)
      globalThis.removeEventListener('keydown', keyDown)
      globalThis.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', stop)
      stop()
      inspection.current = null
    }
    function pointerSpeed() {
      const {controls} = get()
      return controls instanceof PointerLockControls ? controls.pointerSpeed : 1
    }
  }, [camera, get, orbit])
  useFrame((_, delta) => {
    if (fading.current !== null) {
      fading.current = Math.max(0, fading.current - Math.min(delta, 0.1) / blurFade)
      setInspectionFocus(fading.current, focus.current.distance, focus.current.proximity)
      if (fading.current === 0) {
        endIntro()
      }
      return
    }
    const current = inspection.current
    if (!current) {
      return
    }
    const state = turn.current
    const keys = [...state.keys]
    const keyTurn = Number(keys.some(code => rightKeys.has(code))) - Number(keys.some(code => leftKeys.has(code)))
    const {controls} = get()
    const pointerSpeed = controls instanceof PointerLockControls ? controls.pointerSpeed : 1
    current.orbit.addInput(state.pointer + keyTurn * orbitKeySpeed * pointerSpeed * delta, 0)
    state.pointer = 0
    current.orbit.update(current.center, delta)
    focus.current.distance = camera.position.distanceTo(current.center) + current.orbit.radius
    focus.current.proximity = current.orbit.getProximity(current.center)
    setInspectionFocus(1, focus.current.distance, focus.current.proximity, 1)
  })
  return null
}

/** Whether a press on the target grabs the scene: anywhere but on a control or on text that can be selected, like the menu’s title. */
function grabsScene(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false
  }
  return !target.closest('a, button, input, label, select, summary, textarea, [popover]') && getComputedStyle(target).userSelect === 'none'
}
