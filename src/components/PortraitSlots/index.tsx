import {useLayoutEffect} from 'react'

import {slotIssue, usePortraitSlots} from '#src/lib/gallery/portraitSlotStore.ts'
import {invalidSlotColor, slotColors} from '#src/lib/gallery/portraitSlotVisuals.ts'

import useSlotPanels from './useSlotPanels.ts'

/** Mark frame and placard, omitting the dragged slot whose ghost appears where it would drop. */
export default function PortraitSlots() {
  const slots = usePortraitSlots(state => state.slots)
  const aimed = usePortraitSlots(state => state.aimed)
  const dragging = usePortraitSlots(state => state.dragging)
  const panels = useSlotPanels(Math.ceil(slots.length / 64) * 64)
  useLayoutEffect(() => {
    const batch = panels.current
    if (!batch) {
      return
    }
    let count = 0
    for (const slot of slots) {
      if (slot.id !== dragging) {
        batch.setSlot(count++, slot, slotIssue(slot, slots) ? invalidSlotColor : slotColors[slot.ratio], slot.id === aimed)
      }
    }
    batch.showSlots(count)
  }, [aimed, dragging, panels, slots])
  return null
}
