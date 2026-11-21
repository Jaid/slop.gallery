import type {PortraitRatio, PortraitSlot} from './types.ts'

import portraitLabel, {portraitLabelLayout} from './portraitLabel.ts'

/** Shared look of the portrait slot overlay and the editor’s preview. */
export const slotColors: Record<PortraitRatio, string> = {
  '1:1': '#2dd4bf',
  '2:3': '#f59e0b',
  '3:2': '#c084fc',
  '9:16': '#f472b6',
  '16:9': '#60a5fa',
}
export const invalidSlotColor = '#ef4444'
export const slotBorder = 0.04

/** rectangles of a slot in its own frame, as center x, center y, width and height: the frame first, then its name plate */
export function slotPanels(slot: PortraitSlot) {
  const label = portraitLabelLayout(slot.width, slot.height, slot.labelAbove)
  return [
    [0, 0, slot.width, slot.height],
    [0, label.y, label.width, portraitLabel.height],
  ] as const
}
