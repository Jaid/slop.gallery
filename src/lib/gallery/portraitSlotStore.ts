import type {Placement, PortraitRatio, PortraitSlot, Vec3} from './types.ts'

import optis from 'optis'
import readPermalink from 'read-permalink'
import {create} from 'zustand'

import world from '#src/worlds/current.ts'

import {asPortrait, slotArea, slotAreas, slotFrame} from '../placement/portraitSlots.ts'
import {wallPosition} from '../placement/wallGeometry.ts'

const enabledValues = new Set<unknown>([true, '', 'true'])
const flagsSchema = optis({
  defaults: {
    edit_portrait_slots: false,
    show_portrait_slots: false,
  },
  normalizations: {
    edit_portrait_slots(value: unknown) {
      return enabledValues.has(value)
    },
    show_portrait_slots(value: unknown) {
      return enabledValues.has(value)
    },
  },
})

/** Read the `?edit_portrait_slots` flag; a bare `?edit_portrait_slots` counts as enabled. */
export function readPortraitSlotEditing(input: URL | string = typeof location === 'undefined' ? '' : location.href): boolean {
  return readPermalink(input, {schema: flagsSchema}).edit_portrait_slots
}

/** Read the `?show_portrait_slots` flag that marks every portrait slot with its placard; a bare `?show_portrait_slots` counts as enabled. */
export function readShowPortraitSlots(input: URL | string = typeof location === 'undefined' ? '' : location.href): boolean {
  return readPermalink(input, {schema: flagsSchema}).show_portrait_slots
}

/** whether this page was opened with `?edit_portrait_slots`, read once at startup */
export const isEditingPortraitSlots = readPortraitSlotEditing()

/** whether this page shows the portrait slots, read once at startup; editing shows them too */
export const isShowingPortraitSlots = isEditingPortraitSlots || readShowPortraitSlots()

/** the ratios from tallest to widest */
const ratioCycle: ReadonlyArray<PortraitRatio> = ['9:16', '2:3', '1:1', '3:2', '16:9']

type PortraitSlotState = {
  /** the slot under the crosshair while editing */
  aimed: string | null
  /** the slot picked up with the left mouse button, following the crosshair until dropped */
  dragging: string | null
  slots: ReadonlyArray<PortraitSlot>
  /** the ratio, area in cm² and placard side the next new slot gets, following the last edit */
  template: readonly [ratio: PortraitRatio, area: number, labelAbove: boolean]
}

/** The world’s portrait slots: the shipped ones, with `?edit_portrait_slots` as edited on this page. */
export const usePortraitSlots = create<PortraitSlotState>(() => ({
  aimed: null,
  dragging: null,
  template: ['1:1', slotAreas[2], false],
  slots: world.portraitSlots().filter(slot => world.reach.includes(world.placement.wall(slot.wallId)?.room ?? '')),
}))

const nextRatio = (ratio: PortraitRatio, step: -1 | 1) => ratioCycle[(ratioCycle.indexOf(ratio) + step + ratioCycle.length) % ratioCycle.length]
/** Switches the aimed slot, or the preview of a new one, to the previous or next ratio, keeping its area. */
export function cycleSlotRatio(id: string | null, step: -1 | 1) {
  if (!id) {
    usePortraitSlots.setState(({template: [ratio, area, labelAbove]}) => ({template: [nextRatio(ratio, step), area, labelAbove]}))
    return
  }
  replace(id, slot => resized(slot, nextRatio(slot.ratio, step), slotArea(slot)))
}
/** Switches the aimed slot, or the preview of a new one, to the next larger or smaller of the slot areas, wrapping around. */
export function cycleSlotSize(id: string | null, step: -1 | 1) {
  if (!id) {
    usePortraitSlots.setState(({template: [ratio, area, labelAbove]}) => ({template: [ratio, nextArea(area, step), labelAbove]}))
    return
  }
  replace(id, slot => resized(slot, slot.ratio, nextArea(slotArea(slot), step)))
}
/** Moves the placard of the aimed slot, or of the preview of a new one, to the other side of its frame. */
export function flipSlotLabel(id: string | null) {
  if (!id) {
    usePortraitSlots.setState(({template: [ratio, area, labelAbove]}) => ({template: [ratio, area, !labelAbove]}))
    return
  }
  replace(id, ({labelAbove, ...slot}) => (labelAbove ? slot : {
    ...slot,
    labelAbove: true,
  }))
}
export function removeSlot(id: string) {
  usePortraitSlots.setState(state => ({
    slots: state.slots.filter(slot => slot.id !== id),
    aimed: state.aimed === id ? null : state.aimed,
    dragging: state.dragging === id ? null : state.dragging,
  }))
}
/** The slot that X would create where a placement ray meets a wall, shaped like the last edited one. */
export function previewSlot(target: Placement): PortraitSlot {
  const {slots, template} = usePortraitSlots.getState()
  let index = 0
  while (slots.some(slot => slot.id === `${target.wallId}-custom-${index}`)) {
    index++
  }
  return {
    id: `${target.wallId}-custom-${index}`,
    wallId: target.wallId,
    ratio: template[0],
    priority: 0,
    ...slotFrame(template[0], template[1]),
    position: target.position,
    rotation: target.rotation,
    ...template[2] ? {labelAbove: true} : {},
  }
}

