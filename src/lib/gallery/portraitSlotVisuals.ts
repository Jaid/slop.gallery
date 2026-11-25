import type {PortraitRatio, PortraitSlot} from './types.ts'

import hsl from 'okhsl'

import portraitLabel, {portraitLabelLayout} from './portraitLabel.ts'

/** Shared look of the portrait slot overlay and the editor’s preview. */
export const slotColors: Record<PortraitRatio, number> = {
  '1:1': hsl.integer(182, 89, 75),
  '2:3': hsl.integer(70, 99, 73),
  '3:2': hsl.integer(306, 93, 68),
  '9:16': hsl.integer(350, 85, 68),
  '16:9': hsl.integer(254, 92, 67),
}
export const invalidSlotColor = hsl.integer(25, 92, 58)
export const slotBorder = 0.04

/** rectangles of a slot in its own frame, as center x, center y, width and height: the frame first, then its name plate */
export function slotPanels(slot: PortraitSlot) {
  const label = portraitLabelLayout(slot.width, slot.height, slot.labelAbove)
  return [
    [0, 0, slot.width, slot.height],
    [0, label.y, label.width, portraitLabel.height],
  ] as const
}
