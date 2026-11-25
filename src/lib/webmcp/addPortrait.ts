import type {CanvasMaterialId} from '#src/canvas_materials/lib/canvasMaterialIds.ts'
import type {PortraitFrameId} from '#src/frames/lib/frameParameter.ts'
import type {PlacardSide} from '#src/lib/gallery/portraitLabel.ts'
import type {Portrait, PortraitSlot, Vec3} from '#src/lib/gallery/types.ts'
import type {PlacementIssue} from '#src/lib/placement/wallGeometry.ts'

import {canvasMaterialIds, isCanvasMaterialId} from '#src/canvas_materials/lib/canvasMaterialIds.ts'
import {pickFrame} from '#src/frames/lib/frameChoice.ts'
import {frameIds} from '#src/frames/lib/frameParameter.ts'
import {arrivalFrame, newPortrait} from '#src/lib/gallery/actions.ts'
import {requestHanging} from '#src/lib/gallery/hanging/hangings.ts'
import {imageSize, importedImage} from '#src/lib/gallery/ImageImporter.ts'
import {maximumPortraits} from '#src/lib/gallery/imagePolicy.ts'
import {usePortraitSlots} from '#src/lib/gallery/portraitSlotStore.ts'
import {useGallery} from '#src/lib/gallery/store.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import {slotArea} from '#src/lib/placement/portraitSlots.ts'
import {wallPosition} from '#src/lib/placement/wallGeometry.ts'
import world from '#src/worlds/current.ts'

/** where a new work goes: into a portrait slot, onto a wall or loose into the world */
export type PortraitTarget = {
  /** the id of the portrait slot it hangs in, in place of the work hanging there, if any */
  slot: string
} | {
  /** the middle of its frame in world meters, where it enters the world loose, upright and facing +z, and falls */
  position: {
    x: number
    y: number
    z: number
  }
} | {
  /** the middle of its frame on the wall: `x` meters along it from its middle, to the right as seen from its room, and `y` meters above its foot */
  position: {
    x: number
    y: number
  }
  /** the id of the wall it hangs on */
  wallId: string
}
export type PortraitAdditionInput = {
  /** the id of the canvas material its image is on unless the page forces ?new_canvas_material; by default none */
  canvasMaterial?: string
  /** the id of the frame it wears; by default its roll of the frames of the slot or of the room it arrives in */
  frame?: string
  /** whether a work that hangs arrives on its wall like one the player hangs, flying there from in front of the camera, instead of being there right away */
  hangingAnimation?: boolean
  /** its id, unique in the collection; by default a new one */
  id?: string
  /** the URL of the image or video supplying its first frame */
  image: string
  /** its frame area in cm²; by default the slot’s or that of the room it arrives in */
  size?: number
  target: PortraitTarget
  /** its title; by default none, like a work the player brings in has until its flavor text is written */
  title?: string
}
export type PortraitAddition = {
  /** the canvas material its image is on, left out for none */
  canvasMaterial?: CanvasMaterialId
  /** the frame it wears, left out for the default frame */
  frame?: PortraitFrameId
  height: number
  hung: boolean
  id: string
  position: Vec3
  /** the id of the work that hung in the slot before, which the new one takes the place of */
  replaced?: string
  rotation: number
  /** its frame area in cm² */
  size: number
  /** the slot it hangs in, if it went into one */
  slot?: string
  /** its title, if it was given one */
  title?: string
  /** the wall it hangs on, if it hangs */
  wallId?: string
  width: number
}

/** what a target comes down to once the world has found it */
export type PortraitDestination = {
  /** the frame area in cm² a work takes there unless told another */
  area: number
  /** The frame a work with the id wears there unless told another, or undefined for the default frame. */
  frame: (work: string) => PortraitFrameId | undefined
  /** Where the work, with its frame size in meters, goes there, among `portraits`, as what its portrait says about it; throws where it doesn’t fit. */
  place: (work: Pick<Portrait, 'height' | 'title' | 'width'>, portraits: ReadonlyArray<Portrait>) => Pick<Portrait, 'hung' | 'labelAbove' | 'position' | 'rotation' | 'wallId'>
  /** Whether the work is the one a new work takes the place of there. */
  replaces?: (portrait: Portrait) => boolean
  slot?: string
}

