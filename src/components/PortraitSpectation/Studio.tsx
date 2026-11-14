import type {Portrait} from '#src/lib/gallery.ts'
import type {WebgpuRendererOptions} from 'three-fiber-game'
import type {OrbitControls as Controls} from 'three/addons/controls/OrbitControls.js'
import type {Group, PerspectiveCamera} from 'three/webgpu'

import {OrbitControls} from '@react-three/drei/webgpu'
import {useThree} from '@react-three/fiber'
import {useEffect, useLayoutEffect, useRef} from 'react'
import Game, {WebgpuRenderer} from 'three-fiber-game'

import PortraitModel from '#component/PortraitModel'
import {createEnvironment, drawEnvironment} from '#src/lib/gallery/environment.ts'
import {lightingPresets} from '#src/lib/gallery/lighting.ts'
import {portraitStudioBounds, portraitStudioDistance} from '#src/lib/rendering/portraitStudio.ts'

const createRenderer = (options: WebgpuRendererOptions) => new WebgpuRenderer({
  ...options,
  alpha: true,
  antialias: true,
})

/** Its own demand-driven canvas: orbiting never advances the world, and resting draws no frames. No physics, player controls, sound, telemetry or world postprocessing belongs here. */
export default function Studio({portrait, reset}: {
  portrait: Portrait
  reset: number
}) {
  return <Game
    camera={{
      fov: 35,
      near: 0.01,
      far: 100,
    }} dpr={[1, 2]} frameloop='demand' renderer={createRenderer}
  >
    <StudioScene portrait={portrait} reset={reset} />
  </Game>
}

function StudioScene({portrait, reset}: {
  portrait: Portrait
  reset: number
}) {
  const camera = useThree(s => s.camera) as PerspectiveCamera
  const scene = useThree(s => s.scene)
  const canvas = useThree(s => s.renderer.domElement)
  const {width, height} = useThree(s => s.size)
  const invalidate = useThree(s => s.invalidate)
  const controls = useRef<Controls>(null)
  const model = useRef<Group>(null)
  useLayoutEffect(() => {
    const environment = createEnvironment()
    const {gradient, lightBoxes} = lightingPresets.noon.environment
    drawEnvironment(environment, gradient, lightBoxes)
    Object.assign(scene, {
      environment,
      environmentIntensity: 0.8,
    })
    invalidate()
    return () => {
      Object.assign(scene, {environment: null})
      environment.dispose()
    }
  }, [invalidate, scene])
  useLayoutEffect(() => {
    const bounds = portraitStudioBounds(model.current!)
    const distance = portraitStudioDistance(bounds.radius, width / height, camera.fov)
    camera.position.copy(bounds.center).add({
      x: 0,
      y: 0,
      z: distance,
    })
    Object.assign(camera, {
      near: Math.max(0.001, bounds.radius / 100),
      far: Math.max(100, distance * 10),
    })
    camera.updateProjectionMatrix()
    Object.assign(controls.current!, {
      minDistance: bounds.radius * 1.1,
      maxDistance: distance * 3,
    })
    controls.current!.target.copy(bounds.center)
    controls.current!.update()
    invalidate()
  }, [camera, width, height, invalidate, portrait.id, portrait.frame, portrait.width, portrait.height, reset])
  useEffect(() => {
    const orbit = controls.current!
    // Keyboard controls are local to this canvas, not the paused game or the collection.
    canvas.setAttribute('tabindex', '0')
    canvas.setAttribute('aria-label', 'Portrait model. Arrow keys rotate; plus and minus zoom.')
    const keydown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowLeft': {
          orbit.rotateLeft(0.15)
          break
        }
        case 'ArrowRight': {
          orbit.rotateLeft(-0.15)
          break
        }
        case 'ArrowUp': {
          orbit.rotateUp(0.15)
          break
        }
        case 'ArrowDown': {
          orbit.rotateUp(-0.15)
          break
        }
        case '+': case '=': {
          orbit.dollyIn(1 / 1.1)
          break
        }
        case '-': {
          orbit.dollyOut(1 / 1.1)
          break
        }
        default: {
          return
        }
      }
      event.preventDefault()
      event.stopPropagation()
      orbit.update()
      invalidate()
    }
    canvas.addEventListener('keydown', keydown)
    return () => canvas.removeEventListener('keydown', keydown)
  }, [canvas, invalidate])
  return <>
    <ambientLight intensity={0.45} />
    <hemisphereLight args={['#e1edff', '#80705d', 1.3]} />
    <directionalLight color='#fff0d7' intensity={2.3} position={[-3, 5, 8]} />
    <directionalLight color='#d9e8ff' intensity={1.2} position={[4, 1, -5]} />
    <group ref={model}><PortraitModel portrait={portrait} /></group>
    <OrbitControls enableDamping={false} enablePan={false} ref={controls} />
  </>
}
