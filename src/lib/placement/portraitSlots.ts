import type {Portrait, PortraitRatio, PortraitSlot} from '../gallery/types.ts'

/** width per height of each slot ratio */
export const portraitRatios: Record<PortraitRatio, number> = {
  '1:1': 1,
  '2:3': 2 / 3,
  '3:2': 3 / 2,
  '9:16': 9 / 16,
  '16:9': 16 / 9,
}

/** the frame areas, in cm², that slots of every ratio come in */
export const slotAreas = [7500, 15_000, 30_000, 60_000, 100_000] as const

/** the frame area, in cm², of works imported into a room that sets no portrait area of its own or outside of every room */
export const defaultPortraitArea = 15_000

const toMillimeters = (meters: number) => Math.round(meters * 1000) / 1000

/** Frame width and height in meters of a ratio at an area in cm², rounded to the millimeter. */
export function slotFrame(ratio: PortraitRatio, area: number) {
  return frameSize(portraitRatios[ratio], area)
}

/** Frame width and height in meters of a work `aspect` times as wide as it is high at an area in cm², rounded to the millimeter. */
export function frameSize(aspect: number, area: number) {
  const squareMeters = area / 10_000
  return {
    width: toMillimeters(Math.sqrt(squareMeters * aspect)),
    height: toMillimeters(Math.sqrt(squareMeters / aspect)),
  }
}

/** the frame area of a slot in cm² */
export function slotArea({width, height}: Pick<PortraitSlot, 'height' | 'width'>) {
  return Math.round(width * height * 10_000)
}

/** A slot as a hung work, for clearance checks against works and other slots. */
export function asPortrait(slot: PortraitSlot): Portrait {
  return {
    id: slot.id,
    title: '',
    creator: '',
    description: '',
    source: '',
    position: slot.position,
    rotation: slot.rotation,
    width: slot.width,
    height: slot.height,
    hung: true,
    wallId: slot.wallId,
    labelAbove: slot.labelAbove,
  }
}