/** The dragged slot as it would hang where a placement ray meets a wall, or `null` if nothing is dragged. */
export function draggedSlot(target: Placement): PortraitSlot | null {
  const {dragging, slots} = usePortraitSlots.getState()
  const slot = slots.find(candidate => candidate.id === dragging)
  return slot ? {
    ...slot,
    wallId: target.wallId,
    position: target.position,
    rotation: target.rotation,
  } : null
}
/** Hangs a slot at the place of `moved`, keeping its id. */
export function moveSlot(moved: PortraitSlot) {
  usePortraitSlots.setState(state => ({
    slots: state.slots.map(slot => (slot.id === moved.id ? moved : slot)),
    aimed: moved.id,
    dragging: null,
  }))
}
export function createSlot(slot: PortraitSlot) {
  usePortraitSlots.setState(state => ({
    slots: [...state.slots, slot],
    aimed: slot.id,
  }))
}
/** Why a slot cannot hang where it is among the other slots, or an empty string if it can. */
export function slotIssue(slot: PortraitSlot, slots: ReadonlyArray<PortraitSlot>) {
  const wall = world.placement.wall(slot.wallId)
  if (!wall) {
    return 'unknown wall'
  }
  return world.placement.placementIssue(wall, slot.position, slot.width, slot.height, slots.map(asPortrait), slot.id, slot.labelAbove)
}
/** The slot a ray from the eye first meets, frame or placard, unless a wall is in the way, or `null`. */
export function aimedSlot(origin: Vec3, direction: Vec3, slots: ReadonlyArray<PortraitSlot>) {
  const wallHit = world.placement.findPlacement(origin, direction, 0, 0, [])
  const reach = wallHit ? Math.hypot(...wallHit.position.map((value, index) => value - origin[index])) + 0.05 : Infinity
  let nearest: PortraitSlot | null = null
  let nearestDistance = reach
  for (const slot of slots) {
    const normal = [Math.sin(slot.rotation), 0, Math.cos(slot.rotation)] as const
    const facing = direction[0] * normal[0] + direction[2] * normal[2]
    if (facing > -1e-6) {
      continue
    }
    const distance = ((slot.position[0] - origin[0]) * normal[0] + (slot.position[2] - origin[2]) * normal[2]) / facing
    if (distance <= 0 || distance >= nearestDistance) {
      continue
    }
    const hit = origin.map((value, index) => value + direction[index] * distance)
    const across = (hit[0] - slot.position[0]) * Math.cos(slot.rotation) - (hit[2] - slot.position[2]) * Math.sin(slot.rotation)
    const up = hit[1] - slot.position[1]
    // The placard sits about 0.7 m beyond the frame on its side.
    const [low, high] = slot.labelAbove ? [-slot.height / 2, slot.height / 2 + 0.7] : [-slot.height / 2 - 0.7, slot.height / 2]
    if (!(Math.abs(across) <= slot.width / 2 && up >= low && up <= high)) {
      continue
    }
    nearest = slot
    nearestDistance = distance
  }
  return nearest
}

/** The point on the wall where a new slot would go, for a ray from the eye. */
export function slotTarget(origin: Vec3, direction: Vec3) {
  const target = world.placement.findPlacement(origin, direction, 0, 0, [])
  const wall = target && world.placement.wall(target.wallId)
  if (!target || !wall || wall.sticky === false || wall.curveRadius) {
    return null
  }
  return {
    ...target,
    // Snapped onto the hanging plane, in case the ray stopped at glass in front of the wall.
    position: wallPosition(wall, (target.position[0] - wall.center[0]) * Math.cos(wall.rotation) - (target.position[2] - wall.center[2]) * Math.sin(wall.rotation), target.position[1]),
  }
}

/** the next larger or smaller of the slot areas from the one closest in proportion to `area`, wrapping around */
function nextArea(area: number, step: -1 | 1) {
  const distance = (candidate: number) => Math.abs(Math.log(candidate / area))
  const nearest = slotAreas.reduce((best, candidate, index) => (distance(candidate) < distance(slotAreas[best]) ? index : best), 0)
  return slotAreas[(nearest + step + slotAreas.length) % slotAreas.length]
}
/** A slot of this ratio with an area of `area` cm², at the same center. */
function resized(slot: PortraitSlot, ratio: PortraitRatio, area: number): PortraitSlot {
  return {
    ...slot,
    ratio,
    ...slotFrame(ratio, area),
  }
}
function replace(id: string, change: (slot: PortraitSlot) => PortraitSlot) {
  usePortraitSlots.setState(state => {
    const slots = state.slots.map(slot => (slot.id === id ? change(slot) : slot))
    const edited = slots.find(slot => slot.id === id)
    return {
      slots,
      template: edited ? [edited.ratio, slotArea(edited), Boolean(edited.labelAbove)] : state.template,
    }
  })
}
