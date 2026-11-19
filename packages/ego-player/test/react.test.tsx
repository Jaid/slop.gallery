import type {EgoDump, EgoInput, EgoPlayerHandle, EgoPlayerProps, EgoState} from '../src/main.ts'
import type {RootState} from '@react-three/fiber'
import type {RapierContext} from '@react-three/rapier'

import {expect, test} from 'bun:test'

import {createRoot, extend, useThree} from '@react-three/fiber'
import {CuboidCollider, Physics, RigidBody, useRapier} from '@react-three/rapier'
import Branch from 'branch-component'
import {act, createRef, StrictMode, Suspense} from 'react'
import {Object3D, WebGPURenderer} from 'three/webgpu'

import EgoPlayer from '../src/main.ts'

extend({Object3D})
test('React lifecycle preserves the motor, camera ownership and ref contract without gallery providers', async () => {
  // Real Fiber, React and Rapier lifecycles with an inert renderer. No browser or GPU interaction.
  const previousActEnvironment = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true})
  const ownerDocument = {pointerLockElement: null as unknown}
  const canvas = {
    width: 100,
    height: 100,
    style: {},
    ownerDocument,
  } as unknown as HTMLCanvasElement
  const renderer = new WebGPURenderer({canvas})
  renderer.hasInitialized = () => true
  // Fiber’s XR wiring clears the animation loop, which would otherwise initialize a real backend.
  renderer.setAnimationLoop = () => Promise.resolve()
  renderer.render = () => {}
  const root = createRoot(canvas)
  const player = createRef<EgoPlayerHandle>()
  let physics: RapierContext | undefined
  let scene: RootState | undefined
  let keys: EgoInput = {}
  let inputCalls = 0
  let latest: EgoState | undefined
  let cameraEnabled = true
  let ceiling: number | undefined
  function Probe() {
    physics = useRapier()
    scene = useThree()
    return null
  }
  const input = () => keys
  const onInput = () => inputCalls++
  const onUpdate = (state: EgoState) => {
    latest = state
  }
  const cameraToggle = () => cameraEnabled
  const render = (props: Partial<EgoPlayerProps> = {}, mounted = true) => <StrictMode><Suspense fallback={null}><Physics paused>
    {mounted && <EgoPlayer cameraEnabled={cameraToggle} gravity={0} input={input} pointerLock={false} ref={player} onInput={onInput} onUpdate={onUpdate} {...props} />}
    <Branch if={ceiling !== undefined}><RigidBody key={ceiling} colliders={false} type='fixed'>
      <CuboidCollider args={[1, 0.1, 1]} position={[4, ceiling!, 0]} />
      <CuboidCollider args={[10, 0.1, 10]} position={[0, -0.1, 0]} />
    </RigidBody></Branch>
    <Probe />
  </Physics></Suspense></StrictMode>
  try {
    await root.configure({
      renderer: () => renderer,
      frameloop: 'never',
      size: {
        width: 100,
        height: 100,
        top: 0,
        left: 0,
      },
    })
    await act(async () => {
      root.render(render({pitch: -0.108}))
    })
    // Physics suspends on the dynamic WASM import, even after React’s initial commit.
    for (let i = 0; !player.current?.getState() && i < 100; i++) {
      await act(async () => {
        await Bun.sleep(5)
      })
    }
    expect(player.current?.getState()).not.toBeNull()
    const onDemand = player.current!.dump()!
    const {position: livePosition, ...live} = player.current!.getState()!
    expect(onDemand.player).toMatchObject(live)
    expect(onDemand.player.position.y).toBeCloseTo(livePosition.y, 3)
    expect(onDemand.input).toEqual([])
    expect(onDemand.camera.pitch).toBeCloseTo(-0.108, 4)
    const context = physics!
    const state = scene!
    const handle = player.current!
    const body = handle.body!
    expect(body.userData).toEqual({isPlayer: true})
    expect(context.world.bodies.len()).toBe(1)
    expect(context.world.colliders.len()).toBe(1)
    let time = 0
    const frame = () => state.advance(time += 1000 / 60)
    const tick = (count = 1) => {
      for (let i = 0; i < count; i++) {
        context.step(1 / 60)
      }
      frame()
    }
    frame()
    expect(state.camera.rotation.x).toBeCloseTo(-0.108)
    const originalPosition = body.translation()
    await act(async () => root.render(render({
      pitch: 0.2,
      yaw: 1.3,
    })))
    expect(player.current?.body).toBe(body)
    expect(body.translation()).toEqual(originalPosition)
    expect(state.camera.rotation.x).toBeCloseTo(0.2)
    expect(state.camera.rotation.y).toBeCloseTo(1.3)
    await act(async () => root.render(render()))
    expect(state.camera.rotation.x).toBe(0)
    expect(state.camera.rotation.y).toBe(0)
    keys = {forward: true}
    tick(30)
    expect(inputCalls).toBe(0)
    expect(latest?.active).toBe(false)
    ownerDocument.pointerLockElement = {}
    tick(30)
    expect(inputCalls).toBe(0)
    ownerDocument.pointerLockElement = canvas
    tick(30)
    expect(inputCalls).toBe(30)
    expect(latest?.active).toBe(true)
    expect(latest?.position.z).toBeLessThan(0)
    expect(state.camera.position.y).toBeCloseTo(body.translation().y + 1.6)
    let interactions = 0
    const dumps: Array<EgoDump> = []
    const zoomAmounts: Array<number> = []
    const actions = {
      casualZoomTransition: 0,
      extendedZoomTransition: 0,
      onZoomChange: (amount: number) => zoomAmounts.push(amount),
      onInteract: () => interactions++,
      onDump: (dump: EgoDump) => {
        dumps.push(dump)
      },
    }
    await act(async () => root.render(render(actions)))
    keys = {
      interact: true,
      dump: true,
      zoom: true,
    }
    const originalFov = 'fov' in state.camera ? state.camera.fov : 0
    tick(3)
    frame()
    expect(interactions).toBe(1)
    expect(dumps).toHaveLength(1)
    expect(dumps[0].camera.fov).toBe(originalFov / 2)
    expect(zoomAmounts.at(-1)).toBe(1)
    keys = {}
    tick()
    expect('fov' in state.camera && state.camera.fov).toBe(originalFov)
    expect(zoomAmounts.at(-1)).toBe(0)
    keys = {
      interact: true,
      dump: true,
      zoom: true,
      modifier: true,
    }
    tick()
    expect(dumps).toHaveLength(1)
    expect(interactions).toBe(1)
    expect('fov' in state.camera && state.camera.fov).toBe(originalFov)
    keys = {}
    tick()
    ownerDocument.pointerLockElement = null
    keys = {
      interact: true,
      dump: true,
      zoom: true,
    }
    tick()
    expect(dumps).toHaveLength(1)
    ownerDocument.pointerLockElement = canvas
    keys = {}
    tick()
    keys = {dump: true}
    tick()
    expect(dumps).toHaveLength(2)
    expect(dumps[1].id).not.toBe(dumps[0].id)
    keys = {}
    tick()
    await act(async () => root.render(render()))
    const calls = inputCalls
    keys = {dump: true}
    tick()
    expect(dumps).toHaveLength(2)
    expect(inputCalls).toBe(calls)
    keys = {crouch: true}
    tick()
    expect(handle.getState()?.crouching).toBe(true)
    expect(body.collider(0).halfHeight()).toBeCloseTo(0.3)
    await act(async () => {
      root.render(render({
        speed: 4,
        position: [99, 99, 99],
      }))
    })
    expect(player.current?.body).toBe(body)
    expect(body.translation().x).toBe(0)
    expect(body.collider(0).halfHeight()).toBeCloseTo(0.3)
    expect(body.collider(0).translation().y - body.translation().y).toBeCloseTo(0.6)
    cameraEnabled = false
    state.camera.position.set(8, 9, 10)
    tick()
    expect(state.camera.position.toArray()).toEqual([8, 9, 10])
    expect(handle.teleport([3, 4, 5], [0, 2, 0, 0])).toEqual([3, 4, 5])
    expect(handle.getState()?.velocity).toEqual({
      x: 0,
      y: 0,
      z: 0,
    })
    expect(state.camera.position.toArray()).toEqual([3, 5.1, 5])
    expect(state.camera.quaternion.toArray()).toEqual([0, 1, 0, 0])
    expect(() => handle.teleport([0, 0, 0], [0, 0, 0, 0])).toThrow(RangeError)
    expect(handle.getState()?.position).toEqual({
      x: 3,
      y: 4,
      z: 5,
    })
    cameraEnabled = true
    keys = {}
    tick()
    expect(state.camera.position.x).toBe(3)
    await act(async () => {
      root.render(render({requirePointerLock: false}))
    })
    ownerDocument.pointerLockElement = null
    keys = {forward: true}
    tick(30)
    expect(latest?.active).toBe(true)
    await act(async () => {
      root.render(render({
        requirePointerLock: false,
        dodgeFactor: 1.2,
        dodgeJumpFactor: 1.05,
      }))
    })
    keys = {
      right: true,
      sprint: true,
    }
    tick(120)
    expect(Math.hypot(latest!.velocity.x, latest!.velocity.z)).toBeCloseTo(3 * 1.2, 4)
    const metadata = {team: 'blue'}
    await act(async () => root.render(render({userData: metadata})))
    expect(body.userData).toBe(metadata)
    expect(player.current?.body).toBe(body)
    await act(async () => root.render(render()))
    expect(body.userData).toEqual({isPlayer: true})
    await act(async () => {
      root.render(render({}, false))
    })
    expect(player.current).toBeNull()
    expect(context.world.bodies.len()).toBe(0)
    expect(context.world.colliders.len()).toBe(0)
    expect(context.beforeStepCallbacks.size).toBe(0)
    expect(context.afterStepCallbacks.size).toBe(0)
    // Mount the player before its environment, then render before stepping physics.
    for (const blocked of [false, true]) {
      ceiling = blocked ? 0.6 : 1.4
      keys = {}
      cameraEnabled = true
      await act(async () => root.render(render({
        position: [4, 0.02, 0],
        fallbackPosition: [0, 0.05, 0],
        enabled: false,
      })))
      frame()
      const restored = player.current!
      expect(restored.getState()?.crouching).toBe(!blocked)
      expect(restored.body!.translation().x).toBe(blocked ? 0 : 4)
      expect(state.camera.position.x).toBe(blocked ? 0 : 4)
      expect(state.camera.position.y).toBeCloseTo(blocked ? 1.65 : 1.12, 5)
      tick()
      expect(latest?.crouching).toBe(!blocked)
      expect(latest?.position.x).toBe(blocked ? 0 : 4)
      // A later teleport there tells where it ended up: there, or at the fallback position.
      expect(restored.teleport([4, 0.02, 0])).toEqual(blocked ? [0, 0.05, 0] : [4, 0.02, 0])
      expect(restored.body!.translation().x).toBe(blocked ? 0 : 4)
      if (!blocked) {
        expect(restored.teleport([0, 0.05, 0])).toEqual([0, 0.05, 0])
        tick(120)
        expect(restored.getState()?.crouching).toBe(false)
      }
      await act(async () => root.render(render({}, false)))
    }
    // A mount-time restore request waits for sibling colliders and copies its arguments.
    ceiling = 1.4
    cameraEnabled = false
    state.camera.position.set(8, 9, 10)
    await act(async () => root.render(render({position: [4, 0.02, 0]})))
    frame()
    expect(player.current!.getState()?.crouching).toBe(true)
    expect(state.camera.position.toArray()).toEqual([8, 9, 10])
    await act(async () => root.render(render({}, false)))
    await act(async () => root.render(render({position: [0, 0.05, 0]})))
    const pending: [number, number, number] = [4, 0.02, 0]
    // Queued, it has not put the feet anywhere yet.
    expect(player.current!.teleport(pending, [0, 1, 0, 0])).toBeUndefined()
    pending[0] = 100
    frame()
    expect(player.current!.getState()?.crouching).toBe(true)
    expect(state.camera.position.toArray()[0]).toBe(4)
    expect(state.camera.position.y).toBeCloseTo(1.12, 5)
    expect(state.camera.quaternion.toArray()).toEqual([0, 1, 0, 0])
    await act(async () => root.render(render({}, false)))
  } finally {
    await act(async () => root.unmount())
    if (previousActEnvironment) {
      Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousActEnvironment)
    } else {
      Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
    }
  }
})