/** why a work does not fit where it was to hang, to end “It does not fit there: it would …” */
const issues: Record<PlacementIssue, string> = {
  unsticky: 'hang on a wall nothing hangs on',
  frame: 'reach past the wall’s ends, its foot or its top',
  doorway: 'cover an opening of the wall or come too close to one',
  neighbor: 'come too close to a work hanging there',
  reach: 'hang out of reach',
  window: 'cover a window',
  lightSwitch: 'cover a light switch',
}
/** Whether the work hangs in the slot: on its wall, centered where the slot is. */
const hangsIn = (portrait: Portrait, slot: Pick<PortraitSlot, 'position' | 'wallId'>) => portrait.hung && portrait.wallId === slot.wallId && Math.hypot(...portrait.position.map((value, axis) => value - slot.position[axis])) < 1e-3
const outOfReach = (what: string, room: string | undefined) => `${what} is in the ${room}, out of this page’s ?world_reach ${world.reach.mode}, which only mounts ${world.reach.rooms.join(', ')}.`

/** Finds where the target is in the world, or throws for a slot or a wall the world doesn’t have or this page doesn’t mount and for a position outside of the world. */
export function findPortraitDestination(target: PortraitTarget): PortraitDestination {
  if ('slot' in target) {
    const slot = usePortraitSlots.getState().slots.find(candidate => candidate.id === target.slot)
    if (!slot) {
      const elsewhere = world.portraitSlots().find(candidate => candidate.id === target.slot)
      throw new Error(elsewhere ? outOfReach(`The portrait slot “${target.slot}”`, world.wall(elsewhere.wallId)?.room) : `There is no portrait slot “${target.slot}”; dump_portrait_slots lists them.`)
    }
    return {
      area: slotArea(slot),
      frame: work => (slot.frame ? pickFrame(environmentSeed, slot.frame, work) : arrivalFrame(slot.position, slot.position, work)),
      // A slot takes whatever it is given, as its default work does.
      place: () => ({
        position: [...slot.position],
        rotation: slot.rotation,
        wallId: slot.wallId,
        hung: true,
        ...slot.labelAbove ? {labelAbove: true} : {},
      }),
      replaces: portrait => hangsIn(portrait, slot),
      slot: slot.id,
    }
  }
  if ('wallId' in target) {
    const wall = world.placement.wall(target.wallId)
    if (!wall) {
      const elsewhere = world.wall(target.wallId)
      throw new Error(elsewhere ? outOfReach(`The wall “${target.wallId}”`, elsewhere.room) : `There is no wall “${target.wallId}”; dump_portrait_slots and dump_portraits name walls.`)
    }
    const {x, y} = target.position
    return {
      area: world.portraitArea(wall.id, wall.room),
      frame: work => world.roomById(wall.room)?.frame(environmentSeed, work),
      place(work, portraits) {
        const {width, height} = work
        const position = wallPosition(wall, x, wall.center[1] + x * (wall.slope ?? 0) + y)
        // The placard goes below the frame, or above it where only that fits, as for a work the player hangs, unless it never gets one.
        const sides: ReadonlyArray<PlacardSide> = world.placement.placardOf(work) === 'none' ? ['none'] : ['below', 'above']
        const issue = (placard: PlacardSide) => world.placement.placementIssue(wall, position, width, height, portraits, {placard})
        const placard = sides.find(side => !issue(side))
        if (placard === undefined) {
          throw new Error(`It does not fit there on the wall “${wall.id}”, ${wall.width.toFixed(2)} m wide and ${wall.height.toFixed(2)} m high: it would ${issues[issue(sides[0]) as PlacementIssue]}.`)
        }
        return {
          position,
          rotation: wall.rotation - (wall.curveRadius ? x / wall.curveRadius : 0),
          wallId: wall.id,
          hung: true,
          ...placard === 'above' ? {labelAbove: true} : {},
        }
      },
    }
  }
  const position: Vec3 = [target.position.x, target.position.y, target.position.z]
  const room = world.roomAt(position)
  if (!world.placement.contains(position)) {
    throw new Error(`The position ${position.join(', ')} lies outside of the world.`)
  }
  if (room && !world.reach.covers(room.id)) {
    throw new Error(outOfReach(`The position ${position.join(', ')}`, room.id))
  }
  return {
    area: world.portraitArea(undefined, room?.id ?? ''),
    frame: work => arrivalFrame(position, position, work),
    place: () => ({
      position,
      rotation: 0,
      hung: false,
    }),
  }
}

