import type {Placement} from '#src/lib/gallery.ts'
import type {FirstPose, MutableRef} from './types.ts'
import type {RootState} from '@react-three/fiber'

import {useRapier} from '@react-three/rapier'
import {useEffect} from 'react'
import {Raycaster, Vector2} from 'three/webgpu'

import {enterGallery, galleryEvents, isTextInput, useGallery} from '#src/lib/gallery.ts'
import pauseMenu from '#src/lib/pauseMenu.ts'

import createGrabController from './grabController.ts'
import teleportToPortrait from './teleportToPortrait.ts'

export default function useInteractionEvents({
  camera,
  controls,
  renderer,
  placement,
  firstPose,
}: {
  camera: RootState['camera']
  controls: RootState['controls']
  firstPose: MutableRef<FirstPose | null>
  placement: MutableRef<Placement | null>
  renderer: RootState['renderer']
}) {
  const {world} = useRapier()
  useEffect(() => pauseMenu.attach(renderer.domElement), [renderer])
  useEffect(() => {
    const grabbing = createGrabController(camera, placement, world)
    const lock = () => {
      const {locked} = pauseMenu.getSnapshot()
      if (locked === useGallery.getState().locked) {
        return
      }
      useGallery.setState({
        locked,
        activeLabel: null,
      })
      if (!locked) {
        grabbing.cancel()
      } else {
        firstPose.current = {
          position: camera.position.clone(),
          rotation: camera.quaternion.clone(),
        }
      }
    }
    const down = (event: MouseEvent) => {
      if (event.target !== renderer.domElement) {
        return
      }
      if (!document.pointerLockElement) {
        if (event.button === 0) {
          enterGallery()
        }
        return
      }
      if (event.button === 0) {
        grabbing.grab()
      }
      if (event.button === 2 && useGallery.getState().held) {
        grabbing.release(true)
      }
    }
    const mouseup = (event: MouseEvent) => {
      if (event.button === 0) {
        grabbing.release()
      }
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTextInput(event.target)) {
        return
      }
      if (event.repeat) {
        return
      }
      const state = useGallery.getState()
      if (event.code === 'Escape') {
        grabbing.cancel()
      }
      if (!state.locked) {
        return
      }
      if (event.code === 'KeyQ' && state.held) {
        grabbing.release(true)
      }
    }
    const onView = (event: Event) => teleportToPortrait(camera, (event as CustomEvent<string>).detail)
    const importTarget = (x: number, y: number) => {
      const bounds = renderer.domElement.getBoundingClientRect()
      const cursor = new Vector2((x - bounds.left) / bounds.width * 2 - 1, -((y - bounds.top) / bounds.height) * 2 + 1)
      const dropRay = new Raycaster
      dropRay.setFromCamera(cursor, camera)
      return {
        origin: dropRay.ray.origin.toArray(),
        direction: dropRay.ray.direction.toArray(),
      }
    }
    const context = (event: Event) => event.preventDefault()
    const blur = () => {
      grabbing.cancel()
    }
    const unsubscribeMenu = pauseMenu.subscribe(lock)
    lock()
    globalThis.addEventListener('mousedown', down)
    globalThis.addEventListener('mouseup', mouseup)
    globalThis.addEventListener('keydown', keydown)
    window.addEventListener('blur', blur)
    renderer.domElement.addEventListener('contextmenu', context)
    galleryEvents.addEventListener('view', onView)
    useGallery.setState({importTarget})
    galleryEvents.addEventListener('cancel-interaction', grabbing.cancel)
    return () => {
      grabbing.cancel()
      unsubscribeMenu()
      globalThis.removeEventListener('mousedown', down)
      globalThis.removeEventListener('mouseup', mouseup)
      globalThis.removeEventListener('keydown', keydown)
      window.removeEventListener('blur', blur)
      renderer.domElement.removeEventListener('contextmenu', context)
      galleryEvents.removeEventListener('view', onView)
      if (useGallery.getState().importTarget === importTarget) {
        useGallery.setState({importTarget: null})
      }
      galleryEvents.removeEventListener('cancel-interaction', grabbing.cancel)
    }
  }, [camera, controls, firstPose, placement, renderer, world])
}
