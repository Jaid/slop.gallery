import type {PhysicsProps, RapierContext} from '@react-three/rapier'
import type {ReactNode} from 'react'

import {createRoot} from '@react-three/fiber'
import {Physics, useRapier} from '@react-three/rapier'
import {act} from 'react'
import {WebGPURenderer} from 'three/webgpu'

/**
 * Mounts the scene in a paused `<Physics>`, in real Fiber, React and Rapier lifecycles with an inert renderer, without any browser or GPU interaction, and resolves with its Rapier context once Rapier loaded, which steps only when told to. Dispose it to unmount.
 */
export async function mountPhysics(scene: ReactNode, props: Omit<PhysicsProps, 'children' | 'paused'> = {}) {
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
  const unmount = async () => {
    await act(async () => root.unmount())
    if (previousActEnvironment) {
      Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousActEnvironment)
    } else {
      Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
    }
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
    await act(async () => {
      root.render(<Physics {...props} paused>
        {scene}
        <Probe />
      </Physics>)
    })
    // Physics suspends on the dynamic WASM import, even after React’s initial commit.
    for (let i = 0; !physics && i < 100; i++) {
      await act(async () => {
        await Bun.sleep(5)
      })
    }
    if (!physics) {
      throw new Error('Rapier never loaded.')
    }
    return {
      physics,
      [Symbol.asyncDispose]: unmount,
    }
  } catch (error) {
    await unmount()
    throw error
  }
}
