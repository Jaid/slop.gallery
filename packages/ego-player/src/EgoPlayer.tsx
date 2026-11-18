import type {EgoDump} from './EgoDiagnostics.ts'
import type {EgoZoomMode, EgoZoomOptions, EgoZoomTransition} from './EgoZoom.ts'
import type {EgoOptions} from './options.ts'
import type {EgoImpact, EgoInputReader, EgoPlayerHandle, EgoPosition, EgoRotation, EgoState, EgoToggle} from './types.ts'
import type {RapierCollider, RapierRigidBody, RigidBodyProps} from '@react-three/rapier'
import type {ComponentProps, ReactNode, Ref} from 'react'
import type {PointerLockControls as PointerLockControlsImpl} from 'three/addons/controls/PointerLockControls.js'

import {PointerLockControls} from '@react-three/drei/webgpu'
import {useFrame, useThree} from '@react-three/fiber'
import {CapsuleCollider, RigidBody, useAfterPhysicsStep, useBeforePhysicsStep, useRapier} from '@react-three/rapier'
import Branch from 'branch-component'
import {useEffect, useImperativeHandle, useLayoutEffect, useRef, useState} from 'react'

import EgoDiagnostics from './EgoDiagnostics.ts'
import EgoMotor from './EgoMotor.ts'
import getEgoPointerSpeed from './EgoPointerSpeed.ts'
import EgoView from './EgoView.ts'
import EgoZoom from './EgoZoom.ts'
import {getCapsuleHalfHeight} from './math.ts'
import {resolveEgoOptions} from './options.ts'

export type EgoPointerLockOptions = Omit<ComponentProps<typeof PointerLockControls>, 'camera' | 'domElement' | 'ref'>
export type EgoPlayerProps = EgoOptions & Partial<EgoZoomOptions> & {
  /** Only the camera position writer; disable while another system owns the view. */
  cameraEnabled?: EgoToggle
  children?: ReactNode
  /** Enables input, not gravity. May read an external store without React subscriptions. */
  enabled?: EgoToggle
  /** Safe feet position used when a spawn/teleport fits neither standing nor crouching. */
  fallbackPosition?: EgoPosition
  /** Free flight: forward/backward follow the camera direction including pitch, jump/crouch rise/sink, no gravity or collisions, and teleports go anywhere. */
  flying?: EgoToggle
  input: EgoInputReader
  /** Enables the dump action. Called once per press with a detached diagnostic snapshot. */
  onDump?: (dump: EgoDump) => void
  /** Called after a physics step for each obstacle the character first touched in it, ground included. */
  onImpact?: (impact: EgoImpact, state: EgoState) => void
  /** Called for active input during a physics step. */
  onInput?: (input: ReturnType<EgoInputReader>) => void
  /** Called once per interact press while input is active. */
  onInteract?: () => void
  /** Called after a new landing, with downward pre-impact speed. Initial placement is silent. */
  onLand?: (state: EgoState, impactSpeed: number) => void
  /** Called once per stride, independently of audio and head-bob amplitude. */
  onStep?: (state: EgoState) => void
  /** Called after physics with a detached snapshot. */
  onUpdate?: (state: EgoState) => void
  /** Called as the eased zoom changes. Zero is normal FOV; one is either fully zoomed mode. */
  onZoomChange?: (amount: number) => void
  /** Called once when a real FOV transition begins or reverses; explicit release/teleport is silent. */
  onZoomTransition?: (transition: EgoZoomTransition) => void
  /** Initial camera pitch in radians; updates intentionally reset camera orientation. */
  pitch?: number
  /** false omits look controls; an object customizes Drei’s pointer-lock controls. */
  pointerLock?: EgoPointerLockOptions | boolean
  /** Initial world-space feet position. Use the ref to teleport after mounting. */
  position?: EgoPosition
  ref?: Ref<EgoPlayerHandle>
  /** Defaults to true. Only a lock on this Canvas enables input. */
  requirePointerLock?: boolean
  /** Rigid-body metadata. Defaults to {isPlayer: true}; a supplied value replaces it. */
  userData?: RigidBodyProps['userData']
  /** Initial camera yaw in radians; updates intentionally reset camera orientation. */
  yaw?: number
}