/**
 * Brings an image or the first frame of a video at the URL `image` into the world as an imported work: hung in a portrait slot in place of the work hanging there, if any, hung on a wall where it fits, or loose at a position; see the `add_portrait` tool.
 */
export default async function addPortrait({canvasMaterial, frame: frameId, hangingAnimation = false, id, image, size, target, title}: PortraitAdditionInput): Promise<PortraitAddition> {
  const destination = findPortraitDestination(target)
  const chosen = frameId === undefined ? undefined : frameIds.find(candidate => candidate === frameId)
  if (frameId !== undefined && !chosen) {
    throw new Error(`There is no frame “${frameId}”. Frames: ${frameIds.join(', ')}.`)
  }
  if (canvasMaterial !== undefined && !isCanvasMaterialId(canvasMaterial)) {
    throw new Error(`There is no canvas material “${canvasMaterial}”. Canvas materials: ${canvasMaterialIds.join(', ')}.`)
  }
  requireFreeId(id, useGallery.getState().portraits)
  const {image: source, width: pixelWidth, height: pixelHeight} = await importedImage(image)
  // It keeps its own aspect at the frame area, as an import keeps the area of the room it hangs in.
  const {width, height} = imageSize(pixelWidth, pixelHeight, size ?? destination.area)
  const {commit, portraits} = useGallery.getState()
  // Again, as another import may have taken the id while this one loaded its image.
  requireFreeId(id, portraits)
  const replaced = destination.replaces && portraits.find(destination.replaces)
  const placed = destination.place({
    width,
    height,
    title,
  }, portraits)
  if (!replaced && portraits.length >= maximumPortraits) {
    throw new Error('The collection is full. Remove a work to make room.')
  }
  const portrait = newPortrait(source, width, height, {
    position: placed.position,
    direction: [0, 0, -1],
  })
  if (id !== undefined) {
    portrait.id = id
  }
  if (title !== undefined) {
    portrait.title = title
  }
  const frame = chosen ?? destination.frame(portrait.id)
  Object.assign(portrait, placed, {frame})
  if (!frame) {
    delete portrait.frame
  }
  if (canvasMaterial) {
    portrait.canvasMaterial ??= canvasMaterial
  }
  commit([...portraits.filter(candidate => candidate !== replaced), portrait])
  if (hangingAnimation && portrait.hung) {
    requestHanging(portrait.id, portrait.position, portrait.rotation)
  }
  return {
    id: portrait.id,
    ...portrait.title === undefined ? {} : {title: portrait.title},
    hung: portrait.hung,
    ...destination.slot === undefined ? {} : {slot: destination.slot},
    ...portrait.wallId === undefined ? {} : {wallId: portrait.wallId},
    ...replaced ? {replaced: replaced.id} : {},
    ...frame ? {frame} : {},
    ...portrait.canvasMaterial ? {canvasMaterial: portrait.canvasMaterial} : {},
    position: portrait.position,
    rotation: portrait.rotation,
    width,
    height,
    size: Math.round(width * height * 10_000),
  }
}

/** Throws unless no work of `portraits` has the id `id`, if any. */
function requireFreeId(id: string | undefined, portraits: ReadonlyArray<Portrait>) {
  if (id !== undefined && portraits.some(candidate => candidate.id === id)) {
    throw new Error(`A work already has the id “${id}”.`)
  }
}
