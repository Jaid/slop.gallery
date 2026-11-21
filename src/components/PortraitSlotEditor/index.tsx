import type {PortraitSlot} from '#src/lib/gallery/types.ts'

import {useFrame, useThree} from '@react-three/fiber'
import {useEffect, useRef} from 'react'
import {Vector3} from 'three/webgpu'

import {useGallery} from '#src/lib/gallery.ts'
import {aimedSlot, createSlot, cycleSlotRatio, cycleSlotSize, draggedSlot, flipSlotLabel, moveSlot, previewSlot, removeSlot, slotIssue, slotTarget, usePortraitSlots} from '#src/lib/gallery/portraitSlotStore.ts'
import {invalidSlotColor, slotColors} from '#src/lib/gallery/portraitSlotVisuals.ts'

import useSlotPanels from '../PortraitSlots/useSlotPanels.ts'

const ray = (camera: {
  getWorldDirection: (target: Vector3) => Vector3
  position: Vector3
}) => [camera.position.toArray(), camera.getWorldDirection(new Vector3).toArray()] as const

/**
 * `?edit_portrait_slots`: aim at a slot and press ←/→ to cycle its ratio, ↑/↓ to cycle its size, L to move its placard above or below the frame and Delete to delete it. Hold the left mouse button on a slot to drag it and release to drop it where you aim. Aimed at a bare wall, a preview of a new slot follows the crosshair; the arrows and L shape it and the right mouse button places it. Edits are gone with a reload, so dump them with the `dump_portrait_slots` WebMCP tool before.
 */
export default function PortraitSlotEditor() {
  const camera = useThree(state => state.camera)
  const preview = useRef<PortraitSlot>(null)
  const panels = useSlotPanels(1, true)
  useFrame(() => {
    const {slots, aimed, dragging} = usePortraitSlots.getState()
    const [origin, direction] = ray(camera)
    const id = dragging ? null : aimedSlot(origin, direction, slots)?.id ?? null
    if (id !== aimed) {
      usePortraitSlots.setState({aimed: id})
    }
    const target = id ? null : slotTarget(origin, direction)
    preview.current = target && (dragging ? draggedSlot(target) : previewSlot(target))
    const slot = preview.current
    if (slot) {
      panels.current?.setSlot(0, slot, slotIssue(slot, slots) ? invalidSlotColor : slotColors[slot.ratio])
    }
    panels.current?.showSlots(slot ? 1 : 0)
  })
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.ctrlKey || event.metaKey || event.altKey) {
        return
      }
      const {aimed: hovered, dragging} = usePortraitSlots.getState()
      // While dragging, the keys shape the dragged slot.
      const aimed = dragging ?? hovered
      const actions: Partial<Record<string, () => void>> = {
        ArrowLeft: () => cycleSlotRatio(aimed, -1),
        ArrowRight: () => cycleSlotRatio(aimed, 1),
        ArrowUp: () => cycleSlotSize(aimed, 1),
        ArrowDown: () => cycleSlotSize(aimed, -1),
        KeyL: () => flipSlotLabel(aimed),
        Delete: () => {
          if (aimed) {
            removeSlot(aimed)
          }
        },
      }
      const action = actions[event.code]
      if (event.code === 'Escape') {
        usePortraitSlots.setState({dragging: null})
      }
      if (!action) {
        return
      }
      // Editing takes these keys from the game.
      event.preventDefault()
      event.stopImmediatePropagation()
      if (!event.repeat) {
        action()
      }
    }
    // Mouse buttons on a slot or a preview belong to the editor; everything else still reaches the game, such as grabbing portraits.
    const mousedown = (event: MouseEvent) => {
      if (!document.pointerLockElement || useGallery.getState().held) {
        return
      }
      const {aimed} = usePortraitSlots.getState()
      if (event.button === 0 && aimed) {
        usePortraitSlots.setState({dragging: aimed})
      } else if (event.button === 2 && preview.current && !usePortraitSlots.getState().dragging) {
        createSlot(preview.current)
      } else {
        return
      }
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    const mouseup = (event: MouseEvent) => {
      if (event.button !== 0 || !usePortraitSlots.getState().dragging) {
        return
      }
      if (preview.current) {
        moveSlot(preview.current)
      } else {
        usePortraitSlots.setState({dragging: null})
      }
      event.stopImmediatePropagation()
    }
    const cancel = () => usePortraitSlots.setState({dragging: null})
    globalThis.addEventListener('keydown', keydown, {capture: true})
    globalThis.addEventListener('mousedown', mousedown, {capture: true})
    globalThis.addEventListener('mouseup', mouseup, {capture: true})
    window.addEventListener('blur', cancel)
    return () => {
      globalThis.removeEventListener('keydown', keydown, {capture: true})
      globalThis.removeEventListener('mousedown', mousedown, {capture: true})
      globalThis.removeEventListener('mouseup', mouseup, {capture: true})
      window.removeEventListener('blur', cancel)
      cancel()
    }
  }, [camera])
  return null
}
