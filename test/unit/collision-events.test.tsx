import type {CollisionEnterPayload, RapierContext} from '@react-three/rapier'

import {expect, test} from 'bun:test'

import {createRoot} from '@react-three/fiber'
import {BallCollider, CuboidCollider, Physics, RigidBody, useRapier} from '@react-three/rapier'
import {act} from 'react'
import {WebGPURenderer} from 'three/webgpu'

test('a body that strikes another and bounces off within the steps of one frame still enters the collision, while it touches', async () => {
  // Real Fiber, React and Rapier lifecycles with an inert renderer. No browser or GPU interaction.
  const previousActEnvironment = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true})
  const canvas = {
    width: 100,
    height: 100,
    style: {},
    ownerDocument: {},
  } as unknown as HTMLCanvasElement
  const renderer = new WebGPURenderer({canvas})
  renderer.hasInitialized = () => true
  // Fiber’s XR wiring clears the animation loop, which would otherwise initialize a real backend.
  renderer.setAnimationLoop = () => Promise.resolve()
  renderer.render = () => {}
  const root = createRoot(canvas)
  let physics: RapierContext | undefined
  function Probe() {
    physics = useRapier()
    return null
  }
  const entered: Array<{
    other: unknown
    x: number
  }> = []
  const struck = ({other, target}: CollisionEnterPayload) => {
    entered.push({
      other: other.rigidBody?.userData,
      x: target.rigidBody!.translation().x,
    })
  }
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
    // A ball flying at a wall at 10 m/s, which it reaches 0.12 s later, and bouncing straight back off it
    await act(async () => {
      root.render(<Physics gravity={[0, 0, 0]} paused>
        <RigidBody colliders={false} type='fixed' userData={{id: 'wall'}}>
          <CuboidCollider args={[0.05, 1, 1]} position={[1, 0, 0]} restitution={1} />
        </RigidBody>
        <RigidBody colliders={false} linearVelocity={[10, 0, 0]} position={[-0.39, 0, 0]} type='dynamic' onCollisionEnter={struck}>
          <BallCollider args={[0.14]} restitution={1} />
        </RigidBody>
        <Probe />
      </Physics>)
    })
    // Physics suspends on the dynamic WASM import, even after React’s initial commit.
    for (let i = 0; !physics && i < 100; i++) {
      await act(async () => {
        await Bun.sleep(5)
      })
    }
    expect(physics).toBeDefined()
    // Frames of 0.1 s, as a slow or virtual clock hands them out, each 6 steps of 1/60 s: the ball reaches the wall in the first step of the second frame and is long gone from it again by its end.
    for (let frame = 0; frame < 3; frame++) {
      physics!.step(0.1)
    }
    expect(entered).toHaveLength(1)
    expect(entered[0].other).toEqual({id: 'wall'})
    // Told in the step it struck in, touching the wall’s face 0.95 m out, not where the frame left it, back where it started
    expect(entered[0].x).toBeGreaterThan(0.95 - 0.14 - 10 / 60)
  } finally {
    await act(async () => root.unmount())
    if (previousActEnvironment) {
      Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousActEnvironment)
    } else {
      Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
    }
  }
})