const initialPosition: EgoPosition = [0, 0.05, 0]
const readToggle = (value: EgoToggle) => {
  return typeof value === 'function' ? value() : value
}
export default function EgoPlayer({cameraEnabled = true, casualZoomFactor = 2, casualZoomTransition = 0.2, children, enabled = true, extendedZoomFactor = 4, extendedZoomTransition = 0.5, fallbackPosition, flying = false, input, onDump, onImpact, onInteract, onLand, onZoomChange, onZoomTransition, onInput, onStep, onUpdate, pitch = 0, pointerLock = true, position = initialPosition, ref, requirePointerLock = true, userData, yaw = 0, ...options}: EgoPlayerProps) {
  const [defaultUserData] = useState(() => ({isPlayer: true}))
  for (const [name, factor] of Object.entries({
    casualZoomFactor,
    extendedZoomFactor,
  })) {
    if (!Number.isFinite(factor) || factor < 1) {
      throw new RangeError(`ego-player: ${name} must be finite and at least 1.`)
    }
  }
  for (const [name, transition] of Object.entries({
    casualZoomTransition,
    extendedZoomTransition,
  })) {
    if (!Number.isFinite(transition) || transition < 0) {
      throw new RangeError(`ego-player: ${name} must be finite and nonnegative.`)
    }
  }
  const zoomOptions = {
    casualZoomFactor,
    casualZoomTransition,
    extendedZoomFactor,
    extendedZoomTransition,
  }
  const actionKeys = useRef({
    interact: false,
    dump: false,
  })
  const zoomKeys = useRef({
    extendedEligible: false,
    sprint: false,
    zoom: false,
  })
  const [zoom] = useState(() => new EgoZoom)
  const zoomAmount = useRef(0)
  const pointerControls = useRef<PointerLockControlsImpl>(null)
  const basePointerSpeed = typeof pointerLock === 'object' ? pointerLock.pointerSpeed ?? 1 : 1
  const onZoomChangeRef = useRef(onZoomChange)
  useLayoutEffect(() => {
    onZoomChangeRef.current = onZoomChange
  }, [onZoomChange])
  const reportZoom = (amount: number) => {
    if (amount === zoomAmount.current) {
      return
    }
    zoomAmount.current = amount
    onZoomChangeRef.current?.(amount)
  }
  const resetZoom = () => {
    zoom.reset()
    if (pointerControls.current) {
      pointerControls.current.pointerSpeed = basePointerSpeed
    }
    reportZoom(0)
  }
  const bodyRef = useRef<RapierRigidBody>(null)
  const colliderRef = useRef<RapierCollider>(null)
  const motorRef = useRef<EgoMotor | null>(null)
  const initialized = useRef(false)
  const pendingTeleport = useRef<{
    position: EgoPosition
    rotation?: EgoRotation
  } | null>(null)
  const camera = useThree(state => state.camera)
  const scene = useThree(state => state.scene)
  const diagnostics = useRef<EgoDiagnostics | null>(null)
  useEffect(() => {
    diagnostics.current = onDump ? new EgoDiagnostics(scene, camera) : null
    return () => {
      diagnostics.current = null
    }
  }, [scene, camera, onDump])
  useEffect(() => () => {
    zoom.reset()
    if (zoomAmount.current !== 0) {
      zoomAmount.current = 0
      onZoomChangeRef.current?.(0)
    }
  }, [zoom, camera])
  const renderer = useThree(state => state.renderer)
  const {rapier, world} = useRapier()
  const resolved = resolveEgoOptions(options)
  const [view] = useState(() => new EgoView(resolved.eyeHeight))
  // The motor owns subsequent collider resizing; React must not restore the standing shape.
  const [initial] = useState(() => {
    const radius = Math.max(resolved.radius, 0.01)
    const height = Math.max(resolved.height, radius * 2)
    return {
      position: [...position] as [number, number, number],
      radius,
      height,
    }
  })
  useEffect(() => {
    const body = bodyRef.current
    const collider = colliderRef.current
    if (!body || !collider) {
      return
    }
    const motor = new EgoMotor(rapier, world, body, collider)
    motorRef.current = motor
    initialized.current = false
    return () => {
      motorRef.current = null
      motor.dispose()
    }
  }, [rapier, world])
  useEffect(() => {
    motorRef.current?.configure(options)
  })
  useEffect(() => {
    camera.rotation.set(pitch, yaw, 0, 'YXZ')
  }, [camera, pitch, yaw])
  const applyTeleport = (destination: EgoPosition, rotation?: EgoRotation, writeCamera = true) => {
    resetZoom()
    const motor = motorRef.current!
    motor.teleport(destination, fallbackPosition, readToggle(flying))
    const eyeHeight = motor.crouching ? resolved.crouchEyeHeight : resolved.eyeHeight
    view.reset(eyeHeight)
    const actual = motor.body.translation()
    if (writeCamera) {
      camera.position.set(actual.x, actual.y + eyeHeight, actual.z)
    }
    if (rotation) {
      camera.quaternion.set(...rotation).normalize()
    }
  }
  const initialize = () => {
    if (!motorRef.current || initialized.current) {
      return
    }
    // Sibling colliders finish mounting before physics/render callbacks, independent of JSX order.
    const pending = pendingTeleport.current
    const feet = motorRef.current.body.translation()
    applyTeleport(pending?.position ?? [feet.x, feet.y, feet.z], pending?.rotation, !!pending || readToggle(cameraEnabled))
    pendingTeleport.current = null
    initialized.current = true
  }
  useImperativeHandle(ref, () => ({
    releaseZoom: resetZoom,
    get body() {
      return bodyRef.current
    },
    getState: () => motorRef.current?.getState() ?? null,
    dump: () => {
      const motor = motorRef.current
      if (!motor) {
        return null
      }
      return (diagnostics.current ?? new EgoDiagnostics(scene, camera)).capture(motor.getState(), input())
    },
    fling: velocity => {
      // Before setup, the initial placement would reset the momentum anyway.
      if (initialized.current) {
        motorRef.current?.fling(velocity)
      }
    },
    teleport: (destination, rotation) => {
      const motor = motorRef.current
      if (!motor) {
        return
      }
      if (rotation && (!rotation.every(Number.isFinite) || Math.hypot(...rotation) === 0)) {
        throw new RangeError('ego-player: teleport rotation must be a finite, nonzero quaternion.')
      }
      if (!destination.every(Number.isFinite)) {
        throw new RangeError('ego-player: teleport position must be finite.')
      }
      if (!initialized.current) {
        pendingTeleport.current = {
          position: [...destination],
          rotation: rotation && [...rotation],
        }
        return
      }
      applyTeleport(destination, rotation)
    },
  }))
  useBeforePhysicsStep(physicsWorld => {
    initialize()
    const motor = motorRef.current
    if (!motor) {
      return
    }
    const keys = input()
    const active = readToggle(enabled) && (!requirePointerLock || renderer.domElement.ownerDocument.pointerLockElement === renderer.domElement)
    if (active && onInput && (keys.forward || keys.backward || keys.left || keys.right || keys.jump || keys.crouch || keys.sprint || !keys.modifier && (keys.zoom || keys.interact && onInteract || keys.dump && onDump))) {
      onInput(keys)
    }
    motor.step(physicsWorld.timestep, keys, camera.quaternion, active, readToggle(flying))
  })
  useAfterPhysicsStep(() => {
    const motor = motorRef.current
    if (motor && (onUpdate || onLand && motor.landingSpeed > 0 || onImpact && motor.impacts.length)) {
      const state = motor.getState()
      if (motor.landingSpeed > 0) {
        onLand?.(state, motor.landingSpeed)
      }
      for (const impact of motor.impacts) {
        onImpact?.(impact, state)
      }
      onUpdate?.(state)
    }
  })
  useFrame((_, delta) => {
    initialize()
    const motor = motorRef.current
    if (!motor) {
      return
    }
    const {offset, stepped} = view.update(delta, motor.horizontalSpeed, motor.grounded, motor.crouching, resolved)
    if (stepped && onStep) {
      onStep(motor.getState())
    }
    if (readToggle(cameraEnabled)) {
      const translation = motor.body.translation()
      camera.position.set(translation.x, translation.y + offset, translation.z)
    }
    const keys = input()
    const active = readToggle(enabled) && !keys.modifier && (!requirePointerLock || renderer.domElement.ownerDocument.pointerLockElement === renderer.domElement)
    // Intent cancels extended zoom before acceleration; physical motion also excludes coasting.
    // The small speed tolerance ignores resting-contact noise, not camera bob or mouse look.
    const stationary = motor.grounded && motor.horizontalSpeed < 0.01 && !keys.forward && !keys.backward && !keys.left && !keys.right && !keys.jump
    const zoomHeld = !!keys.zoom
    const sprintHeld = !!keys.sprint
    const sprintPressed = sprintHeld && !zoomKeys.current.sprint
    if (!zoomHeld || !sprintHeld) {
      zoomKeys.current.extendedEligible = false
    } else if (sprintPressed && zoomKeys.current.zoom) {
      // Shift must begin while Z is already held. Simultaneous observation and Shift-before-Z stay casual.
      zoomKeys.current.extendedEligible = true
    }
    let zoomMode: EgoZoomMode = 'none'
    if (active && readToggle(cameraEnabled) && zoomHeld) {
      zoomMode = sprintHeld && zoomKeys.current.extendedEligible && stationary ? 'extended' : 'casual'
    }
    zoomKeys.current.zoom = zoomHeld
    zoomKeys.current.sprint = sprintHeld
    if (pointerControls.current) {
      pointerControls.current.pointerSpeed = getEgoPointerSpeed(basePointerSpeed, zoomMode)
    }
    reportZoom(zoom.update(camera, zoomMode, zoomOptions, delta, onZoomTransition))
    if (active && keys.interact && !actionKeys.current.interact) {
      onInteract?.()
    }
    if (active && keys.dump && !actionKeys.current.dump && onDump && diagnostics.current) {
      onDump(diagnostics.current.capture(motor.getState(), keys))
    }
    actionKeys.current = {
      interact: !!keys.interact,
      dump: !!keys.dump,
    }
  })
  return <>
    <Branch if={pointerLock !== false}><PointerLockControls makeDefault {...typeof pointerLock === 'object' ? pointerLock : {}} domElement={renderer.domElement} ref={pointerControls} /></Branch>
    <RigidBody canSleep={false} colliders={false} position={initial.position} type='kinematicPosition' userData={userData === undefined ? defaultUserData : userData} ref={bodyRef}>
      <CapsuleCollider args={[getCapsuleHalfHeight(initial.height, initial.radius), initial.radius]} friction={0} position={[0, initial.height / 2, 0]} restitution={0} ref={colliderRef} />
      {children}
    </RigidBody>
  </>
}
