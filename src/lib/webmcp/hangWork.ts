import type {Portrait, Vec3} from '#src/lib/gallery/types.ts'

import {pickFrame} from '#src/lib/frames/frameChoice.ts'
import {arrivalFrame, newPortrait} from '#src/lib/gallery/actions.ts'
import {imageSize, importedImage, importedTitle} from '#src/lib/gallery/ImageImporter.ts'
import {maximumPortraits, validateImage} from '#src/lib/gallery/imagePolicy.ts'
import {usePortraitSlots} from '#src/lib/gallery/portraitSlotStore.ts'
import {useGallery} from '#src/lib/gallery/store.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import {slotArea} from '#src/lib/placement/portraitSlots.ts'

export type WorkHangingInput = {
  /** its id, unique in the collection; by default a new one */
  id?: string
  /** the URL of the image */
  image: string
  /** the id of the portrait slot it hangs in */
  slot: string
  /** its title; by default the image’s file name, as an import names it */
  title?: string
}
export type WorkHanging = {
  height: number
  id: string
  position: Vec3
  /** the id of the work that hung in the slot before, which the new one takes the place of */
  replaced?: string
  rotation: number
  slot: string
  title: string
  width: number
}

/** Whether the work hangs in the slot: on its wall, centered where the slot is. */
const hangsIn = (portrait: Portrait, slot: {
  position: Vec3
  wallId: string
}) => portrait.hung && portrait.wallId === slot.wallId && Math.hypot(...portrait.position.map((value, axis) => value - slot.position[axis])) < 1e-3

/** Hangs the image at the URL `image` in the portrait slot with the id `slot` as an imported work, in place of the work hanging there, if any; see the `hang_work` tool. */
export default async function hangWork({id, image, slot, title}: WorkHangingInput): Promise<WorkHanging> {
  const target = usePortraitSlots.getState().slots.find(candidate => candidate.id === slot)
  if (!target) {
    throw new Error(`There is no portrait slot “${slot}”; dump_portrait_slots lists them.`)
  }
  if (id !== undefined && useGallery.getState().portraits.some(candidate => candidate.id === id)) {
    throw new Error(`A work already has the id “${id}”.`)
  }
  const response = await fetch(image)
  if (!response.ok) {
    throw new Error(`The image could not be loaded (HTTP ${response.status}).`)
  }
  const file = await response.blob()
  validateImage(file)
  const {image: source, width: pixelWidth, height: pixelHeight} = await importedImage(file)
  // It keeps its own aspect at the slot’s frame area, as an import keeps the area of the room it hangs in.
  const {width, height} = imageSize(pixelWidth, pixelHeight, slotArea(target))
  const normal: Vec3 = [Math.sin(target.rotation), 0, Math.cos(target.rotation)]
  const {pathname} = new URL(image, location.href)
  const portrait = newPortrait(source, title ?? importedTitle(decodeURIComponent(pathname.split('/').at(-1)!)), width, height, {
    position: target.position,
    direction: [-normal[0], 0, -normal[2]],
  })
  if (id !== undefined) {
    portrait.id = id
  }
  const frame = target.frame ? pickFrame(environmentSeed, target.frame, portrait.id) : arrivalFrame(target.position, target.position, portrait.id)
  Object.assign(portrait, {
    position: [...target.position],
    rotation: target.rotation,
    wallId: target.wallId,
    hung: true,
    frame,
    ...target.labelAbove ? {labelAbove: true} : {},
  })
  if (!frame) {
    delete portrait.frame
  }
  const {commit, portraits} = useGallery.getState()
  const replaced = portraits.find(candidate => hangsIn(candidate, target))
  if (!replaced && portraits.length >= maximumPortraits) {
    throw new Error('The collection is full. Remove a work to make room.')
  }
  commit([...portraits.filter(candidate => candidate !== replaced), portrait])
  return {
    id: portrait.id,
    title: portrait.title,
    slot: target.id,
    ...replaced ? {replaced: replaced.id} : {},
    position: portrait.position,
    rotation: portrait.rotation,
    width,
    height,
  }
}
